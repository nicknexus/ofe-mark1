export type KpiChartDataPoint = {
    date: string
    cumulative: number | null
    value: number
    fullDate: Date
    claimCount?: number
    average?: number
}
