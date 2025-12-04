import React, { useState, useEffect } from 'react'
import { X, Calendar, BarChart3, Edit, Trash2, MessageSquare, FileText, Eye, MapPin, Users, Camera, DollarSign } from 'lucide-react'
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
}

export default function DataPointPreviewModal({
    isOpen,
    onClose,
    dataPoint,
    kpi,
    onEdit,
    onDelete,
    onEvidenceClick
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

    if (!isOpen || !dataPoint || !kpi) return null

    const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
        : formatDate(dataPoint.date_represented)

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <BarChart3 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">Impact Claim Details</h2>
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
                                Period: {Math.ceil((parseLocalDate(dataPoint.date_range_end).getTime() - parseLocalDate(dataPoint.date_range_start).getTime()) / (1000 * 60 * 60 * 24)) + 1} days
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

                    {/* Location */}
                    {dataPoint.location_id && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-2">
                                <MapPin className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Location</h3>
                            </div>
                            {loadingLocation ? (
                                <div className="text-center py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                                </div>
                            ) : location ? (
                                <div className="space-y-1">
                                    <p className="text-gray-700 font-medium">{location.name}</p>
                                    {location.description && (
                                        <p className="text-sm text-gray-600">{location.description}</p>
                                    )}
                                    {location.latitude && location.longitude && (
                                        <p className="text-xs text-gray-500">
                                            Coordinates: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">Location not found</p>
                            )}
                        </div>
                    )}

                    {/* Beneficiary Groups */}
                    {beneficiaryGroups.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div className="flex items-center space-x-2 mb-3">
                                <Users className="w-4 h-4 text-gray-600" />
                                <h3 className="text-sm font-semibold text-gray-900">Beneficiary Groups</h3>
                                <span className="text-xs text-gray-500">({beneficiaryGroups.length})</span>
                            </div>
                            {loadingBeneficiaries ? (
                                <div className="text-center py-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mx-auto"></div>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {beneficiaryGroups.map((group) => (
                                        <div key={group.id} className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-sm font-medium text-gray-900">{group.name}</p>
                                            {group.description && (
                                                <p className="text-xs text-gray-600 mt-1">{group.description}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Linked Evidence */}
                    <div>
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
                            (() => {
                                // Group evidence by type
                                const groupedByType: Record<string, Evidence[]> = {}
                                
                                linkedEvidence.forEach((evidence) => {
                                    const type = evidence.type || 'other'
                                    if (!groupedByType[type]) {
                                        groupedByType[type] = []
                                    }
                                    groupedByType[type].push(evidence)
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
                                
                                return (
                                    <div className="space-y-2.5">
                                        {Object.entries(groupedByType).map(([type, evidenceList]) => {
                                            const typeInfo = getEvidenceTypeInfo(type as any)
                                            const IconComponent = getEvidenceIcon(type)
                                            const colors = getTypeColors(type)
                                            
                                            return (
                                                <div key={type} className={`rounded-lg border ${colors.cardBorder} overflow-hidden ${colors.cardBg}`}>
                                                    {/* Evidence Type Card Header */}
                                                    <div className={`px-3 py-2.5 border-b-2 ${colors.headerBorder} shadow-sm ${colors.headerBg}`}>
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
                                                        {evidenceList.map((evidence, idx) => (
                                                            <div 
                                                                key={evidence.id}
                                                                onClick={() => onEvidenceClick?.(evidence)}
                                                                className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-all ${
                                                                    onEvidenceClick ? 'hover:bg-white/80 cursor-pointer hover:shadow-sm' : ''
                                                                } ${idx < evidenceList.length - 1 ? `border-b ${colors.itemBorder}` : ''}`}
                                                            >
                                                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                                    <div className={`w-1.5 h-1.5 rounded-full ${colors.dotColor} flex-shrink-0`}></div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-xs font-medium text-gray-900 truncate">
                                                                            {evidence.title}
                                                                        </div>
                                                                        {evidence.description && (
                                                                            <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">
                                                                                {evidence.description}
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
                                )
                            })()
                        ) : (
                            <p className="text-sm text-gray-500 text-center py-4">No evidence linked to this impact claim</p>
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

