import { parseLocalDate, isSameDay, compareDates, formatDate } from '../../utils'
import type { KpiChartDataPoint } from './kpiChartTypes'

export function getEffectiveDate(update: any): Date {
    if (update.date_range_end) {
        return parseLocalDate(update.date_range_end)
    }
    return parseLocalDate(update.date_represented)
}

export type DatePickerFilterValue = {
    singleDate?: string
    startDate?: string
    endDate?: string
}

export type TimeFrameKey = 'all' | '1month' | '6months' | '1year' | '5years'

export function generateKpiChartData(params: {
    filteredKpiUpdates: any[]
    datePickerValue: DatePickerFilterValue
    timeFrame: TimeFrameKey
    isCumulative: boolean
    isPercentageMetric: boolean
}): KpiChartDataPoint[] {
    const { filteredKpiUpdates, datePickerValue, timeFrame, isCumulative, isPercentageMetric } = params

    if (!filteredKpiUpdates || filteredKpiUpdates.length === 0) {
        return []
    }

    const sortedUpdates = [...filteredKpiUpdates].sort(
        (a, b) => getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime()
    )

    const now = new Date()
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
        if (timeFrame === 'all') {
            if (sortedUpdates.length > 0) {
                startDate = getEffectiveDate(sortedUpdates[0])
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

    const filteredUpdates = sortedUpdates.filter(update => {
        const updateDate = getEffectiveDate(update)
        updateDate.setHours(0, 0, 0, 0)
        const updateStart = update.date_range_start ? parseLocalDate(update.date_range_start) : null
        const updateEnd = update.date_range_end ? parseLocalDate(update.date_range_end) : null

        if (updateStart && updateEnd) {
            updateStart.setHours(0, 0, 0, 0)
            updateEnd.setHours(23, 59, 59, 999)
            return updateStart <= endDate && updateEnd >= startDate
        }
        return compareDates(updateDate, startDate) >= 0 && compareDates(updateDate, endDate) <= 0
    })

    const data: KpiChartDataPoint[] = []

    if (isPercentageMetric) {
        const monthly: Record<string, { singleSum: number; singleCount: number; rangeSum: number; rangeCount: number; date: Date }> = {}
        const ensureBucket = (cursor: Date) => {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
            if (!monthly[key]) monthly[key] = { singleSum: 0, singleCount: 0, rangeSum: 0, rangeCount: 0, date: new Date(cursor) }
            return key
        }

        filteredUpdates.forEach(update => {
            const value = Number(update.value || 0)
            if (!Number.isFinite(value)) return

            const isRange = !!(update.date_range_start && update.date_range_end)
            if (isRange) {
                const claimStart = parseLocalDate(update.date_range_start)
                const claimEnd = parseLocalDate(update.date_range_end)
                claimStart.setHours(0, 0, 0, 0)
                claimEnd.setHours(0, 0, 0, 0)
                const cursor = new Date(claimStart.getFullYear(), claimStart.getMonth(), 1)
                const stop = new Date(claimEnd.getFullYear(), claimEnd.getMonth(), 1)
                while (cursor.getTime() <= stop.getTime()) {
                    const key = ensureBucket(cursor)
                    monthly[key].rangeSum += value
                    monthly[key].rangeCount += 1
                    cursor.setMonth(cursor.getMonth() + 1)
                }
            } else {
                const claimDate = parseLocalDate(update.date_represented)
                claimDate.setHours(0, 0, 0, 0)
                const cursor = new Date(claimDate.getFullYear(), claimDate.getMonth(), 1)
                const key = ensureBucket(cursor)
                monthly[key].singleSum += value
                monthly[key].singleCount += 1
            }
        })

        const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        firstMonth.setMonth(firstMonth.getMonth() - 1)
        const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        const cursor = new Date(firstMonth)
        while (cursor.getTime() <= lastMonth.getTime()) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
            const monthName = cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            const bucket = monthly[key]
            let monthValue: number | null = null
            let claimCount = 0
            if (bucket) {
                if (bucket.singleCount > 0) {
                    monthValue = bucket.singleSum / bucket.singleCount
                    claimCount = bucket.singleCount
                } else if (bucket.rangeCount > 0) {
                    monthValue = bucket.rangeSum / bucket.rangeCount
                    claimCount = bucket.rangeCount
                }
            }
            data.push({
                date: monthName,
                cumulative: monthValue,
                value: monthValue ?? 0,
                fullDate: new Date(cursor),
                claimCount,
            })
            cursor.setMonth(cursor.getMonth() + 1)
        }

        return data
    }

    if (!isCumulative && timeFrame === 'all' && !datePickerValue.singleDate && !datePickerValue.startDate) {
        const firstMonthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
        firstMonthStart.setMonth(firstMonthStart.getMonth() - 1)

        const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const monthlyTotals: Record<string, number> = {}

        filteredUpdates.forEach(update => {
            const updateDate = getEffectiveDate(update)
            const monthKey = `${updateDate.getFullYear()}-${String(updateDate.getMonth() + 1).padStart(2, '0')}`

            if (!monthlyTotals[monthKey]) {
                monthlyTotals[monthKey] = 0
            }
            monthlyTotals[monthKey] += update.value || 0
        })

        let currentMonthDate = new Date(firstMonthStart)
        while (currentMonthDate <= currentMonth) {
            const monthKey = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`
            const monthName = currentMonthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
            const monthlyTotal = monthlyTotals[monthKey] || 0

            data.push({
                date: monthName,
                cumulative: monthlyTotal,
                value: monthlyTotal,
                fullDate: new Date(currentMonthDate),
            })

            currentMonthDate.setMonth(currentMonthDate.getMonth() + 1)
        }

        return data
    }

    startDate.setHours(0, 0, 0, 0)
    const endDateNormalized = new Date(endDate)
    endDateNormalized.setHours(0, 0, 0, 0)

    const timeDiff = endDateNormalized.getTime() - startDate.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

    for (let i = 0; i <= daysDiff; i++) {
        const currentDate = new Date(startDate)
        currentDate.setDate(startDate.getDate() + i)
        currentDate.setHours(0, 0, 0, 0)

        if (compareDates(currentDate, endDateNormalized) > 0) {
            break
        }

        const dateString = formatDate(currentDate).split(',')[0]

        const updateOnThisDate = filteredUpdates.find(update => {
            const updateDate = getEffectiveDate(update)
            updateDate.setHours(0, 0, 0, 0)
            return isSameDay(updateDate, currentDate)
        })

        const cumulative = filteredUpdates
            .filter(update => {
                const updateDate = getEffectiveDate(update)
                updateDate.setHours(0, 0, 0, 0)
                return compareDates(updateDate, currentDate) <= 0
            })
            .reduce((sum, update) => sum + (update.value || 0), 0)

        data.push({
            date: dateString,
            cumulative,
            value: updateOnThisDate ? updateOnThisDate.value || 0 : 0,
            fullDate: currentDate,
        })
    }

    return data
}
