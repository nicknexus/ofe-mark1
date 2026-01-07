import React, { useState, useEffect, useRef, useMemo } from 'react'
import { 
    Plus, 
    FileText, 
    Camera, 
    MessageSquare, 
    DollarSign,
    Upload,
    X,
    Check,
    ChevronRight,
    ChevronLeft,
    MapPin,
    Calendar,
    Eye,
    Edit,
    Trash2,
    Download,
    ExternalLink,
    Filter,
    ChevronDown
} from 'lucide-react'
import { apiService } from '../../services/api'
import { Evidence, Location, KPI } from '../../types'
import { formatDate, getEvidenceTypeInfo, getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import toast from 'react-hot-toast'

interface MobileEvidenceTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function MobileEvidenceTab({ initiativeId, onRefresh }: MobileEvidenceTabProps) {
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(true)
    const [showUploadFlow, setShowUploadFlow] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [showPreview, setShowPreview] = useState(false)
    const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
    
    // Filter state
    const [showFilters, setShowFilters] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [filterType, setFilterType] = useState<string>('all')
    const [filterLocation, setFilterLocation] = useState<string>('all')
    const [filterDateStart, setFilterDateStart] = useState<string>('')
    const [filterDateEnd, setFilterDateEnd] = useState<string>('')

    useEffect(() => {
        loadEvidence()
        loadLocations()
    }, [initiativeId])
    
    const loadLocations = async () => {
        try {
            const locs = await apiService.getLocations(initiativeId)
            setLocations(locs || [])
        } catch (error) {
            console.error('Error loading locations:', error)
        }
    }

    // Lock body scroll when preview is open
    useEffect(() => {
        if (showPreview) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [showPreview])

    const loadEvidence = async () => {
        try {
            setLoading(true)
            const data = await apiService.getEvidence(initiativeId)
            setEvidence(data || [])
        } catch (error) {
            console.error('Error loading evidence:', error)
            toast.error('Failed to load evidence')
        } finally {
            setLoading(false)
        }
    }

    const handleViewEvidence = (ev: Evidence) => {
        setSelectedEvidence(ev)
        setShowPreview(true)
    }

    const handleEditEvidence = (ev: Evidence) => {
        setShowPreview(false)
        setEditingEvidence(ev)
    }

    const handleDeleteEvidence = async (ev: Evidence) => {
        if (!ev.id) return
        try {
            await apiService.deleteEvidence(ev.id)
            toast.success('Evidence deleted')
            setShowPreview(false)
            setSelectedEvidence(null)
            loadEvidence()
        } catch (error) {
            toast.error('Failed to delete')
        }
    }

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual', icon: Camera },
        { value: 'documentation', label: 'Document', icon: FileText },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare },
        { value: 'financials', label: 'Financial', icon: DollarSign }
    ]

    // Show upload flow for new evidence
    if (showUploadFlow) {
        return (
            <MobileEvidenceUploadFlow
                initiativeId={initiativeId}
                onClose={() => setShowUploadFlow(false)}
                onSuccess={() => {
                    setShowUploadFlow(false)
                    loadEvidence()
                    onRefresh?.()
                }}
            />
        )
    }

    // Show edit flow
    if (editingEvidence) {
        return (
            <MobileEvidenceEditFlow
                initiativeId={initiativeId}
                evidence={editingEvidence}
                onClose={() => setEditingEvidence(null)}
                onSuccess={() => {
                    setEditingEvidence(null)
                    loadEvidence()
                    onRefresh?.()
                }}
            />
        )
    }

    // Filter evidence
    const filteredEvidence = useMemo(() => {
        return evidence.filter(ev => {
            // Type filter
            if (filterType !== 'all' && ev.type !== filterType) return false
            
            // Location filter
            if (filterLocation !== 'all') {
                const evLocationIds = ev.location_ids || (ev.location_id ? [ev.location_id] : [])
                if (!evLocationIds.includes(filterLocation)) return false
            }
            
            // Date filter
            if (filterDateStart || filterDateEnd) {
                const evDate = ev.date_represented ? new Date(ev.date_represented) : null
                if (!evDate) return false
                
                if (filterDateStart) {
                    const startDate = new Date(filterDateStart)
                    if (evDate < startDate) return false
                }
                if (filterDateEnd) {
                    const endDate = new Date(filterDateEnd)
                    endDate.setHours(23, 59, 59, 999) // Include the entire end day
                    if (evDate > endDate) return false
                }
            }
            
            return true
        })
    }, [evidence, filterType, filterLocation, filterDateStart, filterDateEnd])

    const hasActiveFilters = filterType !== 'all' || filterLocation !== 'all' || filterDateStart || filterDateEnd
    
    const clearFilters = () => {
        setFilterType('all')
        setFilterLocation('all')
        setFilterDateStart('')
        setFilterDateEnd('')
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Evidence</h1>
                    <p className="text-sm text-gray-500">
                        {hasActiveFilters ? `${filteredEvidence.length} of ${evidence.length}` : `${evidence.length}`} items
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                            hasActiveFilters 
                                ? 'bg-evidence-100 text-evidence-700' 
                                : 'bg-gray-100 text-gray-600'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-evidence-500"></span>}
                    </button>
                    <button
                        onClick={() => setShowUploadFlow(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-evidence-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-evidence-500/25 active:scale-[0.98]"
                    >
                        <Plus className="w-4 h-4" />
                        Add
                    </button>
                </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
                <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-800">Filters</span>
                        {hasActiveFilters && (
                            <button 
                                onClick={clearFilters}
                                className="text-xs text-evidence-600 font-medium"
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Type</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setFilterType('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                    filterType === 'all' 
                                        ? 'bg-evidence-500 text-white' 
                                        : 'bg-gray-100 text-gray-600'
                                }`}
                            >
                                All
                            </button>
                            {evidenceTypes.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => setFilterType(type.value)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
                                        filterType === type.value 
                                            ? 'bg-evidence-500 text-white' 
                                            : 'bg-gray-100 text-gray-600'
                                    }`}
                                >
                                    <type.icon className="w-3 h-3" />
                                    {type.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Location Filter */}
                    {locations.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Location</label>
                            <div className="relative">
                                <select
                                    value={filterLocation}
                                    onChange={(e) => setFilterLocation(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm appearance-none pr-8"
                                >
                                    <option value="all">All locations</option>
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                        </div>
                    )}

                    {/* Date Filter */}
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Date Range</label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <input
                                    type="date"
                                    value={filterDateStart}
                                    onChange={(e) => setFilterDateStart(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                    placeholder="From"
                                />
                            </div>
                            <div className="flex-1">
                                <input
                                    type="date"
                                    value={filterDateEnd}
                                    onChange={(e) => setFilterDateEnd(e.target.value)}
                                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                                    placeholder="To"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Evidence List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-evidence-500"></div>
                </div>
            ) : evidence.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-evidence-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-evidence-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Evidence Yet</h3>
                    <p className="text-gray-500 text-sm px-6 mb-6">
                        Add photos, documents, or recordings to support your impact claims.
                    </p>
                    <button
                        onClick={() => setShowUploadFlow(true)}
                        className="px-6 py-3 bg-evidence-500 text-white rounded-xl font-medium text-sm"
                    >
                        Add Evidence
                    </button>
                </div>
            ) : filteredEvidence.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Filter className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Matches</h3>
                    <p className="text-gray-500 text-sm px-6 mb-6">
                        No evidence matches your current filters.
                    </p>
                    <button
                        onClick={clearFilters}
                        className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                    >
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {filteredEvidence.map((ev) => {
                        const typeInfo = getEvidenceTypeInfo(ev.type)
                        const bgColor = typeInfo.color.split(' ')[0]
                        const TypeIcon = evidenceTypes.find(t => t.value === ev.type)?.icon || FileText
                        const isImage = ev.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

                        return (
                            <button
                                key={ev.id}
                                onClick={() => handleViewEvidence(ev)}
                                className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left active:scale-[0.98] transition-transform"
                            >
                                {/* Preview */}
                                <div className={`aspect-square ${bgColor} flex items-center justify-center relative overflow-hidden`}>
                                    {isImage && ev.file_url ? (
                                        <img
                                            src={ev.file_url}
                                            alt={ev.title || ''}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <TypeIcon className="w-10 h-10 text-gray-400" />
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="font-medium text-gray-800 text-sm truncate">
                                        {ev.title || 'Untitled'}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatDate(ev.date_represented)}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Mobile Evidence Preview */}
            {showPreview && selectedEvidence && (
                <MobileEvidencePreview
                    evidence={selectedEvidence}
                    onClose={() => {
                        setShowPreview(false)
                        setSelectedEvidence(null)
                    }}
                    onEdit={() => handleEditEvidence(selectedEvidence)}
                    onDelete={() => handleDeleteEvidence(selectedEvidence)}
                />
            )}
        </div>
    )
}

// Mobile Evidence Preview Component
interface MobileEvidencePreviewProps {
    evidence: Evidence
    onClose: () => void
    onEdit: () => void
    onDelete: () => void
}

function MobileEvidencePreview({ evidence, onClose, onEdit, onDelete }: MobileEvidencePreviewProps) {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [imageLoading, setImageLoading] = useState(true)
    const [linkedDataPoints, setLinkedDataPoints] = useState<any[]>([])
    const [loadingDataPoints, setLoadingDataPoints] = useState(true)
    const [locations, setLocations] = useState<Location[]>([])
    const [loadingLocations, setLoadingLocations] = useState(true)
    const typeInfo = getEvidenceTypeInfo(evidence.type)
    
    const isImage = evidence.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
    const isPDF = evidence.file_url?.match(/\.pdf$/i)
    
    const hasDateRange = evidence.date_range_start && evidence.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(evidence.date_range_start!)} - ${formatDate(evidence.date_range_end!)}`
        : formatDate(evidence.date_represented)

    // Load linked data points
    useEffect(() => {
        const loadData = async () => {
            if (!evidence.id) return
            try {
                setLoadingDataPoints(true)
                const dataPoints = await apiService.getDataPointsForEvidence(evidence.id)
                setLinkedDataPoints(dataPoints || [])
            } catch (error) {
                console.error('Failed to load linked data points:', error)
            } finally {
                setLoadingDataPoints(false)
            }
        }
        loadData()
    }, [evidence.id])

    // Load locations
    useEffect(() => {
        const loadLocs = async () => {
            const locationIds = evidence.location_ids || (evidence.location_id ? [evidence.location_id] : [])
            if (locationIds.length === 0) {
                setLocations([])
                setLoadingLocations(false)
                return
            }
            try {
                setLoadingLocations(true)
                const locationPromises = locationIds.map((id: string) =>
                    apiService.getLocation(id).catch(() => null)
                )
                const loadedLocations = await Promise.all(locationPromises)
                setLocations(loadedLocations.filter(Boolean) as Location[])
            } catch (error) {
                console.error('Failed to load locations:', error)
            } finally {
                setLoadingLocations(false)
            }
        }
        loadLocs()
    }, [evidence.location_ids, evidence.location_id])

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col">
            {/* Header */}
            <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-gray-100 safe-area-pt">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Evidence</span>
                <div className="w-9" /> {/* Spacer for alignment */}
            </div>

            {/* Content */}
            <div className="flex-1 bg-white overflow-y-auto">
                {/* Image/File Preview */}
                <div className="bg-gray-100 aspect-square flex items-center justify-center relative">
                    {isImage && evidence.file_url ? (
                        <>
                            {imageLoading && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-evidence-500"></div>
                                </div>
                            )}
                            <img
                                src={evidence.file_url}
                                alt={evidence.title || ''}
                                className="w-full h-full object-contain"
                                onLoad={() => setImageLoading(false)}
                                onError={() => setImageLoading(false)}
                            />
                        </>
                    ) : isPDF ? (
                        <div className="text-center p-6">
                            <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-10 h-10 text-red-600" />
                            </div>
                            <p className="font-medium text-gray-800 mb-2">PDF Document</p>
                            <a
                                href={evidence.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-evidence-500 text-white rounded-xl text-sm font-medium"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Open PDF
                            </a>
                        </div>
                    ) : evidence.file_url ? (
                        <div className="text-center p-6">
                            <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <FileText className="w-10 h-10 text-gray-500" />
                            </div>
                            <p className="font-medium text-gray-800 mb-2">File Attached</p>
                            <a
                                href={evidence.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-xl text-sm font-medium"
                            >
                                <Download className="w-4 h-4" />
                                Download
                            </a>
                        </div>
                    ) : (
                        <div className="text-center p-6">
                            <div className={`w-20 h-20 ${typeInfo.color.split(' ')[0]} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                                {evidence.type === 'visual_proof' ? <Camera className="w-10 h-10" /> :
                                 evidence.type === 'testimony' ? <MessageSquare className="w-10 h-10" /> :
                                 evidence.type === 'financials' ? <DollarSign className="w-10 h-10" /> :
                                 <FileText className="w-10 h-10" />}
                            </div>
                            <p className="text-gray-500">No file preview</p>
                        </div>
                    )}
                    
                    {/* Type badge */}
                    <div className="absolute top-3 right-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${typeInfo.color}`}>
                            {typeInfo.label}
                        </span>
                    </div>
                </div>

                {/* Details */}
                <div className="p-4 space-y-4">
                    {/* Title */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{evidence.title || 'Untitled'}</h2>
                    </div>

                    {/* Date & Location Row */}
                    <div className="flex flex-wrap gap-4">
                        {/* Date */}
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                                <Calendar className="w-4 h-4 text-primary-600" />
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase font-medium">Date</p>
                                <span className="text-gray-800 font-medium">{displayDate}</span>
                            </div>
                        </div>

                        {/* Locations */}
                        {(locations.length > 0 || loadingLocations) && (
                            <div className="flex items-center gap-2 text-sm">
                                <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                                    <MapPin className="w-4 h-4 text-primary-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-gray-500 uppercase font-medium">
                                        {locations.length > 1 ? 'Locations' : 'Location'}
                                    </p>
                                    {loadingLocations ? (
                                        <div className="animate-pulse h-4 bg-gray-200 rounded w-16"></div>
                                    ) : (
                                        <span className="text-gray-800 font-medium">
                                            {locations.map(loc => loc.name).join(', ')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Description */}
                    {evidence.description && (
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-500 uppercase font-medium mb-2">Description</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{evidence.description}</p>
                        </div>
                    )}

                    {/* Linked Impact Claims */}
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                        <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md bg-primary-500 flex items-center justify-center">
                                    <FileText className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-sm font-semibold text-gray-700">Linked Impact Claims</span>
                                <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                    {linkedDataPoints.length}
                                </span>
                            </div>
                        </div>
                        
                        <div className="p-3">
                            {loadingDataPoints ? (
                                <div className="flex items-center justify-center py-6">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                                </div>
                            ) : linkedDataPoints.length > 0 ? (
                                (() => {
                                    // Group by KPI
                                    const groupedByKPI: Record<string, { kpi: any, dataPoints: any[] }> = {}
                                    linkedDataPoints.forEach((dataPoint) => {
                                        const kpiId = dataPoint.kpi?.id || 'unknown'
                                        if (!groupedByKPI[kpiId]) {
                                            groupedByKPI[kpiId] = { kpi: dataPoint.kpi, dataPoints: [] }
                                        }
                                        groupedByKPI[kpiId].dataPoints.push(dataPoint)
                                    })
                                    
                                    return (
                                        <div className="space-y-2">
                                            {Object.values(groupedByKPI).map((group, groupIndex) => {
                                                const total = group.dataPoints.reduce((sum, dp) => sum + (dp.value || 0), 0)
                                                return (
                                                    <div key={group.kpi?.id || groupIndex} className="bg-primary-50 rounded-xl p-3">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-sm font-semibold text-gray-800 truncate">
                                                                {group.kpi?.title || 'Unknown Metric'}
                                                            </span>
                                                            <span className="text-sm font-bold text-primary-600">
                                                                {total.toLocaleString()} {group.kpi?.unit_of_measurement || ''}
                                                            </span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {group.dataPoints.slice(0, 3).map((dp, idx) => (
                                                                <div key={dp.id || idx} className="flex items-center justify-between text-xs text-gray-600">
                                                                    <span className="flex items-center gap-1">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-primary-400"></div>
                                                                        {dp.value?.toLocaleString()} {group.kpi?.unit_of_measurement || ''}
                                                                    </span>
                                                                    <span className="text-gray-400">
                                                                        {formatDate(dp.date_represented)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                            {group.dataPoints.length > 3 && (
                                                                <p className="text-xs text-gray-400 text-center pt-1">
                                                                    +{group.dataPoints.length - 3} more
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )
                                })()
                            ) : (
                                <div className="text-center py-6">
                                    <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No linked impact claims</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-gray-100 p-4 safe-area-pb">
                <div className="flex gap-3">
                    <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-red-50 text-red-600 rounded-xl font-medium text-sm"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                    <button
                        onClick={onEdit}
                        className="flex-1 flex items-center justify-center gap-2 py-3 bg-evidence-500 text-white rounded-xl font-semibold text-sm"
                    >
                        <Edit className="w-4 h-4" />
                        Edit
                    </button>
                </div>
            </div>

            {/* Delete Confirmation */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[110]">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <Trash2 className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900">Delete Evidence</h3>
                                <p className="text-xs text-gray-500">This cannot be undone</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-6">
                            Delete "<strong>{evidence.title}</strong>"?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowDeleteConfirm(false)
                                    onDelete()
                                }}
                                className="flex-1 py-3 px-4 bg-red-500 text-white rounded-xl font-medium text-sm"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// Mobile Evidence Upload Flow - Step by step wizard
interface UploadFlowProps {
    initiativeId: string
    onClose: () => void
    onSuccess: () => void
}

function MobileEvidenceUploadFlow({ initiativeId, onClose, onSuccess }: UploadFlowProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [kpis, setKPIs] = useState<KPI[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [formData, setFormData] = useState({
        type: 'visual_proof',
        title: '',
        description: '',
        file: null as File | null,
        fileUrl: '',
        datePickerValue: {} as { singleDate?: string; startDate?: string; endDate?: string },
        selectedLocationIds: [] as string[],
        selectedKpiIds: [] as string[]
    })

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Photo/Video', icon: Camera, description: 'Visual evidence' },
        { value: 'documentation', label: 'Document', icon: FileText, description: 'Reports, forms' },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare, description: 'Quotes, feedback' },
        { value: 'financials', label: 'Financial', icon: DollarSign, description: 'Receipts, invoices' }
    ]

    useEffect(() => {
        // Load locations and KPIs
        Promise.all([
            apiService.getLocations(initiativeId),
            apiService.getKPIs(initiativeId)
        ]).then(([locs, kpiData]) => {
            setLocations(locs || [])
            setKPIs(kpiData || [])
        })
    }, [initiativeId])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFormData(prev => ({
                ...prev,
                file,
                title: prev.title || file.name.replace(/\.[^/.]+$/, '')
            }))
        }
    }

    const handleSubmit = async () => {
        if (!formData.title) {
            toast.error('Please enter a title')
            return
        }
        if (!formData.file && !formData.fileUrl) {
            toast.error('Please select a file or enter a URL')
            return
        }
        if (formData.selectedLocationIds.length === 0) {
            toast.error('Please select at least one location')
            return
        }
        if (formData.selectedKpiIds.length === 0) {
            toast.error('Please select at least one metric')
            return
        }

        setLoading(true)
        try {
            let fileUrl = formData.fileUrl

            // Upload file if selected
            if (formData.file) {
                const uploadResult = await apiService.uploadFile(formData.file)
                fileUrl = uploadResult.file_url
            }

            // Prepare data
            const submitData: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                file_url: fileUrl,
                initiative_id: initiativeId,
                kpi_ids: formData.selectedKpiIds,
                location_ids: formData.selectedLocationIds
            }

            // Handle dates
            if (formData.datePickerValue.singleDate) {
                submitData.date_represented = formData.datePickerValue.singleDate
            } else if (formData.datePickerValue.startDate && formData.datePickerValue.endDate) {
                submitData.date_range_start = formData.datePickerValue.startDate
                submitData.date_range_end = formData.datePickerValue.endDate
                submitData.date_represented = formData.datePickerValue.startDate
            } else {
                submitData.date_represented = getLocalDateString(new Date())
            }

            await apiService.createEvidence(submitData)
            toast.success('Evidence added!')
            onSuccess()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const canProceed = () => {
        switch (step) {
            case 1: return !!formData.type
            case 2: return formData.file !== null || formData.fileUrl !== ''
            case 3: return !!formData.title
            case 4: return formData.selectedLocationIds.length > 0
            case 5: return formData.selectedKpiIds.length > 0
            default: return false
        }
    }

    const totalSteps = 5

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Add Evidence</span>
                <span className="text-sm text-gray-500">{step}/{totalSteps}</span>
            </div>

            {/* Progress */}
            <div className="px-4 pt-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-evidence-500 transition-all duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Step 1: Type */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Evidence Type</h2>
                            <p className="text-gray-500 text-sm mt-1">What kind of evidence?</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {evidenceTypes.map((type) => {
                                const Icon = type.icon
                                const isSelected = formData.type === type.value
                                return (
                                    <button
                                        key={type.value}
                                        onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                                        className={`p-4 rounded-2xl border-2 transition-all ${
                                            isSelected 
                                                ? 'border-evidence-500 bg-evidence-50' 
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                        <div className={`font-semibold text-sm ${isSelected ? 'text-evidence-600' : 'text-gray-700'}`}>
                                            {type.label}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Upload */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Upload File</h2>
                            <p className="text-gray-500 text-sm mt-1">Select a file or paste a link</p>
                        </div>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            className="hidden"
                        />

                        {formData.file ? (
                            <div className="bg-evidence-50 border-2 border-evidence-300 rounded-2xl p-4 text-center">
                                <FileText className="w-12 h-12 text-evidence-500 mx-auto mb-2" />
                                <p className="font-medium text-gray-800 truncate">{formData.file.name}</p>
                                <p className="text-sm text-gray-500">
                                    {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, file: null }))}
                                    className="mt-3 text-sm text-red-600 font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-evidence-400 transition-colors"
                            >
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="font-medium text-gray-700">Tap to select file</p>
                                <p className="text-sm text-gray-500 mt-1">Images, PDFs, documents</p>
                            </button>
                        )}

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-4 text-sm text-gray-500">or</span>
                            </div>
                        </div>

                        <input
                            type="url"
                            value={formData.fileUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
                            placeholder="Paste a link (https://...)"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                        />
                    </div>
                )}

                {/* Step 3: Details */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Details</h2>
                            <p className="text-gray-500 text-sm mt-1">Title and date</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g., Training photos"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description (optional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="What does this evidence show?"
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Date
                            </label>
                            <DateRangePicker
                                value={formData.datePickerValue}
                                onChange={(value) => setFormData(prev => ({ ...prev, datePickerValue: value }))}
                                placeholder="Select date"
                            />
                        </div>
                    </div>
                )}

                {/* Step 4: Location */}
                {step === 4 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Location</h2>
                            <p className="text-gray-500 text-sm mt-1">Where was this captured?</p>
                        </div>

                        {locations.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl">
                                <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No locations available</p>
                                <p className="text-gray-400 text-xs mt-1">Add locations in the Locations tab</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {locations.map((location) => {
                                    const isSelected = formData.selectedLocationIds.includes(location.id!)
                                    return (
                                        <button
                                            key={location.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedLocationIds: isSelected
                                                        ? prev.selectedLocationIds.filter(id => id !== location.id)
                                                        : [...prev.selectedLocationIds, location.id!]
                                                }))
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                isSelected 
                                                    ? 'border-evidence-500 bg-evidence-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <MapPin className={`w-5 h-5 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                                    <div>
                                                        <div className="font-medium text-gray-800">{location.name}</div>
                                                        {location.description && (
                                                            <div className="text-xs text-gray-500">{location.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-5 h-5 text-evidence-500" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 5: Metrics */}
                {step === 5 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Link to Metrics</h2>
                            <p className="text-gray-500 text-sm mt-1">What does this support?</p>
                        </div>

                        {kpis.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl">
                                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No metrics available</p>
                                <p className="text-gray-400 text-xs mt-1">Create metrics on desktop</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {kpis.map((kpi) => {
                                    const isSelected = formData.selectedKpiIds.includes(kpi.id!)
                                    return (
                                        <button
                                            key={kpi.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedKpiIds: isSelected
                                                        ? prev.selectedKpiIds.filter(id => id !== kpi.id)
                                                        : [...prev.selectedKpiIds, kpi.id!]
                                                }))
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                isSelected 
                                                    ? 'border-evidence-500 bg-evidence-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-gray-800">{kpi.title}</div>
                                                    {kpi.description && (
                                                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{kpi.description}</div>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-5 h-5 text-evidence-500" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 safe-area-pb">
                <div className="flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (step < totalSteps) {
                                setStep(s => s + 1)
                            } else {
                                handleSubmit()
                            }
                        }}
                        disabled={!canProceed() || loading}
                        className="flex-1 py-3 bg-evidence-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : step < totalSteps ? (
                            <>
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Add Evidence
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

// Mobile Evidence Edit Flow
interface EditFlowProps {
    initiativeId: string
    evidence: Evidence
    onClose: () => void
    onSuccess: () => void
}

type EvidenceType = 'visual_proof' | 'documentation' | 'testimony' | 'financials'

function MobileEvidenceEditFlow({ initiativeId, evidence, onClose, onSuccess }: EditFlowProps) {
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [kpis, setKPIs] = useState<KPI[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Initialize form with existing evidence data
    const [formData, setFormData] = useState({
        type: (evidence.type || 'visual_proof') as EvidenceType,
        title: evidence.title || '',
        description: evidence.description || '',
        file: null as File | null,
        fileUrl: evidence.file_url || '',
        datePickerValue: {
            singleDate: evidence.date_represented,
            startDate: evidence.date_range_start,
            endDate: evidence.date_range_end
        } as { singleDate?: string; startDate?: string; endDate?: string },
        selectedLocationIds: evidence.location_ids || (evidence.location_id ? [evidence.location_id] : []),
        selectedKpiIds: evidence.kpi_ids || []
    })

    const evidenceTypes: { value: EvidenceType; label: string; icon: typeof Camera; description: string }[] = [
        { value: 'visual_proof', label: 'Photo/Video', icon: Camera, description: 'Visual evidence' },
        { value: 'documentation', label: 'Document', icon: FileText, description: 'Reports, forms' },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare, description: 'Quotes, feedback' },
        { value: 'financials', label: 'Financial', icon: DollarSign, description: 'Receipts, invoices' }
    ]

    useEffect(() => {
        // Load locations and KPIs
        Promise.all([
            apiService.getLocations(initiativeId),
            apiService.getKPIs(initiativeId)
        ]).then(([locs, kpiData]) => {
            setLocations(locs || [])
            setKPIs(kpiData || [])
        })
    }, [initiativeId])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFormData(prev => ({ ...prev, file }))
        }
    }

    const handleSubmit = async () => {
        if (!formData.title) {
            toast.error('Please enter a title')
            return
        }

        setLoading(true)
        try {
            let fileUrl = formData.fileUrl

            // Upload new file if selected
            if (formData.file) {
                const uploadResult = await apiService.uploadFile(formData.file)
                fileUrl = uploadResult.file_url
            }

            // Prepare data
            const submitData: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                file_url: fileUrl,
                kpi_ids: formData.selectedKpiIds,
                location_ids: formData.selectedLocationIds
            }

            // Handle dates
            if (formData.datePickerValue.singleDate) {
                submitData.date_represented = formData.datePickerValue.singleDate
            } else if (formData.datePickerValue.startDate && formData.datePickerValue.endDate) {
                submitData.date_range_start = formData.datePickerValue.startDate
                submitData.date_range_end = formData.datePickerValue.endDate
                submitData.date_represented = formData.datePickerValue.startDate
            }

            await apiService.updateEvidence(evidence.id!, submitData)
            toast.success('Evidence updated!')
            onSuccess()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update evidence'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Edit Evidence</span>
                <div className="w-9" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Type Selection */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Evidence Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {evidenceTypes.map((type) => {
                            const Icon = type.icon
                            const isSelected = formData.type === type.value
                            return (
                                <button
                                    key={type.value}
                                    onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        isSelected 
                                            ? 'border-evidence-500 bg-evidence-50' 
                                            : 'border-gray-200'
                                    }`}
                                >
                                    <Icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                    <div className={`text-xs font-medium ${isSelected ? 'text-evidence-600' : 'text-gray-600'}`}>
                                        {type.label}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* File */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">File</label>
                    <input
                        ref={fileInputRef}
                        type="file"
                        onChange={handleFileSelect}
                        accept="image/*,video/*,.pdf,.doc,.docx"
                        className="hidden"
                    />
                    
                    {formData.file ? (
                        <div className="bg-evidence-50 border border-evidence-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-5 h-5 text-evidence-500 flex-shrink-0" />
                                <span className="text-sm text-gray-700 truncate">{formData.file.name}</span>
                            </div>
                            <button onClick={() => setFormData(prev => ({ ...prev, file: null }))} className="text-red-500 text-xs font-medium">
                                Remove
                            </button>
                        </div>
                    ) : formData.fileUrl ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                <span className="text-sm text-gray-600 truncate">Current file attached</span>
                            </div>
                            <button 
                                onClick={() => fileInputRef.current?.click()} 
                                className="text-evidence-500 text-xs font-medium"
                            >
                                Replace
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full border border-dashed border-gray-300 rounded-xl p-4 text-center"
                        >
                            <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                            <p className="text-sm text-gray-600">Tap to select file</p>
                        </button>
                    )}
                </div>

                {/* Title */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                    />
                </div>

                {/* Description */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                    />
                </div>

                {/* Date */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Date
                    </label>
                    <DateRangePicker
                        value={formData.datePickerValue}
                        onChange={(value) => setFormData(prev => ({ ...prev, datePickerValue: value }))}
                        placeholder="Select date"
                    />
                </div>

                {/* Locations */}
                {locations.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <MapPin className="w-4 h-4 inline mr-1" />
                            Locations
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {locations.map((location) => {
                                const isSelected = formData.selectedLocationIds.includes(location.id!)
                                return (
                                    <button
                                        key={location.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                selectedLocationIds: isSelected
                                                    ? prev.selectedLocationIds.filter(id => id !== location.id)
                                                    : [...prev.selectedLocationIds, location.id!]
                                            }))
                                        }}
                                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                                            isSelected ? 'border-evidence-500 bg-evidence-50' : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-800">{location.name}</span>
                                            {isSelected && <Check className="w-4 h-4 text-evidence-500" />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* KPIs */}
                {kpis.length > 0 && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <FileText className="w-4 h-4 inline mr-1" />
                            Linked Metrics
                        </label>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            {kpis.map((kpi) => {
                                const isSelected = formData.selectedKpiIds.includes(kpi.id!)
                                return (
                                    <button
                                        key={kpi.id}
                                        onClick={() => {
                                            setFormData(prev => ({
                                                ...prev,
                                                selectedKpiIds: isSelected
                                                    ? prev.selectedKpiIds.filter(id => id !== kpi.id)
                                                    : [...prev.selectedKpiIds, kpi.id!]
                                            }))
                                        }}
                                        className={`w-full p-3 rounded-xl border text-left transition-all ${
                                            isSelected ? 'border-evidence-500 bg-evidence-50' : 'border-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-gray-800">{kpi.title}</span>
                                            {isSelected && <Check className="w-4 h-4 text-evidence-500" />}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 safe-area-pb">
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.title || loading}
                        className="flex-1 py-3 bg-evidence-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

