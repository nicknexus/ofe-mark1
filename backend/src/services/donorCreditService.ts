import { supabase } from '../utils/supabase'
import { DonorCredit } from '../types'

export class DonorCreditService {
    static async getCreditsForDonor(donorId: string, userId: string): Promise<DonorCredit[]> {
        const { data, error } = await supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .eq('donor_id', donorId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch donor credits: ${error.message}`)
        return data || []
    }

    static async getCreditsForMetric(kpiId: string, userId: string): Promise<DonorCredit[]> {
        const { data, error } = await supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .eq('kpi_id', kpiId)
            .eq('user_id', userId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch metric credits: ${error.message}`)
        return data || []
    }

    static async getTotalCreditedForMetric(kpiId: string, userId: string, kpiUpdateId?: string): Promise<number> {
        let query = supabase
            .from('donor_credits')
            .select('credited_value')
            .eq('kpi_id', kpiId)
            .eq('user_id', userId)

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

    static async create(credit: Partial<DonorCredit>, userId: string): Promise<DonorCredit> {
        // Validate that we're not exceeding available value
        if (credit.kpi_id) {
            const totalCredited = await this.getTotalCreditedForMetric(
                credit.kpi_id,
                userId,
                credit.kpi_update_id
            )
            
            // Get the metric or claim value to validate against
            if (credit.kpi_update_id) {
                const { data: update } = await supabase
                    .from('kpi_updates')
                    .select('value')
                    .eq('id', credit.kpi_update_id)
                    .eq('user_id', userId)
                    .single()

                if (update && totalCredited + Number(credit.credited_value || 0) > Number(update.value || 0)) {
                    throw new Error(`Credited value exceeds available claim value. Available: ${Number(update.value || 0) - totalCredited}`)
                }
            } else {
                // For metric-level credits, we'd need to sum all claims
                // This is a simplified check - in production you might want more sophisticated validation
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

    static async update(id: string, updates: Partial<DonorCredit>, userId: string): Promise<DonorCredit> {
        const { data, error } = await supabase
            .from('donor_credits')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
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

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('donor_credits')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw new Error(`Failed to delete donor credit: ${error.message}`)
    }

    static async getCreditsForDateRange(
        initiativeId: string,
        userId: string,
        startDate?: string,
        endDate?: string,
        donorId?: string
    ): Promise<DonorCredit[]> {
        let query = supabase
            .from('donor_credits')
            .select(`
                *,
                donors(*),
                kpis(id, title, unit_of_measurement, initiative_id),
                kpi_updates(id, value, date_represented, date_range_start, date_range_end)
            `)
            .eq('user_id', userId)

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

