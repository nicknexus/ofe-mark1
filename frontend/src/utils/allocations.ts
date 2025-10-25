export interface AllocationValidation {
    isValid: boolean
    error?: string
}

export interface AllocationSummary {
    location_id: string
    location_name: string
    allocated_value: number
    percentage: number
}

export const validateAllocations = (
    totalValue: number,
    allocations: Array<{ location_id: string; allocated_value: number }>
): AllocationValidation => {
    const allocatedTotal = allocations.reduce((sum, alloc) => sum + alloc.allocated_value, 0)

    if (allocatedTotal !== totalValue) {
        return {
            isValid: false,
            error: `Allocated total (${allocatedTotal.toLocaleString()}) must equal datapoint value (${totalValue.toLocaleString()})`
        }
    }

    if (allocations.some(alloc => alloc.allocated_value < 0)) {
        return {
            isValid: false,
            error: 'Allocated values cannot be negative'
        }
    }

    if (allocations.some(alloc => alloc.allocated_value > totalValue)) {
        return {
            isValid: false,
            error: 'Individual allocations cannot exceed the total value'
        }
    }

    return { isValid: true }
}

export const calculateAllocationSummary = (
    allocations: Array<{ location_id: string; allocated_value: number }>,
    locations: Array<{ id: string; name: string }>
): AllocationSummary[] => {
    const total = allocations.reduce((sum, alloc) => sum + alloc.allocated_value, 0)

    return allocations.map(allocation => {
        const location = locations.find(loc => loc.id === allocation.location_id)
        return {
            location_id: allocation.location_id,
            location_name: location?.name || 'Unknown Location',
            allocated_value: allocation.allocated_value,
            percentage: total > 0 ? (allocation.allocated_value / total) * 100 : 0
        }
    })
}

export const distributeEvenly = (
    totalValue: number,
    locationIds: string[]
): Array<{ location_id: string; allocated_value: number }> => {
    if (locationIds.length === 0) return []

    const evenValue = totalValue / locationIds.length
    return locationIds.map(locationId => ({
        location_id: locationId,
        allocated_value: evenValue
    }))
}

export const formatAllocationSummary = (summary: AllocationSummary[]): string => {
    return summary
        .map(item => `${item.location_name}: ${item.allocated_value.toLocaleString()} (${item.percentage.toFixed(1)}%)`)
        .join(', ')
}
