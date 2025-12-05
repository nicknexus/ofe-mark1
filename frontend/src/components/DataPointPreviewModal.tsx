import React, { useState, useEffect, useMemo } from 'react'
import { X, Calendar, BarChart3, Edit, Trash2, MessageSquare, FileText, MapPin, Users, Camera, DollarSign, Upload, Plus, Eye } from 'lucide-react'
import { formatDate, getEvidenceTypeInfo, parseLocalDate } from '../utils'
import { apiService } from '../services/api'
import { Evidence, Location, BeneficiaryGroup } from '../types'

interface DataPointPreviewModalProps {
    isOpen: boolean
    onClose: () => void
    dataPoint: any | null
    kpi: any | null
    onEdit?: (dataPoint: any) => void
    onDelete?: (dataPoint: any) => void
    onEvidenceClick?: (evidence: Evidence) => void
    onAddEvidence?: (dataPoint: any) => void
}

export default function DataPointPreviewModal({
    isOpen,
    onClose,
    dataPoint,
    kpi,
    onEdit,
    onDelete,
    onEvidenceClick,
    onAddEvidence
}: DataPointPreviewModalProps) {
    const [linkedEvidence, setLinkedEvidence] = useState<Evidence[]>([])
    const [loadingEvidence, setLoadingEvidence] = useState(false)
    const [location, setLocation] = useState<Location | null>(null)
    const [loadingLocation, setLoadingLocation] = useState(false)
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false)

    useEffect(() => {
        if (isOpen && dataPoint?.id) {
            loadLinkedEvidence()
            if (dataPoint.location_id) {
                loadLocation()
            } else {
                setLocation(null)
            }
            loadBeneficiaryGroups()
        }
    }, [isOpen, dataPoint?.id, dataPoint?.location_id])

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

    const loadLocation = async () => {
        if (!dataPoint?.location_id) return
        try {
            setLoadingLocation(true)
            const loc = await apiService.getLocation(dataPoint.location_id)
            setLocation(loc)
        } catch (error) {
            console.error('Failed to load location:', error)
            setLocation(null)
        } finally {
            setLoadingLocation(false)
        }
    }

    const loadBeneficiaryGroups = async () => {
        if (!dataPoint?.id) return
        try {
            setLoadingBeneficiaries(true)
            const groups = await apiService.getBeneficiaryGroupsForUpdate(dataPoint.id)
            setBeneficiaryGroups(Array.isArray(groups) ? groups : [])
        } catch (error) {
            console.error('Failed to load beneficiary groups:', error)
            setBeneficiaryGroups([])
        } finally {
            setLoadingBeneficiaries(false)
        }
    }

    // Calculate support percentage based on date overlap (same logic as ExpandableKPICard)
    const supportPercentage = useMemo(() => {
        if (!dataPoint || !dataPoint.id || !linkedEvidence || linkedEvidence.length === 0) return 0

        // Get claim date range
        const claimStart = dataPoint.date_range_start 
            ? parseLocalDate(dataPoint.date_range_start) 
            : parseLocalDate(dataPoint.date_represented)
        const claimEnd = dataPoint.date_range_end 
            ? parseLocalDate(dataPoint.date_range_end) 
            : parseLocalDate(dataPoint.date_represented)

        // Calculate total days in claim
        const claimDays = Math.ceil((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
        if (claimDays <= 0) return 0

        // Track which days are covered by evidence
        const coveredDays = new Set<string>()

        linkedEvidence.forEach((ev: any) => {
            const evStart = ev.date_range_start 
                ? parseLocalDate(ev.date_range_start) 
                : ev.date_captured 
                    ? parseLocalDate(ev.date_captured) 
                    : null
            const evEnd = ev.date_range_end 
                ? parseLocalDate(ev.date_range_end) 
                : ev.date_captured 
                    ? parseLocalDate(ev.date_captured) 
                    : null

            if (!evStart || !evEnd) return

            // Find overlap between evidence and claim dates
            const overlapStart = new Date(Math.max(evStart.getTime(), claimStart.getTime()))
            const overlapEnd = new Date(Math.min(evEnd.getTime(), claimEnd.getTime()))

            if (overlapStart <= overlapEnd) {
                // Add each day in the overlap to the set
                const current = new Date(overlapStart)
                while (current <= overlapEnd) {
                    coveredDays.add(current.toISOString().split('T')[0])
                    current.setDate(current.getDate() + 1)
                }
            }
        })

        // Calculate percentage
        const percentage = Math.round((coveredDays.size / claimDays) * 100)
        return Math.min(percentage, 100)
    }, [dataPoint, linkedEvidence])

    if (!isOpen || !dataPoint || !kpi) return null

    const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
        : formatDate(dataPoint.date_represented)
                                
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
                                
                                // Get color scheme for evidence type
                                const getTypeColors = (type: string) => {
                                    switch (type) {
                                        case 'visual_proof':
                                            return {
                                                headerBg: 'bg-gradient-to-r from-pink-100/80 to-rose-100/60',
                                                headerBorder: 'border-pink-200/60',
                    headerIcon: 'text-pink-600',
                                                cardBg: 'bg-gradient-to-br from-pink-50/50 to-rose-50/30',
                                                cardBorder: 'border-pink-100/60',
                                                dotColor: 'bg-pink-400'
                                            }
                                        case 'documentation':
                                            return {
                                                headerBg: 'bg-gradient-to-r from-blue-100/80 to-indigo-100/60',
                                                headerBorder: 'border-blue-200/60',
                    headerIcon: 'text-blue-600',
                                                cardBg: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30',
                                                cardBorder: 'border-blue-100/60',
                                                dotColor: 'bg-blue-400'
                                            }
                                        case 'testimony':
                                            return {
                                                headerBg: 'bg-gradient-to-r from-orange-100/80 to-amber-100/60',
                                                headerBorder: 'border-orange-200/60',
                    headerIcon: 'text-orange-600',
                                                cardBg: 'bg-gradient-to-br from-orange-50/50 to-amber-50/30',
                                                cardBorder: 'border-orange-100/60',
                                                dotColor: 'bg-orange-400'
                                            }
                                        case 'financials':
                                            return {
                                                headerBg: 'bg-gradient-to-r from-primary-100/80 to-primary-100/60',
                                                headerBorder: 'border-primary-200/60',
                    headerIcon: 'text-primary-600',
                                                cardBg: 'bg-gradient-to-br from-primary-50/50 to-primary-50/30',
                                                cardBorder: 'border-primary-100/60',
                                                dotColor: 'bg-primary-400'
                                            }
                                        default:
                                            return {
                                                headerBg: 'bg-gradient-to-r from-gray-100/80 to-slate-100/60',
                                                headerBorder: 'border-gray-200/60',
                    headerIcon: 'text-gray-600',
                                                cardBg: 'bg-gradient-to-br from-gray-50/50 to-slate-50/30',
                                                cardBorder: 'border-gray-100/60',
                                                dotColor: 'bg-gray-400'
                                            }
                                    }
                                }

    // Group evidence by type
    const groupedByType: Record<string, Evidence[]> = {}
    linkedEvidence.forEach((evidence) => {
        const type = evidence.type || 'other'
        if (!groupedByType[type]) {
            groupedByType[type] = []
        }
        groupedByType[type].push(evidence)
    })
                                
                                return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
            <div className="bubble-card max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="icon-bubble bg-evidence-100">
                            <BarChart3 className="w-5 h-5 text-evidence-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Impact Claim</h2>
                            <p className="text-sm text-gray-500">{kpi.title}</p>
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
                    {/* Main Claim Display */}
                    <div className="bg-gradient-to-br from-evidence-50/80 to-blue-50/40 rounded-2xl p-8 border border-evidence-100/60 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-evidence-600 mb-2 uppercase tracking-wide">Claimed Value</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-bold text-gray-900">
                                        {dataPoint.value?.toLocaleString()}
                                    </span>
                                    <span className="text-xl text-gray-500 font-medium">
                                        {kpi.unit_of_measurement || ''}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold ${
                                    supportPercentage === 100
                                        ? 'bg-primary-100 text-primary-700'
                                        : supportPercentage > 0
                                            ? 'bg-yellow-100 text-yellow-700'
                                            : 'bg-gray-100 text-gray-600'
                                }`}>
                                    <span>{supportPercentage}% Supported</span>
                                </div>
                                {supportPercentage < 100 && supportPercentage > 0 && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        {100 - supportPercentage}% of date range unsupported
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {/* Date */}
                        <div className="bubble-card p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="icon-bubble-sm bg-evidence-100">
                                    <Calendar className="w-4 h-4 text-evidence-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">
                                    {hasDateRange ? 'Date Range' : 'Date'}
                                </h3>
                            </div>
                            <p className="text-base font-medium text-gray-900 ml-12">
                                {displayDate}
                            </p>
                            {hasDateRange && (
                                <p className="text-xs text-gray-500 ml-12 mt-1">
                                    {Math.ceil((parseLocalDate(dataPoint.date_range_end).getTime() - parseLocalDate(dataPoint.date_range_start).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                                </p>
                            )}
                        </div>

                        {/* Location */}
                        <div className="bubble-card p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="icon-bubble-sm bg-orange-100">
                                    <MapPin className="w-4 h-4 text-orange-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">Location</h3>
                            </div>
                            {loadingLocation ? (
                                <div className="ml-12">
                                    <div className="animate-pulse h-4 bg-gray-200 rounded w-32"></div>
                                </div>
                            ) : location ? (
                                <div className="ml-12">
                                    <p className="text-base font-medium text-gray-900">{location.name}</p>
                                    {location.description && (
                                        <p className="text-xs text-gray-500 mt-1">{location.description}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-400 ml-12">No location assigned</p>
                            )}
                        </div>
                    </div>

                    {/* Note */}
                    {dataPoint.note && (
                        <div className="bubble-card p-4 mb-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="icon-bubble-sm bg-purple-100">
                                    <MessageSquare className="w-4 h-4 text-purple-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">Note</h3>
                            </div>
                            <p className="text-gray-700 ml-12 whitespace-pre-wrap">{dataPoint.note}</p>
                        </div>
                    )}

                    {/* Beneficiary Groups */}
                    {beneficiaryGroups.length > 0 && (
                        <div className="bubble-card p-4 mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="icon-bubble-sm bg-cyan-100">
                                    <Users className="w-4 h-4 text-cyan-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">Beneficiary Groups</h3>
                                <span className="status-pill">{beneficiaryGroups.length}</span>
                            </div>
                            {loadingBeneficiaries ? (
                                <div className="ml-12 animate-pulse space-y-2">
                                    <div className="h-8 bg-gray-200 rounded-lg w-full"></div>
                                    <div className="h-8 bg-gray-200 rounded-lg w-3/4"></div>
                                </div>
                            ) : (
                                <div className="ml-12 flex flex-wrap gap-2">
                                    {beneficiaryGroups.map((group) => (
                                        <span key={group.id} className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-medium border border-cyan-100">
                                            {group.name}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Evidence Section */}
                    <div className="bubble-card p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="icon-bubble-sm bg-impact-100">
                                    <FileText className="w-4 h-4 text-impact-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">Supporting Evidence</h3>
                                <span className="status-pill">{linkedEvidence.length}</span>
                            </div>
                            {onAddEvidence && (
                                <button
                                    onClick={() => onAddEvidence(dataPoint)}
                                    className="btn-impact flex items-center gap-2 py-2 px-4 text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Add Evidence</span>
                                </button>
                            )}
                        </div>

                        {loadingEvidence ? (
                            <div className="flex items-center justify-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-impact-600"></div>
                            </div>
                        ) : linkedEvidence.length > 0 ? (
                            <div className="space-y-3">
                                        {Object.entries(groupedByType).map(([type, evidenceList]) => {
                                            const typeInfo = getEvidenceTypeInfo(type as any)
                                            const IconComponent = getEvidenceIcon(type)
                                            const colors = getTypeColors(type)
                                            
                                            return (
                                        <div key={type} className={`rounded-xl border overflow-hidden ${colors.cardBorder} ${colors.cardBg}`}>
                                            {/* Type Header */}
                                            <div className={`px-4 py-3 border-b ${colors.headerBorder} ${colors.headerBg}`}>
                                                <div className="flex items-center gap-2">
                                                    <IconComponent className={`w-4 h-4 ${colors.headerIcon}`} />
                                                    <span className="text-sm font-semibold text-gray-800">{typeInfo.label}</span>
                                                    <span className="text-xs text-gray-500">({evidenceList.length})</span>
                                                        </div>
                                                    </div>
                                                    
                                            {/* Evidence Items */}
                                            <div className="p-2 space-y-1">
                                                {evidenceList.map((evidence) => (
                                                            <div 
                                                                key={evidence.id}
                                                                onClick={() => onEvidenceClick?.(evidence)}
                                                        className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                                                    onEvidenceClick ? 'hover:bg-white/80 cursor-pointer hover:shadow-sm' : ''
                                                        }`}
                                                            >
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dotColor}`}></div>
                                                                    <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium text-gray-900 truncate">{evidence.title}</p>
                                                                        {evidence.description && (
                                                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{evidence.description}</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                        {onEvidenceClick && (
                                                            <Eye className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                                                        )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                        ) : (
                            <div className="text-center py-8">
                                <div className="icon-bubble mx-auto mb-3 bg-gray-100">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                </div>
                                <p className="text-sm text-gray-500 mb-4">No evidence linked to this claim yet</p>
                                {onAddEvidence && (
                                    <button
                                        onClick={() => onAddEvidence(dataPoint)}
                                        className="flex items-center gap-2 mx-auto py-2 px-4 text-sm bg-impact-100 hover:bg-impact-200 text-impact-700 rounded-xl transition-colors font-medium"
                                    >
                                        <Upload className="w-4 h-4" />
                                        <span>Upload Evidence</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-5 border-t border-gray-100 bg-gray-50/50">
                    <div>
                        {onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(dataPoint)
                                    onClose()
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Claim</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="btn-secondary py-2.5 px-5 text-sm"
                        >
                            Close
                        </button>
                        {onEdit && (
                            <button
                                onClick={() => {
                                    onEdit(dataPoint)
                                    onClose()
                                }}
                                className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit Claim</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
