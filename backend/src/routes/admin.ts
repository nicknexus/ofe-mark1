import { Router } from 'express';
import { supabase } from '../utils/supabase';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { OrganizationService } from '../services/organizationService';
import { DemoSeedService } from '../services/demoSeedService';

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
                'id, name, slug, description, statement, logo_url, brand_color, website_url, donation_url, is_public, is_demo, demo_public_share, owner_id, created_at, updated_at'
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
        const { name, brand_color, description } = req.body || {};
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ error: 'name is required' });
            return;
        }

        const userId = req.user!.id;
        const trimmed = name.trim();

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
        const benIdMap = new Map<string, string>();

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

            // Locations
            const { data: srcLocs } = await supabase
                .from('locations')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const loc of srcLocs || []) {
                const { id: _lid, initiative_id: _li, created_at: _lc, updated_at: _lu, ...locFields } = loc;
                const { data: newLoc, error: locErr } = await supabase
                    .from('locations')
                    .insert([{ ...locFields, initiative_id: newInit.id, user_id: userId }])
                    .select()
                    .single();
                if (!locErr && newLoc) locationIdMap.set(loc.id, newLoc.id);
            }

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
                if (srcUpdates && srcUpdates.length > 0) {
                    const inserts = srcUpdates.map((u) => {
                        const { id: _uid, kpi_id: _k, created_at: _uc, updated_at: _uu, location_id, ...rest } = u;
                        return {
                            ...rest,
                            kpi_id: newKpi.id,
                            user_id: userId,
                            location_id: location_id ? locationIdMap.get(location_id) ?? null : null,
                        };
                    });
                    await supabase.from('kpi_updates').insert(inserts);
                }
            }

            // Beneficiary groups
            const { data: srcBens } = await supabase
                .from('beneficiary_groups')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const ben of srcBens || []) {
                const { id: _bid, initiative_id: _bi, created_at: _bc, updated_at: _bu, location_id, ...benFields } = ben;
                const { data: newBen, error: benErr } = await supabase
                    .from('beneficiary_groups')
                    .insert([
                        {
                            ...benFields,
                            initiative_id: newInit.id,
                            user_id: userId,
                            location_id: location_id ? locationIdMap.get(location_id) ?? null : null,
                        },
                    ])
                    .select()
                    .single();
                if (!benErr && newBen) benIdMap.set(ben.id, newBen.id);
            }

            // Stories
            const { data: srcStories } = await supabase
                .from('stories')
                .select('*')
                .eq('initiative_id', srcInit.id);
            for (const story of srcStories || []) {
                const { id: _sid, initiative_id: _si, created_at: _sc, updated_at: _su, location_id, ...storyFields } = story;
                const { data: newStory, error: storyErr } = await supabase
                    .from('stories')
                    .insert([
                        {
                            ...storyFields,
                            initiative_id: newInit.id,
                            user_id: userId,
                            location_id: location_id ? locationIdMap.get(location_id) ?? null : null,
                        },
                    ])
                    .select()
                    .single();
                if (storyErr || !newStory) continue;

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

export default router;
