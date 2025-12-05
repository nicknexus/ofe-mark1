import express from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { DonorCreditService } from '../services/donorCreditService'

const router = express.Router()

// Get credits for a metric
router.get('/by-metric/:kpiId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const credits = await DonorCreditService.getCreditsForMetric(req.params.kpiId, req.user!.id)
        res.json(credits)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get total credited for a metric
router.get('/total/:kpiId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const kpiUpdateId = req.query.kpi_update_id as string | undefined
        const total = await DonorCreditService.getTotalCreditedForMetric(
            req.params.kpiId,
            req.user!.id,
            kpiUpdateId
        )
        res.json({ total })
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create credit
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const credit = await DonorCreditService.create(req.body, req.user!.id)
        res.status(201).json(credit)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update credit
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const credit = await DonorCreditService.update(req.params.id, req.body, req.user!.id)
        res.json(credit)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete credit
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        await DonorCreditService.delete(req.params.id, req.user!.id)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router



