import React, { createContext, useContext, useState, ReactNode } from 'react'

export interface DateRange {
    start: Date
    end: Date
}

export interface FilterState {
    // Date range filter
    dateRange: DateRange | null

    // Location filter (null means no filter, empty array means no locations selected)
    selectedLocationIds: string[] | null

    // Metric filter (null means no filter, empty array means no metrics selected)
    selectedKpiIds: string[] | null

    // Actions
    setDateRange: (dateRange: DateRange | null) => void
    setSelectedLocationIds: (locationIds: string[] | null) => void
    setSelectedKpiIds: (kpiIds: string[] | null) => void
    clearFilters: () => void

    // Preset date ranges
    setDateRangePreset: (preset: '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX') => void
}

const getDateRangePreset = (preset: '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX'): DateRange => {
    const now = new Date()
    const start = new Date()

    switch (preset) {
        case '1M':
            start.setMonth(now.getMonth() - 1)
            break
        case '6M':
            start.setMonth(now.getMonth() - 6)
            break
        case '1Y':
            start.setFullYear(now.getFullYear() - 1)
            break
        case '5Y':
            start.setFullYear(now.getFullYear() - 5)
            break
        case '10Y':
            start.setFullYear(now.getFullYear() - 10)
            break
        case 'MAX':
            start.setFullYear(2020) // Set to a reasonable start date
            break
    }

    return { start, end: now }
}

const FilterContext = createContext<FilterState | undefined>(undefined)

interface FilterProviderProps {
    children: ReactNode
}

export function FilterProvider({ children }: FilterProviderProps) {
    const [dateRange, setDateRange] = useState<DateRange | null>(null)
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[] | null>(null)
    const [selectedKpiIds, setSelectedKpiIds] = useState<string[] | null>(null)

    const clearFilters = () => {
        setDateRange(null)
        setSelectedLocationIds(null)
        setSelectedKpiIds(null)
    }

    const setDateRangePreset = (preset: '1M' | '6M' | '1Y' | '5Y' | '10Y' | 'MAX') => {
        setDateRange(getDateRangePreset(preset))
    }

    const value: FilterState = {
        dateRange,
        selectedLocationIds,
        selectedKpiIds,
        setDateRange,
        setSelectedLocationIds,
        setSelectedKpiIds,
        clearFilters,
        setDateRangePreset
    }

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    )
}

export function useFilterStore(): FilterState {
    const context = useContext(FilterContext)
    if (context === undefined) {
        throw new Error('useFilterStore must be used within a FilterProvider')
    }
    return context
}
