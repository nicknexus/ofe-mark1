import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    ArrowLeft,
    Plus,
    Target,
    BarChart3,
    FileText,
    Calendar,
    MapPin,
    Percent,
    Hash,
    TrendingUp,
    Upload,
    Eye
} from 'lucide-react'
import { apiService } from '../services/api'
import { InitiativeDashboard, LoadingState, CreateKPIForm, CreateKPIUpdateForm, CreateEvidenceForm } from '../types'
import { formatDate, getEvidenceColor, getCategoryColor, getEvidenceTypeInfo, getEvidenceStatus } from '../utils'
import CreateKPIModal from '../components/CreateKPIModal'
import AddKPIUpdateModal from '../components/AddKPIUpdateModal'
import AddEvidenceModal from '../components/AddEvidenceModal'
import InitiativeCharts from '../components/InitiativeCharts'
import toast from 'react-hot-toast'

export default function InitiativePage() {
    const { id } = useParams<{ id: string }>()
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })

    // Modal states
    const [isKPIModalOpen, setIsKPIModalOpen] = useState(false)
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)

    // Selected KPI for modals
    const [selectedKPI, setSelectedKPI] = useState<any>(null)

    useEffect(() => {
        if (id) {
            loadDashboard()
        }
    }, [id])

    const loadDashboard = async () => {
        if (!id) return

        try {
            setLoadingState({ isLoading: true })
            const data = await apiService.getInitiativeDashboard(id)
            setDashboard(data)
            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load dashboard'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        }
    }

    const handleCreateKPI = async (kpiData: CreateKPIForm) => {
        try {
            await apiService.createKPI(kpiData)
            toast.success('KPI created successfully!')
            loadDashboard() // Refresh the dashboard
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create KPI'
            toast.error(message)
            throw error // Re-throw to keep modal open on error
        }
    }

    const handleAddKPIUpdate = async (updateData: CreateKPIUpdateForm) => {
        if (!selectedKPI) return

        try {
            await apiService.createKPIUpdate(selectedKPI.id, updateData)
            toast.success('KPI update added successfully!')
            loadDashboard() // Refresh the dashboard
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add KPI update'
            toast.error(message)
            throw error
        }
    }

    const handleAddEvidence = async (evidenceData: CreateEvidenceForm) => {
        try {
            await apiService.createEvidence(evidenceData)
            toast.success('Evidence added successfully!')
            loadDashboard() // Refresh the dashboard
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
            throw error
        }
    }

    const openUpdateModal = (kpi: any) => {
        setSelectedKPI(kpi)
        setIsUpdateModalOpen(true)
    }

    const openEvidenceModal = (kpi?: any) => {
        if (kpi) {
            setSelectedKPI(kpi)
        }
        setIsEvidenceModalOpen(true)
    }

    if (loadingState.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (loadingState.error || !dashboard) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-4">{loadingState.error || 'Initiative not found'}</div>
                <div className="space-x-4">
                    <Link to="/" className="btn-secondary">
                        Back to Dashboard
                    </Link>
                    <button onClick={loadDashboard} className="btn-primary">
                        Try Again
                    </button>
                </div>
            </div>
        )
    }

    const { initiative, kpis, stats } = dashboard

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
                <Link
                    to="/"
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors self-start"
                >
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">{initiative.title}</h1>
                    <p className="text-gray-600 mt-1 text-sm sm:text-base line-clamp-2">{initiative.description}</p>
                </div>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                    {kpis.length > 0 && (
                        <button
                            onClick={() => openEvidenceModal()}
                            className="btn-secondary flex items-center justify-center space-x-2 text-sm w-full sm:w-auto"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="sm:inline">Add Evidence</span>
                        </button>
                    )}
                    <button
                        onClick={() => setIsKPIModalOpen(true)}
                        className="btn-primary flex items-center justify-center space-x-2 text-sm w-full sm:w-auto"
                    >
                        <Plus className="w-4 h-4" />
                        <span>{kpis.length === 0 ? 'Add First KPI' : 'Add KPI'}</span>
                    </button>
                </div>
            </div>

            {kpis.length === 0 ? (
                /* Empty State - First Time */
                <div className="card p-6 sm:p-8 lg:p-12 text-center">
                    <Target className="w-12 h-12 sm:w-16 sm:h-16 text-gray-400 mx-auto mb-4 sm:mb-6" />
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4">
                        Create Your First KPI
                    </h3>
                    <p className="text-gray-600 mb-6 sm:mb-8 max-w-md mx-auto text-sm sm:text-base px-2 sm:px-0">
                        KPIs are the specific metrics you want to track, like "Students Trained" or "Wells Built"
                    </p>
                    <button
                        onClick={() => setIsKPIModalOpen(true)}
                        className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-2.5 sm:py-3 w-full sm:w-auto"
                    >
                        Add First KPI
                    </button>
                    <p className="text-xs sm:text-sm text-gray-500 mt-3 sm:mt-4 px-4 sm:px-0">
                        💡 Example: "Number of people trained" or "Clean water access provided"
                    </p>
                </div>
            ) : (
                /* Main Layout - Stack on mobile, side-by-side on desktop */
                <div className="space-y-6 lg:grid lg:grid-cols-3 lg:gap-6 lg:space-y-0">
                    {/* Main Content - KPIs */}
                    <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                        {/* Quick Stats Bar */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                            <div className="card p-3 sm:p-4 text-center">
                                <p className="text-xl sm:text-2xl font-bold text-primary-600">{stats.total_kpis}</p>
                                <p className="text-xs sm:text-sm text-gray-600">Active KPIs</p>
                            </div>
                            <div className="card p-3 sm:p-4 text-center">
                                <p className="text-xl sm:text-2xl font-bold text-green-600">{stats.evidence_coverage_percentage}%</p>
                                <p className="text-xs sm:text-sm text-gray-600">Evidence Coverage</p>
                            </div>
                            <div className="card p-3 sm:p-4 text-center">
                                <p className="text-xl sm:text-2xl font-bold text-blue-600">{stats.recent_updates}</p>
                                <p className="text-xs sm:text-sm text-gray-600">Data Points</p>
                            </div>
                        </div>

                        {/* KPIs List - Front and Center */}
                        <div className="card p-4 sm:p-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-2 sm:space-y-0">
                                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Your KPIs</h3>
                                <button
                                    onClick={() => setIsKPIModalOpen(true)}
                                    className="btn-secondary flex items-center justify-center space-x-2 text-sm w-full sm:w-auto"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add KPI</span>
                                </button>
                            </div>

                            <div className="space-y-3 sm:space-y-4">
                                {kpis.map((kpi) => (
                                    <div key={kpi.id} className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-sm transition-shadow">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between space-y-2 sm:space-y-0 mb-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-3 mb-1">
                                                    <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{kpi.title}</h4>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium self-start ${getCategoryColor(kpi.category)}`}>
                                                        {kpi.category}
                                                    </span>
                                                </div>
                                                <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{kpi.description}</p>
                                            </div>

                                            <div className="text-left sm:text-right sm:ml-4">
                                                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getEvidenceColor(kpi.evidence_percentage)}`}>
                                                    {kpi.evidence_percentage}% proven
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quick Stats */}
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                                            <div className="flex items-center space-x-3 sm:space-x-4 text-xs sm:text-sm text-gray-500">
                                                <span>{kpi.total_updates} data points</span>
                                                <span>{kpi.evidence_count} evidence</span>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                                                <button
                                                    onClick={() => openUpdateModal(kpi)}
                                                    className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded text-xs sm:text-sm hover:bg-primary-100 transition-colors text-center"
                                                >
                                                    Add Data
                                                </button>
                                                {kpi.total_updates > 0 && (
                                                    <button
                                                        onClick={() => openEvidenceModal(kpi)}
                                                        className="px-3 py-1.5 bg-green-50 text-green-700 rounded text-xs sm:text-sm hover:bg-green-100 transition-colors text-center"
                                                    >
                                                        Add Evidence
                                                    </button>
                                                )}
                                                <Link
                                                    to={`/initiatives/${id}/kpis/${kpi.id}`}
                                                    className="px-3 py-1.5 text-gray-600 hover:text-gray-800 rounded text-xs sm:text-sm hover:bg-gray-100 transition-colors text-center"
                                                >
                                                    View Details
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Analytics & Progress */}
                    <div className="space-y-4 sm:space-y-6">
                        {/* Progress Checklist */}
                        <div className="card p-3 sm:p-4">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-3 sm:mb-4">Your Progress</h3>
                            <div className="space-y-2 sm:space-y-3">
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs">
                                        ✓
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-700">{kpis.length} KPIs created</span>
                                </div>
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs ${stats.recent_updates > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                                        }`}>
                                        {stats.recent_updates > 0 ? '✓' : '2'}
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-700">
                                        {stats.recent_updates > 0 ? `${stats.recent_updates} data points added` : 'Add data points'}
                                    </span>
                                </div>
                                <div className="flex items-center space-x-2 sm:space-x-3">
                                    <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-xs ${stats.evidence_coverage_percentage > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-600'
                                        }`}>
                                        {stats.evidence_coverage_percentage > 0 ? '✓' : '3'}
                                    </div>
                                    <span className="text-xs sm:text-sm text-gray-700">
                                        {stats.evidence_coverage_percentage > 0 ? `${stats.evidence_coverage_percentage}% evidence coverage` : 'Upload evidence'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="card p-3 sm:p-4">
                            <h4 className="text-sm sm:text-base font-medium text-gray-900 mb-2 sm:mb-3">Quick Actions</h4>
                            <div className="space-y-2">
                                <button
                                    onClick={() => setIsKPIModalOpen(true)}
                                    className="w-full text-left px-3 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    + Add new KPI
                                </button>
                                <button
                                    onClick={() => openEvidenceModal()}
                                    className="w-full text-left px-3 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    📎 Upload evidence
                                </button>
                                {stats.recent_updates === 0 && (
                                    <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                        <p className="text-xs text-blue-800">
                                            💡 <strong>Next:</strong> Add data to your KPIs
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modals */}
            <CreateKPIModal
                isOpen={isKPIModalOpen}
                onClose={() => setIsKPIModalOpen(false)}
                onSubmit={handleCreateKPI}
                initiativeId={id!}
            />

            {selectedKPI && (
                <AddKPIUpdateModal
                    isOpen={isUpdateModalOpen}
                    onClose={() => {
                        setIsUpdateModalOpen(false)
                        setSelectedKPI(null)
                    }}
                    onSubmit={handleAddKPIUpdate}
                    kpiTitle={selectedKPI.title}
                    kpiId={selectedKPI.id}
                    metricType={selectedKPI.metric_type}
                    unitOfMeasurement={selectedKPI.unit_of_measurement}
                />
            )}

            <AddEvidenceModal
                isOpen={isEvidenceModalOpen}
                onClose={() => {
                    setIsEvidenceModalOpen(false)
                    setSelectedKPI(null)
                }}
                onSubmit={handleAddEvidence}
                availableKPIs={kpis}
                initiativeId={id!}
                preSelectedKPIId={selectedKPI?.id}
            />
        </div>
    )
}