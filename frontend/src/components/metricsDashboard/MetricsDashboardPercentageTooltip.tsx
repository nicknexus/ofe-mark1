import React from 'react'
import { formatDate } from '../../utils'
import type { MetricsDashboardChartRow } from './generateMetricsDashboardChartData'

export function MetricsDashboardPercentageTooltip({
    active,
    label,
    chartData,
    visiblePercentageKpis,
    kpis,
    percentageAveragesById,
    getKPIColorFn,
}: {
    active?: boolean
    label?: string
    chartData: MetricsDashboardChartRow[]
    visiblePercentageKpis: any[]
    kpis: any[]
    percentageAveragesById: Record<string, number>
    getKPIColorFn: (category: string, index: number) => string
}) {
    if (!active) return null
    const dp = chartData.find(d => d.date === label)
    if (!dp) return null
    const dateLabel = dp.fullDate ? formatDate(dp.fullDate) : label || ''
    return (
        <div
            style={{
                backgroundColor: 'rgba(255,255,255,0.98)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #f1f5f9',
                borderRadius: '12px',
                padding: '10px 12px',
                fontSize: '12px',
                boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                minWidth: 220,
            }}
        >
            <div style={{ fontWeight: 500, color: '#475569', marginBottom: 6 }}>{dateLabel}</div>
            {visiblePercentageKpis.length === 0 && (
                <div style={{ color: '#94a3b8' }}>No percentage metrics selected</div>
            )}
            {visiblePercentageKpis.map(k => {
                const originalIndex = kpis.findIndex(x => x.id === k.id)
                const color = getKPIColorFn(k.category, originalIndex)
                const v = dp[k.id]
                const avg = percentageAveragesById[k.id] || 0
                return (
                    <div key={k.id} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 999,
                                    backgroundColor: color,
                                    display: 'inline-block',
                                }}
                            />
                            <span style={{ fontWeight: 500, color: '#0f172a', fontSize: 12 }}>{k.title}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingLeft: 14 }}>
                            <span style={{ color: '#94a3b8' }}>This month</span>
                            <span style={{ fontWeight: 500, color: '#0f172a' }}>
                                {typeof v === 'number' ? `${Math.round(v)}%` : 'No data'}
                            </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingLeft: 14 }}>
                            <span style={{ color: color, opacity: 0.85 }}>Overall avg</span>
                            <span style={{ fontWeight: 600, color }}>{Math.round(avg)}%</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
