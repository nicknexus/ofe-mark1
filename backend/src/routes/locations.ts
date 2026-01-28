import { Router } from 'express';
import { LocationService } from '../services/locationService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { requireOwnerPermission } from '../middleware/teamPermissions';
import { supabase } from '../utils/supabase';

const router = Router();

// Get all locations
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        const locations = await LocationService.getAll(req.user!.id, initiative_id as string);
        res.json(locations);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create location
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const location = await LocationService.create(req.body, req.user!.id);
        res.status(201).json(location);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get location by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const location = await LocationService.getById(req.params.id, req.user!.id);
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
        const location = await LocationService.update(req.params.id, req.body, req.user!.id);
        res.json(location);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete location (owner only)
router.delete('/:id', authenticateUser, requireOwnerPermission, async (req: AuthenticatedRequest, res) => {
    try {
        await LocationService.delete(req.params.id, req.user!.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPI updates for a location
router.get('/:id/kpi-updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const updates = await LocationService.getKPIUpdatesByLocation(req.params.id, req.user!.id);
        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get evidence for a location
router.get('/:id/evidence', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const evidence = await LocationService.getEvidenceByLocation(req.params.id, req.user!.id);
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
        
        const updates = order.map((item: { id: string; display_order: number }) => 
            supabase
                .from('locations')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
                .eq('user_id', req.user!.id)
        );
        
        await Promise.all(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

