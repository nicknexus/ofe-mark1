import { supabase } from '../utils/supabase'
import { BeneficiaryGroup } from '../types'

export class BeneficiaryService {
    static async getAll(userId: string, initiativeId?: string): Promise<BeneficiaryGroup[]> {
        let query = supabase
            .from('beneficiary_groups')
            .select('*')
            .eq('user_id', userId)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (initiativeId) query = query.eq('initiative_id', initiativeId)

        const { data, error } = await query
        if (error) throw new Error(`Failed to fetch beneficiary groups: ${error.message}`)
        return data || []
    }

    static async create(group: BeneficiaryGroup, userId: string): Promise<BeneficiaryGroup> {
        if (!group.location_id) {
            throw new Error('Location is required for beneficiary groups')
        }
        
        // Get max display_order for this initiative to set the new item at the end
        let maxOrder = 0
        if (group.initiative_id) {
            const { data: existingGroups } = await supabase
                .from('beneficiary_groups')
                .select('display_order')
                .eq('initiative_id', group.initiative_id)
                .eq('user_id', userId)
                .order('display_order', { ascending: false })
                .limit(1)
            
            if (existingGroups && existingGroups.length > 0) {
                maxOrder = (existingGroups[0].display_order ?? 0) + 1
            }
        }
        
        const { data, error } = await supabase
            .from('beneficiary_groups')
            .insert([{ ...group, user_id: userId, display_order: maxOrder }])
            .select()
            .single()

        if (error) throw new Error(`Failed to create beneficiary group: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<BeneficiaryGroup>, userId: string): Promise<BeneficiaryGroup> {
        const { data, error } = await supabase
            .from('beneficiary_groups')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(`Failed to update beneficiary group: ${error.message}`)
        return data
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('beneficiary_groups')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw new Error(`Failed to delete beneficiary group: ${error.message}`)
    }

    static async replaceLinksForUpdate(kpiUpdateId: string, groupIds: string[], userId: string) {
        // Delete existing
        await supabase
            .from('kpi_update_beneficiary_groups')
            .delete()
            .eq('kpi_update_id', kpiUpdateId)

        if (groupIds.length === 0) return { success: true }

        const links = groupIds.map(gid => ({ kpi_update_id: kpiUpdateId, beneficiary_group_id: gid, user_id: userId }))
        const { error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .insert(links)

        if (error) throw new Error(`Failed to link data point to groups: ${error.message}`)
        return { success: true }
    }
}



