import { Router } from 'express';
import { OrganizationService } from '../services/organizationService';
import { SubscriptionService } from '../services/subscriptionService';
import { TeamService } from '../services/teamService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';
import { KPIService } from '../services/kpiService';

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

        // Get public initiatives for this organization
        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('*')
            .eq('organization_id', organization.id)
            .eq('is_public', true)
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

export default router;

