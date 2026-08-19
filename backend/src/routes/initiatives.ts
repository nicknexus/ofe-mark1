import { Router, Response } from 'express';
import { InitiativeService } from '../services/initiativeService';
import { KPIService } from '../services/kpiService';
import { EvidenceService } from '../services/evidenceService';
import { TimelineService } from '../services/timelineService';
import { SubscriptionService } from '../services/subscriptionService';
import { EntitlementService } from '../services/entitlementService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/**
 * Plan gate for OPENING an initiative: over-limit initiatives (beyond the
 * org's current plan allowance, oldest-first) are locked, not deleted — the
 * dashboard shows them greyed out and direct URLs land here. Deleting a
 * locked initiative stays allowed so owners can get back under their limit.
 */
async function assertInitiativeUnlocked(req: AuthenticatedRequest, res: Response, initiativeId: string): Promise<boolean> {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const { activeOrgId } = await SubscriptionService.resolveActiveOrg(req.user!.id, requestedOrgId);
        if (!activeOrgId) return true; // no org context — nothing to lock against
        if (await EntitlementService.isInitiativeAllowed(activeOrgId, initiativeId)) return true;
        res.status(403).json({
            error: 'This program is locked on your current plan. Upgrade to unlock it.',
            code: 'INITIATIVE_LOCKED',
        });
        return false;
    } catch (e) {
        // Fail open — a gating hiccup must never block access to data.
        console.error('[programs] lock check failed, allowing:', (e as Error).message);
        return true;
    }
}

// Get all initiatives
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // Get optional org context from header
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const initiatives = await InitiativeService.getAll(req.user!.id, requestedOrgId);
        res.json(initiatives);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Update display order for multiple initiatives (drag-and-drop on dashboard).
// Org-scoped: any team member can reorder.
router.post('/update-order', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { order } = req.body; // Array of { id: string, display_order: number }
        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Order must be an array' });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await InitiativeService.updateOrder(order, req.user!.id, requestedOrgId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create initiative
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        // Check initiative limit (org-scoped: uses owner's subscription + org count)
        const usage = await SubscriptionService.getInitiativesUsage(req.user!.id, requestedOrgId);
        if (!usage.canCreate) {
            res.status(403).json({
                error: `Program limit reached (${usage.current}/${usage.limit}). Upgrade your plan to create more programs.`,
                code: 'INITIATIVE_LIMIT_REACHED',
                usage
            });
            return;
        }

        const initiative = await InitiativeService.create(req.body, req.user!.id, requestedOrgId);
        res.status(201).json(initiative);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const initiative = await InitiativeService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!initiative) {
            res.status(404).json({ error: 'Program not found' });
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
        if (!(await assertInitiativeUnlocked(req, res, req.params.id))) return;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const initiative = await InitiativeService.update(req.params.id, req.body, req.user!.id, requestedOrgId);
        res.json(initiative);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Delete initiative
// Phase 1 (full-access baseline): any team member of the org can delete.
// InitiativeService.delete authorizes via the org context.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        await InitiativeService.delete(req.params.id, req.user!.id, requestedOrgId);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Get initiative dashboard (KPIs with evidence stats)
router.get('/:id/dashboard', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertInitiativeUnlocked(req, res, req.params.id))) return;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const [initiative, kpis, evidenceStats] = await Promise.all([
            InitiativeService.getById(req.params.id, req.user!.id, requestedOrgId),
            KPIService.getWithEvidence(req.user!.id, req.params.id, requestedOrgId),
            EvidenceService.getEvidenceStats(req.user!.id, requestedOrgId, req.params.id)
        ]);

        if (!initiative) {
            res.status(404).json({ error: 'Program not found' });
            return;
        }

        const totalKPIs = kpis.length;
        const kpisWithEvidence = kpis.filter(kpi => kpi.evidence_percentage > 0).length;
        const overallEvidencePercentage = totalKPIs > 0 ? Math.round(kpisWithEvidence / totalKPIs * 100) : 0;

        // Calculate total evidence pieces
        const totalEvidence = Object.values(evidenceStats).reduce((sum: number, count: any) => sum + (count || 0), 0);

        res.json({
            initiative,
            kpis,
            stats: {
                total_kpis: totalKPIs,
                evidence_coverage_percentage: overallEvidencePercentage,
                evidence_types: evidenceStats,
                recent_updates: kpis.reduce((acc, kpi) => acc + kpi.total_updates, 0),
                total_evidence: totalEvidence
            }
        });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Batch: all KPI updates for every metric in the initiative.
// Replaces N parallel /kpis/:id/updates requests on InitiativePage load.
router.get('/:id/kpi-updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const updatesByKpi = await KPIService.getUpdatesForInitiative(
            req.params.id,
            req.user!.id,
            requestedOrgId
        );
        res.json(updatesByKpi);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Unified timeline payload: claims + evidence + connections + contributors
// for the whole initiative in one round trip (powers the Timeline tab).
router.get('/:id/timeline', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertInitiativeUnlocked(req, res, req.params.id))) return;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const timeline = await TimelineService.getForInitiative(
            req.params.id,
            req.user!.id,
            requestedOrgId
        );
        res.json(timeline);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;