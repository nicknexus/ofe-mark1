import express from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth';
import { EvidenceService } from '../services/evidenceService';

const router = express.Router();

// Get all evidence
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id, kpi_id, beneficiary_group_id } = req.query;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.getAll(
            req.user!.id,
            requestedOrgId,
            initiative_id as string,
            kpi_id as string,
            beneficiary_group_id as string
        );
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Create evidence
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.create(req.body, req.user!.id, requestedOrgId);
        res.status(201).json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Recompute evidence-claim links for the active org under the current
// matching rules (date overlap + location + ben groups + tag). Idempotent —
// safe to call repeatedly. Used to backfill historical data when the rules
// change (e.g. tag-gate rollout) or as a manual "rebuild links" action.
router.post('/backfill-links', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const result = await EvidenceService.backfillLinksForOrg(req.user!.id, requestedOrgId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence statistics - MUST come before /:id route
router.get('/stats/by-type', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        if (!initiative_id) {
            res.status(400).json({ error: 'initiative_id is required' });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const stats = await EvidenceService.getEvidenceStats(
            req.user!.id,
            requestedOrgId,
            initiative_id as string
        );
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence linked to a specific data point (KPI update) - MUST come before /:id route
router.get('/for-kpi-update/:updateId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.getEvidenceForUpdate(
            req.params.updateId,
            req.user!.id,
            requestedOrgId
        );
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!evidence) {
            res.status(404).json({ error: 'Evidence not found' });
            return;
        }
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get data points linked to a specific evidence
router.get('/:id/data-points', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const dataPoints = await EvidenceService.getDataPointsForEvidence(
            req.params.id,
            req.user!.id,
            requestedOrgId
        );
        res.json(dataPoints);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get files for a specific evidence
router.get('/:id/files', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const files = await EvidenceService.getFilesForEvidence(
            req.params.id,
            req.user!.id,
            requestedOrgId
        );
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Update evidence
// Phase 1 (full-access baseline): per-member can_edit_evidence is ignored;
// will be re-introduced in Phase 7.
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.update(req.params.id, req.body, req.user!.id, requestedOrgId);
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Delete evidence
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await EvidenceService.delete(req.params.id, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

export default router; 