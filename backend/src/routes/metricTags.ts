import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { MetricTagService } from '../services/metricTagService'

const router = Router()

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
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await MetricTagService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router
