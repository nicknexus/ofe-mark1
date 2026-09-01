import './leafletSetup'
import React, { useEffect, useMemo, useState } from 'react'
import { Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PublicLocation } from '../../../services/publicApi'

export { TileLayerWithFallback, BasemapLayer } from '../../map/BasemapLayer'

export function LocationMarker({ location }: { location: PublicLocation }) {
    const [isHovered, setIsHovered] = useState(false)

    const icon = useMemo(() => {
        const size = isHovered ? 36 : 32
        const color = '#c0dfa1'

        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${isHovered ? `
                        <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background-color: ${color}; opacity: 0.2; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${color}; opacity: 0.3;"></div>
                    ` : ''}
                    <div style="width: ${isHovered ? '24px' : '20px'}; height: ${isHovered ? '24px' : '20px'}; border-radius: 50%; background-color: ${color}; border: ${isHovered ? '4px' : '3px'} solid white; position: relative; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${isHovered ? '10px' : '8px'}; height: ${isHovered ? '10px' : '8px'}; border-radius: 50%; background-color: white;"></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isHovered])

    return (
        <Marker
            position={[location.latitude, location.longitude]}
            icon={icon}
            eventHandlers={{ mouseover: () => setIsHovered(true), mouseout: () => setIsHovered(false) }}
        >
            <Tooltip direction="top" offset={[0, -15]}>
                <div className="font-sans">
                    <p className="font-semibold text-sm">{location.name}</p>
                    {location.description && <p className="text-xs text-gray-500">{location.description}</p>}
                </div>
            </Tooltip>
        </Marker>
    )
}

export function MapResizeHandler() {
    const map = useMap()
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(map.getContainer())
        map.invalidateSize()
        return () => resizeObserver.disconnect()
    }, [map])
    return null
}

export function ClickableLocationMarker({
    location,
    onClick,
}: {
    location: PublicLocation
    onClick: (loc: PublicLocation) => void
}) {
    const [isHovered, setIsHovered] = useState(false)

    const icon = useMemo(() => {
        const size = isHovered ? 36 : 32
        const color = '#c0dfa1'
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${isHovered ? `
                        <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background-color: ${color}; opacity: 0.2; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${color}; opacity: 0.3;"></div>
                    ` : ''}
                    <div style="width: ${isHovered ? '24px' : '20px'}; height: ${isHovered ? '24px' : '20px'}; border-radius: 50%; background-color: ${color}; border: ${isHovered ? '4px' : '3px'} solid white; position: relative; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${isHovered ? '10px' : '8px'}; height: ${isHovered ? '10px' : '8px'}; border-radius: 50%; background-color: white;"></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isHovered])

    return (
        <Marker
            position={[location.latitude, location.longitude]}
            icon={icon}
            eventHandlers={{
                mouseover: () => setIsHovered(true),
                mouseout: () => setIsHovered(false),
                click: () => onClick(location),
            }}
        >
            <Tooltip direction="top" offset={[0, -15]}>
                <div className="font-sans">
                    <p className="font-semibold text-sm">{location.name}</p>
                    {location.description && <p className="text-xs text-gray-500">{location.description}</p>}
                    <p className="text-xs text-accent mt-1">Click to explore</p>
                </div>
            </Tooltip>
        </Marker>
    )
}
