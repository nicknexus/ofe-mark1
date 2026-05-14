import { parseLocalDate, getLocalDateString } from '../../utils'
import { aggregateKpiUpdates } from '../../utils/kpiAggregation'

export type DashboardDatePickerValue = {
    singleDate?: string
    startDate?: string
    endDate?: string
}

export function filterDashboardKpiUpdates(params: {
    kpiUpdates: any[]
    datePickerValue: DashboardDatePickerValue
    selectedLocations: string[]
    selectedBeneficiaryGroups: string[]
    selectedTags: string[]
    updateBeneficiaryGroupsCache: Record<string, string[]>
}): any[] {
    const {
        kpiUpdates,
        datePickerValue,
        selectedLocations,
        selectedBeneficiaryGroups,
        selectedTags,
        updateBeneficiaryGroupsCache,
    } = params

    if (!kpiUpdates || kpiUpdates.length === 0) {
        return []
    }

    let filtered = [...kpiUpdates]

    if (datePickerValue.singleDate) {
        filtered = filtered.filter(update => {
            const updateDate = update.date_represented
                ? getLocalDateString(parseLocalDate(update.date_represented))
                : ''
            return updateDate === datePickerValue.singleDate
        })
    } else if (datePickerValue.startDate && datePickerValue.endDate) {
        const filterStartDate = datePickerValue.startDate
        const filterEndDate = datePickerValue.endDate
        filtered = filtered.filter(update => {
            const updateDate = update.date_represented
                ? getLocalDateString(parseLocalDate(update.date_represented))
                : ''
            const updateStart = update.date_range_start
                ? getLocalDateString(parseLocalDate(update.date_range_start))
                : ''
            const updateEnd = update.date_range_end
                ? getLocalDateString(parseLocalDate(update.date_range_end))
                : ''

            if (updateStart && updateEnd) {
                return updateStart <= filterEndDate && updateEnd >= filterStartDate
            }
            return updateDate >= filterStartDate && updateDate <= filterEndDate
        })
    }

    if (selectedLocations.length > 0) {
        filtered = filtered.filter(update => {
            return update.location_id && selectedLocations.includes(update.location_id)
        })
    }

    if (selectedBeneficiaryGroups.length > 0) {
        filtered = filtered.filter(update => {
            if (!update.id) return false
            const updateGroupIds = updateBeneficiaryGroupsCache[update.id] || []
            return updateGroupIds.some(groupId => selectedBeneficiaryGroups.includes(groupId))
        })
    }

    if (selectedTags.length > 0) {
        filtered = filtered.filter(update => {
            const tagId = (update as any).tag_id
            return tagId && selectedTags.includes(tagId)
        })
    }

    return filtered
}

export function computeFilteredTotals(filteredUpdates: any[], filteredKPIs: any[]): Record<string, number> {
    const filteredTotals: Record<string, number> = {}

    filteredKPIs.forEach((kpi: any) => {
        const kpiFilteredUpdates = filteredUpdates.filter((update: any) => update.kpi_id === kpi.id)
        filteredTotals[kpi.id] = aggregateKpiUpdates(kpiFilteredUpdates as any, kpi.metric_type)
    })

    return filteredTotals
}
