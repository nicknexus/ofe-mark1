import React, { useState, useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { MapPin, X, Info, BarChart3, FileText, Loader2 } from 'lucide-react'
import { Location, KPIUpdate, Evidence } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import LocationDetailsModal from './LocationDetailsModal'

// Fix Leaflet default icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

interface LocationMapProps {
    locations: Location[]
    onLocationClick?: (location: Location) => void
    onMapClick?: (coordinates: [number, number]) => void
    selectedLocationId?: string | null
    refreshKey?: number // Key to trigger refresh when updates/evidence change
    onApplyLocationFilter?: (locationId: string) => void // Callback to apply location filter
}

// Component to handle map click events
function MapClickHandler({ onMapClick, onMapClickPosition }: { onMapClick?: (coordinates: [number, number]) => void; onMapClickPosition?: (position: { x: number; y: number }, coordinates: [number, number]) => void }) {
    const map = useMapEvents({
        click: (e) => {
            if (onMapClick) {
                // Leaflet uses [lat, lng], but we need [lng, lat] to match existing API
                const { lat, lng } = e.latlng
                const point = map.latLngToContainerPoint(e.latlng)
                onMapClick([lng, lat])
                if (onMapClickPosition) {
                    onMapClickPosition({ x: point.x, y: point.y }, [lng, lat])
                }
            }
        },
    })
    return null
}

// Component to store map instance in ref
function MapInstanceSetter({ mapRef }: { mapRef: React.MutableRefObject<L.Map | null> }) {
    const map = useMap()
    useEffect(() => {
        mapRef.current = map
    }, [map, mapRef])
    return null
}

// Component to update map view when position changes
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
    const map = useMap()
    useEffect(() => {
        map.setView(center, zoom)
    }, [map, center, zoom])
    return null
}

