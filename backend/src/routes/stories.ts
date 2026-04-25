import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { StoryService } from '../services/storyService'

const router = Router()

// List stories (with filters)
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id, location_id, beneficiary_group_id, start_date, end_date, search } = req.query
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined

        if (!initiative_id) {
            res.status(400).json({ error: 'initiative_id is required' })
            return
        }

        const filters: any = {}
        if (location_id) {
            const locationIds = Array.isArray(location_id) ? location_id : [location_id]
            filters.locationIds = locationIds.filter(Boolean)
        }
        if (beneficiary_group_id) {
            const groupIds = Array.isArray(beneficiary_group_id) ? beneficiary_group_id : [beneficiary_group_id]
            filters.beneficiaryGroupIds = groupIds.filter(Boolean)
        }
        if (start_date) {
            filters.startDate = start_date as string
        }
        if (end_date) {
            filters.endDate = end_date as string
        }
        if (search) {
            filters.search = search as string
        }

        const stories = await StoryService.getAll(req.user!.id, initiative_id as string, filters, requestedOrgId)
        res.json(stories)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get single story
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const story = await StoryService.getById(req.params.id, req.user!.id, requestedOrgId)
        res.json(story)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create story
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const story = await StoryService.create(req.body, req.user!.id, requestedOrgId)
        res.status(201).json(story)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update story
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const story = await StoryService.update(req.params.id, req.body, req.user!.id, requestedOrgId)
        res.json(story)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete story
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await StoryService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

export default router
