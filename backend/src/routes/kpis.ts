import { Router } from 'express';
import { KPIService } from '../services/kpiService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all KPIs
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const kpis = await KPIService.getAll(req.user!.id, initiative_id as string, requestedOrgId);
        res.json(kpis);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPIs with evidence stats
router.get('/with-evidence', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const kpis = await KPIService.getWithEvidence(req.user!.id, initiative_id as string, requestedOrgId);
        res.json(kpis);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create KPI
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const kpi = await KPIService.create(req.body, req.user!.id, requestedOrgId);
        res.status(201).json(kpi);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPI by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const kpi = await KPIService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!kpi) {
            res.status(404).json({ error: 'KPI not found' });
            return;
        }
        res.json(kpi);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update KPI
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const kpi = await KPIService.update(req.params.id, req.body, req.user!.id, requestedOrgId);
        res.json(kpi);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete KPI
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await KPIService.delete(req.params.id, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPI updates
router.get('/:id/updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const updates = await KPIService.getUpdates(req.params.id, req.user!.id, requestedOrgId);
        res.json(updates);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Add KPI update
router.post('/:id/updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const update = await KPIService.addUpdate({
            ...req.body,
            kpi_id: req.params.id
        }, req.user!.id, requestedOrgId);
        res.status(201).json(update);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update a KPI update
router.put('/updates/:updateId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const update = await KPIService.updateKPIUpdate(req.params.updateId, req.body, req.user!.id, requestedOrgId);
        res.json(update);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete KPI update
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/updates/:updateId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await KPIService.deleteUpdate(req.params.updateId, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get KPI evidence grouped by dates
router.get('/:id/evidence-by-dates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const evidenceByDates = await KPIService.getEvidenceByDates(req.params.id, req.user!.id);
        res.json(evidenceByDates);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update display order for multiple KPIs
// Authorizes each KPI via the user's org context (KPIService.getById).
router.post('/update-order', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { order } = req.body; // Array of { id: string, display_order: number }
        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Order must be an array' });
            return;
        }

        const { supabase } = require('../utils/supabase');
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;

        await Promise.all(
            order.map(async (item: { id: string; display_order: number }) => {
                const kpi = await KPIService.getById(item.id, req.user!.id, requestedOrgId);
                if (!kpi) throw new Error(`KPI not found or access denied: ${item.id}`);
            })
        );

        const updates = order.map((item: { id: string; display_order: number }) =>
            supabase
                .from('kpis')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
        );

        await Promise.all(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
