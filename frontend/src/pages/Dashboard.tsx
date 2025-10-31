import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
    Plus,
    Target,
    BarChart3,
    FileText,
    TrendingUp,
    Calendar,
    MapPin,
    ExternalLink,
    Upload,
    HelpCircle,
    Edit,
    Trash2,
    Users,
    Activity,
    Award,
    ArrowRight,
    Sparkles,
    Globe,
    Clock
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI } from '../types'
import { formatDate, truncateText } from '../utils'
import toast from 'react-hot-toast'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import FirstTimeTutorial from '../components/FirstTimeTutorial'

export default function Dashboard() {
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [allKPIs, setAllKPIs] = useState<KPI[]>([])
    const [totalEvidence, setTotalEvidence] = useState<number>(0)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [isLoadingStats, setIsLoadingStats] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showTutorial, setShowTutorial] = useState(false)
    const [showEditModal, setShowEditModal] = useState(false)
    const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)
    const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)

    // Add loading cache to prevent duplicate requests
    const [isLoadingData, setIsLoadingData] = useState(false)
    const loadingPromise = useRef<Promise<void> | null>(null)

    useEffect(() => {
        // Only load if not already loading and no promise in progress
        if (!isLoadingData && !loadingPromise.current) {
            loadingPromise.current = loadAllData()
        }
    }, [])

    const loadAllData = async (): Promise<void> => {
        if (isLoadingData || loadingPromise.current) {
            console.log('Load already in progress, skipping...')
            return loadingPromise.current || Promise.resolve()
        }

        // Check if all data is already cached - if so, load from cache without API calls
        const hasCachedData = apiService.isDataCached('/initiatives') &&
            apiService.isDataCached('/kpis') &&
            apiService.isDataCached('/evidence')

        if (hasCachedData) {
            console.log('All dashboard data is cached, loading from cache...')
        } else {
            console.log('Loading dashboard data...')
        }

        setIsLoadingData(true)
        setLoadingState({ isLoading: true })

        try {
            // Load initiatives first for immediate display
            const initiatives = await apiService.loadInitiativesOnly()
            setInitiatives(initiatives)
            setLoadingState({ isLoading: false }) // Show initiatives immediately

            // Load KPIs and evidence in background
            const { kpis, evidence } = await apiService.loadKPIsAndEvidence()
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setIsLoadingStats(false)

            console.log('Dashboard data loaded successfully')

        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load dashboard data'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
            console.error('Dashboard loading error:', error)
        } finally {
            setIsLoadingData(false)
            loadingPromise.current = null
            checkFirstTimeUser()
        }
    }

    // Smart refresh function - only refresh specific data when needed
    const refreshInitiatives = async () => {
        try {
            const initiatives = await apiService.getInitiatives()
            setInitiatives(initiatives)
        } catch (error) {
            console.error('Failed to refresh initiatives:', error)
        }
    }

    const refreshKPIsAndEvidence = async () => {
        try {
            setIsLoadingStats(true)
            const [kpis, evidence] = await Promise.all([
                apiService.getKPIs(),
                apiService.getEvidence()
            ])
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setIsLoadingStats(false)
        } catch (error) {
            console.error('Failed to refresh KPIs and evidence:', error)
            setIsLoadingStats(false)
        }
    }

    const checkFirstTimeUser = () => {
        const hasSeenTutorial = localStorage.getItem('ofe-tutorial-seen')
        if (!hasSeenTutorial) {
            // Delay showing tutorial slightly to let dashboard load
            setTimeout(() => {
                setShowTutorial(true)
            }, 1000)
        }
    }

    const handleTutorialClose = () => {
        setShowTutorial(false)
        localStorage.setItem('ofe-tutorial-seen', 'true')
    }

    const handleTutorialGetStarted = () => {
        setShowTutorial(false)
        localStorage.setItem('ofe-tutorial-seen', 'true')
        setShowCreateModal(true)
    }

    const showTutorialAgain = () => {
        setShowTutorial(true)
    }

    const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
        try {
            await apiService.createInitiative(formData)
            toast.success('Initiative created successfully!')
            // Only refresh initiatives, not all data
            await refreshInitiatives()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create initiative'
            toast.error(message)
            throw error
        }
    }

    const handleEditInitiative = async (formData: CreateInitiativeForm) => {
        if (!selectedInitiative?.id) return
        try {
            await apiService.updateInitiative(selectedInitiative.id, formData)
            toast.success('Initiative updated successfully!')
            // Only refresh initiatives, not all data
            await refreshInitiatives()
            setShowEditModal(false)
            setSelectedInitiative(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update initiative'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteInitiative = async (initiative: Initiative) => {
        if (!initiative.id) return
        try {
            await apiService.deleteInitiative(initiative.id)
            toast.success('Initiative deleted successfully!')
            // Refresh all data since deleting initiative affects KPIs and evidence too
            setIsLoadingStats(true)
            await loadAllData()
            setDeleteConfirmInitiative(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete initiative'
            toast.error(message)
        }
    }

    const openEditModal = (initiative: Initiative) => {
        setSelectedInitiative(initiative)
        setShowEditModal(true)
    }

    const openDeleteConfirm = (initiative: Initiative) => {
        setDeleteConfirmInitiative(initiative)
    }


    if (loadingState.isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        )
    }

    if (loadingState.error) {
        return (
            <div className="text-center py-12">
                <div className="text-red-600 mb-4">{loadingState.error}</div>
                <button
                    onClick={() => {
                        if (!isLoadingData && !loadingPromise.current) {
                            loadingPromise.current = loadAllData()
                        }
                    }}
                    className="btn-primary"
                    disabled={isLoadingData || !!loadingPromise.current}
                >
                    {(isLoadingData || loadingPromise.current) ? 'Loading...' : 'Try Again'}
                </button>
            </div>
        )
    }

    return (
        <>
            <div className="min-h-screen bg-gray-50">
                <div className="space-y-8">
                    {/* Clean Header */}
                    <div className="bg-white border-b border-gray-200">
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0 py-8">
                                <div className="space-y-1">
                                    <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
                                    <p className="text-gray-600">
                                        Track and showcase your organization's impact
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                                    <button
                                        onClick={showTutorialAgain}
                                        className="btn-secondary flex items-center justify-center space-x-2 px-4 py-2 rounded-lg"
                                        title="Show tutorial again"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                        <span>Tutorial</span>
                                    </button>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="btn-primary flex items-center space-x-2 px-4 py-2 rounded-lg"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>{initiatives.length === 0 ? 'Get Started' : 'New Initiative'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Simple Stats Grid */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="p-2 bg-primary-100 rounded-lg">
                                        <Target className="w-5 h-5 text-primary-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Active Initiatives</p>
                                        <p className="text-2xl font-bold text-gray-900">{initiatives.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Total KPIs</p>
                                        {isLoadingStats ? (
                                            <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                                        ) : (
                                            <p className="text-2xl font-bold text-gray-900">{allKPIs.length}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <FileText className="w-5 h-5 text-green-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Evidence Items</p>
                                        {isLoadingStats ? (
                                            <div className="animate-pulse bg-gray-200 h-6 w-8 rounded"></div>
                                        ) : (
                                            <p className="text-2xl font-bold text-gray-900">{totalEvidence}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-lg border border-gray-200 p-6">
                                <div className="flex items-center">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <Users className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div className="ml-4">
                                        <p className="text-sm font-medium text-gray-600">Beneficiaries</p>
                                        <p className="text-2xl font-bold text-gray-900">0</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Help Text for Evidence */}
                    {!isLoadingStats && allKPIs.length === 0 && initiatives.length > 0 && (
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-start">
                                    <div className="p-2 bg-blue-100 rounded-lg mr-3 flex-shrink-0">
                                        <Target className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-blue-800">
                                            Create KPIs first to start uploading evidence
                                        </p>
                                        <p className="text-xs text-blue-600 mt-1">
                                            Evidence needs to be linked to specific KPIs to track your impact proof
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Initiatives Section */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Your Initiatives</h2>
                                <p className="text-gray-600 mt-1">Manage and track your impact projects</p>
                            </div>

                            {initiatives.length === 0 ? (
                                <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
                                    <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                                        <Target className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                                        Welcome to OFE!
                                    </h3>
                                    <p className="text-gray-600 mb-6 max-w-md mx-auto">
                                        Let's start by creating your first initiative. Think of it as a project or program you want to track.
                                    </p>
                                    <button
                                        onClick={() => setShowCreateModal(true)}
                                        className="btn-primary text-base px-6 py-3"
                                    >
                                        Create Your First Initiative
                                    </button>
                                    <p className="text-sm text-gray-500 mt-4">
                                        💡 Example: "Youth Training Program 2025" or "Clean Water Project"
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {initiatives.map((initiative) => (
                                        <div
                                            key={initiative.id}
                                            className="group bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-md transition-all duration-200 relative"
                                        >
                                            <Link
                                                to={`/initiatives/${initiative.id}`}
                                                className="block p-6"
                                            >
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="p-2 bg-primary-100 rounded-lg">
                                                            <Target className="w-5 h-5 text-primary-600" />
                                                        </div>
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                                                                {initiative.title}
                                                            </h3>
                                                            <div className="flex items-center text-sm text-gray-500 mt-1">
                                                                <Calendar className="w-4 h-4 mr-1" />
                                                                <span>Created {formatDate(initiative.created_at || '')}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                                                    {truncateText(initiative.description, 120)}
                                                </p>

                                                <div className="flex items-center justify-between text-sm">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex items-center text-blue-600">
                                                            <BarChart3 className="w-4 h-4 mr-1" />
                                                            <span>0 KPIs</span>
                                                        </div>
                                                        <div className="flex items-center text-green-600">
                                                            <FileText className="w-4 h-4 mr-1" />
                                                            <span>0 Evidence</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-primary-600 font-medium group-hover:underline">
                                                        View Details →
                                                    </span>
                                                </div>
                                            </Link>

                                            {/* Action Buttons */}
                                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        openEditModal(initiative)
                                                    }}
                                                    className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-colors"
                                                    title="Edit Initiative"
                                                >
                                                    <Edit className="w-3 h-3 text-gray-600" />
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault()
                                                        e.stopPropagation()
                                                        openDeleteConfirm(initiative)
                                                    }}
                                                    className="p-1.5 bg-white border border-red-200 rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 transition-colors"
                                                    title="Delete Initiative"
                                                >
                                                    <Trash2 className="w-3 h-3 text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCreateModal && (
                <CreateInitiativeModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateInitiative}
                />
            )}

            {/* Edit Initiative Modal */}
            {selectedInitiative && (
                <CreateInitiativeModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false)
                        setSelectedInitiative(null)
                    }}
                    onSubmit={handleEditInitiative}
                    editData={selectedInitiative}
                />
            )}


            {/* Delete Confirmation Dialog */}
            {deleteConfirmInitiative && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Initiative</h3>
                                <p className="text-sm text-gray-600">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-700 mb-6">
                            Are you sure you want to delete "<strong>{deleteConfirmInitiative.title}</strong>"?
                            This will also delete all associated KPIs, data points, and evidence.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmInitiative(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                            >
                                Delete Initiative
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showTutorial && (
                <FirstTimeTutorial
                    onClose={handleTutorialClose}
                    onGetStarted={handleTutorialGetStarted}
                />
            )}
        </>
    )
} 