import express from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { DonorService } from '../services/donorService'
import { DonorCreditService } from '../services/donorCreditService'

const router = express.Router()

// Get all donors for an initiative
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const initiativeId = req.query.initiative_id as string
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        if (!initiativeId) {
            res.status(400).json({ error: 'initiative_id is required' })
            return
        }
        const donors = await DonorService.getAll(req.user!.id, initiativeId, requestedOrgId)
        res.json(donors)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get donor by ID
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const donor = await DonorService.getById(req.params.id, req.user!.id, requestedOrgId)
        res.json(donor)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create donor
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const donor = await DonorService.create(req.body, req.user!.id, requestedOrgId)
        res.status(201).json(donor)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update donor
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const donor = await DonorService.update(req.params.id, req.body, req.user!.id, requestedOrgId)
        res.json(donor)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete donor
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await DonorService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get credits for a donor
router.get('/:id/credits', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const credits = await DonorCreditService.getCreditsForDonor(req.params.id, req.user!.id, requestedOrgId)
        res.json(credits)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router

