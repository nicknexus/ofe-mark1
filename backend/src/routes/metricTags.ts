import { Router, Response } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { MetricTagService } from '../services/metricTagService'
import { SubscriptionService } from '../services/subscriptionService'

const router = Router()

/**
 * Plan gate for all tag WRITES (create/update/delete/reorder). Reads stay open
 * so the UI can show existing tags in a locked state on the Free plan —
 * nothing is deleted on downgrade, it's just read-only until they upgrade.
 */
async function assertTagsWritable(req: AuthenticatedRequest, res: Response): Promise<boolean> {
    const requestedOrgId = req.headers['x-organization-id'] as string | undefined
    const features = await SubscriptionService.getFeatureAccess(req.user!.id, requestedOrgId)
    if (!features.tags) {
        res.status(403).json({
            error: 'Metric tags are not available on the Free plan. Upgrade to Growth or Pro to use themes.',
            code: 'FEATURE_NOT_IN_PLAN',
            feature: 'tags',
        })
        return false
    }
    return true
}

// List all tags for the active org.
// Query: ?with_counts=1 to include metric_count and claim_count.
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const withCounts = req.query.with_counts === '1' || req.query.with_counts === 'true'
        const tags = withCounts
            ? await MetricTagService.getAllWithCounts(req.user!.id, requestedOrgId)
            : await MetricTagService.getAll(req.user!.id, requestedOrgId)
        res.json(tags)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get a single tag with detail (kpis attached + tagged claims).
router.get('/:id/detail', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const detail = await MetricTagService.getDetail(req.params.id, req.user!.id, requestedOrgId)
        if (!detail) {
            res.status(404).json({ error: 'Tag not found' })
            return
        }
        res.json(detail)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get one tag.
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const tag = await MetricTagService.getById(req.params.id, req.user!.id, requestedOrgId)
        if (!tag) {
            res.status(404).json({ error: 'Tag not found' })
            return
        }
        res.json(tag)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create (idempotent: returns existing tag if name already exists case-insensitively).
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertTagsWritable(req, res))) return
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const tag = await MetricTagService.create(req.body?.name, req.user!.id, requestedOrgId)
        res.status(201).json(tag)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update.
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertTagsWritable(req, res))) return
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const tag = await MetricTagService.update(req.params.id, req.body, req.user!.id, requestedOrgId)
        res.json(tag)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete (cascades to all kpi/claim links via FK).
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!(await assertTagsWritable(req, res))) return
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await MetricTagService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Persist a new org-wide order for tags.
// Body: { order: { id: string, display_order: number }[] }
router.post('/update-order', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { order } = req.body
        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Order must be an array' })
            return
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await MetricTagService.reorder(order, req.user!.id, requestedOrgId)
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router
