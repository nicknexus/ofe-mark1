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

    // Calculate support percentage based on date overlap
    const supportPercentage = useMemo(() => {
        if (!dataPoint || !dataPoint.id || !linkedEvidence || linkedEvidence.length === 0) return 0

        const claimStart = dataPoint.date_range_start
            ? parseLocalDate(dataPoint.date_range_start)
            : parseLocalDate(dataPoint.date_represented)
        const claimEnd = dataPoint.date_range_end
            ? parseLocalDate(dataPoint.date_range_end)
            : parseLocalDate(dataPoint.date_represented)

        // Count days using UTC noon to avoid DST issues
        const startUTC = Date.UTC(claimStart.getFullYear(), claimStart.getMonth(), claimStart.getDate(), 12, 0, 0)
        const endUTC = Date.UTC(claimEnd.getFullYear(), claimEnd.getMonth(), claimEnd.getDate(), 12, 0, 0)
        const claimDays = Math.round((endUTC - startUTC) / (1000 * 60 * 60 * 24)) + 1
        if (claimDays <= 0) return 0

        const coveredDays = new Set<string>()

        linkedEvidence.forEach((ev: any) => {
            if (ev.date_range_start && ev.date_range_end) {
                // Evidence has date range
                const evStart = parseLocalDate(ev.date_range_start)
                const evEnd = parseLocalDate(ev.date_range_end)

                const overlapStart = new Date(Math.max(evStart.getTime(), claimStart.getTime()))
                const overlapEnd = new Date(Math.min(evEnd.getTime(), claimEnd.getTime()))

                if (overlapStart <= overlapEnd) {
                    const current = new Date(overlapStart)
                    while (current <= overlapEnd) {
                        // Use local date string to avoid timezone issues
                        const year = current.getFullYear()
                        const month = String(current.getMonth() + 1).padStart(2, '0')
                        const day = String(current.getDate()).padStart(2, '0')
                        coveredDays.add(`${year}-${month}-${day}`)
                        current.setDate(current.getDate() + 1)
                    }
                }
            } else if (ev.date_represented) {
                // Evidence has single date
                const evDate = parseLocalDate(ev.date_represented)
                if (evDate >= claimStart && evDate <= claimEnd) {
                    coveredDays.add(ev.date_represented.split('T')[0])
                }
            }
        })

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
                    dotColor: 'bg-pink-400',
                    statBg: 'bg-pink-50',
                    statBorder: 'border-pink-200',
                    statText: 'text-pink-700'
                }
            case 'documentation':
                return {
                    headerBg: 'bg-gradient-to-r from-evidence-100/80 to-evidence-100/60',
                    headerBorder: 'border-evidence-200/60',
                    headerIcon: 'text-evidence-600',
                    cardBg: 'bg-gradient-to-br from-evidence-50/50 to-evidence-50/30',
                    cardBorder: 'border-evidence-100/60',
                    dotColor: 'bg-evidence-400',
                    statBg: 'bg-evidence-50',
                    statBorder: 'border-evidence-200',
                    statText: 'text-evidence-700'
                }
            case 'testimony':
                return {
                    headerBg: 'bg-gradient-to-r from-orange-100/80 to-amber-100/60',
                    headerBorder: 'border-orange-200/60',
                    headerIcon: 'text-orange-600',
                    cardBg: 'bg-gradient-to-br from-orange-50/50 to-amber-50/30',
                    cardBorder: 'border-orange-100/60',
                    dotColor: 'bg-orange-400',
                    statBg: 'bg-orange-50',
                    statBorder: 'border-orange-200',
                    statText: 'text-orange-700'
                }
            case 'financials':
                return {
                    headerBg: 'bg-gradient-to-r from-primary-100/80 to-primary-100/60',
                    headerBorder: 'border-primary-200/60',
                    headerIcon: 'text-primary-600',
                    cardBg: 'bg-gradient-to-br from-primary-50/50 to-primary-50/30',
                    cardBorder: 'border-primary-100/60',
                    dotColor: 'bg-primary-400',
                    statBg: 'bg-primary-50',
                    statBorder: 'border-primary-200',
                    statText: 'text-primary-700'
                }
            default:
                return {
                    headerBg: 'bg-gradient-to-r from-gray-100/80 to-slate-100/60',
                    headerBorder: 'border-gray-200/60',
                    headerIcon: 'text-gray-600',
                    cardBg: 'bg-gradient-to-br from-gray-50/50 to-slate-50/30',
                    cardBorder: 'border-gray-100/60',
                    dotColor: 'bg-gray-400',
                    statBg: 'bg-gray-50',
                    statBorder: 'border-gray-200',
                    statText: 'text-gray-700'
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

    // Calculate evidence type stats
    const evidenceTypes = ['visual_proof', 'documentation', 'testimony', 'financials'] as const
    const evidenceTypeStats = evidenceTypes.map(type => {
        const count = groupedByType[type]?.length || 0
        const percentage = linkedEvidence.length > 0 ? Math.round((count / linkedEvidence.length) * 100) : 0
        const typeInfo = getEvidenceTypeInfo(type)
        const IconComponent = getEvidenceIcon(type)
        const colors = getTypeColors(type)
        return { type, count, percentage, typeInfo, IconComponent, colors }
    })

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 z-[70] animate-fade-in">
            <div className="bg-white md:bubble-card w-full h-full md:max-w-4xl md:w-full md:max-h-[90vh] md:h-auto overflow-hidden animate-slide-up md:rounded-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                            <BarChart3 className="w-4 h-4 md:w-5 md:h-5 text-primary-600" />
                        </div>
                        <div>
                            <h2 className="text-base md:text-lg font-bold text-gray-900">Impact Claim</h2>
                            <p className="text-xs md:text-sm text-gray-500 line-clamp-1">{kpi.title}</p>
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
                <div className="p-4 md:p-5 overflow-y-auto h-[calc(100vh-180px)] md:max-h-[calc(90vh-180px)] space-y-4">

                    {/* Main Claim Banner - Value, Support, Date, Location */}
                    <div className="bg-gradient-to-br from-primary-50/80 to-primary-50/40 rounded-2xl border border-primary-100/60 overflow-hidden">
                        {/* Top Row - Claimed Value and Support Status */}
                        <div className="p-4 md:p-6 pb-4">
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div>
                                    <p className="text-xs font-semibold text-primary-600 mb-1 uppercase tracking-wider">Claimed Value</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl md:text-4xl font-bold text-gray-900">
                                            {dataPoint.value?.toLocaleString()}
                                        </span>
                                        <span className="text-base md:text-lg text-gray-500 font-medium">
                                            {kpi.unit_of_measurement || ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="md:text-right">
                                    <div className={`inline-flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm font-bold ${supportPercentage === 100
                                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/25'
                                        : supportPercentage > 0
                                            ? 'bg-yellow-400 text-yellow-900 shadow-lg shadow-yellow-400/25'
                                            : 'bg-red-100 text-red-700'
                                        }`}>
                                        <span>{supportPercentage}% Supported</span>
                                    </div>
                                    {supportPercentage < 100 && linkedEvidence.length > 0 && (
                                        <p className="text-[10px] text-gray-500 mt-1.5">
                                            {100 - supportPercentage}% of date range needs evidence
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Bottom Row - Date and Location */}
                        <div className="px-4 md:px-6 pb-5 pt-2 flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 md:gap-6 border-t border-primary-100/40">
                            {/* Date */}
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center border border-primary-200/40">
                                    <Calendar className="w-4 h-4 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                                        {hasDateRange ? 'Date Range' : 'Date'}
                                    </p>
                                    <p className="text-sm font-semibold text-gray-800">{displayDate}</p>
                                    {hasDateRange && (
                                        <p className="text-[10px] text-gray-500">
                                            {Math.ceil((parseLocalDate(dataPoint.date_range_end).getTime() - parseLocalDate(dataPoint.date_range_start).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="w-px h-10 bg-primary-200/40"></div>

                            {/* Location */}
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center border border-primary-200/40">
                                    <MapPin className="w-4 h-4 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Location</p>
                                    {loadingLocation ? (
                                        <div className="animate-pulse h-4 bg-gray-200 rounded w-24"></div>
                                    ) : location ? (
                                        <p className="text-sm font-semibold text-gray-800">{location.name}</p>
                                    ) : (
                                        <p className="text-sm text-gray-400 italic">Not assigned</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes Section */}
                    {dataPoint.note && (
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                                    <MessageSquare className="w-4 h-4 text-primary-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-primary-600 mb-1 uppercase tracking-wider">Notes</p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{dataPoint.note}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Beneficiary Groups */}
                    {beneficiaryGroups.length > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center flex-shrink-0">
                                    <Users className="w-4 h-4 text-cyan-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-cyan-600 mb-2 uppercase tracking-wider">Beneficiary Groups</p>
                                    {loadingBeneficiaries ? (
                                        <div className="animate-pulse space-y-2">
                                            <div className="h-6 bg-gray-200 rounded-lg w-full"></div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {beneficiaryGroups.map((group) => (
                                                <span key={group.id} className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded-lg text-xs font-medium border border-cyan-100">
                                                    {group.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Evidence Section */}
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        {/* Evidence Header with Total */}
                        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-evidence-500 flex items-center justify-center shadow-lg shadow-evidence-500/25">
                                        <FileText className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Supporting Evidence</p>
                                        <p className="text-xl font-bold text-gray-900">{linkedEvidence.length} <span className="text-sm font-normal text-gray-500">pieces</span></p>
                                    </div>
                                </div>
                                {onAddEvidence && (
                                    <button
                                        onClick={() => onAddEvidence(dataPoint)}
                                        className="flex items-center gap-2 py-2 px-4 text-sm bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Add Evidence</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Evidence Type Stats - 2 cols on mobile, 4 on desktop */}
                        <div className="p-4 border-b border-gray-100 hidden md:block">
                            <div className="grid grid-cols-4 gap-3">
                                {evidenceTypeStats.map(({ type, count, percentage, typeInfo, IconComponent, colors }) => (
                                    <div
                                        key={type}
                                        className={`rounded-xl p-3 border ${colors.statBorder} ${colors.statBg} transition-all hover:shadow-sm`}
                                    >
                                        <div className="flex items-center gap-2 mb-2">
                                            <IconComponent className={`w-4 h-4 ${colors.headerIcon}`} />
                                            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide truncate">{typeInfo.label}</span>
                                        </div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className={`text-xl font-bold ${colors.statText}`}>{count}</span>
                                            <span className="text-xs text-gray-500">({percentage}%)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Evidence List */}
                        <div className="p-4">
                            {loadingEvidence ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-evidence-500"></div>
                                </div>
                            ) : linkedEvidence.length > 0 ? (
                                <div className="space-y-3">
                                    {evidenceTypes.map((type) => {
                                        const evidenceList = groupedByType[type]
                                        if (!evidenceList || evidenceList.length === 0) return null

                                        const typeInfo = getEvidenceTypeInfo(type)
                                        const IconComponent = getEvidenceIcon(type)
                                        const colors = getTypeColors(type)

                                        return (
                                            <div key={type} className={`rounded-xl border overflow-hidden ${colors.cardBorder} ${colors.cardBg}`}>
                                                {/* Type Header */}
                                                <div className={`px-4 py-2.5 border-b ${colors.headerBorder} ${colors.headerBg}`}>
                                                    <div className="flex items-center gap-2">
                                                        <IconComponent className={`w-4 h-4 ${colors.headerIcon}`} />
                                                        <span className="text-sm font-semibold text-gray-800">{typeInfo.label}</span>
                                                        <span className="text-xs text-gray-500 bg-white/50 px-2 py-0.5 rounded-full">{evidenceList.length}</span>
                                                    </div>
                                                </div>

                                                {/* Evidence Items */}
                                                <div className="p-2 space-y-1">
                                                    {evidenceList.map((evidence) => (
                                                        <div
                                                            key={evidence.id}
                                                            onClick={() => onEvidenceClick?.(evidence)}
                                                            className={`flex items-center justify-between p-3 rounded-lg transition-all ${onEvidenceClick ? 'hover:bg-white/80 cursor-pointer hover:shadow-sm' : ''}`}
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
                                    <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                                        <FileText className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <p className="text-sm font-medium text-gray-600 mb-1">No Evidence Yet</p>
                                    <p className="text-xs text-gray-500 mb-4">Add evidence to support this impact claim</p>
                                    {onAddEvidence && (
                                        <button
                                            onClick={() => onAddEvidence(dataPoint)}
                                            className="flex items-center gap-2 mx-auto py-2.5 px-5 text-sm bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg shadow-evidence-500/25"
                                        >
                                            <Upload className="w-4 h-4" />
                                            <span>Upload Evidence</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions - Mobile optimized */}
                <div className="flex flex-col-reverse md:flex-row items-stretch md:items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50 gap-3 md:gap-0">
                    <div className="hidden md:block">
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
                    <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
                        {onEdit && (
                            <button
                                onClick={() => {
                                    onEdit(dataPoint)
                                    onClose()
                                }}
                                className="btn-primary flex items-center justify-center gap-2 py-3 md:py-2.5 px-5 text-sm order-first md:order-last"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit Claim</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="btn-secondary py-3 md:py-2.5 px-5 text-sm text-center"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
