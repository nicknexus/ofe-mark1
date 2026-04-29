import { Router } from 'express';
import { LocationService } from '../services/locationService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { supabase } from '../utils/supabase';

const router = Router();

// Get all locations
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const locations = await LocationService.getAll(req.user!.id, initiative_id as string, requestedOrgId);
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create location
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const location = await LocationService.create(req.body, req.user!.id, requestedOrgId);
        res.status(201).json(location);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get location by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const location = await LocationService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!location) {
            res.status(404).json({ error: 'Location not found' });
            return;
        }
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update location
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const location = await LocationService.update(req.params.id, req.body, req.user!.id, requestedOrgId);
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete location
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await LocationService.delete(req.params.id, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPI updates for a location
router.get('/:id/kpi-updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const updates = await LocationService.getKPIUpdatesByLocation(req.params.id, req.user!.id, requestedOrgId);
        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get evidence for a location
router.get('/:id/evidence', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await LocationService.getEvidenceByLocation(req.params.id, req.user!.id, requestedOrgId);
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update display order for multiple locations
router.post('/update-order', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { order } = req.body; // Array of { id: string, display_order: number }
        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Order must be an array' });
            return;
        }

        // Validate access org-scoped (teammates can reorder), then update
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const allowedIds: string[] = [];
        for (const item of order as { id: string; display_order: number }[]) {
            const loc = await LocationService.getById(item.id, req.user!.id, requestedOrgId);
            if (loc) allowedIds.push(item.id);
        }

        const updates = (order as { id: string; display_order: number }[])
            .filter(item => allowedIds.includes(item.id))
            .map(item =>
                supabase
                    .from('locations')
                    .update({ display_order: item.display_order })
                    .eq('id', item.id)
            );

        await Promise.all(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Link a location to an initiative (adds it to that initiative's locations tab)
router.post('/:id/link', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.body || {};
        if (!initiative_id) {
            res.status(400).json({ error: 'initiative_id is required' });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await LocationService.linkToInitiative(req.params.id, initiative_id, req.user!.id, requestedOrgId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Unlink a location from an initiative (removes it from that initiative's tab,
// but leaves the global location and any entity references intact)
router.delete('/:id/link/:initiativeId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await LocationService.unlinkFromInitiative(req.params.id, req.params.initiativeId, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

