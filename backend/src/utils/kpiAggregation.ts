// Shared KPI aggregation helper.
// Centralizes the rule: number metrics SUM, percentage metrics use a
// configurable strategy (currently simple mean). Swap PERCENTAGE_STRATEGY to
// change behavior globally (e.g. to 'latest') without touching call sites.

export type AggregationStrategy = 'sum' | 'mean' | 'latest'
export type MetricType = 'number' | 'percentage' | string | null | undefined

const PERCENTAGE_STRATEGY: AggregationStrategy = 'mean'

export function getAggregationStrategy(metricType: MetricType): AggregationStrategy {
    return metricType === 'percentage' ? PERCENTAGE_STRATEGY : 'sum'
}

export interface AggregatableUpdate {
    value: number | string | null | undefined
    date_represented?: string | null
}

export function aggregateKpiUpdates(
    updates: AggregatableUpdate[] | null | undefined,
    metricType: MetricType
): number {
    if (!updates || updates.length === 0) return 0

    const strategy = getAggregationStrategy(metricType)
    const nums = updates
        .map(u => Number(u?.value ?? 0))
        .filter(n => Number.isFinite(n))

    if (nums.length === 0) return 0

    switch (strategy) {
        case 'mean': {
            const sum = nums.reduce((s, n) => s + n, 0)
            // Percentages display without decimals.
            return Math.round(sum / nums.length)
        }
        case 'latest': {
            const sorted = [...updates]
                .filter(u => Number.isFinite(Number(u?.value ?? 0)))
                .sort((a, b) => (b?.date_represented || '').localeCompare(a?.date_represented || ''))
            const v = Number(sorted[0]?.value ?? 0)
            return metricType === 'percentage' ? Math.round(v) : v
        }
        case 'sum':
        default:
            return nums.reduce((s, n) => s + n, 0)
    }
}
