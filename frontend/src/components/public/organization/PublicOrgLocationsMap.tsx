import React, { useEffect, useMemo } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import L from 'leaflet'
import type { PublicLocation } from '../../../services/publicApi'
import {
    LocationMarker,
    MapResizeHandler,
    TileLayerWithFallback,
} from '../initiative/PublicInitiativeMap'

// Auto-fits the viewport to the bounding box of the supplied locations.
// Mirrors `LocationMap.MapAutoFit` so the public org "Map" view reframes
// itself whenever filters change without touching the global filter bar.
function MapAutoFit({ locations }: { locations: PublicLocation[] }) {
    const map = useMap()

    const signature = useMemo(
        () =>
            locations
                .filter(l => typeof l.latitude === 'number' && typeof l.longitude === 'number')
                .map(l => `${l.id}:${l.latitude},${l.longitude}`)
                .sort()
                .join('|'),
        [locations]
    )

    useEffect(() => {
        const valid = locations.filter(
            l => typeof l.latitude === 'number' && typeof l.longitude === 'number'
        )
        if (valid.length === 0) return

        if (valid.length === 1) {
            map.setView([valid[0].latitude, valid[0].longitude], 6, { animate: true })
            return
        }

        const bounds = L.latLngBounds(
            valid.map(l => [l.latitude, l.longitude] as [number, number])
        )
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9, animate: true })
        // signature drives the refit; map identity is stable
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature])

    return null
}

type Props = {
    locations: PublicLocation[]
}

/**
 * Compact leaflet map used as the "Map" alternative inside the public org
 * Globe section. Uses Carto Voyager tiles + the shared public-side marker
 * styling so it reads as a sibling of the dashboard map without pulling in
 * the private `LocationMap` (which depends on internal `Location` types and
 * authenticated detail modals).
 */
export function PublicOrgLocationsMap({ locations }: Props) {
    return (
        <MapContainer
            center={[20, 0]}
            zoom={2}
            className="w-full h-full"
            zoomControl={true}
            scrollWheelZoom={true}
            attributionControl={false}
        >
            <MapResizeHandler />
            <TileLayerWithFallback />
            <MapAutoFit locations={locations} />
            {locations.map(location => (
                <LocationMarker key={location.id} location={location} />
            ))}
        </MapContainer>
    )
}
