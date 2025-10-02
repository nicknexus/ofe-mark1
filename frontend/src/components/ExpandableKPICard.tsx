import React, { useState } from 'react'
import {
    ChevronDown,
    ChevronUp,
    Plus,
    Upload,
    Edit,
    Trash2,
    BarChart3,
    FileText,
    TrendingUp,
    Calendar,
    Target,
    ExternalLink
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { getCategoryColor } from '../utils'

interface ExpandableKPICardProps {
    kpi: any
    kpiTotal: number
    isExpanded: boolean
    onToggleExpand: () => void
    onAddUpdate: () => void
    onAddEvidence: () => void
    onEdit: () => void
    onDelete: () => void
    onViewDetails: () => void // Add function to navigate to KPI details page
    kpiUpdates?: any[] // Add KPI updates data for this specific KPI
}

export default function ExpandableKPICard({
    kpi,
    kpiTotal,
    isExpanded,
    onToggleExpand,
    onAddUpdate,
    onAddEvidence,
    onEdit,
    onDelete,
    onViewDetails,
    kpiUpdates = []
}: ExpandableKPICardProps) {

    // Generate 12-month data for this specific KPI
    const generateChartData = () => {
        const data: Array<{
            month: string;
            monthKey: string;
            dataPoints: number;
            date: Date;
        }> = []
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

        // Count real data points per month for this specific KPI
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
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200/60 hover:border-blue-300/60 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300">
            {/* Collapsed View - Horizontal Layout */}
            <div
                className="p-4 cursor-pointer"
                onClick={onToggleExpand}
            >
                <div className="flex items-center justify-between">
                    {/* Left: KPI Info */}
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-3 mb-1">
                                <h3 className="text-lg font-bold text-gray-900 truncate">{kpi.title}</h3>
                                <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${getCategoryColor(kpi.category)}`}>
                                    {kpi.category}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 truncate">{kpi.description}</p>
                        </div>
                    </div>

                    {/* Center: Value Display */}
                    <div className="flex items-center space-x-6 px-6">
                        {kpi.total_updates > 0 && kpiTotal !== undefined ? (
                            <div className="text-center">
                                <div className="flex items-baseline space-x-1">
                                    <span className="text-1xl font-bold text-green-600">
                                        {kpiTotal.toLocaleString()}
                                    </span>
                                    <span className="text-sm font-medium text-gray-500">
                                        {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                    </span>
                                </div>
                                <div className="flex items-center justify-center space-x-1 mt-1">
                                    <TrendingUp className="w-3 h-3 text-green-500" />
                                    <span className="text-xs text-green-600 font-medium">{kpi.total_updates} updates</span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center">
                                <div className="w-2 h-2 bg-gray-300 rounded-full mx-auto mb-1"></div>
                                <span className="text-sm text-gray-500 font-medium">No data yet</span>
                            </div>
                        )}
                    </div>

                    {/* Right: Expand Button */}
                    <div className="flex items-center space-x-2">
                        <div className="text-xs text-gray-500">
                            {kpi.evidence_count} evidence
                        </div>
                        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                            {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-gray-400" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-gray-400" />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded View */}
            {isExpanded && (
                <div className="border-t border-gray-100 p-6 space-y-6">
                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold text-gray-900">KPI Details</h4>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onAddUpdate()
                                }}
                                className="flex items-center space-x-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Data</span>
                            </button>
                            {kpi.total_updates > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onAddEvidence()
                                    }}
                                    className="flex items-center space-x-2 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-sm font-medium transition-colors"
                                >
                                    <Upload className="w-4 h-4" />
                                    <span>Add Evidence</span>
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onEdit()
                                }}
                                className="flex items-center space-x-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onDelete()
                                }}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onViewDetails()
                                }}
                                className="flex items-center space-x-2 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                                <span>Full Details</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <BarChart3 className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Data Points</p>
                                    <p className="text-xl font-bold text-blue-600">{kpi.total_updates}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50/50 border border-green-100 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <FileText className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Evidence Items</p>
                                    <p className="text-xl font-bold text-green-600">{kpi.evidence_count}</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-green-50/50 border border-green-100 rounded-xl p-4">
                            <div className="flex items-center space-x-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Target className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-600">Evidence Coverage</p>
                                    <p className="text-xl font-bold text-green-600">{kpi.evidence_percentage}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart and Data Sections - 2/3 chart + 1/3 data/evidence */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Chart Section - 2/3 width */}
                        <div className="lg:col-span-2 bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h5 className="text-lg font-semibold text-gray-900">Activity Over Time</h5>
                                    <p className="text-sm text-gray-500">Data points submitted per month for this KPI</p>
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
                                                domain={[4, 'dataMax + 2']}
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

                        {/* Data Points and Evidence Sections - 1/3 width */}
                        <div className="lg:col-span-1 space-y-4">
                            {/* Data Points Section */}
                            <div className="bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h5 className="text-lg font-semibold text-gray-900">Data Points</h5>
                                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                                        <BarChart3 className="w-4 h-4" />
                                        <span>{kpi.total_updates || 0} total</span>
                                    </div>
                                </div>
                                <div className="h-48 overflow-y-auto space-y-2">
                                    {kpiUpdates && kpiUpdates.length > 0 ? (
                                        kpiUpdates.slice(0, 10).map((update, index) => (
                                            <div key={update.id || index} className="bg-white/50 border border-blue-100/60 rounded-lg p-3">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <div className="font-medium text-gray-900">
                                                            {update.value?.toLocaleString()} {kpi.unit_of_measurement}
                                                        </div>
                                                        <div className="text-sm text-gray-500">
                                                            {new Date(update.date_represented).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    {update.note && (
                                                        <div className="text-xs text-gray-400 max-w-32 truncate">
                                                            {update.note}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No data points yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Evidence Section */}
                            <div className="bg-gradient-to-br from-green-50/30 to-emerald-50/20 border border-green-100/60 rounded-xl p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h5 className="text-lg font-semibold text-gray-900">Evidence</h5>
                                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                                        <FileText className="w-4 h-4" />
                                        <span>{kpi.evidence_count || 0} items</span>
                                    </div>
                                </div>
                                <div className="h-48 overflow-y-auto space-y-2">
                                    {kpi.evidence_count > 0 ? (
                                        // Mock evidence items - replace with real data when available
                                        Array.from({ length: Math.min(kpi.evidence_count, 8) }, (_, index) => (
                                            <div key={index} className="bg-white/50 border border-green-100/60 rounded-lg p-3">
                                                <div className="flex items-center space-x-3">
                                                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                                        <FileText className="w-4 h-4 text-green-600" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-gray-900 text-sm">
                                                            Evidence Item {index + 1}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            Uploaded recently
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">
                                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                            <p className="text-sm">No evidence uploaded yet</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
