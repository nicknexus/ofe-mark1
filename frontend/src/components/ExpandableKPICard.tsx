import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
    ExternalLink,
    X,
    Eye
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { getCategoryColor } from '../utils'
import EvidencePreviewModal from './EvidencePreviewModal'
import DataPointPreviewModal from './DataPointPreviewModal'
import AddKPIUpdateModal from './AddKPIUpdateModal'
import AddEvidenceModal from './AddEvidenceModal'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

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
    initiativeId?: string // Initiative ID for fetching evidence
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
    kpiUpdates = [],
    initiativeId
}: ExpandableKPICardProps) {

    // Lock body scroll when expanded
    useEffect(() => {
        if (isExpanded) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }

        // Cleanup on unmount
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isExpanded])

    // Time frame filter state
    const [timeFrame, setTimeFrame] = useState<'1month' | '6months' | '1year' | '5years'>('1month')
    const [expandedDataPoints, setExpandedDataPoints] = useState<string[]>([])
    const [expandedEvidence, setExpandedEvidence] = useState<string[]>([])
    const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
    const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)
    const [isDataPointPreviewOpen, setIsDataPointPreviewOpen] = useState(false)
    const [isEditDataPointModalOpen, setIsEditDataPointModalOpen] = useState(false)
    const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false)
    const [deleteConfirmDataPoint, setDeleteConfirmDataPoint] = useState<any>(null)
    const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<any>(null)
    const [editingDataPoint, setEditingDataPoint] = useState<any>(null)
    const [evidence, setEvidence] = useState<any[]>([])
    const [loadingEvidence, setLoadingEvidence] = useState(false)

    const handleDataPointClick = (update: any) => {
        setSelectedDataPoint(update)
        setIsDataPointPreviewOpen(true)
    }

    const toggleEvidenceExpanded = (evidenceId: string) => {
        setExpandedEvidence(prev =>
            prev.includes(evidenceId)
                ? prev.filter(id => id !== evidenceId)
                : [...prev, evidenceId]
        )
    }

    // Load evidence when expanded
    useEffect(() => {
        if (isExpanded && kpi.id && initiativeId) {
            loadEvidence()
        }
    }, [isExpanded, kpi.id, initiativeId])

    const loadEvidence = async () => {
        if (!kpi.id || !initiativeId) return
        try {
            setLoadingEvidence(true)
            const data = await apiService.getEvidence(initiativeId, kpi.id)
            setEvidence(data || [])
        } catch (error) {
            console.error('Error loading evidence:', error)
            setEvidence([])
        } finally {
            setLoadingEvidence(false)
        }
    }

    const handleEvidenceClick = (evidenceItem: any) => {
        setSelectedEvidence(evidenceItem)
        setIsEvidencePreviewOpen(true)
    }

    // Data Point handlers
    const handleEditDataPoint = (dataPoint: any) => {
        setEditingDataPoint(dataPoint)
        setIsEditDataPointModalOpen(true)
    }

    const handleDeleteDataPoint = async (dataPoint: any) => {
        if (!dataPoint.id) return
        try {
            await apiService.deleteKPIUpdate(dataPoint.id)
            toast.success('Data point deleted successfully!')
            // TODO: Refresh data - this would need to be passed down as a prop
            setDeleteConfirmDataPoint(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete data point'
            toast.error(message)
        }
    }

    const handleUpdateDataPoint = async (updateData: any) => {
        if (!editingDataPoint?.id) return
        try {
            await apiService.updateKPIUpdate(editingDataPoint.id, updateData)
            toast.success('Data point updated successfully!')
            // TODO: Refresh data - this would need to be passed down as a prop
            setIsEditDataPointModalOpen(false)
            setEditingDataPoint(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update data point'
            toast.error(message)
            throw error
        }
    }

    // Evidence handlers
    const handleEditEvidence = (evidence: any) => {
        setSelectedEvidence(evidence)
        setIsEditEvidenceModalOpen(true)
    }

    const handleDeleteEvidence = async (evidence: any) => {
        if (!evidence.id) return
        try {
            await apiService.deleteEvidence(evidence.id)
            toast.success('Evidence deleted successfully!')
            // TODO: Refresh data - this would need to be passed down as a prop
            setDeleteConfirmEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete evidence'
            toast.error(message)
        }
    }

    const handleUpdateEvidence = async (evidenceData: any) => {
        if (!selectedEvidence?.id) return
        try {
            await apiService.updateEvidence(selectedEvidence.id, evidenceData)
            toast.success('Evidence updated successfully!')
            // TODO: Refresh data - this would need to be passed down as a prop
            setIsEditEvidenceModalOpen(false)
            setSelectedEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update evidence'
            toast.error(message)
            throw error
        }
    }

    // Get effective date for an update - use end date for ranges, otherwise use date_represented
    const getEffectiveDate = (update: any): Date => {
        if (update.date_range_end) {
            return new Date(update.date_range_end)
        }
        return new Date(update.date_represented)
    }

    // Generate cumulative data for this specific KPI
    const generateChartData = () => {
        if (!kpiUpdates || kpiUpdates.length === 0) {
            return []
        }

        // Sort updates by effective date (end date for ranges, date_represented otherwise)
        const sortedUpdates = [...kpiUpdates].sort((a, b) =>
            getEffectiveDate(a).getTime() - getEffectiveDate(b).getTime()
        )

        // Calculate date range based on time frame
        const now = new Date()
        let startDate: Date

        switch (timeFrame) {
            case '1month':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
                break
            case '6months':
                startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
                break
            case '1year':
                startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
                break
            case '5years':
                startDate = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate())
                break
            default:
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
        }

        // Filter updates within the time frame (using effective date)
        const filteredUpdates = sortedUpdates.filter(update =>
            getEffectiveDate(update) >= startDate
        )

        // Generate time series data with proper spacing
        const data: Array<{
            date: string;
            cumulative: number;
            value: number;
            fullDate: Date;
        }> = []

        // Create a full time series from startDate to now
        const endDate = new Date()
        const timeDiff = endDate.getTime() - startDate.getTime()
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24))

        // Create daily data points for the entire period
        for (let i = 0; i <= daysDiff; i++) {
            const currentDate = new Date(startDate.getTime() + (i * 24 * 60 * 60 * 1000))
            const dateString = currentDate.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            })

            // Find if there's an update on this date (using effective date)
            const updateOnThisDate = filteredUpdates.find(update => {
                const updateDate = getEffectiveDate(update)
                return updateDate.toDateString() === currentDate.toDateString()
            })

            // Calculate cumulative value up to this point (using effective date)
            const cumulative = filteredUpdates
                .filter(update => getEffectiveDate(update) <= currentDate)
                .reduce((sum, update) => sum + (update.value || 0), 0)

            data.push({
                date: dateString,
                cumulative: cumulative,
                value: updateOnThisDate ? (updateOnThisDate.value || 0) : 0,
                fullDate: currentDate
            })
        }

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

                            {/* Progress Bar */}
                            <div className="mt-2">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>Supported</span>
                                    <span>
                                        {kpi.evidence_percentage || 0}%
                                    </span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className={`h-1.5 rounded-full transition-all duration-300 ${(kpi.evidence_percentage || 0) >= 100
                                            ? 'bg-green-500'
                                            : 'bg-yellow-500'
                                            }`}
                                        style={{
                                            width: `${Math.min(kpi.evidence_percentage || 0, 100)}%`
                                        }}
                                    ></div>
                                </div>
                            </div>
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

            {/* Expanded View - Full Screen Modal (excluding sidebar) */}
            {isExpanded && createPortal(
                <div className="fixed top-0 right-0 bottom-0 z-50 bg-white overflow-y-auto" style={{ position: 'fixed', top: 0, left: '224px', right: 0, bottom: 0, width: 'calc(100vw - 224px)', height: '100vh' }}>
                    {/* Header */}
                    <div className="sticky top-0 z-10 bg-white border-b border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onToggleExpand()
                                    }}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-red-600" />
                                </button>
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{kpi.title}</h2>
                                    <p className="text-sm text-gray-500">{kpi.description}</p>
                                </div>
                            </div>
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
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">

                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3">
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

                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-3">
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

                            <div className="bg-green-50/50 border border-green-100 rounded-xl p-3">
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

                        {/* Chart and Data Sections - 3/5 chart + 2/5 data/evidence */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            {/* Chart Section - 3/5 width */}
                            <div className="lg:col-span-3 bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-4 flex flex-col">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h5 className="text-lg font-semibold text-gray-900">Cumulative Progress</h5>
                                        <p className="text-sm text-gray-500">Running total over time</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="flex bg-gray-100 rounded-lg p-0.5">
                                            <button
                                                onClick={() => setTimeFrame('1month')}
                                                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${timeFrame === '1month'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                1M
                                            </button>
                                            <button
                                                onClick={() => setTimeFrame('6months')}
                                                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${timeFrame === '6months'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                6M
                                            </button>
                                            <button
                                                onClick={() => setTimeFrame('1year')}
                                                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${timeFrame === '1year'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                1Y
                                            </button>
                                            <button
                                                onClick={() => setTimeFrame('5years')}
                                                className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${timeFrame === '5years'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-600 hover:text-gray-900'
                                                    }`}
                                            >
                                                5Y
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 h-64 flex items-center justify-center">
                                    {kpiUpdates && kpiUpdates.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                                <XAxis
                                                    dataKey="date"
                                                    stroke="#6b7280"
                                                    fontSize={12}
                                                />
                                                <YAxis
                                                    stroke="#6b7280"
                                                    fontSize={12}
                                                    domain={[0, 'dataMax + (dataMax * 0.1)']}
                                                />
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'white',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px'
                                                    }}
                                                    formatter={(value, name) => [
                                                        `${value} ${kpi.unit_of_measurement || ''}`,
                                                        'Cumulative Total'
                                                    ]}
                                                    labelFormatter={(label) => `Date: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="cumulative"
                                                    stroke="#16a34a"
                                                    strokeWidth={3}
                                                    dot={false}
                                                    activeDot={{ r: 6, stroke: '#16a34a', strokeWidth: 2 }}
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

                            {/* Data Points and Evidence Sections - 2/5 width */}
                            <div className="lg:col-span-2 space-y-4">
                                {/* Data Points Section */}
                                <div className="bg-gradient-to-br from-blue-50/30 to-indigo-50/20 border border-blue-100/60 rounded-xl p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h5 className="text-lg font-semibold text-gray-900">Data Points</h5>
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                <BarChart3 className="w-4 h-4" />
                                                <span>{kpi.total_updates || 0} total</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onAddUpdate()
                                                }}
                                                className="flex items-center space-x-1 px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span>Add</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                                        {kpiUpdates && kpiUpdates.length > 0 ? (
                                            kpiUpdates.map((update, index) => {
                                                const hasDateRange = update.date_range_start && update.date_range_end
                                                const displayDate = hasDateRange
                                                    ? `${new Date(update.date_range_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(update.date_range_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                                                    : new Date(update.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

                                                return (
                                                    <div
                                                        key={update.id || index}
                                                        className="border border-blue-100/60 rounded-md bg-white/50 hover:bg-blue-50/50 cursor-pointer transition-colors p-2"
                                                        onClick={() => handleDataPointClick(update)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center space-x-2">
                                                                    <span className="text-sm font-semibold text-blue-600">
                                                                        {update.value?.toLocaleString()} {kpi.unit_of_measurement}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center space-x-2 mt-0.5">
                                                                    <Calendar className="w-3 h-3 text-gray-400" />
                                                                    <span className="text-xs text-gray-500">{displayDate}</span>
                                                                </div>
                                                            </div>
                                                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                                                        </div>
                                                    </div>
                                                )
                                            })
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
                                        <div className="flex items-center space-x-2">
                                            <div className="flex items-center space-x-2 text-sm text-gray-500">
                                                <FileText className="w-4 h-4" />
                                                <span>{kpi.evidence_count || 0} items</span>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onAddEvidence()
                                                }}
                                                className="flex items-center space-x-1 px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded text-xs font-medium transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span>Add</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto space-y-1.5">
                                        {loadingEvidence ? (
                                            <div className="text-center py-8 text-gray-500">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto mb-2"></div>
                                                <p className="text-sm">Loading evidence...</p>
                                            </div>
                                        ) : evidence.length > 0 ? (
                                            evidence.map((evidenceItem) => {
                                                return (
                                                    <div
                                                        key={evidenceItem.id}
                                                        className="border border-green-100/60 rounded-md bg-white/50 hover:bg-green-50/50 cursor-pointer transition-colors p-2"
                                                        onClick={() => handleEvidenceClick(evidenceItem)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                                <div className="w-5 h-5 bg-green-100 rounded flex items-center justify-center flex-shrink-0">
                                                                    <FileText className="w-3 h-3 text-green-600" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-xs font-medium text-gray-900 truncate">
                                                                        {evidenceItem.title || 'Untitled Evidence'}
                                                                    </div>
                                                                    <div className="text-xs text-gray-500">
                                                                        Click to view
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <Eye className="w-3.5 h-3.5 text-gray-400" />
                                                        </div>
                                                    </div>
                                                )
                                            })
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
                </div>,
                document.body
            )}

            {/* Data Point Preview Modal */}
            {selectedDataPoint && createPortal(
                <DataPointPreviewModal
                    dataPoint={selectedDataPoint}
                    kpi={kpi}
                    isOpen={isDataPointPreviewOpen}
                    onClose={() => {
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                    }}
                    onEdit={(dataPoint) => {
                        setEditingDataPoint(dataPoint)
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                        setIsEditDataPointModalOpen(true)
                    }}
                    onDelete={(dataPoint) => {
                        setDeleteConfirmDataPoint(dataPoint)
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                    }}
                />,
                document.body
            )}

            {/* Evidence Preview Modal - Rendered outside portal */}
            {selectedEvidence && createPortal(
                <EvidencePreviewModal
                    evidence={selectedEvidence}
                    isOpen={isEvidencePreviewOpen}
                    onClose={() => setIsEvidencePreviewOpen(false)}
                    onEdit={(evidence) => {
                        setSelectedEvidence(evidence)
                        setIsEvidencePreviewOpen(false)
                        setIsEditEvidenceModalOpen(true)
                    }}
                />,
                document.body
            )}

            {/* Edit Data Point Modal */}
            {editingDataPoint && createPortal(
                <AddKPIUpdateModal
                    isOpen={isEditDataPointModalOpen}
                    onClose={() => {
                        setIsEditDataPointModalOpen(false)
                        setEditingDataPoint(null)
                    }}
                    onSubmit={handleUpdateDataPoint}
                    kpiTitle={kpi.title}
                    kpiId={kpi.id}
                    metricType={kpi.metric_type || 'number'}
                    unitOfMeasurement={kpi.unit_of_measurement || ''}
                />,
                document.body
            )}

            {/* Edit Evidence Modal */}
            {selectedEvidence && createPortal(
                <AddEvidenceModal
                    isOpen={isEditEvidenceModalOpen}
                    onClose={() => {
                        setIsEditEvidenceModalOpen(false)
                        setSelectedEvidence(null)
                    }}
                    onSubmit={handleUpdateEvidence}
                    availableKPIs={[kpi]}
                    initiativeId={kpi.initiative_id}
                    preSelectedKPIId={kpi.id}
                    editData={selectedEvidence}
                />,
                document.body
            )}

            {/* Delete Data Point Confirmation */}
            {deleteConfirmDataPoint && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
                    <div className="bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-3xl max-w-md w-full p-8 shadow-2xl shadow-gray-900/20">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete Data Point</h3>
                            <p className="text-gray-500">This action cannot be undone</p>
                        </div>

                        <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 border border-red-100/60 rounded-2xl p-4 mb-6">
                            <p className="text-gray-700 text-center">
                                Are you sure you want to delete this data point?
                            </p>
                            <p className="text-sm text-gray-600 text-center mt-2">
                                This will permanently remove the data point and its associated information.
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmDataPoint(null)}
                                className="flex-1 px-6 py-3 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteDataPoint(deleteConfirmDataPoint)}
                                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                            >
                                Delete Data Point
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete Evidence Confirmation */}
            {deleteConfirmEvidence && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
                    <div className="bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-3xl max-w-md w-full p-8 shadow-2xl shadow-gray-900/20">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete Evidence</h3>
                            <p className="text-gray-500">This action cannot be undone</p>
                        </div>

                        <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 border border-red-100/60 rounded-2xl p-4 mb-6">
                            <p className="text-gray-700 text-center">
                                Are you sure you want to delete this evidence?
                            </p>
                            <p className="text-sm text-gray-600 text-center mt-2">
                                This will permanently remove the evidence and its associated information.
                            </p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmEvidence(null)}
                                className="flex-1 px-6 py-3 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteEvidence(deleteConfirmEvidence)}
                                className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                            >
                                Delete Evidence
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
