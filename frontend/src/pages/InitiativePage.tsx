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
import { InitiativeDashboard, LoadingState, CreateKPIForm, CreateKPIUpdateForm, CreateEvidenceForm, User, Organization } from '../types'
import { formatDate, getEvidenceColor, getCategoryColor, getEvidenceTypeInfo, getEvidenceStatus } from '../utils'
import { AuthService } from '../services/auth'
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
import ReportTab from '../components/InitiativeTabs/ReportTab'
import toast from 'react-hot-toast'

export default function InitiativePage() {
    const [user, setUser] = useState<User | null>(null)
    const [organization, setOrganization] = useState<Organization | null>(null)
    const { id, kpiId } = useParams<{ id: string; kpiId?: string }>()
    const navigate = useNavigate()
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
    const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'input' | 'output' | 'impact'>('all')
    const [expandedKPIs, setExpandedKPIs] = useState<Set<string>>(new Set())
    const [allKPIUpdates, setAllKPIUpdates] = useState<any[]>([])
    const [orderedKPIIds, setOrderedKPIIds] = useState<string[]>([])

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
        // Load user and organization
        const loadUserAndOrg = async () => {
            try {
                const currentUser = await AuthService.getCurrentUser()
                setUser(currentUser)
                
                const orgs = await apiService.getOrganizations()
                if (orgs && orgs.length > 0) {
                    setOrganization(orgs[0])
                }
            } catch (error) {
                console.error('Error loading user or organization:', error)
            }
        }
        loadUserAndOrg()

        if (id) {
            loadDashboard()
        }
    }, [id])

    const handleSignOut = async () => {
        try {
            await AuthService.signOut()
            toast.success('Signed out successfully')
        } catch (error) {
            toast.error('Failed to sign out')
        }
    }

    // Handle URL-based metric expansion
    useEffect(() => {
        if (kpiId && dashboard) {
            // Auto-expand the metric from URL and switch to metrics tab
            setActiveTab('metrics')
            setExpandedKPIs(new Set([kpiId]))
        }
    }, [kpiId, dashboard])

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
                    if (newKPI.id) {
                        newSet.add(newKPI.id)
                    }
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

    const toggleKPIExpansion = (kpiIdToToggle: string) => {
        const isExpanded = expandedKPIs.has(kpiIdToToggle)
        if (isExpanded) {
            // Closing the metric - navigate back to initiative
            navigate(`/initiatives/${id}`)
            setExpandedKPIs(new Set())
        } else {
            // Opening a metric - navigate to metric URL
            navigate(`/initiatives/${id}/metrics/${kpiIdToToggle}`)
        }
    }

    const handleTabChange = (tab: string) => {
        setActiveTab(tab)
        // Clear expanded KPIs and navigate to base initiative URL when switching tabs
        if (tab === 'metrics' && kpiId) {
            navigate(`/initiatives/${id}`)
            setExpandedKPIs(new Set())
        } else if (expandedKPIs.size > 0) {
            navigate(`/initiatives/${id}`)
            setExpandedKPIs(new Set())
        }
    }

    const handleMetricCardClick = (kpiIdToOpen: string) => {
        // Navigate to the metric URL - this will trigger the useEffect to expand it
        navigate(`/initiatives/${id}/metrics/${kpiIdToOpen}`)
    }

    const renderHomeContent = () => {
        if (!dashboard) return null

        const { initiative, kpis, stats } = dashboard

        return (
            <div className="h-full overflow-hidden">
                {kpis.length === 0 ? (
                    /* Empty State - Compact for Laptop */
                    <div className="flex items-center justify-center h-full p-6">
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-10 text-center max-w-md mx-auto">
                            <div className="icon-bubble mx-auto mb-6">
                                <BarChart3 className="w-6 h-6 text-primary-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-gray-800 mb-3">
                                Create Your First Metric
                            </h3>
                            <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                                Metrics are the specific measurements you want to track, like "Students Trained" or "Wells Built"
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                                <button
                                    onClick={() => setIsKPIModalOpen(true)}
                                    className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-2xl text-sm font-medium transition-all duration-200 shadow-bubble-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add First Metric</span>
                                </button>
                                <button
                                    onClick={() => handleTabChange('metrics')}
                                    className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-2xl text-sm font-medium transition-all duration-200"
                                >
                                    <BarChart3 className="w-4 h-4" />
                                    <span>View Metrics</span>
                                </button>
                            </div>
                            <div className="mt-6 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                                <p className="text-xs text-gray-500">
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
                            user={user}
                            organization={organization}
                            onOrderChange={setOrderedKPIIds}
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
                        orderedKPIIds={orderedKPIIds}
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
                return <BeneficiariesTab 
                    initiativeId={id!} 
                    onRefresh={loadDashboard}
                    onStoryClick={(storyId) => {
                        setInitialStoryId(storyId)
                        setActiveTab('stories')
                    }}
                    onMetricClick={handleMetricCardClick}
                />
            case 'stories':
                return <StoriesTab initiativeId={id!} onRefresh={loadDashboard} initialStoryId={initialStoryId} />
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

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
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
                user={user}
                onSignOut={handleSignOut}
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-bubble-lg border border-gray-100">
                        <div className="flex items-start space-x-4 mb-6">
                            <div className="icon-bubble">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Metric</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-2 text-sm">
                            Are you sure you want to delete <strong className="text-gray-800">"{deleteConfirmKPI.title}"</strong>?
                        </p>
                        <p className="text-xs text-gray-500 mb-6">
                            This will also delete all associated impact claims and evidence links.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmKPI(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteKPI(deleteConfirmKPI)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all duration-200 shadow-bubble-sm"
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