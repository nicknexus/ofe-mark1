import type { MetricsDashboardChartRow } from './generateMetricsDashboardChartData'

export function calculateMultiKpiMaxWithHeadroom(
    chartData: MetricsDashboardChartRow[],
    chartKpiIds: Set<string>
): number {
    if (!chartData || chartData.length === 0 || chartKpiIds.size === 0) return 0

    let maxValue = 0
    chartData.forEach(dataPoint => {
        chartKpiIds.forEach(kpiId => {
            const value = dataPoint[kpiId]
            if (typeof value === 'number' && isFinite(value) && value > 0) {
                maxValue = Math.max(maxValue, value)
            }
        })
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

export function computeMultiKpiActualMax(
    chartData: MetricsDashboardChartRow[],
    chartKpiIds: Set<string>
): number {
    return Math.max(
        ...chartData.flatMap(d =>
            Array.from(chartKpiIds).map(kpiId => {
                const val = d[kpiId]
                return typeof val === 'number' && isFinite(val) ? val : 0
            })
        ).filter(v => v > 0),
        0
    )
}

export function generateMultiKpiYTicks(maxDomainValue: number, actualMaxValue: number): number[] {
    if (maxDomainValue === 0) return []
    const ticks: number[] = []
    const numTicks = 5
    const step = maxDomainValue / numTicks

    for (let i = 0; i <= numTicks; i++) {
        ticks.push(Math.round(i * step))
    }

    if (actualMaxValue > 0) {
        const isCloseToExistingTick = ticks.some(t => Math.abs(t - actualMaxValue) < step * 0.1)
        if (!isCloseToExistingTick) {
            ticks.push(actualMaxValue)
            ticks.sort((a, b) => a - b)
            return ticks.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1])
        }
    }

    return ticks.filter((val, idx, arr) => idx === 0 || val !== arr[idx - 1])
}

export function computeDashboardPercentageYAxis(params: {
    isPercentageMode: boolean
    chartData: MetricsDashboardChartRow[]
    visiblePercentageKpis: any[]
}): { percentageYMax: number; percentageYTicks: number[] } {
    const { isPercentageMode, chartData, visiblePercentageKpis } = params
    if (!isPercentageMode) {
        return { percentageYMax: 100, percentageYTicks: [] }
    }
    if (chartData.length === 0) {
        return { percentageYMax: 100, percentageYTicks: [0, 25, 50, 75, 100] }
    }
    let max = 100
    chartData.forEach(d => {
        visiblePercentageKpis.forEach(k => {
            const v = d[k.id]
            if (typeof v === 'number' && isFinite(v) && v > max) max = v
        })
    })
    const percentageYMax = max <= 100 ? 100 : Math.ceil(max / 100) * 100
    const step = percentageYMax / 4
    return { percentageYMax, percentageYTicks: [0, step, step * 2, step * 3, percentageYMax] }
}
