import { Router, Response } from 'express';
import { PublicService } from '../services/publicService';
import { OrganizationContextService } from '../services/organizationContextService';
import { EntitlementService, stripGatedFields } from '../services/entitlementService';
import { MetricDefinitionService } from '../services/metricDefinitionService';

const router = Router();

/**
 * Send a public payload with plan-gated fields (tags, beneficiary groups)
 * cosmetically stripped when the org's current plan doesn't include them.
 * No-op for plans with all features — underlying data is never touched.
 */
async function sendPublic(res: Response, orgSlug: string, payload: any): Promise<void> {
    const ent = await EntitlementService.getForOrgSlug(orgSlug);
    res.json(stripGatedFields(payload, ent.features));
}

// ============================================
// SHOWCASE (landing page live feed)
// ============================================

// Global feed of real stories + aggregate stats across all public orgs
router.get('/showcase', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 12, 24);
        const showcase = await PublicService.getShowcase(limit);
        // Cache at the edge/CDN for a few minutes — this data changes slowly.
        res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.json(showcase);
    } catch (error) {
        console.error('Showcase error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================
// SEARCH
// ============================================

// Search organizations, initiatives, and locations
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q as string || '';
        const results = await PublicService.search(query);
        res.json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================
// ORGANIZATIONS
// ============================================

// List all public organizations
router.get('/organizations', async (req, res) => {
    try {
        const organizations = await PublicService.getAllOrganizations();
        res.json(organizations);
    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization by slug with stats
router.get('/organizations/:slug', async (req, res) => {
    try {
        const result = await PublicService.getOrganizationBySlug(req.params.slug);
        if (!result) {
            res.status(404).json({ error: 'Organization not found' });
            return;
        }
        res.json(result);
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's initiatives
router.get('/organizations/:slug/initiatives', async (req, res) => {
    try {
        const initiatives = await PublicService.getOrganizationInitiatives(req.params.slug);
        res.json(initiatives);
    } catch (error) {
        console.error('Get org programs error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's metrics (aggregated from all initiatives)
router.get('/organizations/:slug/metrics', async (req, res) => {
    try {
        const metrics = await PublicService.getOrganizationMetrics(req.params.slug);
        await sendPublic(res, req.params.slug, metrics);
    } catch (error) {
        console.error('Get org metrics error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Org-global metric: pooled total plus the per-initiative breakdown a visitor
// uses to pick which initiative to view it from.
router.get('/organizations/:slug/metric/:metricSlug', async (req, res) => {
    try {
        const metric = await MetricDefinitionService.getPublicBySlug(
            req.params.slug,
            req.params.metricSlug
        );
        if (!metric) {
            res.status(404).json({ error: 'Metric not found' });
            return;
        }
        await sendPublic(res, req.params.slug, metric);
    } catch (error) {
        console.error('Get org metric error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's stories (aggregated from all initiatives)
router.get('/organizations/:slug/stories', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const stories = await PublicService.getOrganizationStories(req.params.slug, limit);
        await sendPublic(res, req.params.slug, stories);
    } catch (error) {
        console.error('Get org stories error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's locations (aggregated from all initiatives)
router.get('/organizations/:slug/locations', async (req, res) => {
    try {
        const locations = await PublicService.getOrganizationLocations(req.params.slug);
        res.json(locations);
    } catch (error) {
        console.error('Get org locations error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's context & challenges (null if not set or org not public)
router.get('/organizations/:slug/context', async (req, res) => {
    try {
        const context = await OrganizationContextService.getPublicBySlug(req.params.slug);
        res.json(context);
    } catch (error) {
        console.error('Get org context error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's tag catalog (org-global, used by all public pages)
router.get('/organizations/:slug/tags', async (req, res) => {
    try {
        const tags = await PublicService.getOrganizationTags(req.params.slug);
        res.json(tags);
    } catch (error) {
        console.error('Get org tags error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's evidence (aggregated from all initiatives)
router.get('/organizations/:slug/evidence', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const evidence = await PublicService.getOrganizationEvidence(req.params.slug, limit);
        await sendPublic(res, req.params.slug, evidence);
    } catch (error) {
        console.error('Get org evidence error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// ============================================
// INITIATIVES (Advanced View)
// ============================================

// Get initiative by org slug + initiative slug
router.get('/initiatives/:orgSlug/:slug', async (req, res) => {
    try {
        const initiative = await PublicService.getInitiativeBySlug(req.params.orgSlug, req.params.slug);
        if (!initiative) {
            res.status(404).json({ error: 'Program not found' });
            return;
        }
        res.json(initiative);
    } catch (error) {
        console.error('Get program error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative dashboard (full data for advanced view)
router.get('/initiatives/:orgSlug/:slug/dashboard', async (req, res) => {
    try {
        const dashboard = await PublicService.getInitiativeDashboard(req.params.orgSlug, req.params.slug);
        if (!dashboard) {
            res.status(404).json({ error: 'Program not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, dashboard);
    } catch (error) {
        console.error('Get program dashboard error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative KPIs with updates
router.get('/initiatives/:orgSlug/:slug/kpis', async (req, res) => {
    try {
        const kpis = await PublicService.getInitiativeKPIs(req.params.orgSlug, req.params.slug);
        await sendPublic(res, req.params.orgSlug, kpis);
    } catch (error) {
        console.error('Get program KPIs error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative stories
router.get('/initiatives/:orgSlug/:slug/stories', async (req, res) => {
    try {
        const stories = await PublicService.getInitiativeStories(req.params.orgSlug, req.params.slug);
        await sendPublic(res, req.params.orgSlug, stories);
    } catch (error) {
        console.error('Get program stories error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative locations
router.get('/initiatives/:orgSlug/:slug/locations', async (req, res) => {
    try {
        const locations = await PublicService.getInitiativeLocations(req.params.orgSlug, req.params.slug);
        res.json(locations);
    } catch (error) {
        console.error('Get program locations error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get location detail (everything linked to a location)
router.get('/initiatives/:orgSlug/:slug/location/:locationId', async (req, res) => {
    try {
        const detail = await PublicService.getLocationDetail(req.params.orgSlug, req.params.slug, req.params.locationId);
        if (!detail) {
            res.status(404).json({ error: 'Location not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, detail);
    } catch (error) {
        console.error('Get location detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative evidence
router.get('/initiatives/:orgSlug/:slug/evidence', async (req, res) => {
    try {
        const evidence = await PublicService.getInitiativeEvidence(req.params.orgSlug, req.params.slug);
        await sendPublic(res, req.params.orgSlug, evidence);
    } catch (error) {
        console.error('Get program evidence error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative beneficiaries
router.get('/initiatives/:orgSlug/:slug/beneficiaries', async (req, res) => {
    try {
        const beneficiaries = await PublicService.getInitiativeBeneficiaries(req.params.orgSlug, req.params.slug);
        res.json(beneficiaries);
    } catch (error) {
        console.error('Get program beneficiaries error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get beneficiary group detail (for Beneficiary Group Detail Page)
router.get('/initiatives/:orgSlug/:initiativeSlug/beneficiary/:groupId', async (req, res) => {
    try {
        const detail = await PublicService.getBeneficiaryGroupDetail(
            req.params.orgSlug,
            req.params.initiativeSlug,
            req.params.groupId
        );
        if (!detail) {
            res.status(404).json({ error: 'Beneficiary group not found' });
            return;
        }
        res.json(detail);
    } catch (error) {
        console.error('Get beneficiary group detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get single metric by slug (for Metric Detail Page)
router.get('/initiatives/:orgSlug/:initiativeSlug/metric/:metricSlug', async (req, res) => {
    try {
        const metric = await PublicService.getMetricBySlug(
            req.params.orgSlug,
            req.params.initiativeSlug,
            req.params.metricSlug
        );
        if (!metric) {
            res.status(404).json({ error: 'Metric not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, metric);
    } catch (error) {
        console.error('Get metric detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get single impact claim by ID (for Impact Claim Detail Page)
router.get('/initiatives/:orgSlug/:initiativeSlug/claim/:claimId', async (req, res) => {
    try {
        const claim = await PublicService.getImpactClaimById(
            req.params.orgSlug,
            req.params.initiativeSlug,
            req.params.claimId
        );
        if (!claim) {
            res.status(404).json({ error: 'Impact claim not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, claim);
    } catch (error) {
        console.error('Get impact claim detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get single story by ID (for Story Detail Page)
router.get('/initiatives/:orgSlug/:initiativeSlug/story/:storyId', async (req, res) => {
    try {
        const story = await PublicService.getStoryById(
            req.params.orgSlug,
            req.params.initiativeSlug,
            req.params.storyId
        );
        if (!story) {
            res.status(404).json({ error: 'Story not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, story);
    } catch (error) {
        console.error('Get story detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get single evidence by ID (for Evidence Detail Page)
router.get('/initiatives/:orgSlug/:initiativeSlug/evidence/:evidenceId', async (req, res) => {
    try {
        const evidence = await PublicService.getEvidenceById(
            req.params.orgSlug,
            req.params.initiativeSlug,
            req.params.evidenceId
        );
        if (!evidence) {
            res.status(404).json({ error: 'Evidence not found' });
            return;
        }
        await sendPublic(res, req.params.orgSlug, evidence);
    } catch (error) {
        console.error('Get evidence detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
