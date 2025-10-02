import React from 'react'
import { TrendingUp, Target, BarChart3, Calendar, FileText } from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
    CartesianGrid
} from 'recharts'

interface MetricsDashboardProps {
    kpis: any[]
    kpiTotals: Record<string, number>
    stats: {
        total_kpis: number
        evidence_coverage_percentage: number
        recent_updates: number
    }
    kpiUpdates?: any[] // Add KPI updates data
}

export default function MetricsDashboard({ kpis, kpiTotals, stats, kpiUpdates = [] }: MetricsDashboardProps) {

    // Generate 12-month data showing total data points per month
    const generateChartData = () => {
        const data: Array<{
            month: string;
            monthKey: string;
            dataPoints: number;
            date: Date;
        }> = []
        const now = new Date()

        // Create data buckets from January 2025 to current month
        const currentDate = new Date()
        const currentYear = currentDate.getFullYear()
        const currentMonth = currentDate.getMonth()

        // Determine how many months to show (from Jan 2025 to current month)
        const monthsToShow = currentYear === 2025 ? currentMonth + 1 : 12

        for (let i = 0; i < monthsToShow; i++) {
            const date = new Date(2025, i, 1) // January 2025 = 0, February = 1, etc.
            const monthKey = date.toISOString().substring(0, 7) // "2025-01" format
            const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

            data.push({
                month: monthName,
                monthKey: monthKey,
                dataPoints: 0,
                date: date
            })
        }

        if (!kpiUpdates || kpiUpdates.length === 0) {
            // Return empty data if no real data
            return data.map(item => ({
                ...item,
                dataPoints: 0
            }))
        }

        // Count real data points per month
        kpiUpdates.forEach(update => {
            const updateDate = new Date(update.date_represented)
            const monthKey = updateDate.toISOString().substring(0, 7)

            const dataItem = data.find(item => item.monthKey === monthKey)
            if (dataItem) {
                dataItem.dataPoints += 1
            }
        })

        return data
    }

    const chartData = generateChartData()

    return (
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-xl shadow-gray-900/5 mb-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                        Impact Dashboard
                    </h2>
                    <p className="text-gray-500 text-sm">Real-time view of your initiative's key metrics and progress</p>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span>Last 12 months</span>
                </div>
            </div>

            <div className="space-y-6">
                {/* Charts Row - 2/3 Activity + 1/3 Support */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Activity Chart - 2/3 width */}
                    <div className="lg:col-span-2 bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Activity Over Time</h3>
                                <p className="text-sm text-gray-500">Total data points submitted per month across all KPIs</p>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <BarChart3 className="w-4 h-4" />
                                <span>2025 to present</span>
                            </div>
                        </div>

                        <div className="h-64">
                            {kpiUpdates && kpiUpdates.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                        <XAxis
                                            dataKey="month"
                                            stroke="#6b7280"
                                            fontSize={12}
                                        />
                                        <YAxis
                                            stroke="#6b7280"
                                            fontSize={12}
                                            domain={[0, 'dataMax + 2']}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '8px'
                                            }}
                                            formatter={(value, name) => [
                                                `${value} data points`,
                                                'Activity'
                                            ]}
                                            labelFormatter={(label) => `Month: ${label}`}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="dataPoints"
                                            stroke="#3b82f6"
                                            strokeWidth={3}
                                            dot={{ fill: '#3b82f6', r: 6 }}
                                            activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                    <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                                    <h4 className="text-lg font-semibold text-gray-700 mb-2">No Data Yet</h4>
                                    <p className="text-sm text-center max-w-xs">
                                        Come back when you add data to see your activity over time
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Support Percentage Chart - 1/3 width */}
                    <div className="bg-gradient-to-br from-green-50/30 to-emerald-50/20 border border-green-100/60 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Data Support</h3>
                                <p className="text-sm text-gray-500">Percentage of data points with evidence</p>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                <FileText className="w-4 h-4" />
                                <span>Coverage</span>
                            </div>
                        </div>

                        <div className="h-64 flex flex-col items-center justify-center">
                            <div className="text-center">
                                <div className="text-4xl font-bold text-green-600 mb-2">
                                    {stats.evidence_coverage_percentage}%
                                </div>
                                <div className="text-sm text-gray-600 mb-4">
                                    <div>Total Data Points: {kpis.reduce((sum, kpi) => sum + (kpi.total_updates || 0), 0)}</div>
                                    <div>Supported Points: {Math.round(kpis.reduce((sum, kpi) => sum + (kpi.total_updates || 0), 0) * stats.evidence_coverage_percentage / 100)}</div>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
                                        style={{ width: `${stats.evidence_coverage_percentage}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Key Metrics - 2 skinny boxes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Total Data Points */}
                    <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/50 border border-blue-100/60 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                </div>
                                <h4 className="text-sm font-semibold text-gray-900">Total Data Points</h4>
                            </div>
                        </div>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                                {stats.recent_updates.toLocaleString()}
                            </span>
                            <span className="text-sm text-gray-500">points</span>
                        </div>
                        <div className="flex items-center mt-2 text-xs text-blue-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            <span>Across all KPIs</span>
                        </div>
                    </div>

                    {/* Evidence Coverage */}
                    <div className="bg-gradient-to-br from-green-50/50 to-emerald-50/50 border border-green-100/60 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Target className="w-5 h-5 text-green-600" />
                                </div>
                                <h4 className="text-sm font-semibold text-gray-900">Evidence Coverage</h4>
                            </div>
                        </div>
                        <div className="flex items-baseline space-x-2">
                            <span className="text-2xl font-bold text-green-600">
                                {stats.evidence_coverage_percentage}%
                            </span>
                            <span className="text-sm text-gray-500">supported</span>
                        </div>
                        <div className="flex items-center mt-2 text-xs text-green-600">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            <span>Data points with evidence</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}