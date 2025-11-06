import React from 'react'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    ComposedChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    ReferenceLine
} from 'recharts'
import { parseLocalDate, formatDate } from '../utils'

interface KPIChartsProps {
    kpi: any
    updates: any[]
    evidence: any[]
    proofPercentage: number
}

export default function KPICharts({ kpi, updates, evidence, proofPercentage }: KPIChartsProps) {
    // Prepare timeline data combining updates and evidence
    const timelineData = updates.map(update => {
        const hasEvidence = evidence.some(ev =>
            ev.date_represented === update.date_represented ||
            (ev.date_range_start && ev.date_range_end &&
                update.date_represented >= ev.date_range_start &&
                update.date_represented <= ev.date_range_end)
        )

        return {
            date: formatDate(update.date_represented).split(',')[0], // Get just the date part without year for chart
            fullDate: update.date_represented,
            value: update.value,
            hasEvidence: hasEvidence ? 100 : 0,
            evidenceCount: evidence.filter(ev =>
                ev.date_represented === update.date_represented ||
                (ev.date_range_start && ev.date_range_end &&
                    update.date_represented >= ev.date_range_start &&
                    update.date_represented <= ev.date_range_end)
            ).length,
            note: update.note || update.label,
            target: kpi.target_value || null
        }
    }).sort((a, b) => parseLocalDate(a.fullDate).getTime() - parseLocalDate(b.fullDate).getTime())

    // Cumulative progress data
    const cumulativeData = timelineData.map((item, index) => {
        const cumulative = timelineData.slice(0, index + 1).reduce((sum, curr) => sum + (curr.value || 0), 0)
        return {
            ...item,
            cumulative,
            proofRate: index === timelineData.length - 1 ? proofPercentage :
                Math.round((timelineData.slice(0, index + 1).filter(d => d.hasEvidence > 0).length / (index + 1)) * 100)
        }
    })

    // Color scheme
    const colors = {
        primary: '#16a34a',
        secondary: '#22c55e',
        accent: '#84cc16',
        warning: '#f59e0b',
        danger: '#ef4444',
        gray: '#6b7280'
    }

    return (
        <div className="space-y-8">
            {/* KPI Progress Over Time */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {kpi.title} Progress Timeline
                </h3>
                <ResponsiveContainer width="100%" height={350}>
                    <ComposedChart data={cumulativeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                            dataKey="date"
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#6b7280"
                            fontSize={12}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke="#6b7280"
                            fontSize={12}
                            domain={[0, 100]}
                            tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'white',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                            formatter={(value, name) => {
                                if (name === 'Cumulative Progress') {
                                    return [`${value} ${kpi.unit_of_measurement || ''}`, name]
                                }
                                if (name === 'Evidence Proof') {
                                    return [`${value}%`, name]
                                }
                                return [value, name]
                            }}
                            labelFormatter={(label) => `Date: ${label}`}
                        />
                        <Legend />

                        {/* Target line if exists */}
                        {kpi.target_value && (
                            <ReferenceLine
                                y={kpi.target_value}
                                stroke={colors.warning}
                                strokeDasharray="5 5"
                                yAxisId="left"
                                label="Target"
                            />
                        )}

                        {/* Main progress area */}
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="cumulative"
                            stroke={colors.primary}
                            fill={colors.primary}
                            fillOpacity={0.3}
                            name="Cumulative Progress"
                        />

                        {/* Evidence coverage bars */}
                        <Bar
                            yAxisId="right"
                            dataKey="proofRate"
                            fill={colors.accent}
                            fillOpacity={0.7}
                            name="Evidence Proof"
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Evidence vs Updates Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Individual Updates */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Individual Data Points
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                                dataKey="date"
                                stroke="#6b7280"
                                fontSize={12}
                            />
                            <YAxis
                                stroke="#6b7280"
                                fontSize={12}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                                formatter={(value, name) => [
                                    `${value} ${kpi.unit_of_measurement || ''}`,
                                    name
                                ]}
                            />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={colors.primary}
                                strokeWidth={3}
                                dot={{ fill: colors.primary, r: 6 }}
                                activeDot={{ r: 8, stroke: colors.primary, strokeWidth: 2 }}
                                name="Value"
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Evidence Coverage Status */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Evidence Coverage
                    </h3>
                    <div className="h-250 flex flex-col justify-center">
                        {/* Proof Percentage Circle */}
                        <div className="text-center mb-6">
                            <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full text-4xl font-bold ${proofPercentage >= 80 ? 'bg-green-100 text-green-600' :
                                proofPercentage >= 30 ? 'bg-yellow-100 text-yellow-600' :
                                    'bg-red-100 text-red-600'
                                }`}>
                                {proofPercentage}%
                            </div>
                            <p className="text-sm text-gray-600 mt-2">Evidence Coverage</p>
                        </div>

                        {/* Evidence Stats */}
                        <div className="grid grid-cols-2 gap-4 text-center">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-lg font-semibold text-gray-900">{updates.length}</p>
                                <p className="text-xs text-gray-600">Data Points</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-lg font-semibold text-gray-900">{evidence.length}</p>
                                <p className="text-xs text-gray-600">Evidence Items</p>
                            </div>
                            <div className="p-3 bg-green-50 rounded-lg">
                                <p className="text-lg font-semibold text-green-600">
                                    {updates.filter(u => evidence.some(e =>
                                        e.date_represented === u.date_represented ||
                                        (e.date_range_start && e.date_range_end &&
                                            u.date_represented >= e.date_range_start &&
                                            u.date_represented <= e.date_range_end)
                                    )).length}
                                </p>
                                <p className="text-xs text-gray-600">Proven</p>
                            </div>
                            <div className="p-3 bg-red-50 rounded-lg">
                                <p className="text-lg font-semibold text-red-600">
                                    {updates.length - updates.filter(u => evidence.some(e =>
                                        e.date_represented === u.date_represented ||
                                        (e.date_range_start && e.date_range_end &&
                                            u.date_represented >= e.date_range_start &&
                                            u.date_represented <= e.date_range_end)
                                    )).length}
                                </p>
                                <p className="text-xs text-gray-600">Needs Proof</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 