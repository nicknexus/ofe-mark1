import React, { useState, useEffect } from 'react'
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
    HelpCircle
} from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateEvidenceForm, KPI } from '../types'
import { formatDate, truncateText } from '../utils'
import toast from 'react-hot-toast'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import AddEvidenceModal from '../components/AddEvidenceModal'
import FirstTimeTutorial from '../components/FirstTimeTutorial'

export default function Dashboard() {
    const [initiatives, setInitiatives] = useState<Initiative[]>([])
    const [allKPIs, setAllKPIs] = useState<KPI[]>([])
    const [totalEvidence, setTotalEvidence] = useState<number>(0)
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showEvidenceModal, setShowEvidenceModal] = useState(false)
    const [showTutorial, setShowTutorial] = useState(false)

    useEffect(() => {
        loadInitiatives()
        loadAllKPIs()
        loadEvidenceCount()
        checkFirstTimeUser()
    }, [])

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

    const loadInitiatives = async () => {
        try {
            setLoadingState({ isLoading: true })
            const data = await apiService.getInitiatives()
            setInitiatives(data)
            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load initiatives'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        }
    }

    const loadAllKPIs = async () => {
        try {
            // Load KPIs from all initiatives
            const data = await apiService.getKPIs()
            setAllKPIs(data)
        } catch (error) {
            console.error('Failed to load KPIs:', error)
        }
    }

    const loadEvidenceCount = async () => {
        try {
            // Get evidence from all initiatives
            const evidenceData = await apiService.getEvidence()
            setTotalEvidence(evidenceData.length)
        } catch (error) {
            console.error('Failed to load evidence count:', error)
        }
    }

    const handleCreateInitiative = async (data: any) => {
        try {
            await apiService.createInitiative(data)
            toast.success('Initiative created successfully!')
            setShowCreateModal(false)
            loadInitiatives()
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to create initiative')
        }
    }

    const handleAddEvidence = async (evidenceData: CreateEvidenceForm) => {
        try {
            await apiService.createEvidence(evidenceData)
            toast.success('Evidence added successfully!')
            // Refresh evidence count
            loadEvidenceCount()
            setShowEvidenceModal(false)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
            throw error
        }
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
                    onClick={loadInitiatives}
                    className="btn-primary"
                >
                    Try Again
                </button>
            </div>
        )
    }

    return (
        <>
            <div className="space-y-4 sm:space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
                        <p className="text-gray-600 mt-1 text-sm sm:text-base">
                            Track and showcase your organization's impact
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                        {/* Only show evidence upload if user has KPIs */}
                        {allKPIs.length > 0 && (
                            <button
                                onClick={() => setShowEvidenceModal(true)}
                                className="btn-secondary flex items-center justify-center space-x-2 text-sm"
                            >
                                <Upload className="w-4 h-4" />
                                <span className="hidden sm:inline">Upload Evidence</span>
                                <span className="sm:hidden">Evidence</span>
                            </button>
                        )}
                        <div className="flex space-x-2 sm:space-x-3">
                            <button
                                onClick={showTutorialAgain}
                                className="btn-secondary flex items-center justify-center space-x-2 text-sm flex-1 sm:flex-none"
                                title="Show tutorial again"
                            >
                                <HelpCircle className="w-4 h-4" />
                                <span className="hidden sm:inline">Tutorial</span>
                            </button>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn-primary flex items-center justify-center space-x-2 text-sm flex-1 sm:flex-none"
                            >
                                <Plus className="w-4 h-4" />
                                <span className="sm:hidden">New</span>
                                <span className="hidden sm:inline">{initiatives.length === 0 ? 'Get Started' : 'New Initiative'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center">
                            <div className="p-2 sm:p-3 bg-primary-100 rounded-lg">
                                <Target className="w-5 h-5 sm:w-6 sm:h-6 text-primary-600" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Active Initiatives</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{initiatives.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center">
                            <div className="p-2 sm:p-3 bg-blue-100 rounded-lg">
                                <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Total KPIs</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{allKPIs.length}</p>
                            </div>
                        </div>
                    </div>

                    <div className="card p-4 sm:p-6">
                        <div className="flex items-center">
                            <div className="p-2 sm:p-3 bg-green-100 rounded-lg">
                                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <p className="text-xs sm:text-sm font-medium text-gray-600">Evidence Items</p>
                                <p className="text-xl sm:text-2xl font-bold text-gray-900">{totalEvidence}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Help Text for Evidence */}
                {allKPIs.length === 0 && initiatives.length > 0 && (
                    <div className="card p-3 sm:p-4 bg-blue-50 border-blue-200">
                        <div className="flex items-start sm:items-center">
                            <div className="p-2 bg-blue-100 rounded-lg mr-3 flex-shrink-0">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
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
                )}

                {/* Initiatives */}
                <div>
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Your Initiatives</h2>
                    </div>

                    {initiatives.length === 0 ? (
                        <div className="card p-6 sm:p-12 text-center">
                            <Target className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">
                                Welcome to OFE!
                            </h3>
                            <p className="text-gray-600 mb-6 text-sm sm:text-base px-2">
                                Let's start by creating your first initiative. Think of it as a project or program you want to track.
                            </p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn-primary text-base sm:text-lg px-4 sm:px-6 py-2 sm:py-3"
                            >
                                Create Your First Initiative
                            </button>
                            <p className="text-xs sm:text-sm text-gray-500 mt-4 px-2">
                                💡 Example: "Youth Training Program 2025" or "Clean Water Project"
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                            {initiatives.map((initiative) => (
                                <Link
                                    key={initiative.id}
                                    to={`/initiatives/${initiative.id}`}
                                    className="card p-4 sm:p-6 hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-primary-200 group"
                                >
                                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors pr-2">
                                            {initiative.title}
                                        </h3>
                                        <div className="text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                            <ExternalLink className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <p className="text-gray-600 text-sm mb-3 sm:mb-4 line-clamp-3">
                                        {truncateText(initiative.description, 120)}
                                    </p>

                                    <div className="pt-3 sm:pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-xs sm:text-sm">
                                            <span className="text-gray-500 truncate pr-2">
                                                Created {formatDate(initiative.created_at || '')}
                                            </span>
                                            <span className="text-primary-600 font-medium group-hover:underline flex-shrink-0">
                                                Open →
                                            </span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
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

            <AddEvidenceModal
                isOpen={showEvidenceModal}
                onClose={() => setShowEvidenceModal(false)}
                onSubmit={handleAddEvidence}
                availableKPIs={allKPIs}
                initiativeId=""
                preSelectedKPIId=""
            />

            {showTutorial && (
                <FirstTimeTutorial
                    onClose={handleTutorialClose}
                    onGetStarted={handleTutorialGetStarted}
                />
            )}
        </>
    )
} 