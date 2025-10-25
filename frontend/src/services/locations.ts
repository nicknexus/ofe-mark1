import { supabase } from './supabase'

export interface Location {
    id: string
    name: string
    type: 'site' | 'clinic' | 'region'
    city?: string
    region?: string
    latitude?: number
    longitude?: number
    created_at: string
    updated_at: string
}

export interface CreateLocationForm {
    name: string
    type: 'site' | 'clinic' | 'region'
    city?: string
    region?: string
    latitude?: number
    longitude?: number
}

export interface UpdateLocationForm extends Partial<CreateLocationForm> { }

class LocationsService {
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

    async getLocations(): Promise<Location[]> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .order('name')

        if (error) {
            throw new Error(`Failed to fetch locations: ${error.message}`)
        }

        return data || []
    }

    async getLocation(id: string): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .select('*')
            .eq('id', id)
            .single()

        if (error) {
            throw new Error(`Failed to fetch location: ${error.message}`)
        }

        return data
    }

    async createLocation(location: CreateLocationForm): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .insert([location])
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to create location: ${error.message}`)
        }

        return data
    }

    async updateLocation(id: string, updates: UpdateLocationForm): Promise<Location> {
        const { data, error } = await supabase
            .from('locations')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
            throw new Error(`Failed to update location: ${error.message}`)
        }

        return data
    }

    async deleteLocation(id: string): Promise<void> {
        const { error } = await supabase
            .from('locations')
            .delete()
            .eq('id', id)

        if (error) {
            throw new Error(`Failed to delete location: ${error.message}`)
        }
    }

    async getLocationKpiTotals(
        startDate: Date,
        endDate: Date,
        kpiIds?: string[],
        locationIds?: string[]
    ): Promise<any[]> {
        // This will call the RPC function once it's available
        // For now, return empty array as fallback
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

export const locationsService = new LocationsService()
