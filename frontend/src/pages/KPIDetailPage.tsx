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
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center space-x-4">
                <Link
                    to={`/initiatives/${initiativeId}`}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-gray-900">{kpi.title}</h1>
                    <p className="text-gray-600 mt-1">{kpi.description}</p>
                </div>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsEvidenceModalOpen(true)}
                        className="btn-secondary flex items-center space-x-2"
                    >
                        <Upload className="w-4 h-4" />
                        <span>Add Evidence</span>
                    </button>
                    <button
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="btn-primary flex items-center space-x-2"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Data</span>
                    </button>
                </div>
            </div>

            {/* Quick Stats Bar */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{updates.length}</p>
                    <p className="text-sm text-gray-600">Data Points</p>
                </div>
                <div className="card p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{evidence.length}</p>
                    <p className="text-sm text-gray-600">Evidence Items</p>
                </div>
                <div className="card p-4 text-center">
                    <p className={`text-2xl font-bold ${proofPercentage >= 80 ? 'text-green-600' :
                        proofPercentage >= 30 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                        {proofPercentage}%
                    </p>
                    <p className="text-sm text-gray-600">Proven</p>
                </div>
            </div>

            {/* Charts Section - Wide Layout */}
            {updates.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Individual Data Points Chart */}
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
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
                    <div className="card p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Evidence Coverage
                        </h3>
                        <div className="flex items-center justify-center" style={{ height: '250px' }}>
                            <div className="text-center">
                                {/* Large Percentage Circle */}
                                <div className={`inline-flex items-center justify-center w-32 h-32 rounded-full text-4xl font-bold mb-6 ${proofPercentage >= 80 ? 'bg-green-100 text-green-600' :
                                        proofPercentage >= 30 ? 'bg-yellow-100 text-yellow-600' :
                                            'bg-red-100 text-red-600'
                                    }`}>
                                    {proofPercentage}%
                                </div>

                                {/* Stats Grid */}
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
            )}

            {/* Main Content - Side by Side Layout */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Column - Data & Evidence (Takes more space) */}
                <div className="xl:col-span-2 space-y-6">
                    {/* Data Updates */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Data Updates</h3>
                            <button
                                onClick={() => setIsUpdateModalOpen(true)}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Update</span>
                            </button>
                        </div>

                        {updates.length === 0 ? (
                            <div className="text-center py-8">
                                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">No data updates yet</h4>
                                <p className="text-gray-600 mb-4">Add your first data point to start tracking progress</p>
                                <button
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="btn-primary"
                                >
                                    Add First Update
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {updates.slice(0, 5).map((update) => (
                                    <div key={update.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-4">
                                                <div className="text-xl font-bold text-primary-600">
                                                    {update.value}
                                                    <span className="text-sm text-gray-500 ml-1">
                                                        {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                                    </span>
                                                </div>
                                                {update.label && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                                        {update.label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center text-sm text-gray-500">
                                                    <Calendar className="w-4 h-4 mr-1" />
                                                    <span>{formatDate(update.date_represented)}</span>
                                                </div>
                                                {update.note && (
                                                    <p className="text-xs text-gray-500 mt-1 italic">{update.note}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {updates.length > 5 && (
                                    <div className="text-center py-2">
                                        <p className="text-sm text-gray-500">
                                            +{updates.length - 5} more updates
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Evidence Section */}
                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Supporting Evidence</h3>
                            <button
                                onClick={() => setIsEvidenceModalOpen(true)}
                                className="btn-secondary flex items-center space-x-2"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Add Evidence</span>
                            </button>
                        </div>

                        {evidence.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                <h4 className="text-lg font-medium text-gray-900 mb-2">No evidence yet</h4>
                                <p className="text-gray-600 mb-4">Upload files, photos, or documents to prove your impact</p>
                                <button
                                    onClick={() => setIsEvidenceModalOpen(true)}
                                    className="btn-primary"
                                >
                                    Add First Evidence
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-4">
                                {evidence.slice(0, 4).map((item) => {
                                    const typeInfo = getEvidenceTypeInfo(item.type)
                                    const hasFileUrl = item.file_url && item.file_url.trim() !== ''
                                    const isExternalURL = hasFileUrl && item.file_url!.startsWith('http')
                                    const isUploadedFile = hasFileUrl && item.file_url!.startsWith('/uploads/')
                                    const isImage = hasFileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.file_url!)
                                    const isPDF = hasFileUrl && item.file_url!.toLowerCase().includes('.pdf')

                                    return (
                                        <div key={item.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                            <div className="flex items-start space-x-3">
                                                <div className={`p-2 rounded-lg ${typeInfo.color.replace('text-', 'bg-').replace('-600', '-100')} ${typeInfo.color}`}>
                                                    {typeInfo.icon === '📷' ? <Camera className="w-4 h-4" /> :
                                                        typeInfo.icon === '📄' ? <FileText className="w-4 h-4" /> :
                                                            typeInfo.icon === '💬' ? <MessageSquare className="w-4 h-4" /> :
                                                                <DollarSign className="w-4 h-4" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-medium text-gray-900 line-clamp-1">{item.title}</h4>
                                                    {item.description && (
                                                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">{item.description}</p>
                                                    )}

                                                    {/* Evidence Actions */}
                                                    {hasFileUrl ? (
                                                        <div className="mt-2">
                                                            {isImage ? (
                                                                <div className="flex items-center space-x-2">
                                                                    <img
                                                                        src={`http://localhost:3001${item.file_url}`}
                                                                        alt={item.title}
                                                                        className="w-16 h-16 object-cover rounded border cursor-pointer hover:opacity-90"
                                                                        onClick={() => window.open(`http://localhost:3001${item.file_url}`, '_blank')}
                                                                    />
                                                                    <button
                                                                        onClick={() => window.open(`http://localhost:3001${item.file_url}`, '_blank')}
                                                                        className="text-blue-600 hover:text-blue-800 text-sm"
                                                                    >
                                                                        View Full Size
                                                                    </button>
                                                                </div>
                                                            ) : isExternalURL ? (
                                                                <a
                                                                    href={item.file_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" />
                                                                    <span>Open Link</span>
                                                                </a>
                                                            ) : isUploadedFile ? (
                                                                <a
                                                                    href={`http://localhost:3001${item.file_url}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                                                                >
                                                                    {isPDF ? <FileText className="w-3 h-3" /> : <Download className="w-3 h-3" />}
                                                                    <span>{isPDF ? 'View PDF' : 'Download'}</span>
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-500 mt-1">Text-based evidence</p>
                                                    )}

                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex items-center text-xs text-gray-500">
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            <span>{formatDate(item.date_represented)}</span>
                                                        </div>
                                                        <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                                                            {typeInfo.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                {evidence.length > 4 && (
                                    <div className="text-center py-2">
                                        <p className="text-sm text-gray-500">
                                            +{evidence.length - 4} more evidence items
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Column - Analytics & Charts */}
                <div className="space-y-6">
                    {/* Progress Summary */}
                    <div className="card p-4">
                        <h3 className="font-semibold text-gray-900 mb-4">Progress Summary</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Latest Value</span>
                                <span className="font-medium">
                                    {updates.length > 0 ? `${updates[0].value} ${kpi.unit_of_measurement}` : 'No data'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Evidence Coverage</span>
                                <span className={`font-medium ${proofPercentage >= 80 ? 'text-green-600' :
                                    proofPercentage >= 30 ? 'text-yellow-600' : 'text-red-600'
                                    }`}>
                                    {proofPercentage}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Total Data Points</span>
                                <span className="font-medium">{updates.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Evidence Items</span>
                                <span className="font-medium">{evidence.length}</span>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="card p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
                        <div className="space-y-2">
                            <button
                                onClick={() => setIsUpdateModalOpen(true)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                📊 Add data point
                            </button>
                            <button
                                onClick={() => setIsEvidenceModalOpen(true)}
                                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                📎 Upload evidence
                            </button>
                            <Link
                                to={`/initiatives/${initiativeId}`}
                                className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                ⬅️ Back to initiative
                            </Link>
                        </div>
                    </div>
                </div>
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
        </div>
    )
} 