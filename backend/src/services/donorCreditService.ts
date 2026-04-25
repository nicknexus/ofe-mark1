import { supabase } from '../utils/supabase'
import { DonorCredit } from '../types'
import { InitiativeService } from './initiativeService'

export class DonorCreditService {
    /**
     * Returns the initiative_id for a KPI if the caller has access, else null.
     */
    private static async getKpiInitiativeIfAccessible(
        kpiId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<string | null> {
        const { data: row } = await supabase
            .from('kpis')
            .select('initiative_id')
            .eq('id', kpiId)
            .maybeSingle()
        if (!row?.initiative_id) return null
        const initiative = await InitiativeService.getById(row.initiative_id, userId, requestedOrgId)
        return initiative ? row.initiative_id : null
    }

    /**
     * Returns the initiative_id for a donor if the caller has access, else null.
     */
    private static async getDonorInitiativeIfAccessible(
        donorId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<string | null> {
        const { data: row } = await supabase
            .from('donors')
            .select('initiative_id')
            .eq('id', donorId)
            .maybeSingle()
        if (!row?.initiative_id) return null
        const initiative = await InitiativeService.getById(row.initiative_id, userId, requestedOrgId)
        return initiative ? row.initiative_id : null
    }

    static async getCreditsForDonor(donorId: string, userId: string, requestedOrgId?: string): Promise<DonorCredit[]> {
        const initiativeId = await this.getDonorInitiativeIfAccessible(donorId, userId, requestedOrgId)
        if (!initiativeId) return []

        const { data, error } = await supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .eq('donor_id', donorId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch donor credits: ${error.message}`)
        return data || []
    }

    static async getCreditsForMetric(kpiId: string, userId: string, requestedOrgId?: string): Promise<DonorCredit[]> {
        const initiativeId = await this.getKpiInitiativeIfAccessible(kpiId, userId, requestedOrgId)
        if (!initiativeId) return []

        const { data, error } = await supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .eq('kpi_id', kpiId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch metric credits: ${error.message}`)
        return data || []
    }

    static async getTotalCreditedForMetric(kpiId: string, userId: string, kpiUpdateId?: string, requestedOrgId?: string): Promise<number> {
        const initiativeId = await this.getKpiInitiativeIfAccessible(kpiId, userId, requestedOrgId)
        if (!initiativeId) return 0

        let query = supabase
            .from('donor_credits')
            .select('credited_value')
            .eq('kpi_id', kpiId)

        if (kpiUpdateId) {
            query = query.eq('kpi_update_id', kpiUpdateId)
        } else {
            query = query.is('kpi_update_id', null)
        }

        const { data, error } = await query

        if (error) throw new Error(`Failed to fetch total credits: ${error.message}`)

        const total = (data || []).reduce((sum, credit) => sum + Number(credit.credited_value || 0), 0)
        return total
    }

    static async create(credit: Partial<DonorCredit>, userId: string, requestedOrgId?: string): Promise<DonorCredit> {
        if (credit.kpi_id) {
            const initiativeId = await this.getKpiInitiativeIfAccessible(credit.kpi_id, userId, requestedOrgId)
            if (!initiativeId) throw new Error('KPI not found or access denied')

            const totalCredited = await this.getTotalCreditedForMetric(
                credit.kpi_id,
                userId,
                credit.kpi_update_id,
                requestedOrgId
            )

            if (credit.kpi_update_id) {
                const { data: update } = await supabase
                    .from('kpi_updates')
                    .select('value')
                    .eq('id', credit.kpi_update_id)
                    .single()

                if (update && totalCredited + Number(credit.credited_value || 0) > Number(update.value || 0)) {
                    throw new Error(`Credited value exceeds available claim value. Available: ${Number(update.value || 0) - totalCredited}`)
                }
            }
        }

        const { data, error } = await supabase
            .from('donor_credits')
            .insert([{ ...credit, user_id: userId }])
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .single()

        if (error) throw new Error(`Failed to create donor credit: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<DonorCredit>, userId: string, requestedOrgId?: string): Promise<DonorCredit> {
        const { data: existing } = await supabase
            .from('donor_credits')
            .select('kpi_id')
            .eq('id', id)
            .maybeSingle()
        if (!existing) throw new Error('Donor credit not found')
        if (existing.kpi_id) {
            const initiativeId = await this.getKpiInitiativeIfAccessible(existing.kpi_id, userId, requestedOrgId)
            if (!initiativeId) throw new Error('Access denied')
        }

        const { data, error } = await supabase
            .from('donor_credits')
            .update(updates)
            .eq('id', id)
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .single()

        if (error) throw new Error(`Failed to update donor credit: ${error.message}`)
        return data
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        const { data: existing } = await supabase
            .from('donor_credits')
            .select('kpi_id')
            .eq('id', id)
            .maybeSingle()
        if (!existing) throw new Error('Donor credit not found')
        if (existing.kpi_id) {
            const initiativeId = await this.getKpiInitiativeIfAccessible(existing.kpi_id, userId, requestedOrgId)
            if (!initiativeId) throw new Error('Access denied')
        }

        const { error } = await supabase
            .from('donor_credits')
            .delete()
            .eq('id', id)

        if (error) throw new Error(`Failed to delete donor credit: ${error.message}`)
    }

    static async getCreditsForDateRange(
        initiativeId: string,
        userId: string,
        startDate?: string,
        endDate?: string,
        donorId?: string,
        requestedOrgId?: string
    ): Promise<DonorCredit[]> {
        const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId)
        if (!initiative) return []

        let query = supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement, initiative_id),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)

        if (donorId) {
            query = query.eq('donor_id', donorId)
        }

        const { data, error } = await query

        if (error) throw new Error(`Failed to fetch credits: ${error.message}`)

        // Filter by initiative and date range
        let filtered = (data || []).filter((credit: any) => {
            if (credit.kpis?.initiative_id !== initiativeId) return false

            if (startDate || endDate) {
                const creditDate = credit.date_range_start || credit.kpi_updates?.date_represented || credit.kpi_updates?.date_range_start
                if (!creditDate) return false

                if (startDate && creditDate < startDate) return false
                if (endDate && creditDate > endDate) return false
            }

            return true
        })

        return filtered
    }
}
