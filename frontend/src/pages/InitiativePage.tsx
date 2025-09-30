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
    Eye,
    Edit,
    Trash2,
    Camera,
    MessageSquare,
    DollarSign
} from 'lucide-react'
import { apiService } from '../services/api'
import { InitiativeDashboard, LoadingState, CreateKPIForm, CreateKPIUpdateForm, CreateEvidenceForm } from '../types'
import { formatDate, getEvidenceColor, getCategoryColor, getEvidenceTypeInfo, getEvidenceStatus } from '../utils'
import CreateKPIModal from '../components/CreateKPIModal'
import AddKPIUpdateModal from '../components/AddKPIUpdateModal'
import AddEvidenceModal from '../components/AddEvidenceModal'
import InitiativeCharts from '../components/InitiativeCharts'
import BeneficiaryManager from '../components/BeneficiaryManager'
import toast from 'react-hot-toast'

export default function InitiativePage() {
    const { id } = useParams<{ id: string }>()
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
    const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'input' | 'output' | 'impact'>('all')

    // Modal states
    const [isKPIModalOpen, setIsKPIModalOpen] = useState(false)
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
    const [isEditKPIModalOpen, setIsEditKPIModalOpen] = useState(false)
    const [deleteConfirmKPI, setDeleteConfirmKPI] = useState<any>(null)

    // Selected KPI for modals
    const [selectedKPI, setSelectedKPI] = useState<any>(null)

    useEffect(() => {
        if (id) {
            loadDashboard()
        }
    }, [id])

    const loadKPITotals = async (kpis: any[]) => {
        const totals: Record<string, number> = {}

        // Load updates for each KPI and calculate totals
        await Promise.all(kpis.map(async (kpi) => {
            try {
                const updates = await apiService.getKPIUpdates(kpi.id)
                totals[kpi.id] = updates.reduce((sum: number, update: any) => sum + (update.value || 0), 0)
            } catch (error) {
                console.warn(`Failed to load updates for KPI ${kpi.id}:`, error)
                totals[kpi.id] = 0
            }
        }))

        setKpiTotals(totals)
    }

    const loadDashboard = async () => {
        if (!id || isLoadingDashboard) return

        try {
            setIsLoadingDashboard(true)
            setLoadingState({ isLoading: true })
            const data = await apiService.getInitiativeDashboard(id)
            setDashboard(data)

            // Load KPI totals after dashboard loads
            if (data?.kpis) {
                await loadKPITotals(data.kpis)
            }

            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load dashboard'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        } finally {
            setIsLoadingDashboard(false)
        }
    }

    const handleCreateKPI = async (kpiData: CreateKPIForm) => {
        try {
            await apiService.createKPI(kpiData)
            toast.success('KPI created successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create KPI'
            toast.error(message)
            throw error // Re-throw to keep modal open on error
        }
    }

    const handleEditKPI = async (kpiData: CreateKPIForm) => {
        if (!selectedKPI) return
        try {
            await apiService.updateKPI(selectedKPI.id, kpiData)
            toast.success('KPI updated successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
            setIsEditKPIModalOpen(false)
            setSelectedKPI(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update KPI'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteKPI = async (kpi: any) => {
        try {
            await apiService.deleteKPI(kpi.id)
            toast.success('KPI deleted successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
            setDeleteConfirmKPI(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete KPI'
            toast.error(message)
        }
    }

    const handleAddKPIUpdate = async (updateData: CreateKPIUpdateForm) => {
        if (!selectedKPI) return

        try {
            await apiService.createKPIUpdate(selectedKPI.id, updateData)
            toast.success('KPI update added successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
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

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
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

    const openEditModal = (kpi: any) => {
        setSelectedKPI(kpi)
        setIsEditKPIModalOpen(true)
    }

    const openDeleteConfirm = (kpi: any) => {
        setDeleteConfirmKPI(kpi)
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
                    <button onClick={loadDashboard} className="btn-primary" disabled={isLoadingDashboard}>
                        {isLoadingDashboard ? 'Loading...' : 'Try Again'}
                    </button>
                </div>
            </div>
        )
    }

    const { initiative, kpis, stats } = dashboard

    // Filter KPIs based on category
    const filteredKpis = categoryFilter === 'all'
        ? kpis
        : kpis.filter(kpi => kpi.category === categoryFilter)

    const getEvidenceIcon = (type: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
            {/* Compact Header with Blur Effect */}
            <div className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-200/60">
                <div className="w-full px-4 sm:px-6">
                    <div className="flex items-center justify-between h-12 sm:h-14">
                        <div className="flex items-center space-x-3">
                            <Link
                                to="/"
                                className="group flex items-center justify-center w-8 h-8 rounded-lg bg-gray-100/70 hover:bg-gray-200/70 transition-all duration-200 hover:scale-105"
                            >
                                <ArrowLeft className="w-4 h-4 text-gray-600 group-hover:text-gray-900 transition-colors" />
                            </Link>
                            <div>
                                <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    {initiative.title}
                                </h1>
                                <p className="text-gray-500 text-xs sm:text-sm mt-0.5 max-w-2xl line-clamp-1">
                                    {initiative.description}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {kpis.length > 0 && (
                                <button
                                    onClick={() => openEvidenceModal()}
                                    className="group flex items-center space-x-1.5 px-3 py-2 bg-white/80 hover:bg-white border border-gray-200/60 hover:border-gray-300/60 rounded-lg text-xs font-medium text-gray-700 hover:text-gray-900 transition-all duration-200 hover:shadow-sm hover:scale-[1.02]"
                                >
                                    <Upload className="w-3 h-3 group-hover:scale-110 transition-transform" />
                                    <span className="hidden sm:inline">Evidence</span>
                                </button>
                            )}
                            <button
                                onClick={() => setIsKPIModalOpen(true)}
                                className="group flex items-center space-x-1.5 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg text-xs font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-200 hover:scale-[1.02]"
                            >
                                <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                                <span>{kpis.length === 0 ? 'Add First KPI' : 'Add KPI'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-full px-2 sm:px-4 py-4 space-y-6">

                {kpis.length === 0 ? (
                    /* Empty State - Modern Design */
                    <div className="flex items-center justify-center min-h-[60vh]">
                        <div className="text-center max-w-lg mx-auto">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-100/50">
                                    <Target className="w-12 h-12 text-blue-600" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-white" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-4">
                                Create Your First KPI
                            </h3>
                            <p className="text-gray-500 text-lg mb-8 leading-relaxed">
                                KPIs are the specific metrics you want to track, like "Students Trained" or "Wells Built"
                            </p>
                            <button
                                onClick={() => setIsKPIModalOpen(true)}
                                className="group inline-flex items-center space-x-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-2xl text-lg font-semibold shadow-xl shadow-blue-600/25 hover:shadow-2xl hover:shadow-blue-600/30 transition-all duration-300 hover:scale-105"
                            >
                                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                                <span>Add First KPI</span>
                            </button>
                            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/60">
                                <p className="text-sm text-blue-700 font-medium">
                                    💡 Example: "Number of people trained" or "Clean water access provided"
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Premium Full-Width Layout */
                    <div className="space-y-6">
                        {/* Premium Stats Overview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500 hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-blue-100/10"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-blue-100 to-blue-200/70 rounded-2xl shadow-lg shadow-blue-500/20">
                                            <Target className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <span className="text-xs font-semibold text-blue-600 bg-blue-50/80 px-3 py-1 rounded-full border border-blue-100">Active</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                                            {stats.total_kpis}
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">Active KPIs</p>
                                        <p className="text-xs text-gray-500">Tracking performance metrics</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 hover:shadow-xl hover:shadow-emerald-500/10 transition-all duration-500 hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/30 to-emerald-100/10"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-emerald-100 to-emerald-200/70 rounded-2xl shadow-lg shadow-emerald-500/20">
                                            <FileText className="w-6 h-6 text-emerald-600" />
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                                            <span className="text-xs font-semibold text-emerald-600">Coverage</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-700 bg-clip-text text-transparent">
                                            {stats.evidence_coverage_percentage}%
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">Evidence Coverage</p>
                                        <p className="text-xs text-gray-500">Documentation progress</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-500 hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 to-purple-100/10"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200/70 rounded-2xl shadow-lg shadow-purple-500/20">
                                            <BarChart3 className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <span className="text-xs font-semibold text-purple-600 bg-purple-50/80 px-3 py-1 rounded-full border border-purple-100">Total</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-purple-700 bg-clip-text text-transparent">
                                            {stats.recent_updates}
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">Data Points</p>
                                        <p className="text-xs text-gray-500">Collected measurements</p>
                                    </div>
                                </div>
                            </div>

                            <div className="group relative overflow-hidden bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 hover:shadow-xl hover:shadow-orange-500/10 transition-all duration-500 hover:scale-[1.02]">
                                <div className="absolute inset-0 bg-gradient-to-br from-orange-50/30 to-orange-100/10"></div>
                                <div className="relative">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="p-3 bg-gradient-to-br from-orange-100 to-orange-200/70 rounded-2xl shadow-lg shadow-orange-500/20">
                                            <TrendingUp className="w-6 h-6 text-orange-600" />
                                        </div>
                                        <span className="text-xs font-semibold text-orange-600 bg-orange-50/80 px-3 py-1 rounded-full border border-orange-100">Progress</span>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-orange-700 bg-clip-text text-transparent">
                                            {Math.round((
                                                (kpis.length > 0 ? 33 : 0) +
                                                (stats.recent_updates > 0 ? 33 : 0) +
                                                (stats.evidence_coverage_percentage > 0 ? 34 : 0)
                                            ))}%
                                        </p>
                                        <p className="text-sm font-semibold text-gray-700">Overall Progress</p>
                                        <p className="text-xs text-gray-500">Initiative completion</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Premium KPI Section - Full Width */}
                        <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-xl shadow-gray-900/5">
                            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between mb-6 space-y-3 xl:space-y-0">
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent">
                                        Key Performance Indicators
                                    </h2>
                                    <p className="text-gray-500 text-sm">Track and measure your initiative's impact across all metrics</p>
                                </div>

                                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                                    {/* Compact Category Filter */}
                                    <div className="flex bg-gray-50/80 backdrop-blur-sm rounded-xl p-0.5 border border-gray-200/60 shadow-inner">
                                        <button
                                            onClick={() => setCategoryFilter('all')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'all'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('input')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'input'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Inputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('output')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'output'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Outputs
                                        </button>
                                        <button
                                            onClick={() => setCategoryFilter('impact')}
                                            className={`px-4 py-2 text-xs rounded-lg font-semibold transition-all duration-300 ${categoryFilter === 'impact'
                                                ? 'bg-white text-gray-900 shadow-md shadow-gray-900/10 border border-gray-200/60'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                                                }`}
                                        >
                                            Impacts
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setIsKPIModalOpen(true)}
                                        className="group flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 hover:scale-105"
                                    >
                                        <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-300" />
                                        <span>Add KPI</span>
                                    </button>
                                </div>
                            </div>

                            {/* Premium KPI Grid - Full Width Amazon/Apple Style */}
                            {filteredKpis.length === 0 ? (
                                <div className="text-center py-16">
                                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-gray-100 to-gray-200/70 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-gray-200/50">
                                        <Target className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-900 mb-2">No KPIs Found</h3>
                                    <p className="text-gray-500 font-medium max-w-md mx-auto">
                                        {categoryFilter === 'all'
                                            ? 'Create your first KPI to start tracking your initiative\'s performance and impact.'
                                            : `No ${categoryFilter} KPIs found. Try a different filter or create a new KPI.`
                                        }
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4 gap-6">
                                    {filteredKpis.map((kpi) => (
                                        <Link
                                            key={kpi.id}
                                            to={`/initiatives/${id}/kpis/${kpi.id}`}
                                            className="group relative overflow-hidden bg-white/90 backdrop-blur-xl border border-gray-200/60 hover:border-blue-300/60 rounded-2xl p-4 hover:shadow-xl hover:shadow-gray-900/8 transition-all duration-300 hover:scale-[1.01] cursor-pointer h-[320px] flex flex-col"
                                        >
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/20 via-transparent to-purple-50/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                                            <div className="relative flex flex-col h-full">
                                                {/* Compact Header */}
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="flex-1 min-w-0 pr-2">
                                                        <div className="flex items-center space-x-2 mb-1">
                                                            <h4 className="text-sm font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                                                                {kpi.title}
                                                            </h4>
                                                            {kpi.total_updates > 0 && (
                                                                <span className="inline-flex items-center justify-center w-4 h-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs font-bold rounded-md shadow-sm flex-shrink-0">
                                                                    {kpi.total_updates > 99 ? '99' : kpi.total_updates}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-gray-600 text-xs leading-tight line-clamp-1">
                                                            {kpi.description}
                                                        </p>
                                                    </div>

                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold shadow-sm flex-shrink-0 ${getCategoryColor(kpi.category)}`}>
                                                        {kpi.category}
                                                    </span>
                                                </div>

                                                {/* Value Display - Fixed Height */}
                                                <div className="mb-3 h-16 flex flex-col justify-center">
                                                    {kpi.total_updates > 0 && kpi.id && kpiTotals[kpi.id] !== undefined ? (
                                                        <div className="flex items-end space-x-2">
                                                            <div className="flex items-baseline space-x-1">
                                                                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                                                                    {kpiTotals[kpi.id!].toLocaleString()}
                                                                </span>
                                                                <span className="text-xs font-medium text-gray-500">
                                                                    {kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center space-x-1 px-1.5 py-0.5 bg-green-50 rounded-md">
                                                                <TrendingUp className="w-3 h-3 text-green-500" />
                                                                <span className="text-xs text-green-600 font-medium">Active</span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center space-x-1.5 px-2 py-1.5 bg-gray-50 rounded-lg">
                                                            <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
                                                            <span className="text-xs text-gray-600 font-medium">No data yet</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Evidence Types - Compact */}
                                                {kpi.evidence_types && kpi.evidence_types.length > 0 && (
                                                    <div className="mb-3 h-6">
                                                        <div className="flex items-center space-x-1 flex-wrap gap-1">
                                                            {kpi.evidence_types.slice(0, 2).map((evidenceType) => {
                                                                const IconComponent = getEvidenceIcon(evidenceType.type)
                                                                return (
                                                                    <div key={evidenceType.type} className="flex items-center space-x-1 bg-gray-50/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 border border-gray-200/40">
                                                                        <IconComponent className="w-3 h-3 text-gray-600" />
                                                                        <span className="text-xs text-gray-700 font-medium">
                                                                            {evidenceType.count}
                                                                        </span>
                                                                    </div>
                                                                )
                                                            })}
                                                            {kpi.evidence_types.length > 2 && (
                                                                <span className="text-xs text-gray-500 font-medium">+{kpi.evidence_types.length - 2}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Stats Row - Fixed Height */}
                                                <div className="flex items-center justify-between mb-3 py-1.5 bg-gray-50/50 rounded-lg px-2 h-8">
                                                    <div className="flex items-center space-x-2 text-xs text-gray-600">
                                                        <div className="flex items-center space-x-1">
                                                            <BarChart3 className="w-3 h-3" />
                                                            <span className="font-medium">{kpi.total_updates}</span>
                                                            <span>data</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <FileText className="w-3 h-3" />
                                                            <span className="font-medium">{kpi.evidence_count}</span>
                                                            <span>evidence</span>
                                                        </div>
                                                    </div>

                                                    <div className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold shadow-sm ${getEvidenceColor(kpi.evidence_percentage)}`}>
                                                        {kpi.evidence_percentage}%
                                                    </div>
                                                </div>

                                                {/* Spacer to push buttons to bottom */}
                                                <div className="flex-1"></div>

                                                {/* Action Buttons - Fixed at Bottom */}
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                openUpdateModal(kpi)
                                                            }}
                                                            className="group flex items-center justify-center space-x-1 px-2 py-2 bg-gradient-to-r from-blue-50 to-blue-100/50 hover:from-blue-100 hover:to-blue-200/50 text-blue-700 hover:text-blue-800 rounded-lg text-xs font-medium border border-blue-200/40 hover:border-blue-300/40 transition-all duration-200 hover:scale-105 shadow-sm"
                                                        >
                                                            <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform duration-200" />
                                                            <span>Add Data</span>
                                                        </button>

                                                        {kpi.total_updates > 0 ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    openEvidenceModal(kpi)
                                                                }}
                                                                className="group flex items-center justify-center space-x-1 px-2 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100/50 hover:from-emerald-100 hover:to-emerald-200/50 text-emerald-700 hover:text-emerald-800 rounded-lg text-xs font-medium border border-emerald-200/40 hover:border-emerald-300/40 transition-all duration-200 hover:scale-105 shadow-sm"
                                                            >
                                                                <Upload className="w-3 h-3 group-hover:scale-110 transition-transform duration-200" />
                                                                <span>Evidence</span>
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    openEditModal(kpi)
                                                                }}
                                                                className="group flex items-center justify-center space-x-1 px-2 py-2 bg-gray-50/80 hover:bg-gray-100/80 text-gray-600 hover:text-gray-800 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 shadow-sm"
                                                                title="Edit KPI"
                                                            >
                                                                <Edit className="w-3 h-3 group-hover:scale-110 transition-transform duration-200" />
                                                                <span>Edit</span>
                                                            </button>
                                                        )}
                                                    </div>

                                                    {/* Secondary Actions Row */}
                                                    <div className="flex items-center space-x-2">
                                                        {kpi.total_updates > 0 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault()
                                                                    e.stopPropagation()
                                                                    openEditModal(kpi)
                                                                }}
                                                                className="group flex items-center justify-center flex-1 px-2 py-1.5 bg-gray-50/80 hover:bg-gray-100/80 text-gray-600 hover:text-gray-800 rounded-lg text-xs font-medium transition-all duration-200 hover:scale-105 shadow-sm"
                                                                title="Edit KPI"
                                                            >
                                                                <Edit className="w-3 h-3 group-hover:scale-110 transition-transform duration-200 mr-1" />
                                                                <span>Edit</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault()
                                                                e.stopPropagation()
                                                                openDeleteConfirm(kpi)
                                                            }}
                                                            className="group flex items-center justify-center w-7 h-7 bg-red-50/80 hover:bg-red-100/80 text-red-600 hover:text-red-700 rounded-lg transition-all duration-200 hover:scale-105 shadow-sm"
                                                            title="Delete KPI"
                                                        >
                                                            <Trash2 className="w-3 h-3 group-hover:scale-110 transition-transform duration-200" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Premium Beneficiaries & Progress Section - Below KPIs */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Premium Beneficiaries Section */}
                            <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-8 shadow-xl shadow-gray-900/5">
                                <div className="mb-6">
                                    <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-2">
                                        Beneficiaries
                                    </h3>
                                    <p className="text-gray-500 text-base">Manage and track the people impacted by your initiative</p>
                                </div>
                                <BeneficiaryManager
                                    initiativeId={id!}
                                    onRefresh={loadDashboard}
                                />
                            </div>

                            {/* Premium Progress & Actions Section */}
                            <div className="space-y-6">
                                {/* Progress Tracker */}
                                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-xl shadow-gray-900/5">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl shadow-lg shadow-blue-500/20">
                                            <TrendingUp className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">Progress Tracker</h3>
                                            <p className="text-gray-500 text-sm">Monitor your initiative milestones</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-green-500/25">
                                                ✓
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900">{kpis.length} KPIs created</p>
                                                <p className="text-sm text-gray-500">Foundation established successfully</p>
                                            </div>
                                            <div className="w-3 h-3 bg-green-500 rounded-full shadow-lg shadow-green-500/25"></div>
                                        </div>

                                        <div className="flex items-center space-x-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-300 ${stats.recent_updates > 0
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25'
                                                : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 shadow-gray-300/25'
                                                }`}>
                                                {stats.recent_updates > 0 ? '✓' : '2'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900">
                                                    {stats.recent_updates > 0 ? `${stats.recent_updates} data points collected` : 'Add data points'}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {stats.recent_updates > 0 ? 'Data collection is active' : 'Start tracking your progress'}
                                                </p>
                                            </div>
                                            <div className={`w-3 h-3 rounded-full shadow-lg ${stats.recent_updates > 0 ? 'bg-green-500 shadow-green-500/25' : 'bg-gray-300 shadow-gray-300/25'}`}></div>
                                        </div>

                                        <div className="flex items-center space-x-4">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold shadow-lg transition-all duration-300 ${stats.evidence_coverage_percentage > 0
                                                ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-500/25'
                                                : 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-600 shadow-gray-300/25'
                                                }`}>
                                                {stats.evidence_coverage_percentage > 0 ? '✓' : '3'}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-bold text-gray-900">
                                                    {stats.evidence_coverage_percentage > 0 ? `${stats.evidence_coverage_percentage}% evidence coverage` : 'Upload evidence'}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {stats.evidence_coverage_percentage > 0 ? 'Documentation is in progress' : 'Proof of impact needed'}
                                                </p>
                                            </div>
                                            <div className={`w-3 h-3 rounded-full shadow-lg ${stats.evidence_coverage_percentage > 0 ? 'bg-green-500 shadow-green-500/25' : 'bg-gray-300 shadow-gray-300/25'}`}></div>
                                        </div>
                                    </div>

                                    {/* Premium Progress Bar */}
                                    <div className="mt-6 pt-6 border-t border-gray-100/60">
                                        <div className="flex items-center justify-between mb-3">
                                            <span className="text-sm font-bold text-gray-700">Overall Progress</span>
                                            <span className="text-lg font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">
                                                {Math.round((
                                                    (kpis.length > 0 ? 33 : 0) +
                                                    (stats.recent_updates > 0 ? 33 : 0) +
                                                    (stats.evidence_coverage_percentage > 0 ? 34 : 0)
                                                ))}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200/60 rounded-full h-3 shadow-inner">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 via-purple-500 to-blue-600 h-3 rounded-full transition-all duration-700 shadow-lg shadow-blue-500/25"
                                                style={{
                                                    width: `${Math.round((
                                                        (kpis.length > 0 ? 33 : 0) +
                                                        (stats.recent_updates > 0 ? 33 : 0) +
                                                        (stats.evidence_coverage_percentage > 0 ? 34 : 0)
                                                    ))}%`
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Premium Quick Actions */}
                                <div className="bg-white/80 backdrop-blur-xl border border-gray-200/50 rounded-2xl p-6 shadow-xl shadow-gray-900/5">
                                    <div className="flex items-center space-x-3 mb-6">
                                        <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl shadow-lg shadow-purple-500/20">
                                            <Hash className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <h4 className="text-xl font-bold text-gray-900">Quick Actions</h4>
                                    </div>

                                    <div className="space-y-4">
                                        <button
                                            onClick={() => setIsKPIModalOpen(true)}
                                            className="group w-full flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 hover:from-blue-50 hover:to-indigo-50 border border-blue-100/60 hover:border-blue-200/60 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-lg"
                                        >
                                            <div className="p-3 bg-blue-100/70 rounded-2xl group-hover:bg-blue-200/70 transition-colors shadow-lg shadow-blue-500/20">
                                                <Plus className="w-5 h-5 text-blue-600 group-hover:rotate-90 transition-transform duration-300" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-gray-900 text-sm">Add new KPI</p>
                                                <p className="text-sm text-gray-500">Create a new metric to track performance</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => openEvidenceModal()}
                                            className="group w-full flex items-center space-x-4 p-4 bg-gradient-to-r from-emerald-50/50 to-green-50/50 hover:from-emerald-50 hover:to-green-50 border border-emerald-100/60 hover:border-emerald-200/60 rounded-2xl transition-all duration-300 hover:scale-[1.02] shadow-sm hover:shadow-lg"
                                        >
                                            <div className="p-3 bg-emerald-100/70 rounded-2xl group-hover:bg-emerald-200/70 transition-colors shadow-lg shadow-emerald-500/20">
                                                <Upload className="w-5 h-5 text-emerald-600 group-hover:scale-110 transition-transform duration-300" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-bold text-gray-900 text-sm">Upload evidence</p>
                                                <p className="text-sm text-gray-500">Add proof of your initiative's impact</p>
                                            </div>
                                        </button>

                                        {stats.recent_updates === 0 && (
                                            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl shadow-sm">
                                                <div className="flex items-start space-x-3">
                                                    <div className="p-2 bg-amber-100 rounded-xl shadow-sm">
                                                        <span className="text-amber-600 text-sm">💡</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-800">Next Step</p>
                                                        <p className="text-sm text-amber-700 mt-1">Add data to your KPIs to start tracking progress</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
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

                {/* Edit KPI Modal */}
                {selectedKPI && (
                    <CreateKPIModal
                        isOpen={isEditKPIModalOpen}
                        onClose={() => {
                            setIsEditKPIModalOpen(false)
                            setSelectedKPI(null)
                        }}
                        onSubmit={handleEditKPI}
                        initiativeId={id!}
                        editData={selectedKPI}
                    />
                )}

                {/* Modern Delete Confirmation Dialog */}
                {deleteConfirmKPI && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                        <div className="bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-3xl max-w-md w-full p-8 shadow-2xl shadow-gray-900/20">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                    <Trash2 className="w-8 h-8 text-red-600" />
                                </div>
                                <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete KPI</h3>
                                <p className="text-gray-500">This action cannot be undone</p>
                            </div>

                            <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 border border-red-100/60 rounded-2xl p-4 mb-6">
                                <p className="text-gray-700 text-center">
                                    Are you sure you want to delete <strong className="text-gray-900">"{deleteConfirmKPI.title}"</strong>?
                                </p>
                                <p className="text-sm text-gray-600 text-center mt-2">
                                    This will also delete all associated data points and evidence links.
                                </p>
                            </div>

                            <div className="flex space-x-3">
                                <button
                                    onClick={() => setDeleteConfirmKPI(null)}
                                    className="flex-1 px-6 py-3 bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 hover:text-gray-900 rounded-xl font-semibold transition-all duration-200 hover:scale-[1.02]"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteKPI(deleteConfirmKPI)}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-semibold shadow-lg shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/30 transition-all duration-200 hover:scale-[1.02]"
                                >
                                    Delete KPI
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}