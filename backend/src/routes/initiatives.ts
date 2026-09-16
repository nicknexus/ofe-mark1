import { Router, Response } from 'express';
import { InitiativeService } from '../services/initiativeService';
import { KPIService } from '../services/kpiService';
import { EvidenceService } from '../services/evidenceService';
import { TimelineService } from '../services/timelineService';
import { SubscriptionService } from '../services/subscriptionService';
import { EntitlementService } from '../services/entitlementService';
import { MatchService } from '../services/matchService';
import { ProgramStructureService, PROGRAM_TEMPLATES } from '../services/programStructureService';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

/** Shared program-limit gate for every create path. */
async function assertCanCreateInitiative(req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    const usage = await SubscriptionService.getInitiativesUsage(req.user!.id, requestedOrgId);
    if (usage.canCreate) return true;
    res.status(403).json({
        error: `Program limit reached (${usage.current}/${usage.limit}). Upgrade your plan to create more programs.`,
        code: 'INITIATIVE_LIMIT_REACHED',
        usage,
    });
    return false;
}

// Code-defined program templates (metrics + tags + groups). Static, no auth needed
// beyond being signed in.
router.get('/templates', authenticateUser, async (_req: AuthenticatedRequest, res) => {
    res.json(PROGRAM_TEMPLATES);
});

// Create a program pre-populated from a template.
router.post('/from-template', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertCanCreateInitiative(req, res))) return;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const { template_id, ...initiative } = req.body || {};
        const result = await ProgramStructureService.createFromTemplate(template_id, initiative, req.user!.id, requestedOrgId);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Create a program whose metrics / locations / groups mirror an existing one.
router.post('/:id/duplicate-structure', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertCanCreateInitiative(req, res))) return;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const result = await ProgramStructureService.duplicateStructure(req.params.id, req.body, req.user!.id, requestedOrgId);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// What this program has / is missing before evidence can connect.
router.get('/:id/readiness', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        res.json(await ProgramStructureService.getReadiness(req.params.id, req.user!.id, requestedOrgId));
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

// Server-side "what will this connect to" preview for the upload wizard.
// Body: { kpiIds, locationIds, tagIds, beneficiaryGroupIds, dateStart, dateEnd? }
router.post('/:id/preview-matches', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const b = req.body || {};
        const result = await MatchService.previewMatches(req.params.id, {
            kpiIds: Array.isArray(b.kpiIds) ? b.kpiIds : [],
            locationIds: Array.isArray(b.locationIds) ? b.locationIds : [],
            tagIds: Array.isArray(b.tagIds) ? b.tagIds : [],
            beneficiaryGroupIds: Array.isArray(b.beneficiaryGroupIds) ? b.beneficiaryGroupIds : [],
            dateStart: String(b.dateStart || ''),
            dateEnd: b.dateEnd ? String(b.dateEnd) : null,
        }, req.user!.id, requestedOrgId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

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

// Per-program activity (last log, claim/evidence counts) for dashboard cards.
router.get('/activity', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        res.json(await InitiativeService.getActivity(req.user!.id, requestedOrgId));
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