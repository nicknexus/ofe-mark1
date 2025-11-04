import React, { useState, useEffect } from 'react'
import { X, Calendar, FileText, Camera, MessageSquare, DollarSign, ExternalLink, Download, Edit, BarChart3 } from 'lucide-react'
import { Evidence } from '../types'
import { formatDate, getEvidenceTypeInfo } from '../utils'
import { apiService } from '../services/api'

interface EvidencePreviewModalProps {
    isOpen: boolean
    onClose: () => void
    evidence: Evidence | null
    onEdit?: (evidence: Evidence) => void
}

export default function EvidencePreviewModal({ isOpen, onClose, evidence, onEdit }: EvidencePreviewModalProps) {
    const [linkedDataPoints, setLinkedDataPoints] = useState<any[]>([])
    const [loadingDataPoints, setLoadingDataPoints] = useState(false)

    useEffect(() => {
        if (isOpen && evidence?.id) {
            loadLinkedDataPoints()
        }
    }, [isOpen, evidence?.id])

    const loadLinkedDataPoints = async () => {
        if (!evidence?.id) return
        try {
            setLoadingDataPoints(true)
            const dataPoints = await apiService.getDataPointsForEvidence(evidence.id)
            setLinkedDataPoints(dataPoints || [])
        } catch (error) {
            console.error('Failed to load linked data points:', error)
            setLinkedDataPoints([])
        } finally {
            setLoadingDataPoints(false)
        }
    }

    if (!isOpen || !evidence) return null

    const getEvidenceIcon = (type: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    const typeInfo = getEvidenceTypeInfo(evidence.type)
    const IconComponent = getEvidenceIcon(evidence.type)

    const isImage = evidence.file_url && (
        evidence.file_url.includes('.jpg') ||
        evidence.file_url.includes('.jpeg') ||
        evidence.file_url.includes('.png') ||
        evidence.file_url.includes('.gif') ||
        evidence.file_url.includes('.webp')
    )

    const isPDF = evidence.file_url && evidence.file_url.includes('.pdf')

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                            <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">{evidence.title}</h2>
                            <p className="text-sm text-gray-600 capitalize">{evidence.type.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(evidence)}
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

                <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
                    {/* Content Preview (Left side on desktop) */}
                    {evidence.file_url && (
                        <div className="flex-1 p-6 flex items-center justify-center bg-gray-50">
                            {isImage ? (
                                <div className="max-w-full max-h-full">
                                    <img
                                        src={evidence.file_url}
                                        alt={evidence.title}
                                        className="max-w-full max-h-96 object-contain rounded-lg shadow-lg"
                                    />
                                </div>
                            ) : isPDF ? (
                                <div className="w-full h-96">
                                    <iframe
                                        src={evidence.file_url}
                                        className="w-full h-full border border-gray-200 rounded-lg"
                                        title={evidence.title}
                                    />
                                </div>
                            ) : (
                                <div className="text-center">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                                    <a
                                        href={evidence.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="btn-primary inline-flex items-center space-x-2"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        <span>Open in New Tab</span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details Panel (Right side on desktop) */}
                    <div className="w-full lg:w-80 p-6 border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto">
                        <div className="space-y-6">
                            {/* Description */}
                            {evidence.description && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                                    <p className="text-sm text-gray-600">{evidence.description}</p>
                                </div>
                            )}

                            {/* Date Information */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Date</h3>
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        {evidence.date_range_start && evidence.date_range_end ? (
                                            <>Range: {formatDate(evidence.date_range_start)} - {formatDate(evidence.date_range_end)}</>
                                        ) : (
                                            <>Date: {formatDate(evidence.date_represented)}</>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* File Information */}
                            {evidence.file_url && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">File</h3>
                                    <div className="space-y-2">
                                        {evidence.file_type && (
                                            <p className="text-sm text-gray-600">Type: {evidence.file_type}</p>
                                        )}
                                        <div className="flex space-x-2">
                                            <a
                                                href={evidence.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-secondary text-xs inline-flex items-center space-x-1"
                                            >
                                                <ExternalLink className="w-3 h-3" />
                                                <span>Open</span>
                                            </a>
                                            <a
                                                href={evidence.file_url}
                                                download
                                                className="btn-secondary text-xs inline-flex items-center space-x-1"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>Download</span>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p>Type: <span className="capitalize">{evidence.type.replace('_', ' ')}</span></p>
                                    {evidence.created_at && (
                                        <p>Uploaded: {formatDate(evidence.created_at.split('T')[0])}</p>
                                    )}
                                </div>
                            </div>

                            {/* Linked Data Points */}
                            <div>
                                <div className="flex items-center space-x-2 mb-3">
                                    <BarChart3 className="w-4 h-4 text-gray-600" />
                                    <h3 className="text-sm font-medium text-gray-700">Supporting Impact Claims</h3>
                                    <span className="text-xs text-gray-500">({linkedDataPoints.length})</span>
                                </div>
                                {loadingDataPoints ? (
                                    <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-600 mx-auto"></div>
                                    </div>
                                ) : linkedDataPoints.length > 0 ? (
                                    <div className="space-y-2">
                                        {linkedDataPoints.map((dataPoint) => {
                                            const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
                                            const displayDate = hasDateRange
                                                ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
                                                : formatDate(dataPoint.date_represented)

                                            return (
                                                <div key={dataPoint.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-green-300 transition-colors">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm font-semibold text-blue-600">
                                                                {dataPoint.value?.toLocaleString()} {dataPoint.kpi?.unit_of_measurement || ''}
                                                            </span>
                                                            {dataPoint.kpi && (
                                                                <span className="text-xs text-gray-500 truncate max-w-[120px]">
                                                                    {dataPoint.kpi.title}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                                                            <Calendar className="w-3 h-3" />
                                                            <span>{displayDate}</span>
                                                        </div>
                                                        {dataPoint.label && (
                                                            <p className="text-xs text-gray-600 mt-1 line-clamp-1">{dataPoint.label}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No impact claims linked to this evidence</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 