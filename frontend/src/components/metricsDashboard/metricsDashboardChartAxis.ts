import type { MetricsDashboardChartRow } from './generateMetricsDashboardChartData'
import type { TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import type { DashboardDatePickerValue } from './filterDashboardKpiUpdates'

export function getMetricsDashboardTimeSpanDays(chartData: MetricsDashboardChartRow[]): number {
    if (chartData.length < 2) return 0
    const first = chartData[0]?.fullDate
    const last = chartData[chartData.length - 1]?.fullDate
    if (!first || !last) return 0
    return Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24))
}

export function getMetricsDashboardXAxisInterval(params: {
    timeFrame: TimeFrameKey
    datePickerValue: DashboardDatePickerValue
    chartData: MetricsDashboardChartRow[]
    isCumulative: boolean
    isPercentageMode: boolean
}): number | undefined {
    const { timeFrame, datePickerValue, chartData, isCumulative, isPercentageMode } = params
    if (timeFrame === '1month' && !datePickerValue.singleDate && !datePickerValue.startDate) return 0

    const dataPointCount = chartData.length
    if (dataPointCount <= 12) return 0

    if (!isCumulative || isPercentageMode) {
        if (dataPointCount <= 24) return 1
        if (dataPointCount <= 48) return 2
        if (dataPointCount <= 72) return 5
        return Math.floor((dataPointCount - 1) / 12)
    }

    const spanDays = getMetricsDashboardTimeSpanDays(chartData)
    if (spanDays <= 90) return Math.floor((dataPointCount - 1) / 30)
    if (spanDays <= 365) return Math.floor((dataPointCount - 1) / 12)
    if (spanDays <= 730) return Math.floor((dataPointCount - 1) / 12)
    return Math.floor((dataPointCount - 1) / 8)
}

export function formatMetricsDashboardXAxisTick(
    chartData: MetricsDashboardChartRow[],
    dateStr: string
): string {
    const dp = chartData.find(d => d.date === dateStr)
    if (!dp?.fullDate) return dateStr
    const spanDays = getMetricsDashboardTimeSpanDays(chartData)
    const d = dp.fullDate as Date
    if (spanDays <= 60) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (spanDays <= 365) {
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    if (spanDays <= 730) {
        return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
