import express from 'express';
import rateLimit from 'express-rate-limit';
import { AuthenticatedRequest, authenticateUser } from '../middleware/auth';
import { EvidenceService } from '../services/evidenceService';
import { MatchService } from '../services/matchService';
import { WritingAssistError, WritingAssistService } from '../services/writingAssistService';

const router = express.Router();

// Per-instance memory store: a cost guard against loops, not a hard quota.
const cleanupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== 'production',
    keyGenerator: (req) => (req as AuthenticatedRequest).user?.id || req.ip || 'anon',
    message: { error: 'Too many cleanups. Try again later.' },
});

router.post('/clean-description', authenticateUser, cleanupLimiter, async (req: AuthenticatedRequest, res) => {
    try {
        const text = await WritingAssistService.cleanUpDescription(req.body?.text);
        res.json({ text });
    } catch (error) {
        if (error instanceof WritingAssistError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('[evidence] clean-description error:', error);
        res.status(500).json({ error: 'Could not clean up the description. Try again.' });
    }
});

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

// Connect evidence to an impact claim by re-scoping the evidence until the
// auto-match gates pass (Timeline "slot evidence into the right claim").
// Two-phase: meaning-changing re-scopes return a dry-run plan until the
// request is repeated with { confirm: true }; scope removals 409.
router.post('/:id/connect-to-claim', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { kpi_update_id, confirm } = req.body || {};
        if (!kpi_update_id) {
            res.status(400).json({ error: 'kpi_update_id is required' });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const result = await EvidenceService.connectToClaim(
            req.params.id,
            kpi_update_id,
            !!confirm,
            req.user!.id,
            requestedOrgId
        );
        if (result.conflict) {
            res.status(409).json({ ...result, code: 'SCOPE_CONFLICT', error: result.conflict });
            return;
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
        return;
    }
});

// Review gate: flip evidence between approved and pending (owner/admin only).
// Approving connects it via the matcher; marking pending strips its claim
// links so it immediately stops connecting/counting everywhere.
router.post('/:id/approval', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { status } = req.body || {};
        if (status !== 'approved' && status !== 'pending') {
            res.status(400).json({ error: "status must be 'approved' or 'pending'" });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const evidence = await EvidenceService.setApprovalStatus(
            req.params.id,
            status,
            req.user!.id,
            requestedOrgId
        );
        res.json(evidence);
    } catch (error) {
        res.status(403).json({ error: (error as Error).message });
        return;
    }
});

// Disconnect evidence from a metric (removes the evidence_kpis candidate
// link and prunes that metric's claim connections — stable under reconcile).
router.delete('/:id/kpi-link/:kpiId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const result = await EvidenceService.disconnectFromKpi(
            req.params.id,
            req.params.kpiId,
            req.user!.id,
            requestedOrgId
        );
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

// Why is / isn't this evidence connected to each candidate claim?
router.get('/:id/match-diagnostics', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        res.json(await MatchService.diagnoseEvidence(req.params.id, req.user!.id, requestedOrgId));
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
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