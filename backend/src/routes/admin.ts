import { Router } from 'express';
import { supabase } from '../utils/supabase';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin, requireSuperAdmin } from '../middleware/requireAdmin';
import { PlatformAdminService } from '../services/platformAdminService';
import { OrganizationService } from '../services/organizationService';
import { DemoSeedService } from '../services/demoSeedService';
import { DemoGenerationError, DemoGenerationService } from '../services/demoGenerationService';
import { sendEmail } from '../utils/email';
import { recordAdminAction } from '../utils/auditLog';

const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/** Find an auth user by email via the admin API (paginated; schema-independent). */
async function findAuthUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
    const target = email.toLowerCase();
    for (let page = 1; page <= 50; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) return null;
        const users = data?.users ?? [];
        const match = users.find((u) => (u.email ?? '').toLowerCase() === target);
        if (match) return { id: match.id, email: match.email ?? '' };
        if (users.length < 200) break;
    }
    return null;
}

const router = Router();

// ALL routes here require authenticated platform admin
router.use(authenticateUser, requireAdmin);

/**
 * GET /api/admin/demos
 * List all demo organizations (across all admins).
 */
router.get('/demos', async (_req: AuthenticatedRequest, res) => {
    try {
        const { data, error } = await supabase
            .from('organizations')
            .select(
                'id, name, slug, description, statement, logo_url, brand_color, website_url, donation_url, is_public, is_demo, demo_public_share, demo_folder, demo_generation_status, owner_id, created_at, updated_at'
            )
            .eq('is_demo', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('[admin] list demos error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/demos
 * Create a new demo org owned by the requesting admin, then seed it.
 * Body: { name: string; brand_color?: string; description?: string }
 */
router.post('/demos', async (req: AuthenticatedRequest, res) => {
    try {
        const { name, brand_color, description, demo_folder } = req.body || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'name is required' });
            return;
        }

        const userId = req.user!.id;
        const trimmed = name.trim();
        const folder = typeof demo_folder === 'string' && demo_folder.trim() ? demo_folder.trim() : null;

        // Unique slug (demo orgs share the slug namespace with real orgs)
        let baseSlug = OrganizationService.generateSlug(trimmed) || 'demo';
        let slug = baseSlug;
        let attempt = 0;
        while (attempt < 100) {
            const { data: check } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();
            if (!check) break;
            attempt++;
            slug = `${baseSlug}-${attempt}`;
        }

        // Demo orgs are auto-published so they are reachable on /demo/:slug
        // immediately. The is_demo=false filter on every /explore + search
        // query keeps them out of public discovery.
        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .insert([
                {
                    name: trimmed,
                    slug,
                    description: description || null,
                    brand_color: brand_color || null,
                    demo_folder: folder,
                    owner_id: userId,
                    is_public: true,
                    is_demo: true,
                    demo_public_share: true,
                },
            ])
            .select()
            .single();

        if (orgErr || !org) {
            throw new Error(`Failed to create demo org: ${orgErr?.message}`);
        }

        // Link admin to the org in user_organizations for compatibility with
        // existing code that joins via that table.
        try {
            await OrganizationService.addUserToOrganization(userId, org.id, 'owner');
        } catch (e) {
            console.warn('[admin/demos] addUserToOrganization skipped:', (e as Error).message);
        }

        // Seed baseline content
        try {
            const seedResult = await DemoSeedService.seed(org.id, userId);
            console.log('[admin/demos] seeded:', seedResult);
        } catch (seedErr) {
            console.error('[admin/demos] seed failed:', seedErr);
            // Seed failure is not fatal — Liam can still edit the empty org.
        }

        res.status(201).json(org);
    } catch (error) {
        console.error('[admin] create demo error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/demos/generate-from-url
 * Creates a demo org from a public website using Firecrawl + OpenAI.
 * Body: { website_url: string; name?: string }
 */
router.post('/demos/generate-from-url', async (req: AuthenticatedRequest, res) => {
    const startedAt = Date.now();
    const rawUrl = typeof req.body?.website_url === 'string' ? req.body.website_url : '<missing>';
    const rawName = typeof req.body?.name === 'string' ? req.body.name : '';
    console.log(`[admin] [${new Date().toISOString()}] generate-from-url received`, {
        userId: req.user!.id,
        websiteUrl: rawUrl,
        name: rawName || null,
    });
    try {
        const demo = await DemoGenerationService.generateFromWebsite(req.user!.id, {
            website_url: req.body?.website_url,
            name: req.body?.name,
        });
        console.log(`[admin] [${new Date().toISOString()}] generate-from-url ok`, {
            ms: Date.now() - startedAt,
            organizationId: (demo as any)?.id ?? (demo as any)?.organization?.id ?? null,
        });
        res.status(201).json(demo);
    } catch (error) {
        console.error(`[admin] [${new Date().toISOString()}] generate-from-url FAILED`, {
            ms: Date.now() - startedAt,
            websiteUrl: rawUrl,
            code: error instanceof DemoGenerationError ? error.code : 'unknown',
            status: error instanceof DemoGenerationError ? error.status : 500,
            message: error instanceof Error ? error.message : String(error),
        });
        if (error instanceof DemoGenerationError) {
            res.status(error.status).json({
                error: error.publicMessage,
                code: error.code,
            });
            return;
        }
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/demos/shell
 * Creates a lightweight demo org "shell" (no seeded content) and returns it
 * immediately. Used so a demo (and its folder) exists instantly before the
 * slow website generation runs. Marked demo_generation_status='generating' so
 * the UI can show a spinner; the caller then hits /demos/:id/generate.
 * Body: { name: string; demo_folder?: string; website_url?: string; brand_color?: string }
 */
router.post('/demos/shell', async (req: AuthenticatedRequest, res) => {
    try {
        const { name, demo_folder, website_url, brand_color } = req.body || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'name is required' });
            return;
        }

        const userId = req.user!.id;
        const trimmed = name.trim();
        const folder = typeof demo_folder === 'string' && demo_folder.trim() ? demo_folder.trim() : null;

        let baseSlug = OrganizationService.generateSlug(trimmed) || 'demo';
        let slug = baseSlug;
        let attempt = 0;
        while (attempt < 100) {
            const { data: check } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();
            if (!check) break;
            attempt++;
            slug = `${baseSlug}-${attempt}`;
        }

        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .insert([
                {
                    name: trimmed,
                    slug,
                    website_url: typeof website_url === 'string' && website_url.trim() ? website_url.trim() : null,
                    brand_color: brand_color || null,
                    demo_folder: folder,
                    owner_id: userId,
                    is_public: true,
                    is_demo: true,
                    demo_public_share: true,
                    demo_generation_status: 'draft',
                },
            ])
            .select()
            .single();

        if (orgErr || !org) {
            throw new Error(`Failed to create demo shell: ${orgErr?.message}`);
        }

        try {
            await OrganizationService.addUserToOrganization(userId, org.id, 'owner');
        } catch (e) {
            console.warn('[admin/demos/shell] addUserToOrganization skipped:', (e as Error).message);
        }

        res.status(201).json(org);
    } catch (error) {
        console.error('[admin] create demo shell error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/demos/:id/generate
 * Runs website generation INTO an existing demo shell. On success the org is
 * populated and marked 'ready'; on failure it is marked 'failed' but kept so
 * the admin can retry or edit it manually.
 * Body: { website_url: string; name?: string }
 */
router.post('/demos/:id/generate', async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;
    try {
        const { data: existing, error: findErr } = await supabase
            .from('organizations')
            .select('id, is_demo')
            .eq('id', id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing || !existing.is_demo) {
            res.status(404).json({ error: 'Demo org not found' });
            return;
        }

        // Atomically claim the generation slot: flip to 'generating' only if a
        // run isn't already in flight. Two concurrent generates on the same shell
        // would otherwise race in populateExistingDemo (one's clearGeneratedContent
        // deletes the other's freshly-inserted kpis → kpi_updates FK violation).
        const { data: claimed } = await supabase
            .from('organizations')
            .update({ demo_generation_status: 'generating' })
            .eq('id', id)
            .neq('demo_generation_status', 'generating')
            .select('id')
            .maybeSingle();
        if (!claimed) {
            res.status(409).json({
                error: 'A generation is already in progress for this demo.',
                code: 'generation_in_progress',
            });
            return;
        }

        try {
            await DemoGenerationService.generateFromWebsite(
                req.user!.id,
                { website_url: req.body?.website_url, name: req.body?.name },
                id
            );
        } catch (genErr) {
            await supabase
                .from('organizations')
                .update({ demo_generation_status: 'failed' })
                .eq('id', id);
            if (genErr instanceof DemoGenerationError) {
                res.status(genErr.status).json({ error: genErr.publicMessage, code: genErr.code });
                return;
            }
            throw genErr;
        }

        const { data: org, error } = await supabase
            .from('organizations')
            .update({ demo_generation_status: 'ready' })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json(org);
    } catch (error) {
        console.error('[admin] generate into demo error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * PATCH /api/admin/demos/:id
 * Allowed fields: name, description, statement, brand_color, logo_url,
 * website_url, donation_url, demo_public_share.
 * Slug is regenerated if name changes.
 */
router.patch('/demos/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;

        // Verify target is a demo org
        const { data: existing, error: findErr } = await supabase
            .from('organizations')
            .select('id, is_demo, slug')
            .eq('id', id)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!existing || !existing.is_demo) {
            res.status(404).json({ error: 'Demo org not found' });
            return;
        }

        const allowed = [
            'name',
            'description',
            'statement',
            'brand_color',
            'logo_url',
            'website_url',
            'donation_url',
            'demo_public_share',
            'demo_folder',
        ] as const;

        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in req.body) updates[key] = req.body[key];
        }

        // Mirror demo_public_share into is_public so that the existing
        // public-facing queries (which all filter by is_public=true) start
        // returning this demo orgs content. Demo orgs are still filtered
        // OUT of /explore + search by an is_demo=false guard.
        if ('demo_public_share' in updates) {
            updates.is_public = !!updates.demo_public_share;
        }

        // Regenerate slug if name changed
        if (updates.name && typeof updates.name === 'string') {
            let baseSlug = OrganizationService.generateSlug(updates.name) || 'demo';
            let slug = baseSlug;
            let attempt = 0;
            while (attempt < 100) {
                const { data: check } = await supabase
                    .from('organizations')
                    .select('id')
                    .eq('slug', slug)
                    .neq('id', id)
                    .maybeSingle();
                if (!check) break;
                attempt++;
                slug = `${baseSlug}-${attempt}`;
            }
            updates.slug = slug;
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid fields to update' });
            return;
        }

        const { data, error } = await supabase
            .from('organizations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('[admin] patch demo error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/admin/demos/:id
 * Hard-deletes the demo org. FKs cascade to initiatives / KPIs / stories / etc.
 */
router.delete('/demos/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;

        // Safety: only allow deletion of is_demo=true orgs through this route
        const { data: existing } = await supabase
            .from('organizations')
            .select('id, is_demo')
            .eq('id', id)
            .maybeSingle();
        if (!existing || !existing.is_demo) {
            res.status(404).json({ error: 'Demo org not found' });
            return;
        }

        const { error } = await supabase.from('organizations').delete().eq('id', id);
        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error('[admin] delete demo error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/demos/:id/clone
 * Duplicates an existing demo org along with its initiatives,
 * KPIs + updates, locations, beneficiary groups, and stories.
 * Does NOT clone evidence files, donors, or team members.
 */
router.post('/demos/:id/clone', async (req: AuthenticatedRequest, res) => {
    try {
        const sourceId = req.params.id;
        const userId = req.user!.id;
        const cloneName: string | undefined = req.body?.name;

        const { data: source, error: findErr } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', sourceId)
            .maybeSingle();
        if (findErr) throw findErr;
        if (!source || !source.is_demo) {
            res.status(404).json({ error: 'Demo org not found' });
            return;
        }

        const newName = (cloneName && cloneName.trim()) || `${source.name} (copy)`;
        let baseSlug = OrganizationService.generateSlug(newName) || 'demo';
        let slug = baseSlug;
        let attempt = 0;
        while (attempt < 100) {
            const { data: check } = await supabase
                .from('organizations')
                .select('id')
                .eq('slug', slug)
                .maybeSingle();
            if (!check) break;
            attempt++;
            slug = `${baseSlug}-${attempt}`;
        }

        const { data: newOrg, error: orgErr } = await supabase
            .from('organizations')
            .insert([
                {
                    name: newName,
                    slug,
                    description: source.description,
                    statement: source.statement,
                    logo_url: source.logo_url,
                    brand_color: source.brand_color,
                    website_url: source.website_url,
                    donation_url: source.donation_url,
                    owner_id: userId,
                    is_public: true,
                    is_demo: true,
                    demo_public_share: true,
                },
            ])
            .select()
            .single();

        if (orgErr || !newOrg) throw new Error(orgErr?.message || 'Failed to create clone');

        try {
            await OrganizationService.addUserToOrganization(userId, newOrg.id, 'owner');
        } catch (e) {
            console.warn('[admin/clone] addUserToOrganization skipped:', (e as Error).message);
        }

        // ---- Clone initiatives (and their children) ----
        const { data: sourceInitiatives } = await supabase
            .from('initiatives')
            .select('*')
            .eq('organization_id', sourceId);

        const initiativeIdMap = new Map<string, string>();
        const locationIdMap = new Map<string, string>();
        const kpiIdMap = new Map<string, string>();
        const kpiUpdateIdMap = new Map<string, string>();
        const benIdMap = new Map<string, string>();

        const linkLocationToInitiative = async (locationId: string, initiativeId: string) => {
            const { error } = await supabase
                .from('initiative_locations')
                .upsert(
                    [{ initiative_id: initiativeId, location_id: locationId }],
                    { onConflict: 'initiative_id,location_id', ignoreDuplicates: true }
                );
            if (error) {
                console.warn('[clone] initiative_locations link skipped:', error.message);
            }
        };

        const cloneLocationForInitiative = async (sourceLocationId: string, newInitiativeId: string): Promise<string | null> => {
            const existing = locationIdMap.get(sourceLocationId);
            if (existing) {
                await linkLocationToInitiative(existing, newInitiativeId);
                return existing;
            }

            const { data: loc, error: locFetchErr } = await supabase
                .from('locations')
                .select('*')
                .eq('id', sourceLocationId)
                .maybeSingle();
            if (locFetchErr || !loc) {
                console.warn('[clone] source location missing:', locFetchErr?.message || sourceLocationId);
                return null;
            }

            const {
                id: _lid,
                organization_id: _lo,
                initiative_id: _li,
                created_at: _lc,
                updated_at: _lu,
                ...locFields
            } = loc;

            const { data: newLoc, error: locErr } = await supabase
                .from('locations')
                .insert([
                    {
                        ...locFields,
                        organization_id: newOrg.id,
                        initiative_id: newInitiativeId,
                        user_id: userId,
                    },
                ])
                .select()
                .single();
            if (locErr || !newLoc) {
                console.warn('[clone] location failed:', locErr?.message);
                return null;
            }

            locationIdMap.set(sourceLocationId, newLoc.id);
            await linkLocationToInitiative(newLoc.id, newInitiativeId);
            return newLoc.id;
        };

        for (const srcInit of sourceInitiatives || []) {
            const { id: _oldId, organization_id: _o, slug: srcSlug, created_at: _c, updated_at: _u, ...initFields } = srcInit;

            // The legacy `unique_slug` constraint on initiatives is GLOBAL,
            // so we always generate a fresh suffix for the clone.
            const rand = Math.random().toString(36).slice(2, 8);
            const cloneSlug = `${(srcSlug as string) || 'initiative'}-${rand}`;

            const { data: newInit, error: initErr } = await supabase
                .from('initiatives')
                .insert([{ ...initFields, slug: cloneSlug, organization_id: newOrg.id, user_id: userId }])
                .select()
                .single();
            if (initErr || !newInit) {
                console.error('[clone] initiative failed:', initErr?.message);
                continue;
            }
            initiativeIdMap.set(srcInit.id, newInit.id);

            // Locations linked through the current org-global junction table,
            // with the legacy initiative_id path as a fallback for older rows.
            const linkedLocationIds = new Set<string>();
            const { data: srcLocLinks } = await supabase
                .from('initiative_locations')
                .select('location_id')
                .eq('initiative_id', srcInit.id);
            for (const link of srcLocLinks || []) {
                if (link.location_id) linkedLocationIds.add(link.location_id);
            }
            const { data: legacyLocs } = await supabase
                .from('locations')
                .select('id')
                .eq('initiative_id', srcInit.id);
            for (const loc of legacyLocs || []) {
                if (loc.id) linkedLocationIds.add(loc.id);
            }
            for (const locationId of linkedLocationIds) {
                await cloneLocationForInitiative(locationId, newInit.id);
            }

            const sourceUpdateIdsForInit: string[] = [];

            // KPIs
            const { data: srcKpis } = await supabase
                .from('kpis')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const kpi of srcKpis || []) {
                const { id: _kid, initiative_id: _ki, created_at: _kc, updated_at: _ku, ...kpiFields } = kpi;
                const { data: newKpi, error: kpiErr } = await supabase
                    .from('kpis')
                    .insert([{ ...kpiFields, initiative_id: newInit.id, user_id: userId }])
                    .select()
                    .single();
                if (kpiErr || !newKpi) continue;
                kpiIdMap.set(kpi.id, newKpi.id);

                const { data: srcUpdates } = await supabase
                    .from('kpi_updates')
                    .select('*')
                    .eq('kpi_id', kpi.id);
                for (const u of srcUpdates || []) {
                    const { id: oldUpdateId, kpi_id: _k, created_at: _uc, updated_at: _uu, location_id, ...rest } = u;
                    const mappedLocationId = location_id
                        ? await cloneLocationForInitiative(location_id, newInit.id)
                        : null;
                    const { data: newUpdate, error: updateErr } = await supabase
                        .from('kpi_updates')
                        .insert([
                            {
                                ...rest,
                                kpi_id: newKpi.id,
                                user_id: userId,
                                location_id: mappedLocationId,
                            },
                        ])
                        .select()
                        .single();
                    if (updateErr || !newUpdate) {
                        console.warn('[clone] kpi_update failed:', updateErr?.message);
                        continue;
                    }
                    kpiUpdateIdMap.set(oldUpdateId, newUpdate.id);
                    sourceUpdateIdsForInit.push(oldUpdateId);
                }
            }

            // Beneficiary groups
            const { data: srcBens } = await supabase
                .from('beneficiary_groups')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const ben of srcBens || []) {
                const { id: _bid, initiative_id: _bi, created_at: _bc, updated_at: _bu, location_id, ...benFields } = ben;
                const mappedBenLocationId = location_id
                    ? await cloneLocationForInitiative(location_id, newInit.id)
                    : null;
                const { data: newBen, error: benErr } = await supabase
                    .from('beneficiary_groups')
                    .insert([
                        {
                            ...benFields,
                            initiative_id: newInit.id,
                            user_id: userId,
                            location_id: mappedBenLocationId,
                        },
                    ])
                    .select()
                    .single();
                if (!benErr && newBen) benIdMap.set(ben.id, newBen.id);
            }

            if (sourceUpdateIdsForInit.length > 0) {
                const { data: srcUpdateLinks } = await supabase
                    .from('kpi_update_beneficiary_groups')
                    .select('*')
                    .in('kpi_update_id', sourceUpdateIdsForInit);
                const updateLinks = (srcUpdateLinks || [])
                    .map((link: any) => {
                        const mappedUpdate = kpiUpdateIdMap.get(link.kpi_update_id);
                        const mappedBen = benIdMap.get(link.beneficiary_group_id);
                        if (!mappedUpdate || !mappedBen) return null;
                        return {
                            kpi_update_id: mappedUpdate,
                            beneficiary_group_id: mappedBen,
                            user_id: userId,
                        };
                    })
                    .filter(Boolean);
                if (updateLinks.length > 0) {
                    await supabase.from('kpi_update_beneficiary_groups').insert(updateLinks as any[]);
                }
            }

            // Stories
            const { data: srcStories } = await supabase
                .from('stories')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const story of srcStories || []) {
                const { id: _sid, initiative_id: _si, created_at: _sc, updated_at: _su, location_id, ...storyFields } = story;
                const mappedLegacyLocationId = location_id
                    ? await cloneLocationForInitiative(location_id, newInit.id)
                    : null;
                const { data: newStory, error: storyErr } = await supabase
                    .from('stories')
                    .insert([
                        {
                            ...storyFields,
                            initiative_id: newInit.id,
                            user_id: userId,
                            location_id: mappedLegacyLocationId,
                        },
                    ])
                    .select()
                    .single();
                if (storyErr || !newStory) continue;

                const { data: srcStoryLocs } = await supabase
                    .from('story_locations')
                    .select('*')
                    .eq('story_id', story.id);
                const storyLocationLinks: any[] = [];
                for (const link of srcStoryLocs || []) {
                    const mappedLocation = link.location_id
                        ? await cloneLocationForInitiative(link.location_id, newInit.id)
                        : null;
                    if (mappedLocation) {
                        storyLocationLinks.push({
                            story_id: newStory.id,
                            location_id: mappedLocation,
                            user_id: userId,
                        });
                    }
                }
                if (storyLocationLinks.length === 0 && mappedLegacyLocationId) {
                    storyLocationLinks.push({
                        story_id: newStory.id,
                        location_id: mappedLegacyLocationId,
                        user_id: userId,
                    });
                }
                if (storyLocationLinks.length > 0) {
                    await supabase.from('story_locations').insert(storyLocationLinks);
                }

                // Clone story_beneficiaries links
                const { data: srcLinks } = await supabase
                    .from('story_beneficiaries')
                    .select('*')
                    .eq('story_id', story.id);
                if (srcLinks && srcLinks.length > 0) {
                    const linkInserts = srcLinks
                        .map((l: any) => {
                            const mappedBen = benIdMap.get(l.beneficiary_group_id);
                            if (!mappedBen) return null;
                            return { story_id: newStory.id, beneficiary_group_id: mappedBen };
                        })
                        .filter(Boolean);
                    if (linkInserts.length > 0) {
                        await supabase.from('story_beneficiaries').insert(linkInserts as any[]);
                    }
                }
            }
        }

        // ---- Clone organization_context (1-to-1 with org) ----
        const { data: srcContext } = await supabase
            .from('organization_context')
            .select('*')
            .eq('organization_id', sourceId)
            .maybeSingle();
        if (srcContext) {
            const { id: _cid, organization_id: _oid, created_at: _cc, updated_at: _cu, ...ctxFields } = srcContext;
            await supabase
                .from('organization_context')
                .insert([{ ...ctxFields, organization_id: newOrg.id }]);
        }

        res.status(201).json(newOrg);
    } catch (error) {
        console.error('[admin] clone demo error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/admin/orgs
 * List all real (non-demo) organizations with owner, plan, and usage.
 * Optional ?search= filters by org name or slug (case-insensitive).
 */
router.get('/orgs', async (req: AuthenticatedRequest, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

        let query = supabase
            .from('organizations')
            .select('id, name, slug, is_public, owner_id, created_at')
            .eq('is_demo', false)
            .order('created_at', { ascending: false })
            .limit(500);

        if (search) {
            query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`);
        }

        // Support agents only see the orgs assigned to them; super admins see all.
        const role = await PlatformAdminService.getRole(req.user!.id);
        if (role === 'support') {
            const assigned = await PlatformAdminService.getAssignedOrgIds(req.user!.id);
            if (assigned.length === 0) {
                res.json([]);
                return;
            }
            query = query.in('id', assigned);
        }

        const { data: orgs, error } = await query;
        if (error) throw error;

        const rows = await Promise.all(
            (orgs || []).map(async (org) => {
                // Owner identity
                let owner: { id: string; email?: string; name?: string } = { id: org.owner_id };
                if (org.owner_id) {
                    const { data: u } = await supabase.auth.admin.getUserById(org.owner_id);
                    owner = {
                        id: org.owner_id,
                        email: u?.user?.email,
                        name: u?.user?.user_metadata?.name,
                    };
                }

                // Owner's subscription (limits live here)
                const { data: sub } = await supabase
                    .from('subscriptions')
                    .select('status, plan_tier, team_members_limit, initiatives_limit, trial_ends_at')
                    .eq('user_id', org.owner_id)
                    .maybeSingle();

                // Usage counts
                const [{ count: memberCount }, { count: initiativeCount }] = await Promise.all([
                    supabase
                        .from('team_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('organization_id', org.id),
                    supabase
                        .from('initiatives')
                        .select('*', { count: 'exact', head: true })
                        .eq('organization_id', org.id),
                ]);

                return {
                    id: org.id,
                    name: org.name,
                    slug: org.slug,
                    is_public: org.is_public,
                    created_at: org.created_at,
                    owner,
                    subscription: sub || null,
                    usage: {
                        team_members: memberCount || 0,
                        initiatives: initiativeCount || 0,
                    },
                };
            })
        );

        res.json(rows);
    } catch (error) {
        console.error('[admin] list orgs error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/admin/orgs/:id
 * Single org detail (owner + plan + usage). Used by the support-mode account
 * view so an agent sees the customer owner's details, not their own.
 */
router.get('/orgs/:id', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { data: org, error } = await supabase
            .from('organizations')
            .select('id, name, slug, is_public, owner_id, created_at')
            .eq('id', id)
            .maybeSingle();
        if (error) throw error;
        if (!org) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        let owner: { id: string; email?: string; name?: string } = { id: org.owner_id };
        if (org.owner_id) {
            const { data: u } = await supabase.auth.admin.getUserById(org.owner_id);
            owner = { id: org.owner_id, email: u?.user?.email, name: u?.user?.user_metadata?.name };
        }

        const { data: sub } = await supabase
            .from('subscriptions')
            .select('status, plan_tier, team_members_limit, initiatives_limit, trial_ends_at')
            .eq('user_id', org.owner_id)
            .maybeSingle();

        const [{ count: memberCount }, { count: initiativeCount }] = await Promise.all([
            supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('organization_id', org.id),
            supabase.from('initiatives').select('*', { count: 'exact', head: true }).eq('organization_id', org.id),
        ]);

        res.json({
            id: org.id,
            name: org.name,
            slug: org.slug,
            is_public: org.is_public,
            created_at: org.created_at,
            owner,
            subscription: sub || null,
            usage: { team_members: memberCount || 0, initiatives: initiativeCount || 0 },
        });
    } catch (error) {
        console.error('[admin] get org error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * PATCH /api/admin/orgs/:id/limits
 * Adjust an org's quota/date columns on the OWNER's subscription row.
 * Body (all optional): { team_members_limit, initiatives_limit, trial_ends_at }
 * Never touches Stripe / payment data.
 */
router.patch('/orgs/:id/limits', async (req: AuthenticatedRequest, res) => {
    try {
        const { id } = req.params;
        const { team_members_limit, initiatives_limit, trial_ends_at } = req.body || {};

        const { data: org, error: orgErr } = await supabase
            .from('organizations')
            .select('id, owner_id, is_demo')
            .eq('id', id)
            .maybeSingle();
        if (orgErr) throw orgErr;
        if (!org || org.is_demo) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }
        if (!org.owner_id) {
            res.status(400).json({ error: 'Organization has no owner subscription to adjust' });
            return;
        }

        const updates: Record<string, unknown> = {};
        if (team_members_limit !== undefined) {
            if (team_members_limit !== null && (typeof team_members_limit !== 'number' || team_members_limit < 0)) {
                res.status(400).json({ error: 'team_members_limit must be a non-negative number or null' });
                return;
            }
            updates.team_members_limit = team_members_limit;
        }
        if (initiatives_limit !== undefined) {
            if (initiatives_limit !== null && (typeof initiatives_limit !== 'number' || initiatives_limit < 0)) {
                res.status(400).json({ error: 'initiatives_limit must be a non-negative number or null' });
                return;
            }
            updates.initiatives_limit = initiatives_limit;
        }
        if (trial_ends_at !== undefined) {
            updates.trial_ends_at = trial_ends_at; // ISO string or null
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({ error: 'No valid fields to update' });
            return;
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .update(updates)
            .eq('user_id', org.owner_id)
            .select('status, plan_tier, team_members_limit, initiatives_limit, trial_ends_at')
            .maybeSingle();
        if (error) throw error;

        console.log(`[admin] ${req.user!.email} adjusted limits for org ${id}:`, updates);
        await recordAdminAction({
            adminUserId: req.user!.id,
            adminEmail: req.user!.email,
            organizationId: id,
            action: 'limits.update',
            detail: updates,
        });
        res.json(data);
    } catch (error) {
        console.error('[admin] patch org limits error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/admin/me
 * The calling admin's role, so the console can gate super-only sections.
 */
router.get('/me', async (req: AuthenticatedRequest, res) => {
    try {
        const role = await PlatformAdminService.getRole(req.user!.id);
        res.json({ id: req.user!.id, email: req.user!.email, role });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── Support agents (super admins only) ──────────────────────────────────────

/**
 * GET /api/admin/agents
 * List support agents with their assigned orgs.
 */
router.get('/agents', requireSuperAdmin, async (_req: AuthenticatedRequest, res) => {
    try {
        const { data: admins, error } = await supabase
            .from('platform_admins')
            .select('user_id, role')
            .eq('role', 'support');
        if (error) throw error;

        const agents = await Promise.all(
            (admins || []).map(async (a) => {
                const { data: u } = await supabase.auth.admin.getUserById(a.user_id);
                const { data: assigns } = await supabase
                    .from('support_org_assignments')
                    .select('organization_id, organizations(id, name)')
                    .eq('admin_user_id', a.user_id);
                return {
                    user_id: a.user_id,
                    email: u?.user?.email,
                    name: u?.user?.user_metadata?.name,
                    last_sign_in_at: (u?.user as any)?.last_sign_in_at ?? null,
                    orgs: (assigns || []).map((r: any) => ({
                        id: r.organization_id,
                        name: r.organizations?.name ?? '(unknown)',
                    })),
                };
            })
        );
        res.json(agents);
    } catch (error) {
        console.error('[admin] list agents error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/agents
 * Body: { email, mode: 'create' | 'promote' }
 *  - create: provision a new account + email a set-password link.
 *  - promote: turn an existing account into a support agent.
 */
router.post('/agents', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const mode = req.body?.mode === 'promote' ? 'promote' : 'create';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({ error: 'Please provide a valid email address' });
            return;
        }

        let userId: string;
        let setupLink: string | undefined;

        const existing = await findAuthUserByEmail(email);
        if (mode === 'promote') {
            if (!existing) {
                res.status(404).json({ error: 'No account found with that email to promote' });
                return;
            }
            userId = existing.id;
        } else {
            if (existing) {
                res.status(409).json({ error: 'An account with that email already exists. Use “promote” instead.' });
                return;
            }
            const crypto = await import('crypto');
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
                email,
                password: crypto.randomBytes(24).toString('hex'),
                email_confirm: true,
                user_metadata: { must_change_password: true },
            });
            if (createErr || !created?.user) {
                throw new Error(`Failed to create account: ${createErr?.message ?? 'unknown error'}`);
            }
            userId = created.user.id;
            const { data: link } = await supabase.auth.admin.generateLink({
                type: 'recovery',
                email,
                options: { redirectTo: `${APP_URL.replace(/\/+$/, '')}/reset-password` },
            });
            setupLink = (link?.properties as any)?.action_link ?? undefined;
        }

        const { error: upsertErr } = await supabase
            .from('platform_admins')
            .upsert({ user_id: userId, role: 'support' }, { onConflict: 'user_id' });
        if (upsertErr) throw upsertErr;

        await recordAdminAction({
            adminUserId: req.user!.id,
            adminEmail: req.user!.email,
            action: mode === 'promote' ? 'agent.promote' : 'agent.create',
            detail: { email },
        });

        let emailSent = false;
        if (setupLink) {
            const result = await sendEmail({
                to: email,
                subject: 'You have been added as a support agent on Nexus',
                html: `<p>You've been added as a support agent.</p><p>Set your password to get started: <a href="${setupLink}">Set your password</a></p><p>Then sign in at <a href="${APP_URL.replace(/\/+$/, '')}/admin">${APP_URL.replace(/\/+$/, '')}/admin</a>.</p>`,
                text: `You've been added as a support agent. Set your password: ${setupLink}\nThen sign in at ${APP_URL.replace(/\/+$/, '')}/admin`,
            });
            emailSent = result.success;
            console.log(`[admin] support agent set-password link for ${email}: ${setupLink}`);
        }

        res.status(201).json({ user_id: userId, email, mode, emailSent, setupLink: emailSent ? undefined : setupLink });
    } catch (error) {
        console.error('[admin] create agent error:', error);
        res.status(400).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/admin/agents/:userId
 * Revoke a support agent (removes their admin row + all assignments).
 * Refuses to touch a super admin via this route.
 */
router.delete('/agents/:userId', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
        const { userId } = req.params;
        const { data: row } = await supabase
            .from('platform_admins')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();
        if (!row) {
            res.status(404).json({ error: 'Agent not found' });
            return;
        }
        if ((row as any).role !== 'support') {
            res.status(400).json({ error: 'This route only revokes support agents' });
            return;
        }
        await supabase.from('support_org_assignments').delete().eq('admin_user_id', userId);
        await supabase.from('platform_admins').delete().eq('user_id', userId);
        await recordAdminAction({
            adminUserId: req.user!.id,
            adminEmail: req.user!.email,
            action: 'agent.revoke',
            detail: { revoked_user_id: userId },
        });
        res.status(204).send();
    } catch (error) {
        console.error('[admin] revoke agent error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/admin/agents/:userId/orgs   Body: { organization_id }
 * Assign an org to a support agent.
 */
router.post('/agents/:userId/orgs', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
        const { userId } = req.params;
        const organization_id = req.body?.organization_id;
        if (!organization_id) {
            res.status(400).json({ error: 'organization_id is required' });
            return;
        }
        const { error } = await supabase
            .from('support_org_assignments')
            .upsert(
                { admin_user_id: userId, organization_id, granted_by: req.user!.id },
                { onConflict: 'admin_user_id,organization_id', ignoreDuplicates: true }
            );
        if (error) throw error;
        res.status(201).json({ success: true });
    } catch (error) {
        console.error('[admin] assign org error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * DELETE /api/admin/agents/:userId/orgs/:orgId
 * Unassign an org from a support agent.
 */
router.delete('/agents/:userId/orgs/:orgId', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
    try {
        const { userId, orgId } = req.params;
        const { error } = await supabase
            .from('support_org_assignments')
            .delete()
            .eq('admin_user_id', userId)
            .eq('organization_id', orgId);
        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error('[admin] unassign org error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ─── Audit log ───────────────────────────────────────────────────────────────

/**
 * POST /api/admin/audit/support-session   Body: { organization_id }
 * Records that an admin entered support mode for an org. Called by the console
 * when "Open" is clicked. Requires the caller to be allowed to access the org.
 */
router.post('/audit/support-session', async (req: AuthenticatedRequest, res) => {
    try {
        const organization_id = req.body?.organization_id;
        if (!organization_id) {
            res.status(400).json({ error: 'organization_id is required' });
            return;
        }
        if (!(await PlatformAdminService.canAccessOrg(req.user!.id, organization_id))) {
            res.status(403).json({ error: 'Not allowed to support this organization' });
            return;
        }
        await recordAdminAction({
            adminUserId: req.user!.id,
            adminEmail: req.user!.email,
            organizationId: organization_id,
            action: 'support.enter',
        });
        res.status(201).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/admin/audit
 * Recent admin actions. Super admins see everything; support agents see only
 * their own actions.
 */
router.get('/audit', async (req: AuthenticatedRequest, res) => {
    try {
        let query = supabase
            .from('admin_audit_log')
            .select('id, admin_user_id, admin_email, organization_id, action, detail, created_at')
            .order('created_at', { ascending: false })
            .limit(200);

        if (!(await PlatformAdminService.isSuperAdmin(req.user!.id))) {
            query = query.eq('admin_user_id', req.user!.id);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Decorate with org names for readability.
        const orgIds = Array.from(new Set((data || []).map((r) => r.organization_id).filter(Boolean))) as string[];
        const orgNames = new Map<string, string>();
        if (orgIds.length > 0) {
            const { data: orgs } = await supabase.from('organizations').select('id, name').in('id', orgIds);
            for (const o of orgs || []) orgNames.set(o.id, o.name);
        }

        res.json(
            (data || []).map((r) => ({
                ...r,
                organization_name: r.organization_id ? orgNames.get(r.organization_id) ?? null : null,
            }))
        );
    } catch (error) {
        console.error('[admin] list audit error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
