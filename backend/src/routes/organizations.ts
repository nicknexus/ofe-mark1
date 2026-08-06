import { Router } from 'express';
import { OrganizationService } from '../services/organizationService';
import { OrganizationContextService } from '../services/organizationContextService';
import { SubscriptionService } from '../services/subscriptionService';
import { TeamService } from '../services/teamService';
import { PublicService } from '../services/publicService';
import { EntitlementService, stripGatedFields } from '../services/entitlementService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';
import { KPIService } from '../services/kpiService';
import { MetricDefinitionService } from '../services/metricDefinitionService';
import { upload } from '../utils/fileUpload';
import { compressImage, isCompressibleImage } from '../utils/imageCompression';
import path from 'path';

const router = Router();

// ===== PUBLIC ROUTES (No authentication required) =====
// IMPORTANT: More specific routes must come BEFORE parameterized routes

// Get all public organizations (for homepage browse)
router.get('/public', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('is_public', true)
            .eq('is_demo', false)
            .order('name', { ascending: true })
            .limit(100);

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Search public organizations (must come BEFORE /public/:slug)
router.get('/public/search', async (req, res) => {
    try {
        const query = req.query.q as string || '';
        if (!query.trim()) {
            res.json([]);
            return;
        }

        const organizations = await OrganizationService.searchPublic(query);
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization by slug (public page) - must come AFTER /public/search
router.get('/public/:slug', async (req, res) => {
    try {
        const organization = await OrganizationService.getBySlug(req.params.slug);
        if (!organization) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        // Get all initiatives for this public organization
        // If org is public, all its initiatives are visible
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('*')
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false });

        res.json({
            organization,
            initiatives: initiatives || []
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ===== AUTHENTICATED ROUTES =====

// Embed-widget preview data.
//
// The widget iframe (/embed/:slug) normally reads the anonymous /api/public
// endpoints, which all require is_public = true. That leaves an org with no
// way to see its own widget before going live. This route serves the SAME
// payload for a caller who already has access to the org, so the Account →
// Embed Widget tab can render a true-to-life preview while the public page
// is still off.
//
// Access is org membership (owner or team member), not admin — the Account
// tab decides who gets to *see* the tab, so that gate can be relaxed without
// touching the server.
//
// Two path segments, so this never collides with the /:id route below.
router.get('/embed-preview/:slug', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { slug } = req.params;

        const { data: org } = await supabase
            .from('organizations')
            .select('id, is_public')
            .eq('slug', slug)
            .maybeSingle();

        if (!org) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        const hasAccess = await TeamService.hasOrgAccess(req.user!.id, org.id);
        if (!hasAccess) {
            res.status(403).json({ error: 'You do not have access to this organization' });
            return;
        }

        const [result, metrics, stories] = await Promise.all([
            PublicService.getOrganizationBySlug(slug, { allowPrivate: true }),
            PublicService.getOrganizationMetrics(slug, { allowPrivate: true }),
            PublicService.getOrganizationStories(slug, 6, { allowPrivate: true }),
        ]);

        if (!result) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        // Apply the same plan-gated field stripping the anonymous routes do,
        // so the preview matches what donors would actually be served.
        const ent = await EntitlementService.getForOrg(org.id);
        res.json({
            organization: result.organization,
            stats: result.stats,
            metrics: stripGatedFields(metrics, ent.features),
            stories: stripGatedFields(stories, ent.features),
            is_public: !!org.is_public,
        });
    } catch (error) {
        console.error('Embed preview error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Preview of the org-global metric page for a member of the org. Mirrors the
// anonymous /public route with the is_public gate lifted, so the whole public
// surface stays testable inside a private org.
router.get('/metric-preview/:slug/:metricSlug', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { slug, metricSlug } = req.params;

        const { data: org } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();

        if (!org) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        const hasAccess = await TeamService.hasOrgAccess(req.user!.id, org.id);
        if (!hasAccess) {
            res.status(403).json({ error: 'You do not have access to this organization' });
            return;
        }

        const metric = await MetricDefinitionService.getPublicBySlug(slug, metricSlug, true);
        if (!metric) {
            res.status(404).json({ error: 'Metric not found' });
            return;
        }

        const ent = await EntitlementService.getForOrg(org.id);
        res.json(stripGatedFields(metric, ent.features));
    } catch (error) {
        console.error('Metric preview error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get user's organizations
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const organizations = await OrganizationService.getUserOrganizations(req.user!.id);
        res.json(organizations);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create organization for existing user (for users who signed up without one)
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { name } = req.body;
        const userId = req.user!.id;

        if (!name || name.trim() === '') {
            res.status(400).json({ error: 'Organization name is required' });
            return;
        }

        // Check if user already owns an organization
        const existingOrg = await TeamService.getUserOwnedOrganization(userId);
        if (existingOrg) {
            res.status(400).json({ error: 'You already have an organization' });
            return;
        }

        // Create the organization
        const organization = await OrganizationService.findOrCreate(name.trim(), userId);
        if (!organization) {
            res.status(500).json({ error: 'Failed to create organization' });
            return;
        }

        // Create subscription record with status 'none' (user needs to activate trial)
        try {
            await SubscriptionService.getOrCreate(userId, organization.id);
        } catch (subError) {
            console.error('Failed to create subscription record:', subError);
            // Non-fatal
        }

        // Update user metadata to include organization
        await supabase.auth.admin.updateUserById(userId, {
            user_metadata: { organization: name.trim() }
        });

        res.status(201).json({
            organization,
            message: 'Organization created successfully!'
        });
    } catch (error) {
        console.error('Create organization error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization by ID (authenticated)
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const organization = await OrganizationService.getById(req.params.id, req.user!.id);
        if (!organization) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }
        res.json(organization);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update organization
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const organization = await OrganizationService.update(req.params.id, req.body, req.user!.id);
        res.json(organization);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Upload organization logo
router.post('/:id/logo', authenticateUser, upload.single('logo'), async (req: AuthenticatedRequest, res) => {
    console.log('[Logo Upload] Starting logo upload for org:', req.params.id);
    console.log('[Logo Upload] File received:', req.file ? { name: req.file.originalname, size: req.file.size, type: req.file.mimetype } : 'NO FILE');

    try {
        if (!req.file) {
            console.log('[Logo Upload] ERROR: No file uploaded');
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        const userId = req.user!.id;
        const orgId = req.params.id;

        // Verify user owns this specific organization (supports multi-org owners, e.g. admins with demo orgs)
        const isOwner = await TeamService.isUserOwnerOfOrganization(userId, orgId);
        if (!isOwner) {
            res.status(403).json({ error: 'Only the organization owner can update the logo' });
            return;
        }

        // Fetch current logo_url so we can clean it up after replacement
        const { data: ownedOrg } = await supabase
            .from('organizations')
            .select('logo_url')
            .eq('id', orgId)
            .maybeSingle();

        // Compress image if needed
        let finalBuffer = req.file.buffer;
        let finalMimetype = req.file.mimetype;
        let finalSize = req.file.size;

        if (isCompressibleImage(req.file.mimetype)) {
            const compressionResult = await compressImage(
                req.file.buffer,
                req.file.mimetype,
                req.file.size
            );
            finalBuffer = compressionResult.buffer;
            finalMimetype = compressionResult.mimetype;
            finalSize = compressionResult.size;
        }

        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.round(Math.random() * 1E9);
        const ext = path.extname(req.file.originalname);
        const filename = `${timestamp}-${randomId}-logo${ext}`;
        const filePath = `logos/${orgId}/${filename}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('evidence-files')
            .upload(filePath, finalBuffer, {
                contentType: finalMimetype,
                upsert: false
            });

        if (uploadError) {
            console.error('[Logo Upload] Storage upload error:', uploadError);
            res.status(500).json({ error: 'Failed to upload logo' });
            return;
        }

        console.log('[Logo Upload] File uploaded to storage, getting public URL');

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('evidence-files')
            .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
            console.log('[Logo Upload] ERROR: Failed to generate public URL');
            res.status(500).json({ error: 'Failed to generate logo URL' });
            return;
        }

        console.log('[Logo Upload] Public URL:', urlData.publicUrl);

        // Delete old logo if exists
        if (ownedOrg?.logo_url) {
            try {
                const oldUrlParts = ownedOrg.logo_url.split('/evidence-files/');
                if (oldUrlParts.length === 2) {
                    await supabase.storage.from('evidence-files').remove([oldUrlParts[1]]);
                }
            } catch (e) {
                console.warn('[Logo Upload] Failed to delete old logo:', e);
            }
        }

        // Update organization with new logo URL
        console.log('[Logo Upload] Updating organization with logo URL');
        const updatedOrg = await OrganizationService.update(orgId, { logo_url: urlData.publicUrl }, userId);
        console.log('[Logo Upload] Updated org:', updatedOrg?.id, 'logo_url:', updatedOrg?.logo_url);

        res.json({
            success: true,
            logo_url: urlData.publicUrl,
            organization: updatedOrg
        });
        console.log('[Logo Upload] SUCCESS');
    } catch (error) {
        console.error('Logo upload error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete organization logo
router.delete('/:id/logo', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const orgId = req.params.id;

        // Verify user owns this specific organization (supports multi-org owners)
        const isOwner = await TeamService.isUserOwnerOfOrganization(userId, orgId);
        if (!isOwner) {
            res.status(403).json({ error: 'Only the organization owner can delete the logo' });
            return;
        }

        const { data: ownedOrg } = await supabase
            .from('organizations')
            .select('logo_url')
            .eq('id', orgId)
            .maybeSingle();

        // Delete logo from storage if exists
        if (ownedOrg?.logo_url) {
            try {
                const urlParts = ownedOrg.logo_url.split('/evidence-files/');
                if (urlParts.length === 2) {
                    await supabase.storage.from('evidence-files').remove([urlParts[1]]);
                }
            } catch (e) {
                console.warn('Failed to delete logo from storage:', e);
            }
        }

        // Update organization to remove logo URL
        const updatedOrg = await OrganizationService.update(orgId, { logo_url: '' }, userId);

        res.json({
            success: true,
            organization: updatedOrg
        });
    } catch (error) {
        console.error('Logo delete error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization dashboard (initiatives, KPIs, etc.)
router.get('/:id/dashboard', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const organization = await OrganizationService.getById(req.params.id, req.user!.id);
        if (!organization) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }

        // Get initiatives for this organization
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('*')
            .eq('organization_id', organization.id)
            .order('created_at', { ascending: false });

        // Get KPIs for each initiative
        const allKPIs = [];
        if (initiatives && initiatives.length > 0) {
            for (const initiative of initiatives) {
                const kpis = await KPIService.getWithEvidence(req.user!.id, initiative.id);
                allKPIs.push(...kpis);
            }
        }

        res.json({
            organization,
            initiatives: initiatives || [],
            kpis: allKPIs
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// ===== CONTEXT & CHALLENGES =====

// Get org context (owner only)
router.get('/:id/context', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const context = await OrganizationContextService.getForOwner(req.params.id, req.user!.id);
        res.json(context);
    } catch (error) {
        const status = (error as any).status || 500;
        res.status(status).json({ error: (error as Error).message });
    }
});

// Upsert org context (owner only)
router.put('/:id/context', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const {
            featured_video_url,
            problem_statement,
            stats_and_statements,
            theory_of_change,
            theory_of_change_stages,
            strategies,
            additional_info,
        } = req.body || {};
        const context = await OrganizationContextService.upsertForOwner(req.params.id, req.user!.id, {
            featured_video_url,
            problem_statement,
            stats_and_statements: Array.isArray(stats_and_statements) ? stats_and_statements : undefined,
            theory_of_change,
            theory_of_change_stages: Array.isArray(theory_of_change_stages) ? theory_of_change_stages : undefined,
            strategies: Array.isArray(strategies) ? strategies : undefined,
            additional_info,
        });
        res.json(context);
    } catch (error) {
        const status = (error as any).status || 500;
        res.status(status).json({ error: (error as Error).message });
    }
});

export default router;

