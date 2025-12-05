import React from 'react'
import { X, Calendar, FileText, Camera, MessageSquare, DollarSign, Eye } from 'lucide-react'
import { formatDate, getEvidenceTypeInfo } from '../utils'
import { Evidence } from '../types'

interface AllEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    evidence: Evidence[]
    kpi: any
    onEvidenceClick?: (evidence: Evidence) => void
}

export default function AllEvidenceModal({
    isOpen,
    onClose,
    evidence,
    kpi,
    onEvidenceClick
}: AllEvidenceModalProps) {
    if (!isOpen) return null

    // Group evidence by type
    const groupedByType: Record<string, Evidence[]> = {
        visual_proof: [],
        documentation: [],
        testimony: [],
        financials: []
    }

    evidence.forEach((ev) => {
        const type = ev.type || 'documentation'
        if (groupedByType[type]) {
            groupedByType[type].push(ev)
        }
    })

    // Get icon component for evidence type
    const getEvidenceIcon = (type: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    const typeOrder: Array<'visual_proof' | 'documentation' | 'testimony' | 'financials'> = [
        'visual_proof',
        'documentation',
        'testimony',
        'financials'
    ]

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
            <div className="bubble-card max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="icon-bubble bg-primary-100">
                            <FileText className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">All Evidence</h2>
                            <p className="text-sm text-gray-500">{kpi?.title || 'Metric Evidence'}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
                    {evidence.length === 0 ? (
                        <div className="text-center py-12">
                            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No evidence available</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {typeOrder.map((type) => {
                                const typeEvidence = groupedByType[type]
                                if (typeEvidence.length === 0) return null

                                const typeInfo = getEvidenceTypeInfo(type)
                                const IconComponent = getEvidenceIcon(type)

                                return (
                                    <div key={type} className="space-y-3">
                                        {/* Type Header */}
                                        <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                                            <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                            <h3 className="text-sm font-semibold text-gray-700">
                                                {typeInfo.label}
                                            </h3>
                                            <span className="text-xs text-gray-500">
                                                ({typeEvidence.length} {typeEvidence.length === 1 ? 'item' : 'items'})
                                            </span>
                                        </div>

                                        {/* Evidence List */}
                                        <div className="space-y-2">
                                            {typeEvidence.map((ev) => {
                                                const hasDateRange = ev.date_range_start && ev.date_range_end
                                                const displayDate = hasDateRange
                                                    ? `${formatDate(ev.date_range_start)} - ${formatDate(ev.date_range_end)}`
                                                    : formatDate(ev.date_represented)

                                                return (
                                                    <div
                                                        key={ev.id}
                                                        onClick={() => onEvidenceClick?.(ev)}
                                                        className="border border-gray-100/80 rounded-lg bg-white/60 hover:bg-primary-50/50 hover:border-primary-200 cursor-pointer transition-all duration-200 p-3"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-sm font-semibold text-primary-600 truncate">
                                                                        {ev.title}
                                                                    </span>
                                                                </div>
                                                                {ev.description && (
                                                                    <p className="text-xs text-gray-500 line-clamp-1 mb-1">
                                                                        {ev.description}
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center space-x-2 text-[10px] text-gray-500">
                                                                    <Calendar className="w-2.5 h-2.5" />
                                                                    <span>{displayDate}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-2">
                                                                <Eye className="w-3 h-3 text-gray-400" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

