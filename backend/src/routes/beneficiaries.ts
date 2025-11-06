import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { BeneficiaryService } from '../services/beneficiaryService'
import { supabase } from '../utils/supabase'

const router = Router()

// List groups (optionally by initiative)
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { initiative_id } = req.query
        const groups = await BeneficiaryService.getAll(req.user!.id, initiative_id as string | undefined)
        res.json(groups)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Create
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const group = await BeneficiaryService.create(req.body, req.user!.id)
        res.status(201).json(group)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Update
router.put('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const group = await BeneficiaryService.update(req.params.id, req.body, req.user!.id)
        res.json(group)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Delete
router.delete('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        await BeneficiaryService.delete(req.params.id, req.user!.id)
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

// Get KPI updates linked to a beneficiary group
router.get('/:id/kpi-updates', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
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
            .eq('user_id', req.user!.id)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch linked KPI updates: ${error.message}`)

        // Extract and flatten all updates, preserving KPI relationship
        const updates = (data || [])
            .map((item: any) => item.kpi_updates)
            .filter(Boolean)
            .map((update: any) => ({
                ...update,
                kpi: update.kpis // Ensure KPI data is at root level for easier access
            }))

        res.json(updates)
    } catch (error) {
        res.status(500).json({ error: (error as Error).message })
    }
})

// Bulk get data point counts for multiple beneficiary groups (PERFORMANCE OPTIMIZATION)
router.post('/bulk-data-point-counts', authenticateUser, async (req: AuthenticatedRequest, res): Promise<void> => {
    try {
        const { group_ids } = req.body
        if (!Array.isArray(group_ids) || group_ids.length === 0) {
            res.json({})
            return
        }

        const { data, error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select('beneficiary_group_id')
            .in('beneficiary_group_id', group_ids)
            .eq('user_id', req.user!.id)

        if (error) throw new Error(`Failed to fetch data point counts: ${error.message}`)

        // Count data points per group
        const counts: Record<string, number> = {}
        group_ids.forEach((id: string) => {
            counts[id] = 0 // Initialize all to 0
        })

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
        const { data, error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select(`
                beneficiary_groups(id, name, description)
            `)
            .eq('kpi_update_id', req.params.updateId)
            .eq('user_id', req.user!.id)

        if (error) throw new Error(`Failed to fetch linked beneficiary groups: ${error.message}`)

        const groups = (data || []).map((item: any) => item.beneficiary_groups).filter(Boolean)
        res.json(groups)
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
        
        const updates = order.map((item: { id: string; display_order: number }) => 
            supabase
                .from('beneficiary_groups')
                .update({ display_order: item.display_order })
                .eq('id', item.id)
                .eq('user_id', req.user!.id)
        );
        
        await Promise.all(updates);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router

