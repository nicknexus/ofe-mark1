import React, { useState, useEffect } from 'react'
import { X, Calendar, BarChart3, Edit, Trash2, MessageSquare, FileText, Eye } from 'lucide-react'
import { formatDate, getEvidenceTypeInfo } from '../utils'
import { apiService } from '../services/api'
import { Evidence } from '../types'

interface DataPointPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    dataPoint: any | null
    kpi: any | null
    onEdit?: (dataPoint: any) => void
    onDelete?: (dataPoint: any) => void
}

export default function DataPointPreviewModal({
    isOpen,
    onClose,
    dataPoint,
    kpi,
    onEdit,
    onDelete
}: DataPointPreviewModalProps) {
    const [linkedEvidence, setLinkedEvidence] = useState<Evidence[]>([])
    const [loadingEvidence, setLoadingEvidence] = useState(false)

    useEffect(() => {
        if (isOpen && dataPoint?.id) {
            loadLinkedEvidence()
        }
    }, [isOpen, dataPoint?.id])

    const loadLinkedEvidence = async () => {
        if (!dataPoint?.id) return
        try {
            setLoadingEvidence(true)
            const evidence = await apiService.getEvidenceForDataPoint(dataPoint.id)
            setLinkedEvidence(evidence || [])
        } catch (error) {
            console.error('Failed to load linked evidence:', error)
            setLinkedEvidence([])
        } finally {
            setLoadingEvidence(false)
        }
    }

    if (!isOpen || !dataPoint || !kpi) return null

    const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
        : formatDate(dataPoint.date_represented)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Data Point Details</h2>
                            <p className="text-sm text-gray-600">{kpi.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(dataPoint)}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-140px)]">
                    {/* Value Display */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 text-center border border-blue-100">
                        <div className="text-sm text-gray-600 mb-2">Value</div>
                        <div className="text-4xl font-bold text-blue-600">
                            {dataPoint.value?.toLocaleString()} {kpi.unit_of_measurement || ''}
                        </div>
                    </div>

                    {/* Date Information */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-2 mb-3">
                            <Calendar className="w-5 h-5 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">
                                {hasDateRange ? 'Date Range' : 'Date'}
                            </h3>
                        </div>
                        <div className="text-base font-medium text-gray-700">
                            {displayDate}
                        </div>
                        {hasDateRange && (
                            <div className="mt-2 text-xs text-gray-500">
                                Period: {Math.ceil((new Date(dataPoint.date_range_end).getTime() - new Date(dataPoint.date_range_start).getTime()) / (1000 * 60 * 60 * 24))} days
                            </div>
                        )}
                    </div>

                    {/* Label */}
                    {dataPoint.label && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <h3 className="text-sm font-semibold text-gray-900 mb-2">Label</h3>
                            <p className="text-gray-700">{dataPoint.label}</p>
                        </div>
                    )}

                    {/* Note */}
                    {dataPoint.note && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <MessageSquare className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Note</h3>
                            </div>
                            <p className="text-gray-700 whitespace-pre-wrap">{dataPoint.note}</p>
                        </div>
                    )}

                    {/* Linked Evidence */}
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex items-center space-x-2 mb-3">
                            <FileText className="w-5 h-5 text-gray-600" />
                            <h3 className="text-sm font-semibold text-gray-900">Linked Evidence</h3>
                            <span className="text-xs text-gray-500">({linkedEvidence.length})</span>
                        </div>
                        {loadingEvidence ? (
                            <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                            </div>
                        ) : linkedEvidence.length > 0 ? (
                            <div className="space-y-2">
                                {linkedEvidence.map((evidence) => {
                                    const typeInfo = getEvidenceTypeInfo(evidence.type)
                                    return (
                                        <div key={evidence.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-blue-300 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center space-x-2 mb-1">
                                                        <div className={`p-1.5 rounded ${typeInfo.color}`}>
                                                            <FileText className="w-3 h-3" />
                                                        </div>
                                                        <span className="text-sm font-medium text-gray-900 truncate">{evidence.title}</span>
                                                        <span className={`px-2 py-0.5 rounded text-xs ${typeInfo.color}`}>
                                                            {evidence.type.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    {evidence.description && (
                                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{evidence.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No evidence linked to this data point</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                        {onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(dataPoint)
                                    onClose()
                                }}
                                className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        )}
                        {onEdit && (
                            <button
                                onClick={() => {
                                    onEdit(dataPoint)
                                    onClose()
                                }}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

