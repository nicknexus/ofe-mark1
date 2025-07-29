import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Plus,
    Calendar,
    Hash,
    Percent,
    TrendingUp,
    Upload,
    Eye,
    Edit,
    Trash2,
    MapPin,
    Clock,
    FileText,
    Camera,
    Download,
    ExternalLink,
    MessageSquare,
    DollarSign,
    BarChart3
} from 'lucide-react'
import { apiService } from '../services/api'
import { KPI, KPIUpdate, LoadingState, CreateKPIUpdateForm, CreateEvidenceForm, Evidence } from '../types'
import { formatDate, getEvidenceColor, getCategoryColor, getEvidenceTypeInfo } from '../utils'
import AddKPIUpdateModal from '../components/AddKPIUpdateModal'
import AddEvidenceModal from '../components/AddEvidenceModal'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export default function KPIDetailPage() {
    const { initiativeId, kpiId } = useParams<{ initiativeId: string; kpiId: string }>()
    const [kpi, setKPI] = useState<KPI | null>(null)
    const [updates, setUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })

    // Modal states
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)

    useEffect(() => {
        if (kpiId) {
            loadKPIData()
        }
    }, [kpiId])

    const loadKPIData = async () => {
        if (!kpiId) return

        try {
            setLoadingState({ isLoading: true })
            const [kpiData, updatesData, evidenceData] = await Promise.all([
                apiService.getKPI(kpiId),
                apiService.getKPIUpdates(kpiId),
                apiService.getEvidence(undefined, kpiId)
            ])

            setKPI(kpiData)
            setUpdates(updatesData)
            setEvidence(evidenceData)
            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load KPI data'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        }
    }

    const handleAddUpdate = async (updateData: CreateKPIUpdateForm) => {
        if (!kpiId) return

        try {
            await apiService.createKPIUpdate(kpiId, updateData)
            toast.success('Update added successfully!')
            loadKPIData() // Refresh data
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add update'
            toast.error(message)
            throw error
        }
    }

    const handleAddEvidence = async (evidenceData: CreateEvidenceForm) => {
        try {
            await apiService.createEvidence(evidenceData)
            toast.success('Evidence added successfully!')
            loadKPIData() // Refresh data
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
            throw error
        }
    }

    const getEvidenceProofPercentage = () => {
        if (updates.length === 0) return 0
        const updatesWithEvidence = updates.filter(update =>
            evidence.some(ev =>
                ev.date_represented === update.date_represented ||
                (ev.date_range_start && ev.date_range_end &&
                    update.date_represented >= ev.date_range_start &&
                    update.date_represented <= ev.date_range_end)
            )
        )
        return Math.round((updatesWithEvidence.length / updates.length) * 100)
    }

    if (loadingState.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (loadingState.error || !kpi) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-4">{loadingState.error || 'KPI not found'}</div>
                <Link to={`/initiatives/${initiativeId}`} className="btn-primary">
                    Back to Initiative
                </Link>
            </div>
        )
    }

    const proofPercentage = getEvidenceProofPercentage()

    return (
        <>
            {/* Header with back navigation */}
            <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                    <div className="flex items-center space-x-3 min-w-0">
                        <Link
                            to={`/initiatives/${initiativeId}`}
                            className="text-gray-500 hover:text-gray-700 transition-colors p-1 -ml-1"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="min-w-0">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                                {kpi.title}
                            </h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(kpi.category)}`}>
                                    {kpi.category}
                                </span>
                                <span className="text-gray-500 text-sm">
                                    {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 sm:flex-shrink-0">
                        <button
                            onClick={() => setIsEvidenceModalOpen(true)}
                            className="btn-secondary flex items-center justify-center space-x-2 text-sm"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:inline">Add Evidence</span>
                            <span className="sm:hidden">Evidence</span>
                        </button>
                        <button
                            onClick={() => setIsUpdateModalOpen(true)}
                            className="btn-primary flex items-center justify-center space-x-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Data</span>
                        </button>
                    </div>
                </div>

                {/* Quick Stats Bar */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="card p-3 sm:p-4 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-blue-600">{updates.length}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Data Points</p>
                    </div>
                    <div className="card p-3 sm:p-4 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-green-600">{evidence.length}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Evidence Items</p>
                    </div>
                    <div className="card p-3 sm:p-4 text-center">
                        <p className={`text-lg sm:text-2xl font-bold ${proofPercentage >= 80 ? 'text-green-600' :
                            proofPercentage >= 30 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                            {proofPercentage}%
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">Proven</p>
                    </div>
                </div>

                {/* Data and Evidence Lists - Full width on desktop */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                    {/* Data Updates Timeline */}
                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                Data Updates ({updates.length})
                            </h3>
                            <button
                                onClick={() => setIsUpdateModalOpen(true)}
                                className="btn-secondary flex items-center space-x-2 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline">Add Data</span>
                                <span className="sm:hidden">Add</span>
                            </button>
                        </div>

                        {updates.length === 0 ? (
                            <div className="text-center py-8">
                                <Calendar className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 text-sm sm:text-base">No data points yet</p>
                                <button
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="btn-primary mt-4 text-sm"
                                >
                                    Add First Data Point
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {updates
                                    .sort((a, b) => new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
                                    .map((update) => (
                                        <div key={update.id} className="p-3 border border-gray-200 rounded-lg">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                                                <div className="min-w-0">
                                                    <div className="flex items-center space-x-2">
                                                        <span className="text-lg sm:text-xl font-bold text-primary-600">
                                                            {update.value} {kpi.unit_of_measurement}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs sm:text-sm text-gray-600">
                                                        {formatDate(update.date_represented)}
                                                    </p>
                                                    {update.note && (
                                                        <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">
                                                            {update.note}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex items-center space-x-2 text-xs">
                                                    {evidence.some(ev =>
                                                        ev.date_represented === update.date_represented ||
                                                        (ev.date_range_start && ev.date_range_end &&
                                                            update.date_represented >= ev.date_range_start &&
                                                            update.date_represented <= ev.date_range_end)
                                                    ) ? (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                            ✓ Proven
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                                            No evidence
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </div>

                    {/* Evidence List */}
                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                Evidence ({evidence.length})
                            </h3>
                            <button
                                onClick={() => setIsEvidenceModalOpen(true)}
                                className="btn-secondary flex items-center space-x-2 text-sm"
                            >
                                <Upload className="w-4 h-4" />
                                <span className="hidden sm:inline">Add Evidence</span>
                                <span className="sm:hidden">Add</span>
                            </button>
                        </div>

                        {evidence.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 text-sm sm:text-base">No evidence uploaded</p>
                                <button
                                    onClick={() => setIsEvidenceModalOpen(true)}
                                    className="btn-primary mt-4 text-sm"
                                >
                                    Upload First Evidence
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {evidence
                                    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                                    .map((item) => {
                                        const typeInfo = getEvidenceTypeInfo(item.type)
                                        const IconComponent = item.type === 'visual_proof' ? Camera :
                                            item.type === 'documentation' ? FileText :
                                                item.type === 'testimony' ? MessageSquare : DollarSign
                                        return (
                                            <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                                                <div className="flex items-start space-x-3">
                                                    <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                                                        <IconComponent className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-sm font-medium text-gray-900 truncate">
                                                            {item.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-600">
                                                            {formatDate(item.date_represented)}
                                                        </p>
                                                        {item.description && (
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                                {item.description}
                                                            </p>
                                                        )}
                                                        {item.file_url && (
                                                            <div className="mt-2">
                                                                <a
                                                                    href={item.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center space-x-1 text-xs text-primary-600 hover:text-primary-700"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    <span>View File</span>
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Charts Section - Full width at bottom on desktop */}
                {updates.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Individual Data Points Chart */}
                        <div className="card p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                                Individual Data Points
                            </h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={updates
                                    .sort((a, b) => new Date(a.date_represented).getTime() - new Date(b.date_represented).getTime())
                                    .map(update => ({
                                        date: new Date(update.date_represented).toLocaleDateString('en-US', {
                                            month: 'short',
                                            day: 'numeric'
                                        }),
                                        value: update.value,
                                        label: update.label || update.note
                                    }))}>
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
                                            'Value'
                                        ]}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#16a34a"
                                        strokeWidth={3}
                                        dot={{ fill: '#16a34a', r: 6 }}
                                        activeDot={{ r: 8, stroke: '#16a34a', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Evidence Coverage Visualization */}
                        <div className="card p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                                Evidence Coverage
                            </h3>
                            <div className="flex items-center justify-center" style={{ height: '250px' }}>
                                <div className="text-center">
                                    {/* Large Percentage Circle */}
                                    <div className={`inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-full text-2xl sm:text-4xl font-bold mb-4 sm:mb-6 ${proofPercentage >= 80 ? 'bg-green-100 text-green-600' :
                                        proofPercentage >= 30 ? 'bg-yellow-100 text-yellow-600' :
                                            'bg-red-100 text-red-600'
                                        }`}>
                                        {proofPercentage}%
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center">
                                        <div>
                                            <p className="text-lg sm:text-xl font-bold text-gray-900">{updates.length}</p>
                                            <p className="text-xs text-gray-600">Updates</p>
                                        </div>
                                        <div>
                                            <p className="text-lg sm:text-xl font-bold text-gray-900">{evidence.length}</p>
                                            <p className="text-xs text-gray-600">Evidence</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            <AddKPIUpdateModal
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                onSubmit={handleAddUpdate}
                kpiTitle={kpi.title}
                kpiId={kpi.id!}
                metricType={kpi.metric_type}
                unitOfMeasurement={kpi.unit_of_measurement}
            />

            <AddEvidenceModal
                isOpen={isEvidenceModalOpen}
                onClose={() => setIsEvidenceModalOpen(false)}
                onSubmit={handleAddEvidence}
                availableKPIs={[kpi]}
                initiativeId={initiativeId!}
                preSelectedKPIId={kpi.id}
            />
        </>
    )
} 