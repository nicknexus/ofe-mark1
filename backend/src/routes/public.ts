import { Router } from 'express';
import { PublicService } from '../services/publicService';

const router = Router();

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
        console.error('Get org initiatives error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's metrics (aggregated from all initiatives)
router.get('/organizations/:slug/metrics', async (req, res) => {
    try {
        const metrics = await PublicService.getOrganizationMetrics(req.params.slug);
        res.json(metrics);
    } catch (error) {
        console.error('Get org metrics error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get organization's stories (aggregated from all initiatives)
router.get('/organizations/:slug/stories', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const stories = await PublicService.getOrganizationStories(req.params.slug, limit);
        res.json(stories);
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

// Get organization's evidence (aggregated from all initiatives)
router.get('/organizations/:slug/evidence', async (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
        const evidence = await PublicService.getOrganizationEvidence(req.params.slug, limit);
        res.json(evidence);
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
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }
        res.json(initiative);
    } catch (error) {
        console.error('Get initiative error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative dashboard (full data for advanced view)
router.get('/initiatives/:orgSlug/:slug/dashboard', async (req, res) => {
    try {
        const dashboard = await PublicService.getInitiativeDashboard(req.params.orgSlug, req.params.slug);
        if (!dashboard) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }
        res.json(dashboard);
    } catch (error) {
        console.error('Get initiative dashboard error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative KPIs with updates
router.get('/initiatives/:orgSlug/:slug/kpis', async (req, res) => {
    try {
        const kpis = await PublicService.getInitiativeKPIs(req.params.orgSlug, req.params.slug);
        res.json(kpis);
    } catch (error) {
        console.error('Get initiative KPIs error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative stories
router.get('/initiatives/:orgSlug/:slug/stories', async (req, res) => {
    try {
        const stories = await PublicService.getInitiativeStories(req.params.orgSlug, req.params.slug);
        res.json(stories);
    } catch (error) {
        console.error('Get initiative stories error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative locations
router.get('/initiatives/:orgSlug/:slug/locations', async (req, res) => {
    try {
        const locations = await PublicService.getInitiativeLocations(req.params.orgSlug, req.params.slug);
        res.json(locations);
    } catch (error) {
        console.error('Get initiative locations error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative evidence
router.get('/initiatives/:orgSlug/:slug/evidence', async (req, res) => {
    try {
        const evidence = await PublicService.getInitiativeEvidence(req.params.orgSlug, req.params.slug);
        res.json(evidence);
    } catch (error) {
        console.error('Get initiative evidence error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative beneficiaries
router.get('/initiatives/:orgSlug/:slug/beneficiaries', async (req, res) => {
    try {
        const beneficiaries = await PublicService.getInitiativeBeneficiaries(req.params.orgSlug, req.params.slug);
        res.json(beneficiaries);
    } catch (error) {
        console.error('Get initiative beneficiaries error:', error);
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
        res.json(metric);
    } catch (error) {
        console.error('Get metric detail error:', error);
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
        res.json(story);
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
        res.json(evidence);
    } catch (error) {
        console.error('Get evidence detail error:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
