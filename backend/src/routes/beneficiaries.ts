import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { BeneficiaryService } from '../services/beneficiaryService'
import { supabase } from '../utils/supabase'

const router = Router()

// List groups (optionally by initiative)
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const groups = await BeneficiaryService.getAll(req.user!.id, initiative_id as string | undefined, requestedOrgId)
        res.json(groups)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const group = await BeneficiaryService.create(req.body, req.user!.id, requestedOrgId)
        res.status(201).json(group)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const group = await BeneficiaryService.update(req.params.id, req.body, req.user!.id, requestedOrgId)
        res.json(group)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete
// Phase 1 (full-access baseline): any team member of the org can delete.
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await BeneficiaryService.delete(req.params.id, req.user!.id, requestedOrgId)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Link/unlink data point to groups (post-hoc)
router.post('/link-kpi-update', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { kpi_update_id, beneficiary_group_ids } = req.body
        const result = await BeneficiaryService.replaceLinksForUpdate(kpi_update_id, beneficiary_group_ids || [], req.user!.id)
        res.json(result)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get KPI updates linked to a beneficiary group.
// Authorization: caller must have access to the group (via initiative org).
router.get('/:id/kpi-updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined

        // Verify access to the group via initiative org context.
        const groups = await BeneficiaryService.getAll(req.user!.id, undefined, requestedOrgId)
        const allowed = groups.some(g => g.id === req.params.id)
        if (!allowed) {
            res.status(404).json({ error: 'Beneficiary group not found' })
            return
        }

        const { data, error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select(`
                kpi_updates(
                    id, value, date_represented, date_range_start, date_range_end, 
                    label, note, created_at,
                    kpis(id, title, unit_of_measurement)
                )
            `)
            .eq('beneficiary_group_id', req.params.id)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch linked KPI updates: ${error.message}`)

        const updates = (data || [])
            .map((item: any) => item.kpi_updates)
            .filter(Boolean)
            .map((update: any) => ({
                ...update,
                kpi: update.kpis
            }))

        res.json(updates)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Bulk get data point counts for multiple beneficiary groups.
// Authorization: limit returned counts to groups the caller can access.
router.post('/bulk-data-point-counts', authenticateUser, async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
        const { group_ids } = req.body
        if (!Array.isArray(group_ids) || group_ids.length === 0) {
            res.json({})
            return
        }

        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const accessibleGroups = await BeneficiaryService.getAll(req.user!.id, undefined, requestedOrgId)
        const accessibleIds = new Set(accessibleGroups.map(g => g.id))
        const filteredIds = group_ids.filter((id: string) => accessibleIds.has(id))

        const counts: Record<string, number> = {}
        group_ids.forEach((id: string) => { counts[id] = 0 })

        if (filteredIds.length === 0) {
            res.json(counts)
            return
        }

        const { data, error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select('beneficiary_group_id')
            .in('beneficiary_group_id', filteredIds)

        if (error) throw new Error(`Failed to fetch data point counts: ${error.message}`)

        if (data) {
            data.forEach((item: any) => {
                counts[item.beneficiary_group_id] = (counts[item.beneficiary_group_id] || 0) + 1
            })
        }

        res.json(counts)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get beneficiary groups linked to a KPI update
router.get('/for-kpi-update/:updateId', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // The kpi_update -> kpi -> initiative chain governs access. We rely on
        // the caller already having access to the parent KPI update via the
        // KPI/initiative routes; here we just return the linked groups.
        const { data, error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select(`
                beneficiary_groups(id, name, description, initiative_id)
            `)
            .eq('kpi_update_id', req.params.updateId)

        if (error) throw new Error(`Failed to fetch linked beneficiary groups: ${error.message}`)

        // Filter to groups whose initiative the caller can access.
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const accessibleGroups = await BeneficiaryService.getAll(req.user!.id, undefined, requestedOrgId)
        const accessibleIds = new Set(accessibleGroups.map(g => g.id))

        const groups = (data || [])
            .map((item: any) => item.beneficiary_groups)
            .filter(Boolean)
            .filter((g: any) => accessibleIds.has(g.id))
        res.json(groups)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Get derived locations for multiple beneficiary groups
router.post('/bulk-derived-locations', authenticateUser, async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
        const { group_ids } = req.body
        if (!Array.isArray(group_ids) || group_ids.length === 0) {
            res.json({})
            return
        }
        const result = await BeneficiaryService.getBulkDerivedLocations(group_ids)
        res.json(result)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update display order for multiple beneficiary groups
router.post('/update-order', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { order } = req.body; // Array of { id: string, display_order: number }
        if (!Array.isArray(order)) {
            res.status(400).json({ error: 'Order must be an array' });
            return;
        }

        // Authorize: caller must have access to every group in the order array.
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const accessibleGroups = await BeneficiaryService.getAll(req.user!.id, undefined, requestedOrgId)
        const accessibleIds = new Set(accessibleGroups.map(g => g.id))
        for (const item of order) {
            if (!accessibleIds.has(item.id)) {
                res.status(403).json({ error: `Access denied for group ${item.id}` })
                return
            }
        }

        const updates = order.map((item: { id: string; display_order: number }) =>
            supabase
                .from('beneficiary_groups')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
        );

        await Promise.all(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router
