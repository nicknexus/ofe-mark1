import { formatDate } from '../../../utils'

type MonthRow = {
    date: string
    fullDate: Date
    value: number | null
    claimCount: number
    average: number
}

type Props = {
    active?: boolean
    label?: string
    percentageChartData: MonthRow[]
    percentageOverallAvg: number
    accent: string
}

export function PublicMetricPercentageTooltip({ active, label, percentageChartData, percentageOverallAvg, accent }: Props) {
    if (!active) return null
    const dp = percentageChartData.find(d => d.date === label)
    const dateLabel = dp?.fullDate ? formatDate(dp.fullDate) : (label || '')
    const monthVal = dp?.value
    const claimCount = dp?.claimCount ?? 0
    return (
        <div style={{ backgroundColor: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(8px)', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)', minWidth: 160 }}>
            <div style={{ fontWeight: 500, color: '#475569', marginBottom: 6 }}>{dateLabel}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: '#94a3b8' }}>This month</span>
                <span style={{ fontWeight: 500, color: '#0f172a' }}>
                    {typeof monthVal === 'number' ? `${Math.round(monthVal)}% · ${claimCount} claim${claimCount === 1 ? '' : 's'}` : 'No data'}
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, paddingTop: 6, borderTop: '1px dashed #e2e8f0' }}>
                <span style={{ color: accent, opacity: 0.85, fontWeight: 500 }}>Overall avg</span>
                <span style={{ fontWeight: 600, color: accent }}>{Math.round(percentageOverallAvg)}%</span>
            </div>
        </div>
    )
}
