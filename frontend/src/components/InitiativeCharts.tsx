import React from 'react'
import {
    LineChart,
    Line,
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'
import { KPI } from '../types'

interface InitiativeChartsProps {
    kpis: any[]
    stats: {
        total_kpis: number
        evidence_coverage_percentage: number
        recent_updates: number
    }
}

interface CategoryDataItem {
    category: string
    count: number
    totalUpdates: number
}

export default function InitiativeCharts({ kpis, stats }: InitiativeChartsProps) {
    // Prepare data for KPI Category Breakdown
    const categoryData = kpis.reduce((acc: CategoryDataItem[], kpi) => {
        const category = kpi.category || 'Other'
        const existing = acc.find((item: CategoryDataItem) => item.category === category)
        if (existing) {
            existing.count += 1
            existing.totalUpdates += kpi.total_updates || 0
        } else {
            acc.push({
                category,
                count: 1,
                totalUpdates: kpi.total_updates || 0
            })
        }
        return acc
    }, [])

    // Prepare data for Evidence Coverage by KPI
    const evidenceData = kpis.map(kpi => ({
        name: kpi.title.length > 15 ? kpi.title.substring(0, 15) + '...' : kpi.title,
        coverage: kpi.evidence_percentage || 0,
        updates: kpi.total_updates || 0
    })).slice(0, 6) // Show top 6 KPIs

    // Prepare mock timeline data (you'd get this from real data)
    const timelineData = [
        { month: 'Jan', kpis: 2, evidence: 5 },
        { month: 'Feb', kpis: 3, evidence: 8 },
        { month: 'Mar', kpis: 4, evidence: 12 },
        { month: 'Apr', kpis: 5, evidence: 18 },
        { month: 'May', kpis: kpis.length, evidence: kpis.reduce((acc, kpi) => acc + (kpi.evidence_count || 0), 0) }
    ]

    // Color scheme (green primary)
    const colors = {
        primary: '#16a34a',
        secondary: '#22c55e',
        accent: '#84cc16',
        light: '#dcfce7',
        warning: '#f59e0b',
        danger: '#ef4444'
    }

    const categoryColors: Record<string, string> = {
        'Input': colors.primary,
        'Output': colors.secondary,
        'Impact': colors.accent,
        'Other': '#6b7280'
    }

    return (
        <div className="space-y-8">
            {/* Top Row - Overview Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* KPI Progress Timeline */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        Growth Timeline
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <AreaChart data={timelineData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                                dataKey="month"
                                stroke="#6b7280"
                                fontSize={12}
                            />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="evidence"
                                stackId="1"
                                stroke={colors.primary}
                                fill={colors.primary}
                                fillOpacity={0.6}
                                name="Evidence Items"
                            />
                            <Area
                                type="monotone"
                                dataKey="kpis"
                                stackId="2"
                                stroke={colors.secondary}
                                fill={colors.secondary}
                                fillOpacity={0.8}
                                name="Active KPIs"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* KPI Categories Breakdown */}
                <div className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        KPI Categories
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={categoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="count"
                            >
                                {categoryData.map((entry: CategoryDataItem, index: number) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={categoryColors[entry.category] || categoryColors.Other}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px'
                                }}
                                formatter={(value, name) => [`${value} KPIs`, name]}
                            />
                            <Legend
                                wrapperStyle={{ fontSize: '14px' }}
                                formatter={(value) => value}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bottom Row - Evidence Coverage */}
            <div className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Evidence Coverage by KPI
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={evidenceData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                            dataKey="name"
                            stroke="#6b7280"
                            fontSize={12}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                        />
                        <YAxis
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
                                if (name === 'coverage') return [`${value}%`, 'Evidence Coverage']
                                return [value, 'Data Updates']
                            }}
                        />
                        <Bar
                            dataKey="coverage"
                            fill={colors.primary}
                            radius={[4, 4, 0, 0]}
                        />
                    </BarChart>
                </ResponsiveContainer>

                {/* Coverage Legend */}
                <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-600">
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-green-500 rounded"></div>
                        <span>80-100% = Fully Proven</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                        <span>30-79% = Some Proof</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                        <span>0-29% = Needs Evidence</span>
                    </div>
                </div>
            </div>
        </div>
    )
}