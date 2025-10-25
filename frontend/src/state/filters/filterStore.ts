import { create } from 'zustand'

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

export const useFilterStore = create<FilterState>((set) => ({
    dateRange: null,
    selectedLocationIds: null,
    selectedKpiIds: null,

    setDateRange: (dateRange) => set({ dateRange }),
    setSelectedLocationIds: (selectedLocationIds) => set({ selectedLocationIds }),
    setSelectedKpiIds: (selectedKpiIds) => set({ selectedKpiIds }),

    clearFilters: () => set({
        dateRange: null,
        selectedLocationIds: null,
        selectedKpiIds: null
    }),

    setDateRangePreset: (preset) => set({ dateRange: getDateRangePreset(preset) })
}))
