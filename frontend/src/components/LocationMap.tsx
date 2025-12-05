import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Tooltip } from 'react-leaflet'
import { createPortal } from 'react-dom'
import L from 'leaflet'
import { MapPin, X } from 'lucide-react'
import { Location } from '../types'
import LocationDetailsModal from './LocationDetailsModal'

// Fix Leaflet default icon issue with webpack/vite
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Carto Voyager tile configuration - modern with blue water and colors
const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

interface LocationMapProps {
    locations: Location[]
    onLocationClick?: (location: Location) => void
    onMapClick?: (coordinates: [number, number]) => void
    selectedLocationId?: string | null
    refreshKey?: number // Key to trigger refresh when updates/evidence change
    onApplyLocationFilter?: (locationId: string) => void // Callback to apply location filter
    initiativeId?: string // Initiative ID for fetching stories
    onEditClick?: (location: Location) => void // Callback for edit button
    onMetricClick?: (kpiId: string) => void // Callback for metric card click
    onStoryClick?: (storyId: string) => void // Callback for story card click
    flatTopCorners?: boolean // Remove top border radius (for dashboard)
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

// Component to handle resize events
function MapResizeHandler() {
    const map = useMap()
    
    useEffect(() => {
        const handleResize = () => {
            // Invalidate size after a small delay to ensure container has resized
            setTimeout(() => {
                map.invalidateSize()
            }, 100)
        }
        
        // Listen to window resize
        window.addEventListener('resize', handleResize)
        
        // Also use ResizeObserver for container size changes
        const container = map.getContainer()
        const resizeObserver = new ResizeObserver(() => {
            map.invalidateSize()
        })
        resizeObserver.observe(container)
        
        // Initial invalidateSize call
        map.invalidateSize()
        
        return () => {
            window.removeEventListener('resize', handleResize)
            resizeObserver.disconnect()
        }
    }, [map])
    
    return null
}

// Tile layer with fallback handling
function TileLayerWithFallback() {
    const [useFallback, setUseFallback] = useState(false)
    const map = useMap()
    
    useEffect(() => {
        if (useFallback) return
        
        // Test Carto tile availability
        const testImg = new Image()
        testImg.onerror = () => {
            console.warn('Carto tiles unavailable, falling back to OpenStreetMap')
            setUseFallback(true)
        }
        testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
        
        return () => {
            testImg.onerror = null
        }
    }, [useFallback])
    
    // Handle tile load errors at runtime
    useEffect(() => {
        const handleTileError = () => {
            if (!useFallback) {
                console.warn('Carto tile load failed, falling back to OpenStreetMap')
                setUseFallback(true)
            }
        }
        
        map.on('tileerror', handleTileError)
        
        return () => {
            map.off('tileerror', handleTileError)
        }
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
                        isSelected ? 'bg-blue-500' : 'bg-primary-500'
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
                        isSelected ? 'bg-blue-500' : 'bg-primary-500'
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
                    isSelected ? 'bg-blue-500' : 'bg-primary-500'
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
                    <div className="w-2.5 h-2.5 rounded-full bg-primary-500 opacity-90">
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
        const color = isSelected ? '#3b82f6' : '#c0dfa1'
        
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
        >
            <Tooltip permanent={false} direction="top" offset={[0, -10]}>
                {location.name}
            </Tooltip>
        </Marker>
    )
}

export default function LocationMap({
    locations,
    onLocationClick,
    onMapClick,
    selectedLocationId,
    refreshKey,
    onApplyLocationFilter,
    initiativeId,
    onEditClick,
    onMetricClick,
    onStoryClick,
}: LocationMapProps) {
    const [center, setCenter] = useState<[number, number]>([20, 0]) // [lat, lng]
    const [zoom, setZoom] = useState(2)
    const [hoveredLocationId, setHoveredLocationId] = useState<string | null>(null)
    const [detailsLocation, setDetailsLocation] = useState<Location | null>(null)
    const [detailsModalOpen, setDetailsModalOpen] = useState(false)
    const [mapClickPopup, setMapClickPopup] = useState<{ coordinates: [number, number]; position: { x: number; y: number } } | null>(null)
    const mapClickPopupRef = useRef<HTMLDivElement>(null)
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapInstanceRef = useRef<L.Map | null>(null)

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (mapClickPopupRef.current && !mapClickPopupRef.current.contains(event.target as Node)) {
                setMapClickPopup(null)
            }
        }

        if (mapClickPopup) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [mapClickPopup])

    const handleMarkerClick = (location: Location, event: L.LeafletMouseEvent) => {
        // Close map click popup if open
        setMapClickPopup(null)
        
        // Open details modal directly
        setDetailsLocation(location)
        setDetailsModalOpen(true)
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
            className="relative w-full h-full overflow-hidden"
        >
            
            <MapContainer
                center={center}
                zoom={zoom}
                style={{ width: '100%', height: '100%' }}
                className="leaflet-map-dashboard relative z-0"
                zoomControl={false}
            >
                <MapInstanceSetter mapRef={mapInstanceRef} />
                <MapResizeHandler />
                <TileLayerWithFallback />
                <MapClickHandler onMapClick={onMapClick} onMapClickPosition={handleMapClickWithPosition} />
                <MapViewUpdater center={center} zoom={zoom} />

                {locations.map((location) => {
                    const isHovered = hoveredLocationId === location.id
                    const isSelected = selectedLocationId === location.id
                    const isPopupOpen = detailsLocation?.id === location.id && detailsModalOpen

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
                                    <div className="p-2 bg-primary-100 rounded-lg">
                                        <MapPin className="w-4 h-4 text-primary-500" />
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
                                    className="flex-1 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-xs font-medium transition-colors"
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
                onEditClick={onEditClick}
                onMetricClick={onMetricClick}
                onStoryClick={onStoryClick}
                refreshKey={refreshKey}
                initiativeId={initiativeId}
            />

            {/* Zoom Controls */}
            <div className="absolute bottom-4 right-4 flex flex-col space-y-2 z-[50]">
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

            {/* No Location Banner */}
            {locations.length === 0 && (
                <div className="absolute top-4 left-4 z-[100] pointer-events-none">
                    <div className="bg-white/95 backdrop-blur-sm border border-gray-300 rounded-lg px-3 py-2 shadow-lg">
                        <div className="flex items-center space-x-2">
                            <MapPin className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">No location added</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
