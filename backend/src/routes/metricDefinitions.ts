import { Router } from 'express';
import { MetricDefinitionService } from '../services/metricDefinitionService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All of the org's global metrics, with per-initiative usage and pooled totals.
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const definitions = await MetricDefinitionService.getAll(req.user!.id, requestedOrgId);
        res.json(definitions);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const definition = await MetricDefinitionService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!definition) {
            res.status(404).json({ error: 'Metric not found' });
            return;
        }
        res.json(definition);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const definition = await MetricDefinitionService.create(req.body, req.user!.id, requestedOrgId);
        res.status(201).json(definition);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const definition = await MetricDefinitionService.update(
            req.params.id,
            req.body,
            req.user!.id,
            requestedOrgId
        );
        res.json(definition);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// Permanent, org-wide delete. Takes every instance and every claim with it —
// removing a metric from a single initiative is the DELETE below, not this.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await MetricDefinitionService.delete(req.params.id, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Add the metric to an initiative (or restore a previously archived instance).
router.post('/:id/initiatives', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const { initiative_id } = req.body;
        if (!initiative_id) {
            res.status(400).json({ error: 'initiative_id is required' });
            return;
        }
        const kpi = await MetricDefinitionService.attachToInitiative(
            req.params.id,
            initiative_id,
            req.user!.id,
            requestedOrgId
        );
        res.status(201).json(kpi);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});

// What a detach would hide — drives the confirmation copy.
router.get('/:id/initiatives/:initiativeId/impact', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const impact = await MetricDefinitionService.getDetachImpact(
            req.params.id,
            req.params.initiativeId,
            req.user!.id,
            requestedOrgId
        );
        res.json(impact);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Remove from one initiative. Archives: claims and evidence links are kept.
router.delete('/:id/initiatives/:initiativeId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await MetricDefinitionService.detachFromInitiative(
            req.params.id,
            req.params.initiativeId,
            req.user!.id,
            requestedOrgId
        );
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;
