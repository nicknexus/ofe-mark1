import { Router } from 'express';
import { InitiativeService } from '../services/initiativeService';
import { KPIService } from '../services/kpiService';
import { EvidenceService } from '../services/evidenceService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all initiatives
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const initiatives = await InitiativeService.getAll(req.user!.id);
        res.json(initiatives);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create initiative
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const initiative = await InitiativeService.create(req.body, req.user!.id);
        res.status(201).json(initiative);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const initiative = await InitiativeService.getById(req.params.id, req.user!.id);
        if (!initiative) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }
        res.json(initiative);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update initiative
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const initiative = await InitiativeService.update(req.params.id, req.body, req.user!.id);
        res.json(initiative);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete initiative
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        await InitiativeService.delete(req.params.id, req.user!.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative dashboard (KPIs with evidence stats)
router.get('/:id/dashboard', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const [initiative, kpis, evidenceStats] = await Promise.all([
            InitiativeService.getById(req.params.id, req.user!.id),
            KPIService.getWithEvidence(req.user!.id, req.params.id),
            EvidenceService.getEvidenceStats(req.params.id)
        ]);

        if (!initiative) {
            res.status(404).json({ error: 'Initiative not found' });
            return;
        }

        const totalKPIs = kpis.length;
        const kpisWithEvidence = kpis.filter(kpi => kpi.evidence_percentage > 0).length;
        const overallEvidencePercentage = totalKPIs > 0 ? Math.round(kpisWithEvidence / totalKPIs * 100) : 0;

        res.json({
            initiative,
            kpis,
            stats: {
                total_kpis: totalKPIs,
                evidence_coverage_percentage: overallEvidencePercentage,
                evidence_types: evidenceStats,
                recent_updates: kpis.reduce((acc, kpi) => acc + kpi.total_updates, 0)
            }
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router; 