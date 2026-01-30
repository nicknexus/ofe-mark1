import { Router } from 'express';
import { OrganizationService } from '../services/organizationService';
import { SubscriptionService } from '../services/subscriptionService';
import { TeamService } from '../services/teamService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';
import { KPIService } from '../services/kpiService';
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

        // Verify user owns this organization
        const ownedOrg = await TeamService.getUserOwnedOrganization(userId);
        if (!ownedOrg || ownedOrg.id !== orgId) {
            res.status(403).json({ error: 'Only the organization owner can update the logo' });
            return;
        }

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
        if (ownedOrg.logo_url) {
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

        // Verify user owns this organization
        const ownedOrg = await TeamService.getUserOwnedOrganization(userId);
        if (!ownedOrg || ownedOrg.id !== orgId) {
            res.status(403).json({ error: 'Only the organization owner can delete the logo' });
            return;
        }

        // Delete logo from storage if exists
        if (ownedOrg.logo_url) {
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

export default router;

