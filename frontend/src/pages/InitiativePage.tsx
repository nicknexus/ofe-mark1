import React, { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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
import MetricsDashboard from '../components/MetricsDashboard'
import ExpandableKPICard from '../components/ExpandableKPICard'
import InitiativeSidebar from '../components/InitiativeSidebar'
import HomeTab from '../components/InitiativeTabs/HomeTab'
import MetricsTab from '../components/InitiativeTabs/MetricsTab'
import EvidenceTab from '../components/InitiativeTabs/EvidenceTab'
import LocationTab from '../components/InitiativeTabs/LocationTab'
import BeneficiariesTab from '../components/InitiativeTabs/BeneficiariesTab'
import StoriesTab from '../components/InitiativeTabs/StoriesTab'
import DonorTab from '../components/InitiativeTabs/DonorTab'
import ReportTab from '../components/InitiativeTabs/ReportTab'
import toast from 'react-hot-toast'

export default function InitiativePage() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
    const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'input' | 'output' | 'impact'>('all')
    const [expandedKPIs, setExpandedKPIs] = useState<Set<string>>(new Set())
    const [allKPIUpdates, setAllKPIUpdates] = useState<any[]>([])

    // Sidebar navigation state
    const [activeTab, setActiveTab] = useState('home')
    const [initialStoryId, setInitialStoryId] = useState<string | undefined>(undefined)

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
        const allUpdates: any[] = []

        // Load updates for each KPI and calculate totals
        await Promise.all(kpis.map(async (kpi) => {
            try {
                const updates = await apiService.getKPIUpdates(kpi.id)
                totals[kpi.id] = updates.reduce((sum: number, update: any) => sum + (update.value || 0), 0)

                // Add KPI info to each update for context
                updates.forEach((update: any) => {
                    allUpdates.push({
                        ...update,
                        kpi_title: kpi.title,
                        kpi_unit: kpi.unit_of_measurement
                    })
                })
            } catch (error) {
                console.warn(`Failed to load updates for KPI ${kpi.id}:`, error)
                totals[kpi.id] = 0
            }
        }))

        setKpiTotals(totals)
        setAllKPIUpdates(allUpdates)
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
            const newKPI = await apiService.createKPI(kpiData)
            toast.success('Metric created successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                await loadDashboard() // Refresh the dashboard
            }

            // Auto-open the metric popup after creation
            if (newKPI?.id) {
                // Switch to metrics tab if not already there
                if (activeTab !== 'metrics') {
                    setActiveTab('metrics')
                }
                // Expand the newly created metric
                setExpandedKPIs(prev => {
                    const newSet = new Set(prev)
                    newSet.add(newKPI.id)
                    return newSet
                })
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create metric'
            toast.error(message)
            throw error // Re-throw to keep modal open on error
        }
    }

    const handleEditKPI = async (kpiData: CreateKPIForm) => {
        if (!selectedKPI) return
        try {
            await apiService.updateKPI(selectedKPI.id, kpiData)
            toast.success('Metric updated successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
            setIsEditKPIModalOpen(false)
            setSelectedKPI(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update metric'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteKPI = async (kpi: any) => {
        try {
            await apiService.deleteKPI(kpi.id)
            toast.success('Metric deleted successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
            setDeleteConfirmKPI(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete metric'
            toast.error(message)
        }
    }

    const handleAddKPIUpdate = async (updateData: CreateKPIUpdateForm) => {
        if (!selectedKPI) return

        try {
            await apiService.createKPIUpdate(selectedKPI.id, updateData)
            toast.success('Impact claim added successfully!')

            // Explicitly clear the dashboard cache to ensure fresh data
            apiService.clearCache(`/initiatives/${id}/dashboard`)

            // Only reload if not currently loading
            if (!isLoadingDashboard) {
                loadDashboard() // Refresh the dashboard
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add impact claim'
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

    const toggleKPIExpansion = (kpiId: string) => {
        setExpandedKPIs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(kpiId)) {
                newSet.delete(kpiId)
            } else {
                newSet.add(kpiId)
            }
            return newSet
        })
    }

    const handleTabChange = (tab: string) => {
        setActiveTab(tab)
        // Clear expanded KPIs when switching to metrics tab to show main metrics page
        if (tab === 'metrics') {
            setExpandedKPIs(new Set())
        }
    }

    const handleMetricCardClick = (kpiId: string) => {
        setActiveTab('metrics')
        // Expand the clicked KPI
        setExpandedKPIs(prev => {
            const newSet = new Set(prev)
            if (!newSet.has(kpiId)) {
                newSet.add(kpiId)
            }
            return newSet
        })
    }

    const renderHomeContent = () => {
        if (!dashboard) return null

        const { initiative, kpis, stats } = dashboard

        return (
            <div className="h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30 overflow-hidden">
                {kpis.length === 0 ? (
                    /* Empty State - Compact for Laptop */
                    <div className="flex items-center justify-center h-full p-4">
                        <div className="text-center max-w-md mx-auto">
                            <div className="relative mb-6">
                                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100/50">
                                    <BarChart3 className="w-8 h-8 text-blue-600" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
                                    <Plus className="w-3 h-3 text-white" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-3">
                                Create Your First Metric
                            </h3>
                            <p className="text-gray-500 text-base mb-6 leading-relaxed">
                                Metrics are the specific measurements you want to track, like "Students Trained" or "Wells Built"
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={() => setIsKPIModalOpen(true)}
                                    className="inline-flex items-center space-x-2 px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl text-base font-medium transition-colors duration-200"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add First Metric</span>
                                </button>
                                <button
                                    onClick={() => handleTabChange('metrics')}
                                    className="inline-flex items-center space-x-2 px-6 py-3 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl text-base font-medium transition-colors duration-200"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    <span>View Metrics</span>
                                </button>
                            </div>
                            <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100/60">
                                <p className="text-xs text-blue-700 font-medium">
                                    💡 Example: "Number of people trained" or "Clean water access provided"
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Analytics Dashboard - Flush to Top */
                    <div className="h-full overflow-hidden">
                        <MetricsDashboard
                            kpis={kpis}
                            kpiTotals={kpiTotals}
                            stats={stats}
                            kpiUpdates={allKPIUpdates}
                            initiativeId={id}
                            onNavigateToLocations={() => setActiveTab('location')}
                            onMetricCardClick={handleMetricCardClick}
                            onAddKPI={() => setIsKPIModalOpen(true)}
                            onStoryClick={(storyId) => {
                                setInitialStoryId(storyId)
                                setActiveTab('stories')
                            }}
                        />
                    </div>
                )}
            </div>
        )
    }

    const renderActiveTab = () => {
        switch (activeTab) {
            case 'home':
                return (
                    <HomeTab>
                        {renderHomeContent()}
                    </HomeTab>
                )
            case 'metrics':
                return (
                    <MetricsTab
                        dashboard={dashboard}
                        kpiTotals={kpiTotals}
                        categoryFilter={categoryFilter}
                        setCategoryFilter={setCategoryFilter}
                        expandedKPIs={expandedKPIs}
                        setExpandedKPIs={setExpandedKPIs}
                        allKPIUpdates={allKPIUpdates}
                        onAddKPI={() => setIsKPIModalOpen(true)}
                        onAddUpdate={openUpdateModal}
                        onAddEvidence={openEvidenceModal}
                        onEditKPI={openEditModal}
                        onDeleteKPI={openDeleteConfirm}
                        onToggleKPIExpansion={toggleKPIExpansion}
                        initiativeId={id}
                        onRefresh={loadDashboard}
                    />
                )
            case 'evidence':
                return <EvidenceTab initiativeId={id!} onRefresh={loadDashboard} />
            case 'location':
                return <LocationTab 
                    onStoryClick={(storyId) => {
                        setInitialStoryId(storyId)
                        setActiveTab('stories')
                    }}
                    onMetricClick={handleMetricCardClick}
                />
            case 'beneficiaries':
                return <BeneficiariesTab initiativeId={id!} onRefresh={loadDashboard} />
            case 'stories':
                return <StoriesTab initiativeId={id!} onRefresh={loadDashboard} initialStoryId={initialStoryId} />
            case 'donors':
                return <DonorTab initiativeId={id!} dashboard={dashboard} onRefresh={loadDashboard} />
            case 'report':
                return <ReportTab initiativeId={id!} dashboard={dashboard} />
            default:
                return (
                    <HomeTab>
                        {renderHomeContent()}
                    </HomeTab>
                )
        }
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

    return (
        <div className="relative">
            {/* Fixed Sidebar */}
            <InitiativeSidebar
                activeTab={activeTab}
                onTabChange={handleTabChange}
                initiativeTitle={dashboard.initiative.title}
                initiativeId={id!}
                initiativeSlug={dashboard.initiative.slug}
            />

            {/* Main Content with left margin for sidebar */}
            <div className="ml-56">
                {renderActiveTab()}
            </div>

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
                    initiativeId={id!}
                />
            )}

            <AddEvidenceModal
                isOpen={isEvidenceModalOpen}
                onClose={() => {
                    setIsEvidenceModalOpen(false)
                    setSelectedKPI(null)
                }}
                onSubmit={handleAddEvidence}
                availableKPIs={dashboard.kpis}
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
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white/95 backdrop-blur-xl border border-gray-200/60 rounded-3xl max-w-md w-full p-8 shadow-2xl shadow-gray-900/20">
                        <div className="text-center mb-6">
                            <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-red-100 to-pink-100 rounded-2xl flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">Delete Metric</h3>
                            <p className="text-gray-500">This action cannot be undone</p>
                        </div>

                        <div className="bg-gradient-to-r from-red-50/50 to-pink-50/50 border border-red-100/60 rounded-2xl p-4 mb-6">
                            <p className="text-gray-700 text-center">
                                Are you sure you want to delete <strong className="text-gray-900">"{deleteConfirmKPI.title}"</strong>?
                            </p>
                            <p className="text-sm text-gray-600 text-center mt-2">
                                This will also delete all associated impact claims and evidence links.
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
                                Delete Metric
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}