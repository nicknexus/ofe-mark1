import { supabase } from './supabase'

export interface DatapointLocationAllocation {
    id: string
    datapoint_id: string
    location_id: string
    allocated_value: number
    created_at: string
}

export interface CreateAllocationForm {
    datapoint_id: string
    location_id: string
    allocated_value: number
}

export interface AllocationSummary {
    location_id: string
    location_name: string
    allocated_value: number
    percentage: number
}

class AllocationsService {
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

    async createAllocations(
        datapointId: string,
        allocations: Array<{ location_id: string; allocated_value: number }>
    ): Promise<DatapointLocationAllocation[]> {
        const allocationRecords = allocations.map(allocation => ({
            datapoint_id: datapointId,
            location_id: allocation.location_id,
            allocated_value: allocation.allocated_value
        }))

        const { data, error } = await supabase
            .from('kpi_datapoint_locations')
            .insert(allocationRecords)
            .select()

        if (error) {
            throw new Error(`Failed to create allocations: ${error.message}`)
        }

        return data || []
    }

    async getAllocationsForDatapoint(datapointId: string): Promise<DatapointLocationAllocation[]> {
        const { data, error } = await supabase
            .from('kpi_datapoint_locations')
            .select(`
        *,
        locations!inner(name)
      `)
            .eq('datapoint_id', datapointId)

        if (error) {
            throw new Error(`Failed to fetch allocations: ${error.message}`)
        }

        return data || []
    }

    async updateAllocations(
        datapointId: string,
        allocations: Array<{ location_id: string; allocated_value: number }>
    ): Promise<DatapointLocationAllocation[]> {
        // First, delete existing allocations
        await this.deleteAllocationsForDatapoint(datapointId)

        // Then create new ones
        return this.createAllocations(datapointId, allocations)
    }

    async deleteAllocationsForDatapoint(datapointId: string): Promise<void> {
        const { error } = await supabase
            .from('kpi_datapoint_locations')
            .delete()
            .eq('datapoint_id', datapointId)

        if (error) {
            throw new Error(`Failed to delete allocations: ${error.message}`)
        }
    }

    async getAllocationSummary(datapointId: string): Promise<AllocationSummary[]> {
        const { data, error } = await supabase
            .from('kpi_datapoint_locations')
            .select(`
        allocated_value,
        locations!inner(id, name)
      `)
            .eq('datapoint_id', datapointId)

        if (error) {
            throw new Error(`Failed to fetch allocation summary: ${error.message}`)
        }

        if (!data || data.length === 0) {
            return []
        }

        const total = data.reduce((sum, item) => sum + item.allocated_value, 0)

        return data.map(item => ({
            location_id: item.locations.id,
            location_name: item.locations.name,
            allocated_value: item.allocated_value,
            percentage: total > 0 ? (item.allocated_value / total) * 100 : 0
        }))
    }

    validateAllocations(
        totalValue: number,
        allocations: Array<{ location_id: string; allocated_value: number }>
    ): { isValid: boolean; error?: string } {
        const allocatedTotal = allocations.reduce((sum, alloc) => sum + alloc.allocated_value, 0)

        if (allocatedTotal !== totalValue) {
            return {
                isValid: false,
                error: `Allocated total (${allocatedTotal}) must equal datapoint value (${totalValue})`
            }
        }

        if (allocations.some(alloc => alloc.allocated_value < 0)) {
            return {
                isValid: false,
                error: 'Allocated values cannot be negative'
            }
        }

        return { isValid: true }
    }
}

export const allocationsService = new AllocationsService()
