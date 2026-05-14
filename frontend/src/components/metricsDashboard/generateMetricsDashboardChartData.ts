import { parseLocalDate, compareDates, formatDate } from '../../utils'
import { getEffectiveDate, type TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import type { DashboardDatePickerValue } from './filterDashboardKpiUpdates'

export type MetricsDashboardChartRow = Record<string, any> & { date: string; fullDate: Date }

export function generateMetricsDashboardChartData(params: {
    filteredUpdates: any[]
    filteredKPIs: any[]
    kpis: any[]
    visibleKPIs: Set<string>
    datePickerValue: DashboardDatePickerValue
    timeFrame: TimeFrameKey
    isCumulative: boolean
    isPercentageMode: boolean
}): MetricsDashboardChartRow[] {
    const {
        filteredUpdates,
        filteredKPIs,
        kpis,
        visibleKPIs,
        datePickerValue,
        timeFrame,
        isCumulative,
        isPercentageMode,
    } = params

    if (!filteredKPIs || filteredKPIs.length === 0) {
        return []
    }

    const filteredKPIIds = new Set(filteredKPIs.map(kpi => kpi.id))
    const updatesByKPI: Record<string, any[]> = {}
    filteredUpdates.forEach(update => {
        const kpiId = update.kpi_id
        if (filteredKPIIds.has(kpiId)) {
            if (!updatesByKPI[kpiId]) {
                updatesByKPI[kpiId] = []
            }
            updatesByKPI[kpiId].push(update)
        }
    })

    Object.keys(updatesByKPI).forEach(kpiId => {
        updatesByKPI[kpiId].sort(
            (a, b) => getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime()
        )
    })

    let startDate: Date
    let endDate: Date

    if (datePickerValue.singleDate) {
        startDate = parseLocalDate(datePickerValue.singleDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = parseLocalDate(datePickerValue.singleDate)
        endDate.setHours(23, 59, 59, 999)
    } else if (datePickerValue.startDate && datePickerValue.endDate) {
        startDate = parseLocalDate(datePickerValue.startDate)
        startDate.setHours(0, 0, 0, 0)
        endDate = parseLocalDate(datePickerValue.endDate)
        endDate.setHours(23, 59, 59, 999)
    } else {
        const now = new Date()
        now.setHours(0, 0, 0, 0)

        if (timeFrame === 'all') {
            const visibleKPIUpdates = filteredUpdates.filter(update => {
                const kpiId = update.kpi_id
                return visibleKPIs.has(kpiId) && filteredKPIIds.has(kpiId)
            })

            if (visibleKPIUpdates.length > 0) {
                const oldestUpdate = visibleKPIUpdates.reduce((oldest, update) => {
                    const updateDate = getEffectiveDate(update)
                    const oldestDate = getEffectiveDate(oldest)
                    return updateDate < oldestDate ? update : oldest
                })
                startDate = getEffectiveDate(oldestUpdate)
                startDate.setHours(0, 0, 0, 0)
                startDate.setDate(startDate.getDate() - 1)
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                startDate.setHours(0, 0, 0, 0)
            }
        } else {
            switch (timeFrame) {
                case '1month':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                    break
                case '6months':
                    startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
                    break
                case '1year':
                    startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
                    break
                case '5years':
                    startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
                    break
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
            }
            startDate.setHours(0, 0, 0, 0)
        }
        endDate = new Date(now)
        endDate.setHours(23, 59, 59, 999)
    }

    const filteredUpdatesByKPI: Record<string, any[]> = {}
    Object.keys(updatesByKPI).forEach(kpiId => {
        filteredUpdatesByKPI[kpiId] = updatesByKPI[kpiId].filter(update => {
            const updateDate = getEffectiveDate(update)
            updateDate.setHours(0, 0, 0, 0)
            return compareDates(updateDate, startDate) >= 0 && compareDates(updateDate, endDate) <= 0
        })
    })

    const data: MetricsDashboardChartRow[] = []

    if (isPercentageMode) {
        const pctKpiIds = kpis
            .filter(k => k.metric_type === 'percentage' && visibleKPIs.has(k.id))
            .map(k => k.id)

        const monthly: Record<
            string,
            Record<string, { singleSum: number; singleCount: number; rangeSum: number; rangeCount: number }>
        > = {}
        const ensure = (key: string, kpiId: string) => {
            if (!monthly[key]) monthly[key] = {}
            if (!monthly[key][kpiId])
                monthly[key][kpiId] = { singleSum: 0, singleCount: 0, rangeSum: 0, rangeCount: 0 }
            return monthly[key][kpiId]
        }

        pctKpiIds.forEach(kpiId => {
            ;(filteredUpdatesByKPI[kpiId] || []).forEach((update: any) => {
                const value = Number(update.value || 0)
                if (!Number.isFinite(value)) return
                const isRange = !!(update.date_range_start && update.date_range_end)
                if (isRange) {
                    const claimStart = parseLocalDate(update.date_range_start)
                    claimStart.setHours(0, 0, 0, 0)
                    const claimEnd = parseLocalDate(update.date_range_end)
                    claimEnd.setHours(0, 0, 0, 0)
                    const cursor = new Date(claimStart.getFullYear(), claimStart.getMonth(), 1)
                    const stop = new Date(claimEnd.getFullYear(), claimEnd.getMonth(), 1)
                    while (cursor.getTime() <= stop.getTime()) {
                        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
                        const b = ensure(key, kpiId)
                        b.rangeSum += value
                        b.rangeCount += 1
                        cursor.setMonth(cursor.getMonth() + 1)
                    }
                } else {
                    const claimDate = parseLocalDate(update.date_represented)
                    claimDate.setHours(0, 0, 0, 0)
                    const key = `${claimDate.getFullYear()}-${String(claimDate.getMonth() + 1).padStart(2, '0')}`
                    const b = ensure(key, kpiId)
                    b.singleSum += value
                    b.singleCount += 1
                }
            })
        })

        const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        firstMonth.setMonth(firstMonth.getMonth() - 1)
        const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        const cursor = new Date(firstMonth)
        while (cursor.getTime() <= lastMonth.getTime()) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
            const monthName = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            const dataPoint: MetricsDashboardChartRow = { date: monthName, fullDate: new Date(cursor) }
            pctKpiIds.forEach(kpiId => {
                const b = monthly[key]?.[kpiId]
                let v: number | null = null
                if (b) {
                    if (b.singleCount > 0) v = b.singleSum / b.singleCount
                    else if (b.rangeCount > 0) v = b.rangeSum / b.rangeCount
                }
                dataPoint[kpiId] = v
            })
            data.push(dataPoint)
            cursor.setMonth(cursor.getMonth() + 1)
        }
        return data
    }

    if (!isCumulative) {
        const firstMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        firstMonthStart.setMonth(firstMonthStart.getMonth() - 1)

        const lastMonthDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)

        const monthlyTotals: Record<string, Record<string, number>> = {}

        Object.keys(filteredUpdatesByKPI).forEach(kpiId => {
            if (!visibleKPIs.has(kpiId)) return

            filteredUpdatesByKPI[kpiId].forEach(update => {
                const updateDate = getEffectiveDate(update)
                const monthKey = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}`

                if (!monthlyTotals[monthKey]) {
                    monthlyTotals[monthKey] = {}
                }
                if (!monthlyTotals[monthKey][kpiId]) {
                    monthlyTotals[monthKey][kpiId] = 0
                }
                monthlyTotals[monthKey][kpiId] += update.value || 0
            })
        })

        let currentMonthDate = new Date(firstMonthStart)
        while (currentMonthDate <= lastMonthDate) {
            const monthKey = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
            const monthName = currentMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

            const dataPoint: MetricsDashboardChartRow = {
                date: monthName,
                fullDate: new Date(currentMonthDate),
            }

            Array.from(visibleKPIs).forEach(kpiId => {
                dataPoint[kpiId] = monthlyTotals[monthKey]?.[kpiId] || 0
            })

            data.push(dataPoint)

            currentMonthDate.setMonth(currentMonthDate.getMonth() + 1)
        }

        return data
    }

    const startDateOnly = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
    startDateOnly.setHours(0, 0, 0, 0)
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    endDateOnly.setHours(0, 0, 0, 0)

    const timeDiff = endDateOnly.getTime() - startDateOnly.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

    for (let i = 0; i <= daysDiff; i++) {
        const currentDate = new Date(startDateOnly)
        currentDate.setDate(startDateOnly.getDate() + i)
        currentDate.setHours(0, 0, 0, 0)

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (compareDates(currentDate, today) > 0) {
            break
        }

        const dateString = formatDate(currentDate).split(',')[0]

        const dataPoint: MetricsDashboardChartRow = {
            date: dateString,
            fullDate: currentDate,
        }

        Object.keys(filteredUpdatesByKPI).forEach(kpiId => {
            const cumulative = filteredUpdatesByKPI[kpiId]
                .filter(update => {
                    const updateDate = getEffectiveDate(update)
                    updateDate.setHours(0, 0, 0, 0)
                    return compareDates(updateDate, currentDate) <= 0
                })
                .reduce((sum, update) => sum + (update.value || 0), 0)

            dataPoint[kpiId] = cumulative
        })

        data.push(dataPoint)
    }

    return data
}
