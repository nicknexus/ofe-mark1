import React, { useState, useEffect, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { MapPin, X, Info, BarChart3, FileText, Loader2 } from 'lucide-react'
import { Location, KPIUpdate, Evidence } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import LocationDetailsModal from './LocationDetailsModal'

const geoUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface LocationMapProps {
    locations: Location[]
    onLocationClick?: (location: Location) => void
    onMapClick?: (coordinates: [number, number]) => void
    selectedLocationId?: string | null
    refreshKey?: number // Key to trigger refresh when updates/evidence change
}

export default function LocationMap({
    locations,
    onLocationClick,
    onMapClick,
    selectedLocationId,
    refreshKey,
}: LocationMapProps) {
    const [position, setPosition] = useState({ coordinates: [0, 0] as [number, number], zoom: 1 })
    const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null)
    const [popupLocation, setPopupLocation] = useState<Location | null>(null)
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
    const [detailsLocation, setDetailsLocation] = useState<Location | null>(null)
    const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const popupRef = useRef<HTMLDivElement>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)

    // Fetch data when popup opens or refreshKey changes
    useEffect(() => {
        if (popupLocation?.id) {
            setLoadingData(true)
            Promise.all([
                apiService.getLocationKPIUpdates(popupLocation.id),
                apiService.getLocationEvidence(popupLocation.id),
            ])
                .then(([updates, ev]) => {
                    setKpiUpdates(updates || [])
                    setEvidence(ev || [])
                })
                .catch((error) => {
                    console.error('Failed to fetch location data:', error)
                    setKpiUpdates([])
                    setEvidence([])
                })
                .finally(() => {
                    setLoadingData(false)
                })
        } else {
            setKpiUpdates([])
            setEvidence([])
        }
    }, [popupLocation?.id, refreshKey])

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
                setPopupLocation(null)
                setPopupPosition(null)
            }
        }

        if (popupLocation) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [popupLocation])

    const handleMoveEnd = (position: any) => {
        setPosition(position)
    }

    const handleMapClick = (event: any) => {
        if (onMapClick && event.lng !== undefined && event.lat !== undefined) {
            onMapClick([event.lng, event.lat])
            setPopupLocation(null)
            setPopupPosition(null)
        }
    }

    const handleMarkerClick = (location: Location, event: React.MouseEvent) => {
        event.stopPropagation()
        if (popupLocation?.id === location.id) {
            setPopupLocation(null)
            setPopupPosition(null)
        } else {
            setPopupLocation(location)
            // Calculate popup position relative to marker
            const mapContainer = mapContainerRef.current
            if (mapContainer) {
                const mapRect = mapContainer.getBoundingClientRect()
                // Get marker position from the event
                const markerX = (event.clientX - mapRect.left)
                const markerY = (event.clientY - mapRect.top)

                setPopupPosition({
                    x: markerX,
                    y: markerY - 10, // Position above marker
                })
            }
        }
        // Just notify parent to highlight this location, don't open editor
        onLocationClick?.(location)
    }

    const handleMarkerMouseEnter = (location: Location, event: React.MouseEvent) => {
        setHoveredLocationId(location.id || null)
    }

    const handleMarkerMouseLeave = () => {
        setHoveredLocationId(null)
    }

    return (
        <div ref={mapContainerRef} className="relative w-full h-full rounded-lg overflow-hidden border-2 border-gray-300/60 bg-gradient-to-br from-blue-50 via-indigo-50/30 to-cyan-50 shadow-inner">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 via-white/40 to-green-100/20 pointer-events-none z-0" />
            <ComposableMap
                projectionConfig={{
                    scale: 150,
                    center: [0, 20],
                }}
                style={{ width: '100%', height: '100%' }}
                onClick={handleMapClick}
            >
                <ZoomableGroup zoom={position.zoom} center={position.coordinates} onMoveEnd={handleMoveEnd}>
                    <Geographies geography={geoUrl}>
                        {({ geographies }: { geographies: any[] }) =>
                            geographies.map((geo: any) => (
                                <Geography
                                    key={geo.rsmKey}
                                    geography={geo}
                                    fill="#e0e7ff"
                                    stroke="#c7d2fe"
                                    style={{
                                        default: { outline: 'none', transition: 'fill 0.3s ease' },
                                        hover: { outline: 'none', fill: '#c7d2fe', transition: 'fill 0.3s ease' },
                                        pressed: { outline: 'none', fill: '#a5b4fc' },
                                    }}
                                />
                            ))
                        }
                    </Geographies>

                    {locations.map((location) => {
                        const isHovered = hoveredLocationId === location.id
                        const isSelected = selectedLocationId === location.id
                        const isPopupOpen = popupLocation?.id === location.id

                        return (
                            <Marker
                                key={location.id}
                                coordinates={[location.longitude, location.latitude]}
                            >
                                <g
                                    className="cursor-pointer"
                                    onClick={(e) => handleMarkerClick(location, e)}
                                    onMouseEnter={(e) => handleMarkerMouseEnter(location, e)}
                                    onMouseLeave={handleMarkerMouseLeave}
                                >
                                    {/* Outer pulse ring for selected/hovered */}
                                    {(isSelected || isHovered) && (
                                        <circle
                                            r={isSelected ? 16 : 12}
                                            fill={isSelected ? '#3b82f6' : '#10b981'}
                                            opacity={0.2}
                                            className="animate-ping"
                                        />
                                    )}

                                    {/* Outer glow ring */}
                                    {(isSelected || isHovered) && (
                                        <circle
                                            r={isSelected ? 14 : 10}
                                            fill={isSelected ? '#3b82f6' : '#10b981'}
                                            opacity={0.3}
                                        />
                                    )}

                                    {/* Main marker circle */}
                                    <circle
                                        r={isSelected ? 10 : isHovered ? 8 : 6}
                                        fill={isSelected ? '#3b82f6' : '#10b981'}
                                        stroke="white"
                                        strokeWidth={isSelected || isHovered ? 3 : 2}
                                        className="transition-all duration-200"
                                    />

                                    {/* Inner dot */}
                                    <circle
                                        r={isSelected ? 4 : isHovered ? 3 : 2}
                                        fill="white"
                                        className="transition-all duration-200"
                                    />

                                    {/* Pin icon indicator on hover */}
                                    {isHovered && !isSelected && (
                                        <g transform={`translate(0, -18)`}>
                                            <circle r="5" fill="#10b981" opacity="0.9" />
                                            <circle r="2" fill="white" />
                                        </g>
                                    )}
                                </g>

                                {/* Hover Tooltip */}
                                {isHovered && !isPopupOpen && (
                                    <g transform={`translate(0, -${isSelected ? 25 : 20})`}>
                                        <rect
                                            x="-50"
                                            y="-12"
                                            width="100"
                                            height="24"
                                            rx="6"
                                            fill="rgba(0, 0, 0, 0.8)"
                                            className="backdrop-blur-sm"
                                        />
                                        <text
                                            textAnchor="middle"
                                            y="4"
                                            fill="white"
                                            fontSize="11"
                                            fontWeight="600"
                                            className="pointer-events-none"
                                        >
                                            {location.name}
                                        </text>
                                    </g>
                                )}
                            </Marker>
                        )
                    })}
                </ZoomableGroup>
            </ComposableMap>

            {/* Click Popup */}
            {popupLocation && popupPosition && (
                <div
                    ref={popupRef}
                    className="absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[320px] max-w-[400px] max-h-[600px] animate-fade-in-up overflow-hidden flex flex-col"
                    style={{
                        left: `${Math.max(10, Math.min(popupPosition.x, (mapContainerRef.current?.clientWidth || 800) - 410))}px`,
                        top: `${Math.max(10, popupPosition.y - 300)}px`,
                        transform: popupPosition.y - 300 < 10 ? 'translateY(0)' : 'translateX(-50%)',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Popup Arrow */}
                    {popupPosition.y - 300 >= 10 && (
                        <div
                            className="absolute w-4 h-4 bg-white border-r border-b border-gray-200 transform rotate-45"
                            style={{
                                bottom: '-8px',
                                left: '50%',
                                transform: 'translateX(-50%) rotate(45deg)',
                            }}
                        />
                    )}

                    {/* Popup Content */}
                    <div className="p-4 flex-1 overflow-y-auto">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-2">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <MapPin className="w-4 h-4 text-green-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-sm">{popupLocation.name}</h3>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setPopupLocation(null)
                                    setPopupPosition(null)
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {popupLocation.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">{popupLocation.description}</p>
                        )}

                        <div className="space-y-2 pt-3 border-t border-gray-100 mb-4">
                            <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="break-all">
                                    {popupLocation.latitude.toFixed(6)}, {popupLocation.longitude.toFixed(6)}
                                </span>
                            </div>
                            {popupLocation.created_at && (
                                <div className="text-xs text-gray-400">
                                    Created {new Date(popupLocation.created_at).toLocaleDateString()}
                                </div>
                            )}
                        </div>

                        {/* Impact Claims Section */}
                        <div className="mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" />
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Impact Claims ({kpiUpdates.length})
                                </h4>
                            </div>
                            {loadingData ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : kpiUpdates.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No impact claims linked</p>
                            ) : (
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {kpiUpdates.slice(0, 5).map((update: any) => (
                                        <div
                                            key={update.id}
                                            className="bg-blue-50 border border-blue-100 rounded-lg p-2 text-xs"
                                        >
                                            <div className="font-medium text-gray-900">
                                                {update.kpis?.title || 'Unknown KPI'}
                                            </div>
                                            <div className="text-gray-600 mt-1">
                                                {update.value} {update.kpis?.unit_of_measurement || ''}
                                            </div>
                                            <div className="text-gray-400 mt-1">
                                                {formatDate(update.date_represented)}
                                            </div>
                                        </div>
                                    ))}
                                    {kpiUpdates.length > 5 && (
                                        <p className="text-xs text-gray-400 text-center">
                                            +{kpiUpdates.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Evidence Section */}
                        <div className="mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <FileText className="w-4 h-4 text-purple-600" />
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Evidence ({evidence.length})
                                </h4>
                            </div>
                            {loadingData ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : evidence.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No evidence linked</p>
                            ) : (
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                    {evidence.slice(0, 5).map((ev) => (
                                        <div
                                            key={ev.id}
                                            className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-xs"
                                        >
                                            <div className="font-medium text-gray-900">{ev.title}</div>
                                            <div className="text-gray-600 mt-1 capitalize">
                                                {ev.type?.replace('_', ' ')}
                                            </div>
                                            <div className="text-gray-400 mt-1">
                                                {formatDate(ev.date_represented)}
                                            </div>
                                        </div>
                                    ))}
                                    {evidence.length > 5 && (
                                        <p className="text-xs text-gray-400 text-center">
                                            +{evidence.length - 5} more
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* See Details Button */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <button
                                onClick={() => {
                                    setDetailsLocation(popupLocation)
                                    setPopupLocation(null)
                                    setPopupPosition(null)
                                    setDetailsModalOpen(true)
                                }}
                                className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                            >
                                See Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Location Details Modal */}
            <LocationDetailsModal
                isOpen={detailsModalOpen}
                onClose={() => {
                    setDetailsModalOpen(false)
                    setDetailsLocation(null)
                }}
                location={detailsLocation}
                onLocationClick={onLocationClick}
                refreshKey={refreshKey}
            />

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-10">
                <button
                    onClick={() => setPosition({ ...position, zoom: Math.min(position.zoom * 1.5, 8) })}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700 font-bold text-lg"
                >
                    +
                </button>
                <button
                    onClick={() => setPosition({ ...position, zoom: Math.max(position.zoom / 1.5, 1) })}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700 font-bold text-lg"
                >
                    −
                </button>
            </div>

            {/* Empty State */}
            {locations.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50/90 via-white/90 to-green-50/90 backdrop-blur-sm">
                    <div className="text-center p-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <MapPin className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">No Locations Yet</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Click on the map to add your first location
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

