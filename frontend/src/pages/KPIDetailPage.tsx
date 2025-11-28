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

            // Load beneficiaries for all data points in parallel (PERFORMANCE OPTIMIZATION)
            const beneficiaryPromises = updates.map(update =>
                apiService.getBeneficiaryGroupsForUpdate(update.id!).catch(error => {
                    console.error('Error loading beneficiaries for update:', update.id, error)
                    return []
                })
            )

            const beneficiaryResults = await Promise.allSettled(beneficiaryPromises)
            const beneficiaryData = beneficiaryResults.map((result, index) => ({
                updateId: updates[index].id,
                beneficiaries: result.status === 'fulfilled' ? (result.value as any[] || []) : []
            }))
            const beneficiaryMap: Record<string, any[]> = {}
            beneficiaryData.forEach(result => {
                beneficiaryMap[result.updateId!] = result.beneficiaries as any[]
            })
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
        if (dataPoint.isFullySupported) return 'text-green-600'
        if (dataPoint.completionPercentage && dataPoint.completionPercentage > 0) return 'text-yellow-600'
        return 'text-gray-500'
    }

    const getStatusDot = (dataPoint: DataPointWithEvidence) => {
        if (dataPoint.isFullySupported) return 'bg-green-500'
        if (dataPoint.completionPercentage && dataPoint.completionPercentage > 0) return 'bg-yellow-500'
        return 'bg-gray-300'
    }

    return (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {dataPointsWithEvidence
                .sort((a, b) => new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
                .map((dataPoint) => {
                    const isExpanded = expandedPoints.includes(dataPoint.id!)
                    return (
                        <div key={dataPoint.id} className="border border-gray-200 rounded-lg">
                            {/* Main Data Point Card */}
                            <div
                                className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                                onClick={() => toggleExpanded(dataPoint.id!)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusDot(dataPoint)}`}></div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center space-x-2 mb-1">
                                                <span className="text-lg font-bold text-primary-600">
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
                                <div className="border-t border-gray-100 p-4 bg-gray-50">
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
                                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800"
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
                                                className={`h-2 rounded-full ${dataPoint.isFullySupported ? 'bg-green-500' :
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
                        <div className="flex items-center space-x-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Delete Evidence</h3>
                                <p className="text-sm text-gray-600">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-700 mb-6">
                            Are you sure you want to delete "<strong>{deleteConfirmEvidence.title}</strong>"?
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmEvidence(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteEvidence(deleteConfirmEvidence)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
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
                            onClick={() => setIsUpdateModalOpen(true)}
                            className="btn-primary flex items-center justify-center space-x-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Data</span>
                        </button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="card p-3 sm:p-4 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-blue-600">{updates.length}</p>
                        <p className="text-xs sm:text-sm text-gray-600">Impact Claims</p>
                    </div>
                    <div className="card p-3 sm:p-4 text-center">
                        <p className="text-lg sm:text-2xl font-bold text-green-600">
                            {updates.reduce((sum, update) => sum + update.value, 0)}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-600">Total {kpi.unit_of_measurement}</p>
                    </div>
                </div>

                {/* Evidence Type Statistics - Compact horizontal layout */}
                {evidenceStats.length > 0 && (
                    <div className="card p-3">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                            <span className="text-sm font-medium text-gray-700 mr-2">Evidence Types:</span>
                            {evidenceStats.map((stat, index) => {
                                const IconComponent = getEvidenceIcon(stat.type)
                                const typeInfo = getEvidenceTypeInfo(stat.type)
                                return (
                                    <div key={stat.type} className="flex items-center space-x-1.5">
                                        <div className={`p-1 rounded-lg ${typeInfo.color} flex-shrink-0`}>
                                            <IconComponent className="w-3 h-3" />
                                        </div>
                                        <span className="text-xs font-medium text-gray-900">{stat.label}</span>
                                        <span className="text-xs text-gray-600">({stat.count} • {stat.percentage}%)</span>
                                        {index < evidenceStats.length - 1 && <span className="text-gray-300">|</span>}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Date Filter */}
                <div className="card p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">Filter by Date Range</h3>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-600">From:</label>
                                <input
                                    type="date"
                                    value={dateFilter.startDate}
                                    onChange={(e) => setDateFilter(prev => ({
                                        ...prev,
                                        startDate: e.target.value,
                                        isActive: e.target.value !== '' && prev.endDate !== ''
                                    }))}
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-600">To:</label>
                                <input
                                    type="date"
                                    value={dateFilter.endDate}
                                    onChange={(e) => setDateFilter(prev => ({
                                        ...prev,
                                        endDate: e.target.value,
                                        isActive: prev.startDate !== '' && e.target.value !== ''
                                    }))}
                                    className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                            </div>
                            <button
                                onClick={() => setDateFilter({ startDate: '', endDate: '', isActive: false })}
                                className="btn-secondary text-sm px-3 py-2"
                                disabled={!dateFilter.isActive}
                            >
                                Clear Filter
                            </button>
                        </div>
                    </div>
                    {dateFilter.isActive && (
                        <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-700">
                                Showing data from {new Date(dateFilter.startDate).toLocaleDateString()} to {new Date(dateFilter.endDate).toLocaleDateString()}
                            </p>
                        </div>
                    )}
                </div>

                {/* Data and Evidence Lists - Full width on desktop */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                    {/* Data Updates Timeline - Takes 2/3 of the space */}
                    <div className="xl:col-span-2 card p-4 sm:p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                                Impact Claims ({dateFilter.isActive ? filteredUpdates.length : updates.length})
                            </h3>
                            <div className="flex items-center space-x-3">
                                <div className="flex items-center space-x-4 text-sm">
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-blue-600">{dateFilter.isActive ? filteredUpdates.length : updates.length}</div>
                                        <div className="text-xs text-gray-600">Items</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-bold text-green-600">
                                            {dateFilter.isActive ? filteredTotal : updates.reduce((sum, update) => sum + update.value, 0)}
                                        </div>
                                        <div className="text-xs text-gray-600">Total {kpi.unit_of_measurement}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsUpdateModalOpen(true)}
                                    className="btn-secondary flex items-center space-x-2 text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span className="hidden sm:inline">Add Impact Claim</span>
                                    <span className="sm:hidden">Add</span>
                                </button>
                            </div>
                        </div>

                        {/* Filtered Total Sum */}
                        {dateFilter.isActive && (
                            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-green-700">Filtered Range Total:</span>
                                    <span className="text-lg font-bold text-green-600">
                                        {filteredTotal} {kpi.unit_of_measurement}
                                    </span>
                                </div>
                            </div>
                        )}

                        {filteredUpdates.length === 0 ? (
                            <div className="text-center py-8">
                                <Calendar className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                                <p className="text-gray-600 text-sm sm:text-base">
                                    {dateFilter.isActive ? 'No impact claims in selected date range' : 'No impact claims yet'}
                                </p>
                                {!dateFilter.isActive && (
                                    <button
                                        onClick={() => setIsUpdateModalOpen(true)}
                                        className="btn-primary mt-4 text-sm"
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

                    {/* New KPI Evidence Section - Takes 1/3 of the space */}
                    <div className="xl:col-span-1">
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                        {/* Individual Data Points Chart */}
                        <div className="card p-4 sm:p-6">
                            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">
                                Individual Impact Claims
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
        </>
    )
} 