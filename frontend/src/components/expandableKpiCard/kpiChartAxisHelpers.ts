import type { KpiChartDataPoint } from './kpiChartTypes'
import type { TimeFrameKey } from './generateKpiChartData'

export function getTimeSpanDays(chartData: KpiChartDataPoint[]): number {
    if (chartData.length < 2) return 0
    const first = chartData[0]?.fullDate
    const last = chartData[chartData.length - 1]?.fullDate
    if (!first || !last) return 0
    return Math.round((last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24))
}

export function getXAxisInterval(params: {
    timeFrame: TimeFrameKey
    chartData: KpiChartDataPoint[]
    effectiveIsCumulative: boolean
}): number | undefined {
    const { timeFrame, chartData, effectiveIsCumulative } = params
    if (timeFrame === '1month') return 0

    const dataPointCount = chartData.length
    if (dataPointCount <= 12) return 0

    if (!effectiveIsCumulative) {
        if (dataPointCount <= 24) return 1
        if (dataPointCount <= 48) return 2
        if (dataPointCount <= 72) return 5
        return Math.floor((dataPointCount - 1) / 12)
    }

    const spanDays = getTimeSpanDays(chartData)
    if (spanDays <= 90) return Math.floor((dataPointCount - 1) / 30)
    if (spanDays <= 365) return Math.floor((dataPointCount - 1) / 12)
    if (spanDays <= 730) return Math.floor((dataPointCount - 1) / 12)
    return Math.floor((dataPointCount - 1) / 8)
}

export function formatXAxisTick(chartData: KpiChartDataPoint[], dateStr: string): string {
    const dp = chartData.find(d => d.date === dateStr)
    if (!dp?.fullDate) return dateStr
    const spanDays = getTimeSpanDays(chartData)
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

export function calculateMaxWithHeadroom(chartData: KpiChartDataPoint[]): number {
    if (!chartData || chartData.length === 0) return 0

    let maxValue = 0
    chartData.forEach(dataPoint => {
        if (
            dataPoint.cumulative &&
            typeof dataPoint.cumulative === 'number' &&
            isFinite(dataPoint.cumulative)
        ) {
            maxValue = Math.max(maxValue, dataPoint.cumulative)
        }
    })

    if (maxValue === 0) return 0

    let headroomPercentage = 0.15
    if (maxValue < 100) {
        headroomPercentage = 0.2
    } else if (maxValue < 1000) {
        headroomPercentage = 0.15
    } else if (maxValue < 10000) {
        headroomPercentage = 0.12
    } else {
        headroomPercentage = 0.1
    }

    return maxValue * (1 + headroomPercentage)
}

export function computeActualMaxCumulative(chartData: KpiChartDataPoint[]): number {
    return Math.max(
        ...chartData
            .map(d => (typeof d.cumulative === 'number' && isFinite(d.cumulative) ? d.cumulative : 0))
            .filter(v => v > 0),
        0
    )
}

export function generateYTicks(maxDomainValue: number, actualMaxValue: number): number[] {
    if (maxDomainValue === 0) return []
    const ticks: number[] = []
    const numTicks = 5
    const step = maxDomainValue / numTicks

    for (let i = 0; i <= numTicks; i++) {
        ticks.push(Math.round(i * step))
    }

    if (actualMaxValue > 0 && !ticks.some(t => Math.abs(t - actualMaxValue) < step * 0.1)) {
        ticks.push(actualMaxValue)
        ticks.sort((a, b) => a - b)
    }

    return ticks
}

export function computePercentageYAxis(
    chartData: KpiChartDataPoint[],
    isPercentageMetric: boolean
): { percentageYMax: number; percentageYTicks: number[] } {
    if (!isPercentageMetric) {
        return { percentageYMax: 100, percentageYTicks: [] }
    }
    if (chartData.length === 0) {
        return { percentageYMax: 100, percentageYTicks: [0, 25, 50, 75, 100] }
    }
    let maxValue = 100
    chartData.forEach(d => {
        if (typeof d.cumulative === 'number' && isFinite(d.cumulative) && d.cumulative > maxValue) {
            maxValue = d.cumulative
        }
    })
    const percentageYMax = maxValue <= 100 ? 100 : Math.ceil(maxValue / 100) * 100
    const step = percentageYMax / 4
    const percentageYTicks = [0, step, step * 2, step * 3, percentageYMax]
    return { percentageYMax, percentageYTicks }
}
