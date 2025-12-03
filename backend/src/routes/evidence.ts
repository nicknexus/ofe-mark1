import express from 'express';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth';
import { EvidenceService } from '../services/evidenceService';

const router = express.Router();

// Get all evidence
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id, kpi_id } = req.query;
        const evidence = await EvidenceService.getAll(
            initiative_id as string,
            kpi_id as string
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
        const evidence = await EvidenceService.create(req.body, req.user!.id);
        res.status(201).json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence statistics - MUST come before /:id route
router.get('/stats/by-type', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query;
        const stats = await EvidenceService.getEvidenceStats(initiative_id as string);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence linked to a specific data point (KPI update) - MUST come before /:id route
router.get('/for-kpi-update/:updateId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const evidence = await EvidenceService.getEvidenceForUpdate(req.params.updateId, req.user!.id);
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get evidence by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const evidence = await EvidenceService.getById(req.params.id);
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
        const dataPoints = await EvidenceService.getDataPointsForEvidence(req.params.id, req.user!.id);
        res.json(dataPoints);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Get files for a specific evidence
router.get('/:id/files', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const files = await EvidenceService.getFilesForEvidence(req.params.id, req.user!.id);
        res.json(files);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Update evidence
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const evidence = await EvidenceService.update(req.params.id, req.body, req.user!.id);
        res.json(evidence);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Delete evidence
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        await EvidenceService.delete(req.params.id, req.user!.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

export default router; 