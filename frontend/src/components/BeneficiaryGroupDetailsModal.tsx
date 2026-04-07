import React, { useState, useEffect, useMemo } from 'react'
import { X, Users, BarChart3, FileText, Calendar, Info, Loader2, Camera, MessageSquare, DollarSign, Edit, MapPin } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BeneficiaryGroup, KPIUpdate, Evidence, Story, Location } from '../types'
import { apiService } from '../services/api'
import { getEvidenceTypeInfo, formatDate } from '../utils'
import EvidencePreviewModal from './EvidencePreviewModal'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function TileLayerWithFallback() {
    const [useFallback, setUseFallback] = useState(false)
    const map = useMap()
    useEffect(() => {
        if (useFallback) return
        const testImg = new Image()
        testImg.onerror = () => {
            setUseFallback(true)
        }
        testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
        return () => { testImg.onerror = null }
    }, [useFallback])
    useEffect(() => {
        const handleTileError = () => {
            if (!useFallback) setUseFallback(true)
        }
        map.on('tileerror', handleTileError)
        return () => { map.off('tileerror', handleTileError) }
    }, [map, useFallback])
    return (
        <TileLayer
            attribution={useFallback ? OSM_ATTRIBUTION : CARTO_ATTRIBUTION}
            url={useFallback ? OSM_FALLBACK_URL : CARTO_VOYAGER_URL}
            subdomains={useFallback ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
    )
}

function MapResizeHandler() {
    const map = useMap()
    useEffect(() => {
        const handleResize = () => {
            setTimeout(() => map.invalidateSize(), 100)
        }
        window.addEventListener('resize', handleResize)
        const container = map.getContainer()
        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(container)
        map.invalidateSize()
        return () => {
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
        }
    }, [map])
    return null
}

function FitBoundsToLocations({ locations }: { locations: Location[] }) {
    const map = useMap()
    useEffect(() => {
        if (locations.length === 0) return
        if (locations.length === 1) {
            map.setView([locations[0].latitude, locations[0].longitude], 12)
            return
        }
        const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]))
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
    }, [map, locations])
    return null
}

function createLocationIcon() {
    const size = 32
    const color = '#c0dfa1'
    return L.divIcon({
        className: 'custom-marker',
        html: `
            <div style="
                position: relative;
                width: ${size}px;
                height: ${size}px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
            ">
                <div style="
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background-color: ${color};
                    border: 3px solid white;
                    position: relative;
                    z-index: 10;
                ">
                    <div style="
                        position: absolute;
                        left: 50%;
                        top: 50%;
                        transform: translate(-50%, -50%);
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: white;
                    "></div>
                </div>
            </div>
        `,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
    })
}

const locationMarkerIcon = createLocationIcon()

interface BeneficiaryGroupDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    beneficiaryGroup: BeneficiaryGroup | null
    onEditClick?: (group: BeneficiaryGroup) => void
    onMetricClick?: (kpiId: string) => void
    onStoryClick?: (storyId: string) => void
    refreshKey?: number
    initiativeId?: string
    groupLocations?: Location[]
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
    groupLocations = [],
}: BeneficiaryGroupDetailsModalProps) {
    const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [stories, setStories] = useState<Story[]>([])
    const [location, setLocation] = useState<Location | null>(null)
    const [loading, setLoading] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isEvidencePreviewOpen, setIsEvidencePreviewOpen] = useState(false)

    useEffect(() => {
        if (isOpen && beneficiaryGroup?.id && initiativeId) {
            setLoading(true)
            Promise.all([
                apiService.getKPIUpdatesForBeneficiaryGroup(beneficiaryGroup.id),
                apiService.getStories(initiativeId, { beneficiaryGroupIds: [beneficiaryGroup.id] }),
                apiService.getEvidenceForBeneficiaryGroup(beneficiaryGroup.id),
            ])
                .then(([updates, storiesData, evidenceData]) => {
                    setKpiUpdates(Array.isArray(updates) ? updates : [])
                    setStories(Array.isArray(storiesData) ? storiesData : [])
                    setEvidence(Array.isArray(evidenceData) ? evidenceData : [])
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

    useEffect(() => {
        if (!isOpen) {
            setLocation(null)
            return
        }
        if (groupLocations.length > 0) {
            setLocation(null)
            return
        }
        if (beneficiaryGroup?.location_id) {
            apiService.getLocation(beneficiaryGroup.location_id)
                .then(loc => setLocation(loc))
                .catch(() => setLocation(null))
        } else {
            setLocation(null)
        }
    }, [isOpen, beneficiaryGroup?.location_id, groupLocations.length])

    const mapLocations = useMemo(() => {
        if (groupLocations.length > 0) return groupLocations
        if (location) return [location]
        return []
    }, [groupLocations, location])

    const mapCenter = useMemo<[number, number]>(() => {
        if (mapLocations.length === 0) return [0, 0]
        const avgLat = mapLocations.reduce((s, l) => s + l.latitude, 0) / mapLocations.length
        const avgLng = mapLocations.reduce((s, l) => s + l.longitude, 0) / mapLocations.length
        return [avgLat, avgLng]
    }, [mapLocations])

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
                <div className="bubble-card max-w-[95vw] w-full h-[90vh] max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
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

                    {/* Content - 4 Column Layout */}
                    <div className="flex-1 overflow-hidden min-h-0 p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                <span className="ml-3 text-gray-600">Loading beneficiary group data...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-4 gap-6 h-full">
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

                                {/* Third Column - Evidence */}
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

                                {/* Fourth Column - Location Map */}
                                <div className="bubble-card overflow-hidden flex flex-col min-h-0 h-full">
                                    <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <MapPin className="w-4 h-4 text-gray-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">Location</h3>
                                            {mapLocations.length > 0 && (
                                                <span className="status-pill">{mapLocations.length}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-h-0 relative overflow-hidden">
                                        {mapLocations.length === 0 ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center py-8">
                                                    <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                                    <p className="text-xs text-gray-500">No location linked</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="relative w-full h-full overflow-hidden">
                                                <MapContainer
                                                    center={mapCenter}
                                                    zoom={2}
                                                    style={{ width: '100%', height: '100%' }}
                                                    className="leaflet-map-dashboard relative z-0"
                                                    zoomControl={false}
                                                    scrollWheelZoom={true}
                                                >
                                                    <TileLayerWithFallback />
                                                    <MapResizeHandler />
                                                    <FitBoundsToLocations locations={mapLocations} />
                                                    {mapLocations.map(loc => (
                                                        <Marker
                                                            key={loc.id}
                                                            position={[loc.latitude, loc.longitude]}
                                                            icon={locationMarkerIcon}
                                                        >
                                                            <Tooltip direction="top" offset={[0, -16]} permanent={mapLocations.length <= 3}>
                                                                <span className="text-xs font-medium">{loc.name}</span>
                                                                {loc.country && (
                                                                    <span className="text-[10px] text-gray-500 ml-1">({loc.country})</span>
                                                                )}
                                                            </Tooltip>
                                                        </Marker>
                                                    ))}
                                                </MapContainer>
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

