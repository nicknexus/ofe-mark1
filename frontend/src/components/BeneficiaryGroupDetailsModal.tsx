import React, { useState, useEffect } from 'react'
import { X, Users, BarChart3, FileText, Calendar, Info, Loader2, Camera, MessageSquare, DollarSign, Edit } from 'lucide-react'
import { BeneficiaryGroup, KPIUpdate, Evidence, Story } from '../types'
import { apiService } from '../services/api'
import { getEvidenceTypeInfo, formatDate } from '../utils'
import EvidencePreviewModal from './EvidencePreviewModal'

interface BeneficiaryGroupDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    beneficiaryGroup: BeneficiaryGroup | null
    onEditClick?: (group: BeneficiaryGroup) => void
    onMetricClick?: (kpiId: string) => void
    onStoryClick?: (storyId: string) => void
    refreshKey?: number
    initiativeId?: string
}

export default function BeneficiaryGroupDetailsModal({
    isOpen,
    onClose,
    beneficiaryGroup,
    onEditClick,
    onMetricClick,
    onStoryClick,
    refreshKey,
    initiativeId,
}: BeneficiaryGroupDetailsModalProps) {
    const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [stories, setStories] = useState<Story[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)

    useEffect(() => {
        if (isOpen && beneficiaryGroup?.id && initiativeId) {
            setLoading(true)
            Promise.all([
                apiService.getKPIUpdatesForBeneficiaryGroup(beneficiaryGroup.id),
                apiService.getStories(initiativeId, { beneficiaryGroupIds: [beneficiaryGroup.id] }),
            ])
                .then(async ([updates, storiesData]) => {
                    setKpiUpdates(updates || [])
                    setStories(storiesData || [])
                    
                    // Get evidence linked to these KPI updates
                    const updateIds = (updates || []).map((u: any) => u.id).filter(Boolean)
                    if (updateIds.length > 0) {
                        try {
                            const allEvidence: Evidence[] = []
                            // Get evidence for each update
                            for (const updateId of updateIds) {
                                try {
                                    const ev = await apiService.getEvidenceForDataPoint(updateId)
                                    if (ev && Array.isArray(ev)) {
                                        allEvidence.push(...ev)
                                    }
                                } catch (error) {
                                    console.error(`Failed to load evidence for update ${updateId}:`, error)
                                }
                            }
                            // Remove duplicates
                            const uniqueEvidence = Array.from(new Map(allEvidence.map(e => [e.id, e])).values())
                            setEvidence(uniqueEvidence)
                        } catch (error) {
                            console.error('Failed to fetch evidence:', error)
                            setEvidence([])
                        }
                    } else {
                        setEvidence([])
                    }
                })
                .catch((error) => {
                    console.error('Failed to fetch beneficiary group data:', error)
                    setKpiUpdates([])
                    setEvidence([])
                    setStories([])
                })
                .finally(() => {
                    setLoading(false)
                })
        } else {
            setKpiUpdates([])
            setEvidence([])
            setStories([])
        }
    }, [isOpen, beneficiaryGroup?.id, refreshKey, initiativeId])

    if (!isOpen || !beneficiaryGroup) return null

    // Group KPI updates by KPI to show metrics with totals
    const metricsByKPI: Record<string, { kpi: any, updates: KPIUpdate[], total: number }> = {}
    kpiUpdates.forEach((update: any) => {
        const kpiId = update.kpi_id || update.kpis?.id || 'unknown'
        if (!metricsByKPI[kpiId]) {
            metricsByKPI[kpiId] = {
                kpi: update.kpis || update.kpi,
                updates: [],
                total: 0
            }
        }
        metricsByKPI[kpiId].updates.push(update)
        metricsByKPI[kpiId].total += (update.value || 0)
    })

    // Group evidence by type
    const evidenceByType: Record<string, Evidence[]> = {}
    evidence.forEach((ev) => {
        const type = ev.type || 'other'
        if (!evidenceByType[type]) {
            evidenceByType[type] = []
        }
        evidenceByType[type].push(ev)
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

    // Get color scheme for evidence type
    const getTypeColors = (type: string) => {
        switch (type) {
            case 'visual_proof':
                return {
                    headerBg: 'bg-gradient-to-r from-pink-100/80 to-rose-100/60',
                    headerBorder: 'border-pink-200/60',
                    headerIcon: 'text-pink-700',
                    headerText: 'text-gray-900',
                    cardBg: 'bg-gradient-to-br from-pink-50/50 to-rose-50/30',
                    cardBorder: 'border-pink-100/60',
                    itemBorder: 'border-pink-100/40',
                    dotColor: 'bg-pink-400'
                }
            case 'documentation':
                return {
                    headerBg: 'bg-gradient-to-r from-blue-100/80 to-indigo-100/60',
                    headerBorder: 'border-blue-200/60',
                    headerIcon: 'text-blue-700',
                    headerText: 'text-gray-900',
                    cardBg: 'bg-gradient-to-br from-blue-50/50 to-indigo-50/30',
                    cardBorder: 'border-blue-100/60',
                    itemBorder: 'border-blue-100/40',
                    dotColor: 'bg-blue-400'
                }
            case 'testimony':
                return {
                    headerBg: 'bg-gradient-to-r from-orange-100/80 to-amber-100/60',
                    headerBorder: 'border-orange-200/60',
                    headerIcon: 'text-orange-700',
                    headerText: 'text-gray-900',
                    cardBg: 'bg-gradient-to-br from-orange-50/50 to-amber-50/30',
                    cardBorder: 'border-orange-100/60',
                    itemBorder: 'border-orange-100/40',
                    dotColor: 'bg-orange-400'
                }
            case 'financials':
                return {
                    headerBg: 'bg-gradient-to-r from-primary-100/80 to-primary-100/60',
                    headerBorder: 'border-primary-200/60',
                    headerIcon: 'text-primary-700',
                    headerText: 'text-gray-900',
                    cardBg: 'bg-gradient-to-br from-primary-50/50 to-primary-50/30',
                    cardBorder: 'border-primary-100/60',
                    itemBorder: 'border-primary-100/40',
                    dotColor: 'bg-primary-400'
                }
            default:
                return {
                    headerBg: 'bg-gradient-to-r from-gray-100/80 to-slate-100/60',
                    headerBorder: 'border-gray-200/60',
                    headerIcon: 'text-gray-700',
                    headerText: 'text-gray-900',
                    cardBg: 'bg-gradient-to-br from-gray-50/50 to-slate-50/30',
                    cardBorder: 'border-gray-100/60',
                    itemBorder: 'border-gray-100/40',
                    dotColor: 'bg-gray-400'
                }
        }
    }

    const ageRange = beneficiaryGroup.age_range_start && beneficiaryGroup.age_range_end 
        ? `${beneficiaryGroup.age_range_start}-${beneficiaryGroup.age_range_end}`
        : beneficiaryGroup.age_range_start 
            ? `${beneficiaryGroup.age_range_start}+`
            : null

    return (
        <>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
                <div className="bubble-card max-w-7xl w-full h-[90vh] max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
                    {/* Header */}
                    <div className="flex items-start justify-between p-6 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-start space-x-4 flex-1">
                            <div className="icon-bubble">
                                <Users className="w-5 h-5 text-primary-500" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">{beneficiaryGroup.name}</h2>
                                {beneficiaryGroup.description && (
                                    <p className="text-gray-600 mb-3">{beneficiaryGroup.description}</p>
                                )}
                                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                    {beneficiaryGroup.total_number !== null && beneficiaryGroup.total_number !== undefined && (
                                        <div className="flex items-center space-x-2">
                                            <Info className="w-4 h-4" />
                                            <span>{beneficiaryGroup.total_number.toLocaleString()} beneficiaries</span>
                                        </div>
                                    )}
                                    {ageRange && (
                                        <div className="flex items-center space-x-2">
                                            <Info className="w-4 h-4" />
                                            <span>Age: {ageRange}</span>
                                        </div>
                                    )}
                                    {beneficiaryGroup.created_at && (
                                        <div className="flex items-center space-x-2">
                                            <Calendar className="w-4 h-4" />
                                            <span>Created {formatDate(beneficiaryGroup.created_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            {onEditClick && (
                                <button
                                    onClick={() => {
                                        onClose()
                                        onEditClick(beneficiaryGroup)
                                    }}
                                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-xl hover:bg-blue-100 transition-colors text-sm"
                                >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content - 3 Column Layout */}
                    <div className="flex-1 overflow-hidden min-h-0 p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                <span className="ml-3 text-gray-600">Loading beneficiary group data...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-6 h-full">
                                {/* Left Column - Stories */}
                                <div className="bubble-card overflow-hidden flex flex-col min-h-0 h-full">
                                    <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <MessageSquare className="w-4 h-4 text-gray-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">Stories</h3>
                                            <span className="status-pill">{stories.length}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                        {stories.length === 0 ? (
                                            <div className="text-center py-8">
                                                <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-500">No stories</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {stories.map((story) => (
                                                    <div 
                                                        key={story.id} 
                                                        onClick={() => {
                                                            if (story.id && onStoryClick) {
                                                                onClose()
                                                                onStoryClick(story.id)
                                                            }
                                                        }}
                                                        className={`bubble-card overflow-hidden transition-all ${
                                                            onStoryClick && story.id
                                                                ? 'hover:shadow-bubble-hover hover:border-blue-200 cursor-pointer'
                                                                : 'hover:shadow-bubble-hover'
                                                        }`}
                                                    >
                                                        {story.media_url && story.media_type === 'photo' && (
                                                            <div className="w-full h-48 bg-gray-100 overflow-hidden">
                                                                <img 
                                                                    src={story.media_url} 
                                                                    alt={story.title}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                        <div className="p-3">
                                                            <h4 className="text-sm font-semibold text-gray-900 mb-2 line-clamp-2">
                                                                {story.title}
                                                            </h4>
                                                            {story.description && (
                                                                <p className="text-xs text-gray-600 line-clamp-3 mb-3 leading-relaxed">
                                                                    {story.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center space-x-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
                                                                <Calendar className="w-3 h-3" />
                                                                <span>{formatDate(story.date_represented)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Middle Column - Metrics */}
                                <div className="bubble-card overflow-hidden flex flex-col min-h-0 h-full">
                                    <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <BarChart3 className="w-4 h-4 text-gray-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">Metrics</h3>
                                            <span className="status-pill">{Object.keys(metricsByKPI).length}</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                        {Object.keys(metricsByKPI).length === 0 ? (
                                            <div className="text-center py-8">
                                                <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-500">No metrics</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {Object.values(metricsByKPI).map((group, idx) => (
                                                    <div 
                                                        key={group.kpi?.id || idx} 
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (group.kpi?.id && onMetricClick) {
                                                                onClose()
                                                                onMetricClick(group.kpi.id)
                                                            }
                                                        }}
                                                        className={`bubble-card transition-all ${
                                                            onMetricClick && group.kpi?.id
                                                                ? 'hover:shadow-bubble-hover hover:border-blue-200 cursor-pointer'
                                                                : 'hover:shadow-bubble-hover'
                                                        }`}
                                                    >
                                                        {/* Modern Metric Card */}
                                                        <div className="p-4">
                                                            <div className="flex items-start justify-between mb-3">
                                                                <div className="flex items-center space-x-2.5 flex-1 min-w-0">
                                                                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex-shrink-0 shadow-sm">
                                                                        <BarChart3 className="w-4 h-4 text-white" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-sm font-bold text-gray-900 truncate mb-1">
                                                                            {group.kpi?.title || 'Unknown Metric'}
                                                                        </div>
                                                                        <div className="flex items-baseline space-x-2">
                                                                            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                                                {group.total.toLocaleString()}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500 font-medium">
                                                                                {group.kpi?.unit_of_measurement || ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                {onMetricClick && group.kpi?.id && (
                                                                    <div className="flex-shrink-0 ml-2">
                                                                        <div className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                                                            <BarChart3 className="w-3 h-3 text-blue-600" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="pt-2 border-t border-gray-100">
                                                                <div className="text-xs text-gray-500">
                                                                    {group.updates.length} {group.updates.length === 1 ? 'impact claim' : 'impact claims'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Column - Evidence */}
                                <div className="bubble-card overflow-hidden flex flex-col min-h-0 h-full">
                                    <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <FileText className="w-4 h-4 text-gray-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">Evidence</h3>
                                            <span className="text-xs text-gray-500">({evidence.length})</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-6 min-h-0">
                                        {Object.keys(evidenceByType).length === 0 ? (
                                            <div className="text-center py-8">
                                                <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                <p className="text-xs text-gray-500">No evidence</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {Object.entries(evidenceByType).map(([type, evidenceList]) => {
                                                    const typeInfo = getEvidenceTypeInfo(type as any)
                                                    const IconComponent = getEvidenceIcon(type)
                                                    const colors = getTypeColors(type)
                                                    
                                                    return (
                                                        <div key={type} className={`rounded-lg border ${colors.cardBorder} overflow-hidden ${colors.cardBg}`}>
                                                            {/* Evidence Type Card Header */}
                                                            <div className={`px-3 py-2 border-b-2 ${colors.headerBorder} shadow-sm ${colors.headerBg}`}>
                                                                <div className="flex items-center space-x-2 min-w-0">
                                                                    <IconComponent className={`w-4 h-4 ${colors.headerIcon} flex-shrink-0`} />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className={`text-sm font-bold ${colors.headerText} truncate`}>
                                                                            {typeInfo.label}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600 mt-0.5">
                                                                            {evidenceList.length} {evidenceList.length === 1 ? 'item' : 'items'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Evidence Items List */}
                                                            <div className={`px-3 py-1.5 space-y-1 ${evidenceList.length > 3 ? 'max-h-[150px] overflow-y-auto' : ''}`}>
                                                                {evidenceList.map((ev, idx) => (
                                                                    <div 
                                                                        key={ev.id}
                                                                        onClick={() => {
                                                                            setSelectedEvidence(ev)
                                                                            setIsEvidencePreviewOpen(true)
                                                                        }}
                                                                        className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-all cursor-pointer hover:bg-white/80 hover:shadow-sm ${
                                                                            idx < evidenceList.length - 1 ? `border-b ${colors.itemBorder}` : ''
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                                            <div className={`w-1.5 h-1.5 rounded-full ${colors.dotColor} flex-shrink-0`}></div>
                                                                            <div className="min-w-0 flex-1">
                                                                                <div className="text-xs font-medium text-gray-900 truncate">
                                                                                    {ev.title}
                                                                                </div>
                                                                                {ev.description && (
                                                                                    <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                                                                                        {ev.description}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Evidence Preview Modal */}
            {selectedEvidence && (
                <EvidencePreviewModal
                    isOpen={isEvidencePreviewOpen}
                    onClose={() => {
                        setIsEvidencePreviewOpen(false)
                        setSelectedEvidence(null)
                    }}
                    evidence={selectedEvidence}
                />
            )}
        </>
    )
}

