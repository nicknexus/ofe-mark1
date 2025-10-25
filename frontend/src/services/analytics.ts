import { supabase } from './supabase'

export interface KpiTimeseriesData {
    date: string
    kpi_id: string
    kpi_name: string
    value: number
    unit: string
}

export interface KpiTotalsData {
    kpi_id: string
    kpi_name: string
    total_value: number
    unit: string
}

export interface LocationKpiTotalsData {
    location_id: string
    location_name: string
    kpi_id: string
    kpi_name: string
    total_value: number
    unit: string
}

class AnalyticsService {
    private async getAuthHeaders() {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            throw new Error('No authenticated session')
        }

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        }
    }

    async getKpiTimeseries(
        startDate: Date,
        endDate: Date,
        kpiIds?: string[],
        locationIds?: string[]
    ): Promise<KpiTimeseriesData[]> {
        try {
            const { data, error } = await supabase.rpc('get_kpi_timeseries', {
                p_start: startDate.toISOString(),
                p_end: endDate.toISOString(),
                p_kpi_ids: kpiIds || null,
                p_location_ids: locationIds || null
            })

            if (error) {
                console.warn('RPC not available, falling back to empty data:', error.message)
                return []
            }

            return data || []
        } catch (error) {
            console.warn('RPC not available, falling back to empty data')
            return []
        }
    }

    async getKpiTotals(
        startDate: Date,
        endDate: Date,
        kpiIds?: string[],
        locationIds?: string[]
    ): Promise<KpiTotalsData[]> {
        try {
            const { data, error } = await supabase.rpc('get_kpi_totals', {
                p_start: startDate.toISOString(),
                p_end: endDate.toISOString(),
                p_kpi_ids: kpiIds || null,
                p_location_ids: locationIds || null
            })

            if (error) {
                console.warn('RPC not available, falling back to empty data:', error.message)
                return []
            }

            return data || []
        } catch (error) {
            console.warn('RPC not available, falling back to empty data')
            return []
        }
    }

    async getLocationKpiTotals(
        startDate: Date,
        endDate: Date,
        kpiIds?: string[],
        locationIds?: string[]
    ): Promise<LocationKpiTotalsData[]> {
        try {
            const { data, error } = await supabase.rpc('get_location_kpi_totals', {
                p_start: startDate.toISOString(),
                p_end: endDate.toISOString(),
                p_kpi_ids: kpiIds || null,
                p_location_ids: locationIds || null
            })

            if (error) {
                console.warn('RPC not available, falling back to empty data:', error.message)
                return []
            }

            return data || []
        } catch (error) {
            console.warn('RPC not available, falling back to empty data')
            return []
        }
    }
}

export const analyticsService = new AnalyticsService()
