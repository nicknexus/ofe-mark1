import express from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { DonorCreditService } from '../services/donorCreditService'

const router = express.Router()

// Get credits for a metric
router.get('/by-metric/:kpiId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const credits = await DonorCreditService.getCreditsForMetric(req.params.kpiId, req.user!.id, requestedOrgId)
        res.json(credits)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get total credited for a metric
router.get('/total/:kpiId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const kpiUpdateId = req.query.kpi_update_id as string | undefined
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const total = await DonorCreditService.getTotalCreditedForMetric(
            req.params.kpiId,
            req.user!.id,
            kpiUpdateId,
            requestedOrgId
        )
        res.json({ total })
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create credit
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const credit = await DonorCreditService.create(req.body, req.user!.id, requestedOrgId)
        res.status(201).json(credit)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update credit
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const credit = await DonorCreditService.update(req.params.id, req.body, req.user!.id, requestedOrgId)
        res.json(credit)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete credit
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await DonorCreditService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router














