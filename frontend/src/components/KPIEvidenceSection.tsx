import React, { useState, useEffect } from 'react'
import {
    Upload,
    Edit,
    FileText,
    Camera,
    MessageSquare,
    DollarSign,
    ExternalLink,
    Trash2
} from 'lucide-react'
import { apiService } from '../services/api'
import { KPI, Evidence, CreateEvidenceForm } from '../types'
import { formatDate, getEvidenceTypeInfo } from '../utils'
import AddEvidenceModal from './AddEvidenceModal'
import EvidencePreviewModal from './EvidencePreviewModal'
import toast from 'react-hot-toast'

interface KPIEvidenceSectionProps {
    kpi: KPI
    onRefresh: () => void
    initiativeId: string
    dateFilter?: {
        startDate: string
        endDate: string
        isActive: boolean
    }
}

export default function KPIEvidenceSection({ kpi, onRefresh, initiativeId, dateFilter }: KPIEvidenceSectionProps) {
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(true)
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)
    const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false)
    const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<Evidence | null>(null)

    // Filter evidence based on date filter
    const filteredEvidence = dateFilter?.isActive
        ? evidence.filter(evidenceItem => {
            const evidenceDate = evidenceItem.date_represented
            const evidenceStart = evidenceItem.date_range_start
            const evidenceEnd = evidenceItem.date_range_end

            // Check if evidence overlaps with filter range
            if (evidenceStart && evidenceEnd) {
                // Evidence is a range - check overlap
                return dateFilter.startDate <= evidenceEnd && dateFilter.endDate >= evidenceStart
            } else {
                // Evidence is single date - check if it's within filter range
                return evidenceDate >= dateFilter.startDate && evidenceDate <= dateFilter.endDate
            }
        })
        : evidence

    useEffect(() => {
        if (kpi.id) {
            loadEvidence()
        }
    }, [kpi.id])

    const loadEvidence = async () => {
        try {
            setLoading(true)
            const data = await apiService.getEvidence(initiativeId, kpi.id!)
            setEvidence(data)
        } catch (error) {
            console.error('Error loading evidence:', error)
            toast.error('Failed to load evidence')
        } finally {
            setLoading(false)
        }
    }

    const handleAddEvidence = async (evidenceData: CreateEvidenceForm) => {
        try {
            await apiService.createEvidence(evidenceData)
            toast.success('Evidence added successfully!')
            loadEvidence()
            onRefresh()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
            throw error
        }
    }

    const handleEvidenceClick = (evidenceItem: Evidence) => {
        setSelectedEvidence(evidenceItem)
        setIsEvidencePreviewOpen(true)
    }

    const handleEditEvidence = (evidenceItem: Evidence) => {
        setSelectedEvidence(evidenceItem)
        setIsEditEvidenceModalOpen(true)
    }

    const handleDeleteEvidence = async (evidenceItem: Evidence) => {
        if (!evidenceItem.id) return
        try {
            await apiService.deleteEvidence(evidenceItem.id)
            toast.success('Evidence deleted successfully!')
            loadEvidence()
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
            loadEvidence()
            onRefresh()
            setIsEditEvidenceModalOpen(false)
            setSelectedEvidence(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update evidence'
            toast.error(message)
            throw error
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

    if (loading) {
        return (
            <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-5 h-full">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200/60 rounded-lg w-1/4"></div>
                    <div className="h-20 bg-gray-200/60 rounded-xl"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-soft-float border border-white/60 p-4 sm:p-5 h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-800">
                    Evidence ({dateFilter?.isActive ? filteredEvidence.length : evidence.length})
                </h3>
                <div className="flex items-center space-x-3">
                    <div className="text-right text-sm">
                        <div className="text-lg font-bold text-evidence-500">{dateFilter?.isActive ? filteredEvidence.length : evidence.length}</div>
                        <div className="text-xs text-gray-500">Items</div>
                    </div>
                    <button
                        onClick={() => setIsEvidenceModalOpen(true)}
                        className="flex items-center justify-center space-x-2 px-4 py-2 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Add Evidence</span>
                        <span className="sm:hidden">Add</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-evidence-500"></div>
                    </div>
                ) : filteredEvidence.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100/80 flex items-center justify-center mx-auto mb-4">
                            <Upload className="w-7 h-7 text-gray-400" />
                        </div>
                        <p className="text-gray-500 text-sm sm:text-base">
                            {dateFilter?.isActive
                                ? 'No evidence in selected date range'
                                : 'No evidence yet'
                            }
                        </p>
                        {!dateFilter?.isActive && (
                            <button
                                onClick={() => setIsEvidenceModalOpen(true)}
                                className="mt-4 px-5 py-2.5 bg-evidence-500 text-white rounded-xl hover:bg-evidence-600 font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25 text-sm"
                            >
                                Add First Evidence
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 max-h-[calc(100vh-480px)] min-h-[150px] overflow-y-auto pr-2 scrollbar-thin">
                        {filteredEvidence
                            .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                            .map(evidenceItem => {
                                const IconComponent = getEvidenceIcon(evidenceItem.type)
                                const typeInfo = getEvidenceTypeInfo(evidenceItem.type)

                                return (
                                    <div key={evidenceItem.id} className="p-3 bg-white/60 backdrop-blur-sm border border-gray-100 rounded-xl hover:border-evidence-300 hover:shadow-soft-float transition-all duration-200 cursor-pointer" onClick={() => handleEvidenceClick(evidenceItem)}>
                                        <div className="flex items-start space-x-3">
                                            <div className={`p-1.5 rounded-lg ${typeInfo.color} flex-shrink-0`}>
                                                <IconComponent className="w-3 h-3" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between">
                                                    <div className="min-w-0 flex-1">
                                                        <h4 className="text-sm font-medium text-gray-800 hover:text-evidence-600 transition-colors line-clamp-1">
                                                            {evidenceItem.title}
                                                        </h4>
                                                        <div className="flex items-center text-xs text-gray-500 space-x-2 mt-1">
                                                            <span>
                                                                {evidenceItem.date_range_start && evidenceItem.date_range_end ? (
                                                                    <>Range: {formatDate(evidenceItem.date_range_start)} - {formatDate(evidenceItem.date_range_end)}</>
                                                                ) : (
                                                                    <>Date: {formatDate(evidenceItem.date_represented)}</>
                                                                )}
                                                            </span>
                                                            <span>•</span>
                                                            <span className="capitalize">{evidenceItem.type.replace('_', ' ')}</span>
                                                        </div>
                                                        {evidenceItem.description && (
                                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                                                                {evidenceItem.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                                                        {evidenceItem.file_url && (
                                                            <div className="text-gray-400">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                        <button
                                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100/50"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                handleEditEvidence(evidenceItem)
                                                            }}
                                                        >
                                                            <Edit className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            className="text-gray-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50/50"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                setDeleteConfirmEvidence(evidenceItem)
                                                            }}
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                    </div>
                )}
            </div>

            {/* Add Evidence Modal */}
            <AddEvidenceModal
                isOpen={isEvidenceModalOpen}
                onClose={() => setIsEvidenceModalOpen(false)}
                onSubmit={handleAddEvidence}
                availableKPIs={[kpi]}
                initiativeId={initiativeId}
                preSelectedKPIId={kpi.id}
            />

            {/* Evidence Preview Modal */}
            {selectedEvidence && (
                <EvidencePreviewModal
                    evidence={selectedEvidence}
                    isOpen={isEvidencePreviewOpen}
                    onClose={() => setIsEvidencePreviewOpen(false)}
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
            )}

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
                    initiativeId={initiativeId}
                    preSelectedKPIId={kpi.id}
                    editData={selectedEvidence}
                />
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirmEvidence && (
                <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
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
        </div>
    )
} 