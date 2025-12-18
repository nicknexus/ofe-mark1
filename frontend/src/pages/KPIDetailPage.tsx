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
    BarChart3,
    Users
} from 'lucide-react'
import { apiService } from '../services/api'
import { KPI, KPIUpdate, LoadingState, CreateKPIUpdateForm } from '../types'
import { formatDate, getCategoryColor, getEvidenceTypeInfo } from '../utils'
import AddKPIUpdateModal from '../components/AddKPIUpdateModal'
import KPIEvidenceSection from '../components/KPIEvidenceSection'
import EvidencePreviewModal from '../components/EvidencePreviewModal'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import AddEvidenceModal from '../components/AddEvidenceModal'
import EditDataPointBeneficiariesModal from '../components/EditDataPointBeneficiariesModal'

// DataPointsList Component
interface DataPointsListProps {
    updates: KPIUpdate[]
    kpi: KPI
    onRefresh: () => void
}

interface DataPointWithEvidence extends KPIUpdate {
    evidenceItems?: any[]
    completionPercentage?: number
    isFullySupported?: boolean
}

function DataPointsList({ updates, kpi, onRefresh }: DataPointsListProps) {
    const [expandedPoints, setExpandedPoints] = useState<string[]>([])
    const [dataPointsWithEvidence, setDataPointsWithEvidence] = useState<DataPointWithEvidence[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<any>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)
    const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false)
    const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<any>(null)
    const [editingDataPoint, setEditingDataPoint] = useState<any>(null)
    const [dataPointBeneficiaries, setDataPointBeneficiaries] = useState<Record<string, any[]>>({})

    useEffect(() => {
        if (updates.length > 0) {
            fetchDataPointsWithEvidence()
        }
    }, [updates])

    const fetchDataPointsWithEvidence = async () => {
        try {
            setLoading(true)
            const evidenceByDates = await apiService.getKPIEvidenceByDates(kpi.id!)

            // Map updates to include their evidence and completion data
            const updatesWithEvidence = updates.map(update => {
                // Find the matching date group from evidenceByDates
                const matchingGroup = evidenceByDates.find(group => {
                    return group.dataPoints.some((dp: any) => dp.id === update.id)
                })

                if (matchingGroup) {
                    const matchingDataPoint = matchingGroup.dataPoints.find((dp: any) => dp.id === update.id)
                    return {
                        ...update,
                        evidenceItems: matchingDataPoint?.evidenceItems || [],
                        completionPercentage: matchingDataPoint?.completionPercentage || 0,
                        isFullySupported: matchingDataPoint?.isFullySupported || false
                    }
                }

                return {
                    ...update,
                    evidenceItems: [],
                    completionPercentage: 0,
                    isFullySupported: false
                }
            })

            setDataPointsWithEvidence(updatesWithEvidence)

            // Load beneficiaries in batches to avoid rate limiting
            const beneficiaryMap: Record<string, any[]> = {}
            const batchSize = 2
            for (let i = 0; i < updates.length; i += batchSize) {
                const batch = updates.slice(i, i + batchSize)
                await Promise.all(batch.map(async (update) => {
                    try {
                        const groups = await apiService.getBeneficiaryGroupsForUpdate(update.id!)
                        beneficiaryMap[update.id!] = Array.isArray(groups) ? groups : []
                    } catch (error) {
                        console.error('Error loading beneficiaries for update:', update.id, error)
                        beneficiaryMap[update.id!] = []
                    }
                }))
                // Delay between batches
                if (i + batchSize < updates.length) {
                    await new Promise(resolve => setTimeout(resolve, 300))
                }
            }
            setDataPointBeneficiaries(beneficiaryMap)

        } catch (error) {
            console.error('Error fetching data points with evidence:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleExpanded = (updateId: string) => {
        setExpandedPoints(prev =>
            prev.includes(updateId)
                ? prev.filter(id => id !== updateId)
                : [...prev, updateId]
        )
    }

    const handleEvidenceClick = (evidence: any) => {
        setSelectedEvidence(evidence)
        setIsEvidencePreviewOpen(true)
    }

    const handleEditEvidence = (evidence: any) => {
        setSelectedEvidence(evidence)
        setIsEditEvidenceModalOpen(true)
    }

    const handleDeleteEvidence = async (evidence: any) => {
        if (!evidence.id) return
        try {
            await apiService.deleteEvidence(evidence.id)
            toast.success('Evidence deleted successfully!')
            fetchDataPointsWithEvidence()
            onRefresh()
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
            fetchDataPointsWithEvidence()
            onRefresh()
            setIsEditEvidenceModalOpen(false)
            setSelectedEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update evidence'
            toast.error(message)
            throw error
        }
    }

    const getStatusColor = (dataPoint: DataPointWithEvidence) => {
        if (dataPoint.isFullySupported) return 'text-primary-500'
        if (dataPoint.completionPercentage && dataPoint.completionPercentage > 0) return 'text-yellow-600'
        return 'text-gray-500'
    }

    const getStatusDot = (dataPoint: DataPointWithEvidence) => {
        if (dataPoint.isFullySupported) return 'bg-primary-500'
        if (dataPoint.completionPercentage && dataPoint.completionPercentage > 0) return 'bg-yellow-500'
        return 'bg-gray-300'
    }

    return (
        <div className="space-y-3 max-h-[calc(100vh-480px)] min-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
            {dataPointsWithEvidence
                .sort((a, b) => {
                    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
                    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
                    return dateB - dateA
                })
                .map((dataPoint) => {
                    const isExpanded = expandedPoints.includes(dataPoint.id!)
                    return (
                        <div key={dataPoint.id} className="bg-white/80 backdrop-blur-sm border border-gray-100 rounded-2xl shadow-soft-float hover:shadow-soft-float-hover transition-all duration-200">
                            {/* Main Data Point Card */}
                            <div
                                className="p-4 cursor-pointer hover:bg-white/90 transition-all duration-200 rounded-2xl"
                                onClick={() => toggleExpanded(dataPoint.id!)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusDot(dataPoint)}`}></div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-lg font-bold text-primary-500">
                                                    {dataPoint.value} {kpi.unit_of_measurement}
                                                </span>
                                                {dataPoint.label && (
                                                    <span className="text-sm text-gray-500">- {dataPoint.label}</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-600">
                                                {dataPoint.date_range_start && dataPoint.date_range_end ? (
                                                    <span>Range: {formatDate(dataPoint.date_range_start)} - {formatDate(dataPoint.date_range_end)}</span>
                                                ) : (
                                                    <span>Date: {formatDate(dataPoint.date_represented)}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 flex-shrink-0">
                                        <span className={`text-sm font-medium ${getStatusColor(dataPoint)}`}>
                                            {dataPoint.completionPercentage || 0}%
                                        </span>
                                        <button
                                            className="text-gray-400 hover:text-blue-600"
                                            onClick={(e) => {
                                                e.preventDefault()
                                                e.stopPropagation()
                                                setEditingDataPoint({ ...dataPoint, kpi })
                                            }}
                                            title="Edit Beneficiaries"
                                        >
                                            <Users className="w-4 h-4" />
                                        </button>
                                        <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Details */}
                            {isExpanded && (
                                <div className="border-t border-gray-100/60 p-4 bg-offWhite/50 rounded-b-2xl">
                                    {/* Beneficiaries */}
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-700">Beneficiary Groups</span>
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault()
                                                    e.stopPropagation()
                                                    setEditingDataPoint({ ...dataPoint, kpi })
                                                }}
                                                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
                                            >
                                                Edit
                                            </button>
                                        </div>
                                        {dataPointBeneficiaries[dataPoint.id!]?.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {dataPointBeneficiaries[dataPoint.id!].map((beneficiary: any) => (
                                                    <span
                                                        key={beneficiary.id}
                                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                                                    >
                                                        {beneficiary.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-xs text-gray-500">No beneficiary groups linked</p>
                                        )}
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="mb-4">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-gray-700">Evidence Coverage</span>
                                            <span className={getStatusColor(dataPoint)}>
                                                {dataPoint.completionPercentage || 0}% Complete
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full ${dataPoint.isFullySupported ? 'bg-primary-500' :
                                                    dataPoint.completionPercentage && dataPoint.completionPercentage > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                                                    }`}
                                                style={{ width: `${dataPoint.completionPercentage || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Evidence Items */}
                                    {dataPoint.evidenceItems && dataPoint.evidenceItems.length > 0 ? (
                                        <div>
                                            <h5 className="text-sm font-medium text-gray-700 mb-2">
                                                Evidence ({dataPoint.evidenceItems.length} items)
                                            </h5>
                                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                {dataPoint.evidenceItems.map((evidence: any) => (
                                                    <div
                                                        key={evidence.id}
                                                        className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 cursor-pointer transition-colors"
                                                        onClick={() => handleEvidenceClick(evidence)}
                                                    >
                                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                                                            <div className="min-w-0 flex-1">
                                                                <span className="text-sm font-medium text-gray-900 block truncate hover:text-blue-600">
                                                                    {evidence.title}
                                                                </span>
                                                                <span className="text-xs text-gray-500 block">
                                                                    {evidence.date_range_start && evidence.date_range_end ? (
                                                                        <>Range: {formatDate(evidence.date_range_start)} - {formatDate(evidence.date_range_end)}</>
                                                                    ) : (
                                                                        <>Date: {formatDate(evidence.date_represented)}</>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center space-x-2 flex-shrink-0">
                                                            {evidence.file_url && (
                                                                <div className="text-gray-400">
                                                                    <ExternalLink className="w-3 h-3" />
                                                                </div>
                                                            )}
                                                            <button
                                                                className="text-gray-400 hover:text-gray-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleEditEvidence(evidence)
                                                                }}
                                                                title="Edit Evidence"
                                                            >
                                                                <Edit className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                className="text-gray-400 hover:text-red-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    setDeleteConfirmEvidence(evidence)
                                                                }}
                                                                title="Delete Evidence"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-sm text-gray-500">No evidence yet</p>
                                            <p className="text-xs text-gray-400">Add evidence to support this impact claim</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

            {/* Edit Evidence Modal */}
            {selectedEvidence && (
                <AddEvidenceModal
                    isOpen={isEditEvidenceModalOpen}
                    onClose={() => {
                        setIsEditEvidenceModalOpen(false)
                        setSelectedEvidence(null)
                    }}
                    onSubmit={handleUpdateEvidence}
                    availableKPIs={[kpi]}
                    initiativeId={kpi.initiative_id || ''}
                    preSelectedKPIId={kpi.id}
                    editData={selectedEvidence}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirmEvidence && (
                <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-50">
                    <div className="bg-white/90 backdrop-blur-xl rounded-3xl max-w-md w-full p-6 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border border-white/60">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2.5 bg-red-100/80 rounded-xl">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800">Delete Evidence</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-6">
                            Are you sure you want to delete "<strong className="text-gray-800">{deleteConfirmEvidence.title}</strong>"?
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmEvidence(null)}
                                className="flex-1 px-5 py-3 text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteEvidence(deleteConfirmEvidence)}
                                className="flex-1 px-5 py-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all duration-200 font-semibold shadow-lg shadow-red-500/25"
                            >
                                Delete Evidence
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Evidence Preview Modal */}
            <EvidencePreviewModal
                isOpen={isEvidencePreviewOpen}
                onClose={() => setIsEvidencePreviewOpen(false)}
                evidence={selectedEvidence}
                onEdit={(evidence) => {
                    setSelectedEvidence(evidence)
                    setIsEvidencePreviewOpen(false)
                    setIsEditEvidenceModalOpen(true)
                }}
                onDelete={(evidence) => {
                    setDeleteConfirmEvidence(evidence)
                    setIsEvidencePreviewOpen(false)
                }}
            />

            {/* Edit Data Point Beneficiaries Modal */}
            <EditDataPointBeneficiariesModal
                isOpen={!!editingDataPoint}
                onClose={() => setEditingDataPoint(null)}
                dataPoint={editingDataPoint}
                onRefresh={() => {
                    fetchDataPointsWithEvidence()
                    onRefresh()
                }}
            />
        </div>
    )
}

export default function KPIDetailPage() {
    const { initiativeId, kpiId } = useParams<{ initiativeId: string; kpiId: string }>()
    const [kpi, setKPI] = useState<KPI | null>(null)
    const [updates, setUpdates] = useState<KPIUpdate[]>([])
    const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
    const [evidenceStats, setEvidenceStats] = useState<any[]>([])

    // Modal states
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)

    // Date filter states
    const [dateFilter, setDateFilter] = useState<{
        startDate: string
        endDate: string
        isActive: boolean
    }>({
        startDate: '',
        endDate: '',
        isActive: false
    })

    // Filtered data based on date filter
    const filteredUpdates = dateFilter.isActive
        ? updates.filter(update => {
            const updateDate = update.date_represented
            const updateStart = update.date_range_start
            const updateEnd = update.date_range_end

            // Check if update overlaps with filter range
            if (updateStart && updateEnd) {
                // Update is a range - check overlap
                return dateFilter.startDate <= updateEnd && dateFilter.endDate >= updateStart
            } else {
                // Update is single date - check if it's within filter range
                return updateDate >= dateFilter.startDate && updateDate <= dateFilter.endDate
            }
        })
        : updates

    // Calculate filtered total sum
    const filteredTotal = filteredUpdates.reduce((sum, update) => sum + update.value, 0)

    useEffect(() => {
        if (kpiId) {
            loadKPIData()
        }
    }, [kpiId])

    const loadKPIData = async () => {
        if (!kpiId) return

        try {
            setLoadingState({ isLoading: true })
            const [kpiData, updatesData] = await Promise.all([
                apiService.getKPI(kpiId),
                apiService.getKPIUpdates(kpiId)
            ])

            setKPI(kpiData)
            setUpdates(updatesData)

            // Load evidence stats 
            loadEvidenceStats()

            setLoadingState({ isLoading: false })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load KPI data'
            setLoadingState({ isLoading: false, error: message })
            toast.error(message)
        }
    }

    const loadEvidenceStats = async () => {
        if (!kpiId || !initiativeId) return

        try {
            const [evidence, updates] = await Promise.all([
                apiService.getEvidence(initiativeId, kpiId),
                apiService.getKPIUpdates(kpiId)
            ])

            // Total data points (claims) for this KPI
            const totalDataPoints = updates?.length || 0

            if (!evidence || evidence.length === 0 || totalDataPoints === 0) {
                setEvidenceStats([])
                return
            }

            // For each evidence type, track which unique data points it covers
            const dataPointsCoveredByType: Record<string, Set<string>> = {
                visual_proof: new Set(),
                documentation: new Set(),
                testimony: new Set(),
                financials: new Set()
            }

            // Go through each evidence item and track which data points it covers
            evidence.forEach((ev: any) => {
                if (!ev.type || !dataPointsCoveredByType.hasOwnProperty(ev.type)) return

                // Get data points covered by this evidence
                if (ev.kpi_update_ids && Array.isArray(ev.kpi_update_ids)) {
                    ev.kpi_update_ids.forEach((updateId: string) => {
                        dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(updateId)
                    })
                } else if (ev.evidence_kpi_updates && Array.isArray(ev.evidence_kpi_updates)) {
                    ev.evidence_kpi_updates.forEach((link: any) => {
                        if (link.kpi_update_id) {
                            dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(link.kpi_update_id)
                        }
                    })
                } else if (ev.kpi_ids?.includes(kpiId)) {
                    // Legacy: if evidence is linked to the KPI, it covers all data points
                    updates.forEach((update: any) => {
                        if (update.id) {
                            dataPointsCoveredByType[ev.type as keyof typeof dataPointsCoveredByType].add(update.id)
                        }
                    })
                }
            })

            // Calculate stats for each type
            const stats = Object.entries(dataPointsCoveredByType).map(([type, coveredSet]) => ({
                type,
                count: coveredSet.size,
                percentage: totalDataPoints > 0 ? Math.round((coveredSet.size / totalDataPoints) * 100) : 0,
                label: type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
            })).filter(stat => stat.count > 0) // Only show types that have coverage

            setEvidenceStats(stats)
        } catch (error) {
            console.error('Error loading evidence stats:', error)
            setEvidenceStats([])
        }
    }

    const getEvidenceIcon = (type: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
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

    return (
        <div className="min-h-screen">
            {/* Header with back navigation */}
            <div className="space-y-4 sm:space-y-5 p-4 sm:p-6 max-w-[1800px] mx-auto">
                {/* Top Header Bar */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                        <div className="flex items-center space-x-3 min-w-0">
                            <Link
                                to={`/initiatives/${initiativeId}`}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 -ml-2 rounded-xl hover:bg-gray-100/50"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <div className="min-w-0">
                                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 truncate">
                                    {kpi.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(kpi.category)}`}>
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
                                onClick={() => setIsUpdateModalOpen(true)}
                                className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 font-semibold transition-all duration-200 shadow-lg shadow-primary-500/25 text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Add Data</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-primary-500">{updates.length}</p>
                        <p className="text-xs sm:text-sm text-gray-500">Impact Claims</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 text-center">
                        <p className="text-xl sm:text-2xl font-bold text-evidence-500">
                            {updates.reduce((sum, update) => sum + update.value, 0)}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">Total {kpi.unit_of_measurement}</p>
                    </div>
                </div>

                {/* Evidence Type Statistics - Compact horizontal layout */}
                {evidenceStats.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <span className="text-sm font-medium text-gray-600 mr-2">Evidence Types:</span>
                            {evidenceStats.map((stat, index) => {
                                const IconComponent = getEvidenceIcon(stat.type)
                                const typeInfo = getEvidenceTypeInfo(stat.type)
                                return (
                                    <div key={stat.type} className="flex items-center space-x-1.5">
                                        <div className={`p-1.5 rounded-lg ${typeInfo.color} flex-shrink-0`}>
                                            <IconComponent className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-medium text-gray-800">{stat.label}</span>
                                        <span className="text-xs text-gray-500">({stat.count} • {stat.percentage}%)</span>
                                        {index < evidenceStats.length - 1 && <span className="text-gray-200">|</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Date Filter */}
                <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                        <h3 className="text-base font-semibold text-gray-800">Filter by Date Range</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-500">From:</label>
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(e) => setDateFilter(prev => ({
                                        ...prev,
                                        startDate: e.target.value,
                                        isActive: e.target.value !== '' && prev.endDate !== ''
                                    }))}
                                    className="bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-evidence-400 hover:bg-white/80 transition-all duration-200"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-500">To:</label>
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(e) => setDateFilter(prev => ({
                                        ...prev,
                                        endDate: e.target.value,
                                        isActive: prev.startDate !== '' && e.target.value !== ''
                                    }))}
                                    className="bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-evidence-400 hover:bg-white/80 transition-all duration-200"
                                />
                            </div>
                            <button
                                onClick={() => setDateFilter({ startDate: '', endDate: '', isActive: false })}
                                className="px-4 py-2 text-sm text-gray-600 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/80 font-medium transition-all duration-200 disabled:opacity-50"
                                disabled={!dateFilter.isActive}
                            >
                                Clear Filter
                            </button>
                        </div>
                    </div>
                    {dateFilter.isActive && (
                        <div className="mt-3 p-3 bg-evidence-50/60 backdrop-blur-sm rounded-xl border border-evidence-200/40">
                            <p className="text-sm text-primary-700">
                                Showing data from {new Date(dateFilter.startDate).toLocaleDateString()} to {new Date(dateFilter.endDate).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                </div>

                {/* Data and Evidence Lists - Full width on desktop */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
                    {/* Data Updates Timeline - Takes 2/3 of the space */}
                    <div className="xl:col-span-2 bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 sm:p-5 flex flex-col max-h-[calc(100vh-320px)]">
                        <div className="flex items-center justify-between mb-4 flex-shrink-0">
                            <h3 className="text-base font-semibold text-gray-800">
                                Impact Claims ({dateFilter.isActive ? filteredUpdates.length : updates.length})
                            </h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-4 text-sm">
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-primary-500">{dateFilter.isActive ? filteredUpdates.length : updates.length}</div>
                                        <div className="text-xs text-gray-500">Items</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-evidence-500">
                                            {dateFilter.isActive ? filteredTotal : updates.reduce((sum, update) => sum + update.value, 0)}
                                        </div>
                                        <div className="text-xs text-gray-500">Total {kpi.unit_of_measurement}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="flex items-center space-x-2 px-4 py-2 bg-primary-100/80 text-primary-700 rounded-xl hover:bg-primary-200/80 font-medium transition-all duration-200 text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Add Impact Claim</span>
                                    <span className="sm:hidden">Add</span>
                                </button>
                            </div>
                        </div>

                        {/* Filtered Total Sum */}
                        {dateFilter.isActive && (
                            <div className="mb-4 p-3 bg-evidence-50/60 backdrop-blur-sm rounded-xl border border-evidence-200/40 flex-shrink-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-primary-700">Filtered Range Total:</span>
                                    <span className="text-lg font-bold text-primary-500">
                                        {filteredTotal} {kpi.unit_of_measurement}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-hidden">
                            {filteredUpdates.length === 0 ? (
                                <div className="text-center py-8">
                                    <div className="w-14 h-14 rounded-2xl bg-gray-100/80 flex items-center justify-center mx-auto mb-4">
                                        <Calendar className="w-7 h-7 text-gray-400" />
                                    </div>
                                    <p className="text-gray-500 text-sm sm:text-base">
                                        {dateFilter.isActive ? 'No impact claims in selected date range' : 'No impact claims yet'}
                                    </p>
                                    {!dateFilter.isActive && (
                                        <button
                                            onClick={() => setIsUpdateModalOpen(true)}
                                            className="mt-4 px-5 py-2.5 bg-primary-500 text-white rounded-xl hover:bg-primary-600 font-semibold transition-all duration-200 shadow-lg shadow-primary-500/25 text-sm"
                                        >
                                            Add First Impact Claim
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <DataPointsList
                                    updates={filteredUpdates}
                                    kpi={kpi}
                                    onRefresh={() => {
                                        loadKPIData() // This will refresh data points and evidence stats
                                    }}
                                />
                            )}
                        </div>
                    </div>

                    {/* New KPI Evidence Section - Takes 1/3 of the space */}
                    <div className="xl:col-span-1 max-h-[calc(100vh-320px)]">
                        <KPIEvidenceSection
                            kpi={kpi}
                            onRefresh={() => {
                                loadKPIData() // This will refresh both data points and evidence stats
                            }}
                            initiativeId={initiativeId!}
                            dateFilter={dateFilter}
                        />
                    </div>
                </div>

                {/* Charts Section - Full width at bottom on desktop */}
                {updates.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                        {/* Individual Data Points Chart */}
                        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 sm:p-5">
                            <h3 className="text-base font-semibold text-gray-800 mb-4">
                                Individual Impact Claims
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
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
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        stroke="#9ca3af"
                                        fontSize={11}
                                    />
                                    <YAxis
                                        stroke="#9ca3af"
                                        fontSize={11}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'rgba(255,255,255,0.95)',
                                            backdropFilter: 'blur(8px)',
                                            border: '1px solid rgba(0,0,0,0.05)',
                                            borderRadius: '12px',
                                            boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                                        }}
                                        formatter={(value, name) => [
                                            `${value} ${kpi.unit_of_measurement || ''}`,
                                            'Value'
                                        ]}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#3db6fd"
                                        strokeWidth={3}
                                        dot={{ fill: '#3db6fd', r: 5 }}
                                        activeDot={{ r: 7, stroke: '#3db6fd', strokeWidth: 2 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
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
        </div>
    )
} 