// Custom marker component wrapper
function CustomMarkerWrapper({
    location,
    isHovered,
    isSelected,
    isPopupOpen,
    onClick,
    onMouseEnter,
    onMouseLeave,
}: {
    location: Location
    isHovered: boolean
    isSelected: boolean
    isPopupOpen: boolean
    onClick: (e: React.MouseEvent) => void
    onMouseEnter: (e: React.MouseEvent) => void
    onMouseLeave: () => void
}) {
    return (
        <div
            className="cursor-pointer relative"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            style={{ transform: 'translate(-50%, -50%)' }}
        >
            {/* Outer pulse ring for selected/hovered */}
            {(isSelected || isHovered) && (
                <div
                    className={`absolute inset-0 rounded-full animate-ping ${
                        isSelected ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{
                        width: isSelected ? '32px' : '24px',
                        height: isSelected ? '32px' : '24px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        opacity: 0.2,
                    }}
                />
            )}

            {/* Outer glow ring */}
            {(isSelected || isHovered) && (
                <div
                    className={`absolute inset-0 rounded-full ${
                        isSelected ? 'bg-blue-500' : 'bg-green-500'
                    }`}
                    style={{
                        width: isSelected ? '28px' : '20px',
                        height: isSelected ? '28px' : '20px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        opacity: 0.3,
                    }}
                />
            )}

            {/* Main marker circle */}
            <div
                className={`rounded-full transition-all duration-200 border-2 border-white ${
                    isSelected ? 'bg-blue-500' : 'bg-green-500'
                }`}
                style={{
                    width: isSelected ? '20px' : isHovered ? '16px' : '12px',
                    height: isSelected ? '20px' : isHovered ? '16px' : '12px',
                    borderWidth: isSelected || isHovered ? '3px' : '2px',
                }}
            />

            {/* Inner dot */}
            <div
                className="absolute inset-0 bg-white rounded-full"
                style={{
                    width: isSelected ? '8px' : isHovered ? '6px' : '4px',
                    height: isSelected ? '8px' : isHovered ? '6px' : '4px',
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                }}
            />

            {/* Pin icon indicator on hover */}
            {isHovered && !isSelected && (
                <div
                    className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full"
                    style={{ marginTop: '-18px' }}
                >
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 opacity-90">
                        <div className="w-1 h-1 rounded-full bg-white absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                </div>
            )}

            {/* Hover Tooltip */}
            {isHovered && !isPopupOpen && (
                <div
                    className="absolute left-1/2 top-0 transform -translate-x-1/2 -translate-y-full whitespace-nowrap"
                    style={{ marginTop: isSelected ? '-25px' : '-20px' }}
                >
                    <div className="bg-black/80 backdrop-blur-sm text-white text-xs font-semibold px-2 py-1 rounded-md">
                        {location.name}
                    </div>
                </div>
            )}
        </div>
    )
}

// Individual marker component
function LocationMarker({
    location,
    isHovered,
    isSelected,
    isPopupOpen,
    onMarkerClick,
    onMarkerMouseEnter,
    onMarkerMouseLeave,
}: {
    location: Location
    isHovered: boolean
    isSelected: boolean
    isPopupOpen: boolean
    onMarkerClick: (location: Location, event: L.LeafletMouseEvent) => void
    onMarkerMouseEnter: () => void
    onMarkerMouseLeave: () => void
}) {
    // Create custom icon using DivIcon
    const icon = useMemo(() => {
        const size = isSelected ? 40 : isHovered ? 36 : 32
        const color = isSelected ? '#3b82f6' : '#10b981'
        
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
                    ${(isSelected || isHovered) ? `
                        <div style="
                            position: absolute;
                            width: ${isSelected ? '48px' : '42px'};
                            height: ${isSelected ? '48px' : '42px'};
                            border-radius: 50%;
                            background-color: ${color};
                            opacity: 0.2;
                            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
                            transform-origin: center;
                        "></div>
                        <div style="
                            position: absolute;
                            width: ${isSelected ? '44px' : '38px'};
                            height: ${isSelected ? '44px' : '38px'};
                            border-radius: 50%;
                            background-color: ${color};
                            opacity: 0.3;
                        "></div>
                    ` : ''}
                    <div style="
                        width: ${isSelected ? '28px' : isHovered ? '24px' : '20px'};
                        height: ${isSelected ? '28px' : isHovered ? '24px' : '20px'};
                        border-radius: 50%;
                        background-color: ${color};
                        border: ${isSelected || isHovered ? '4px' : '3px'} solid white;
                        position: relative;
                        z-index: 10;
                    ">
                        <div style="
                            position: absolute;
                            left: 50%;
                            top: 50%;
                            transform: translate(-50%, -50%);
                            width: ${isSelected ? '12px' : isHovered ? '10px' : '8px'};
                            height: ${isSelected ? '12px' : isHovered ? '10px' : '8px'};
                            border-radius: 50%;
                            background-color: white;
                        "></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isSelected, isHovered])

    return (
        <Marker
            position={[location.latitude, location.longitude]}
            icon={icon}
            eventHandlers={{
                click: (e) => {
                    onMarkerClick(location, e)
                },
                mouseover: onMarkerMouseEnter,
                mouseout: onMarkerMouseLeave,
            }}
        />
    )
}

export default function LocationMap({
    locations,
    onLocationClick,
    onMapClick,
    selectedLocationId,
    refreshKey,
    onApplyLocationFilter,
}: LocationMapProps) {
    const [center, setCenter] = useState<[number, number]>([20, 0]) // [lat, lng]
    const [zoom, setZoom] = useState(2)
    const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null)
    const [popupLocation, setPopupLocation] = useState<Location | null>(null)
    const [popupPosition, setPopupPosition] = useState<{ x: number; y: number } | null>(null)
    const [detailsLocation, setDetailsLocation] = useState<Location | null>(null)
    const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loadingData, setLoadingData] = useState(false)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [mapClickPopup, setMapClickPopup] = useState<{ coordinates: [number, number]; position: { x: number; y: number } } | null>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const mapClickPopupRef = useRef<HTMLDivElement>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<L.Map | null>(null)

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
            if (mapClickPopupRef.current && !mapClickPopupRef.current.contains(event.target as Node)) {
                setMapClickPopup(null)
            }
        }

        if (popupLocation || mapClickPopup) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [popupLocation, mapClickPopup])

    // Update popup position when marker is clicked
    const updatePopupPosition = (location: Location, event: L.LeafletMouseEvent) => {
        const map = mapInstanceRef.current
        let positionSet = false
        
        if (map && mapContainerRef.current) {
            // Use map instance to convert lat/lng to container point
            try {
                const markerLatLng = event.latlng
                const point = map.latLngToContainerPoint(markerLatLng)
                const containerRect = mapContainerRef.current.getBoundingClientRect()
                // Convert to viewport coordinates
                setPopupPosition({
                    x: containerRect.left + point.x,
                    y: containerRect.top + point.y - 10, // Position above marker
                })
                positionSet = true
            } catch (e) {
                console.error('Error calculating popup position:', e)
            }
        }
        
        if (!positionSet) {
            // Fallback: use original event coordinates (already in viewport coordinates)
            const originalEvent = (event as any).originalEvent as MouseEvent
            if (originalEvent) {
                setPopupPosition({
                    x: originalEvent.clientX,
                    y: originalEvent.clientY - 10,
                })
                positionSet = true
            }
        }
        
        if (!positionSet && mapContainerRef.current) {
            // Last resort: use center of map container in viewport coordinates
            const rect = mapContainerRef.current.getBoundingClientRect()
            setPopupPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2 - 150,
            })
        }
    }

    const handleMarkerClick = (location: Location, event: L.LeafletMouseEvent) => {
        // Close map click popup if open
        setMapClickPopup(null)
        
        if (popupLocation?.id === location.id) {
            setPopupLocation(null)
            setPopupPosition(null)
        } else {
            setPopupLocation(location)
            updatePopupPosition(location, event)
        }
        onLocationClick?.(location)
    }

    const handleMarkerMouseEnter = (location: Location) => {
        setHoveredLocationId(location.id || null)
    }

    const handleMarkerMouseLeave = () => {
        setHoveredLocationId(null)
    }

    const handleZoomIn = () => {
        setZoom((prev) => Math.min(prev * 1.5, 18))
    }

    const handleZoomOut = () => {
        setZoom((prev) => Math.max(prev / 1.5, 1))
    }

    const handleMapClickWithPosition = (position: { x: number; y: number }, coordinates: [number, number]) => {
        // Convert container coordinates to viewport coordinates
        let viewportPosition = position
        if (mapContainerRef.current) {
            const rect = mapContainerRef.current.getBoundingClientRect()
            viewportPosition = {
                x: rect.left + position.x,
                y: rect.top + position.y,
            }
        }
        
        // If onApplyLocationFilter exists, show popup with Apply Filter button
        if (onApplyLocationFilter) {
            setMapClickPopup({ coordinates, position: viewportPosition })
        } else if (onMapClick) {
            // Otherwise, call the original onMapClick callback (for navigation, etc.)
            onMapClick(coordinates)
        }
    }

    return (
        <div
            ref={mapContainerRef}
            className="relative w-full h-full rounded-lg overflow-hidden border-2 border-gray-300/60 bg-gradient-to-br from-blue-50 via-indigo-50/30 to-cyan-50 shadow-inner"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-100/20 via-white/40 to-green-100/20 pointer-events-none z-[400]" />
            
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ width: '100%', height: '100%' }}
                className="relative z-0"
                zoomControl={false}
            >
                <MapInstanceSetter mapRef={mapInstanceRef} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler onMapClick={onMapClick} onMapClickPosition={handleMapClickWithPosition} />
                <MapViewUpdater center={center} zoom={zoom} />

                {locations.map((location) => {
                    const isHovered = hoveredLocationId === location.id
                    const isSelected = selectedLocationId === location.id
                    const isPopupOpen = popupLocation?.id === location.id

                    return (
                        <LocationMarker
                            key={`${location.id}-${isHovered}-${isSelected}`}
                            location={location}
                            isHovered={isHovered}
                            isSelected={isSelected}
                            isPopupOpen={isPopupOpen}
                            onMarkerClick={handleMarkerClick}
                            onMarkerMouseEnter={() => handleMarkerMouseEnter(location)}
                            onMarkerMouseLeave={handleMarkerMouseLeave}
                        />
                    )
                })}
            </MapContainer>

            {/* Click Popup */}
            {popupLocation && popupPosition && createPortal(
                <div
                    ref={popupRef}
                    className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[320px] max-w-[400px] max-h-[600px] animate-fade-in-up overflow-hidden flex flex-col"
                    style={{
                        left: `${Math.max(10, Math.min(popupPosition.x, window.innerWidth - 410))}px`,
                        top: `${Math.max(10, popupPosition.y - 300)}px`,
                        transform: popupPosition.y - 300 < 10 ? 'translateY(0)' : 'translateX(-50%)',
                        pointerEvents: 'auto',
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

                        {/* Metrics Section - Grouped by KPI with totals */}
                        <div className="mb-4">
                            <div className="flex items-center space-x-2 mb-2">
                                <BarChart3 className="w-4 h-4 text-blue-600" />
                                <h4 className="text-sm font-semibold text-gray-900">
                                    Metrics
                                </h4>
                            </div>
                            {loadingData ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                </div>
                            ) : kpiUpdates.length === 0 ? (
                                <p className="text-xs text-gray-400 py-2">No metrics linked</p>
                            ) : (() => {
                                // Group updates by KPI and calculate totals
                                const metricsMap = new Map<string, { kpi: any; updates: any[]; total: number }>()
                                kpiUpdates.forEach((update: any) => {
                                    const kpiId = update.kpi_id || 'unknown'
                                    if (!metricsMap.has(kpiId)) {
                                        metricsMap.set(kpiId, {
                                            kpi: update.kpis,
                                            updates: [],
                                            total: 0,
                                        })
                                    }
                                    const metric = metricsMap.get(kpiId)!
                                    metric.updates.push(update)
                                    metric.total += update.value || 0
                                })
                                const metrics = Array.from(metricsMap.values())

                                return (
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {metrics.map((metric, index) => (
                                            <div
                                                key={metric.kpi?.id || index}
                                                className="bg-blue-50 border border-blue-100 rounded-lg p-2.5"
                                            >
                                                <div className="font-semibold text-gray-900 text-sm mb-1">
                                                    {metric.kpi?.title || 'Unknown Metric'}
                                                </div>
                                                <div className="text-base font-bold text-blue-700">
                                                    {metric.total.toLocaleString()} {metric.kpi?.unit_of_measurement || ''}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {metric.updates.length} {metric.updates.length === 1 ? 'impact claim' : 'impact claims'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
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
                </div>,
                document.body
            )}

            {/* Map Click Popup - For applying location filter */}
            {mapClickPopup && onApplyLocationFilter && (() => {
                // Find nearest location to clicked coordinates
                const [lng, lat] = mapClickPopup.coordinates
                let nearestLocation: Location | null = null
                let minDistance = Infinity

                locations.forEach((loc) => {
                    const distance = Math.sqrt(
                        Math.pow(loc.longitude - lng, 2) + Math.pow(loc.latitude - lat, 2)
                    )
                    if (distance < minDistance) {
                        minDistance = distance
                        nearestLocation = loc
                    }
                })

                // Only show popup if there's a nearby location (within reasonable distance)
                // Convert to approximate degrees (roughly 1 degree ≈ 111km)
                const thresholdDistance = 0.01 // ~1km
                if (!nearestLocation || minDistance > thresholdDistance) {
                    return null
                }

                // TypeScript now knows nearestLocation is not null here, but we need to assert it
                const location: Location = nearestLocation as Location

                return createPortal(
                    <div
                        ref={mapClickPopupRef}
                        className="fixed z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 min-w-[280px] max-w-[320px] animate-fade-in-up overflow-hidden flex flex-col"
                        style={{
                            left: `${Math.max(10, Math.min(mapClickPopup.position.x, window.innerWidth - 330))}px`,
                            top: `${Math.max(10, mapClickPopup.position.y - 100)}px`,
                            transform: 'translateX(-50%)',
                            pointerEvents: 'auto',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Popup Arrow */}
                        <div
                            className="absolute w-4 h-4 bg-white border-r border-b border-gray-200 transform rotate-45"
                            style={{
                                bottom: '-8px',
                                left: '50%',
                                transform: 'translateX(-50%) rotate(45deg)',
                            }}
                        />

                        {/* Popup Content */}
                        <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center space-x-2">
                                    <div className="p-2 bg-green-100 rounded-lg">
                                        <MapPin className="w-4 h-4 text-green-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-sm">{location.name}</h3>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setMapClickPopup(null)}
                                    className="text-gray-400 hover:text-gray-600 p-1 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <p className="text-xs text-gray-600 mb-4">
                                Apply this location to the master filter?
                            </p>

                            <div className="flex space-x-2">
                                <button
                                    onClick={() => setMapClickPopup(null)}
                                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (location.id && onApplyLocationFilter) {
                                            onApplyLocationFilter(location.id)
                                            setMapClickPopup(null)
                                        }
                                    }}
                                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                                >
                                    Apply Filter
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            })()}

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
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-[700]">
                <button
                    onClick={handleZoomIn}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700 font-bold text-lg pointer-events-auto"
                >
                    +
                </button>
                <button
                    onClick={handleZoomOut}
                    className="w-10 h-10 bg-white border border-gray-200 rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors text-gray-700 font-bold text-lg pointer-events-auto"
                >
                    −
                </button>
            </div>

            {/* Empty State */}
            {locations.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50/90 via-white/90 to-green-50/90 backdrop-blur-sm z-[800]">
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
