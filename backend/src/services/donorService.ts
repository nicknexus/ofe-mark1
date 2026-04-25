import { supabase } from '../utils/supabase'
import { Donor } from '../types'
import { InitiativeService } from './initiativeService'

export class DonorService {
    /**
     * Verifies the caller has access to the donor's initiative.
     */
    private static async assertAccessByDonorId(
        donorId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ id: string; initiative_id: string; user_id: string } | null> {
        const { data: row, error } = await supabase
            .from('donors')
            .select('id, initiative_id, user_id')
            .eq('id', donorId)
            .maybeSingle()
        if (error) throw new Error(`Failed to fetch donor: ${error.message}`)
        if (!row) return null
        const initiative = await InitiativeService.getById(row.initiative_id, userId, requestedOrgId)
        if (!initiative) return null
        return row
    }

    static async getAll(userId: string, initiativeId: string, requestedOrgId?: string): Promise<Donor[]> {
        const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId)
        if (!initiative) return []

        const { data, error } = await supabase
            .from('donors')
            .select('*')
            .eq('initiative_id', initiativeId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch donors: ${error.message}`)
        return data || []
    }

    static async getById(id: string, userId: string, requestedOrgId?: string): Promise<Donor> {
        const access = await this.assertAccessByDonorId(id, userId, requestedOrgId)
        if (!access) throw new Error('Donor not found or access denied')

        const { data, error } = await supabase
            .from('donors')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw new Error(`Failed to fetch donor: ${error.message}`)
        return data
    }

    static async create(donor: Partial<Donor>, userId: string, requestedOrgId?: string): Promise<Donor> {
        if (donor.initiative_id) {
            const initiative = await InitiativeService.getById(donor.initiative_id, userId, requestedOrgId)
            if (!initiative) throw new Error('Initiative not found or access denied')
        }

        const { data, error } = await supabase
            .from('donors')
            .insert([{ ...donor, user_id: userId }])
            .select()
            .single()

        if (error) throw new Error(`Failed to create donor: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<Donor>, userId: string, requestedOrgId?: string): Promise<Donor> {
        const access = await this.assertAccessByDonorId(id, userId, requestedOrgId)
        if (!access) throw new Error('Donor not found or access denied')

        const { data, error } = await supabase
            .from('donors')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw new Error(`Failed to update donor: ${error.message}`)
        return data
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const access = await this.assertAccessByDonorId(id, userId, requestedOrgId)
        if (!access) throw new Error('Donor not found or access denied')

        const { error } = await supabase
            .from('donors')
            .delete()
            .eq('id', id)

        if (error) throw new Error(`Failed to delete donor: ${error.message}`)
    }
}
