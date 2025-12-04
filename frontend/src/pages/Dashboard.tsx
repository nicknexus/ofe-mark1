import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    Plus,
    MapPin,
    Edit,
    Trash2
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Organization, Location } from '../types'
import { formatDate, truncateText } from '../utils'
import toast from 'react-hot-toast'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import FirstTimeTutorial from '../components/FirstTimeTutorial'
import LocationMap from '../components/LocationMap'

export default function Dashboard() {
    const navigate = useNavigate()
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [allKPIs, setAllKPIs] = useState<KPI[]>([])
    const [allLocations, setAllLocations] = useState<Location[]>([])
    const [totalEvidence, setTotalEvidence] = useState<number>(0)
    const [organization, setOrganization] = useState<Organization | null>(null)
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

        // Listen for tutorial trigger from header
        const handleShowTutorial = () => {
            setShowTutorial(true)
        }
        window.addEventListener('show-tutorial', handleShowTutorial)
        return () => {
            window.removeEventListener('show-tutorial', handleShowTutorial)
        }
    }, [])

    const loadAllData = async (): Promise<void> => {
        if (isLoadingData || loadingPromise.current) {
            console.log('Load already in progress, skipping...')
            return loadingPromise.current || Promise.resolve()
        }

        // Check if all data is already cached - if so, load from cache without API calls
        const [initiativesCached, kpisCached, evidenceCached] = await Promise.all([
            apiService.isDataCached('/initiatives'),
            apiService.isDataCached('/kpis'),
            apiService.isDataCached('/evidence')
        ])
        const hasCachedData = initiativesCached && kpisCached && evidenceCached

        if (hasCachedData) {
            console.log('All dashboard data is cached, loading from cache...')
        } else {
            console.log('Loading dashboard data...')
        }

        setIsLoadingData(true)
        setLoadingState({ isLoading: true })

        try {
            // Load organization and initiatives in parallel for immediate display
            const [orgs, initiatives] = await Promise.all([
                apiService.getOrganizations(),
                apiService.loadInitiativesOnly()
            ])
            
            setInitiatives(initiatives)
            if (orgs && orgs.length > 0) {
                setOrganization(orgs[0]) // User has one organization
            }
            setLoadingState({ isLoading: false }) // Show initiatives immediately

            // Load KPIs, evidence, and locations in background
            const [{ kpis, evidence }, locations] = await Promise.all([
                apiService.loadKPIsAndEvidence(),
                apiService.getLocations() // Get all locations across all initiatives
            ])
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setAllLocations(locations)
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
            const [kpis, evidence, locations] = await Promise.all([
                apiService.getKPIs(),
                apiService.getEvidence(),
                apiService.getLocations()
            ])
            setAllKPIs(kpis)
            setTotalEvidence(evidence.length)
            setAllLocations(locations)
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

    // Handle location click from map - navigate to the initiative's location tab
    const handleLocationClick = (location: Location) => {
        if (location.initiative_id) {
            navigate(`/initiatives/${location.initiative_id}?tab=locations`)
        }
    }

    return (
        <>
            <div className="h-screen overflow-hidden pt-24 pb-6 px-4 sm:px-6 flex flex-col">
                {/* Two Column Layout - fills remaining height */}
                <div className="flex-1 min-h-0">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                        {/* Initiatives Module - Takes 2 columns */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-bubble border border-gray-100 overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                                <h2 className="text-lg font-semibold text-gray-800">Your Initiatives</h2>
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-all duration-200 flex items-center gap-1.5 shadow-bubble-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    {initiatives.length === 0 ? 'Get Started' : 'New Initiative'}
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 overflow-y-auto min-h-0">
                                {initiatives.length === 0 ? (
                                    <div className="text-center py-8">
                                        <div className="icon-bubble mx-auto mb-4">
                                            <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-6 h-6 object-contain" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-gray-800 mb-2">
                                            Welcome to OFE
                                        </h3>
                                        <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
                                            Create your first initiative to start tracking impact.
                                        </p>
                                        <button
                                            onClick={() => setShowCreateModal(true)}
                                            className="px-5 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-all duration-200 shadow-bubble-sm"
                                        >
                                            Create Your First Initiative
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {initiatives.map((initiative) => (
                                            <div
                                                key={initiative.id}
                                                className="group bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all duration-200 relative"
                                            >
                                                <Link
                                                    to={`/initiatives/${initiative.id}`}
                                                    className="block"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
                                                                <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-5 h-5 object-contain" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-semibold text-gray-800 group-hover:text-primary-600 transition-colors truncate">
                                                                    {initiative.title}
                                                                </h3>
                                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                                                    {truncateText(initiative.description, 60)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-primary-500 text-sm font-medium group-hover:translate-x-0.5 transition-transform flex-shrink-0 ml-2">
                                                            →
                                                        </span>
                                                    </div>
                                                </Link>

                                                {/* Action Buttons */}
                                                <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-1">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            openEditModal(initiative)
                                                        }}
                                                        className="p-1.5 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                                                        title="Edit Initiative"
                                                    >
                                                        <Edit className="w-3 h-3 text-gray-500" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault()
                                                            e.stopPropagation()
                                                            openDeleteConfirm(initiative)
                                                        }}
                                                        className="p-1.5 bg-white border border-red-200 rounded-lg shadow-sm hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                                                        title="Delete Initiative"
                                                    >
                                                        <Trash2 className="w-3 h-3 text-red-500" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Locations Map Module */}
                        <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 overflow-hidden flex flex-col">
                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <MapPin className="w-5 h-5 text-primary-500" />
                                    <h2 className="text-lg font-semibold text-gray-800">All Locations</h2>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {allLocations.length} location{allLocations.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            
                            <div className="flex-1 min-h-0 rounded-b-2xl overflow-hidden">
                                <LocationMap
                                    locations={allLocations}
                                    onLocationClick={handleLocationClick}
                                />
                            </div>
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
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-bubble-lg border border-gray-100">
                        <div className="flex items-start space-x-4 mb-6">
                            <div className="icon-bubble">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Initiative</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                            Are you sure you want to delete "<strong className="font-medium text-gray-800">{deleteConfirmInitiative.title}</strong>"?
                            This will also delete all associated KPIs, impact claims, and evidence.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmInitiative(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all duration-200 shadow-bubble-sm"
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