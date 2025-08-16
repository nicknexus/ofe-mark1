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
}

export default function KPIEvidenceSection({ kpi, onRefresh, initiativeId }: KPIEvidenceSectionProps) {
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(true)
    const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)
    const [isEditEvidenceModalOpen, setIsEditEvidenceModalOpen] = useState(false)
    const [deleteConfirmEvidence, setDeleteConfirmEvidence] = useState<Evidence | null>(null)

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
            <div className="card p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="card p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-gray-900">
                    Evidence ({evidence.length})
                </h3>
                <button
                    onClick={() => setIsEvidenceModalOpen(true)}
                    className="btn-primary flex items-center space-x-1 text-xs px-2 py-1"
                >
                    <Upload className="w-3 h-3" />
                    <span>Add</span>
                </button>
            </div>

            {/* Evidence List */}
            {evidence.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                    <Upload className="w-8 h-8 mx-auto text-gray-300 mb-3" />
                    <p className="text-sm">No evidence uploaded yet</p>
                    <button
                        onClick={() => setIsEvidenceModalOpen(true)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-700"
                    >
                        Add the first evidence
                    </button>
                </div>
            ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
                    {evidence
                        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
                        .map(evidenceItem => {
                            const IconComponent = getEvidenceIcon(evidenceItem.type)
                            const typeInfo = getEvidenceTypeInfo(evidenceItem.type)

                            return (
                                <div key={evidenceItem.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer" onClick={() => handleEvidenceClick(evidenceItem)}>
                                    <div className="flex items-start space-x-3">
                                        <div className={`p-1.5 rounded-lg ${typeInfo.color} flex-shrink-0`}>
                                            <IconComponent className="w-3 h-3" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-start justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors line-clamp-1">
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
                                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
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
                                                        className="text-gray-400 hover:text-gray-600"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEditEvidence(evidenceItem)
                                                        }}
                                                    >
                                                        <Edit className="w-3 h-3" />
                                                    </button>
                                                    <button
                                                        className="text-gray-400 hover:text-red-600"
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
        </div>
    )
} 