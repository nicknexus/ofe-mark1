import { TileLayer } from 'react-leaflet'

const CARTO_KEY = (import.meta.env.VITE_CARTO_API_KEY || '').trim()

const CARTO_VOYAGER_URL = CARTO_KEY
    ? `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'

const CARTO_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export function BasemapLayer() {
    return (
        <TileLayer
            attribution={CARTO_ATTRIBUTION}
            url={CARTO_VOYAGER_URL}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
    )
}

/** @deprecated Use BasemapLayer. Kept so existing public-map imports keep working. */
export const TileLayerWithFallback = BasemapLayer
