import { Svg, Circle, Path, Rect, G } from '@react-pdf/renderer'
import { feature } from 'topojson-client'
import topology from 'world-atlas/countries-110m.json'
import type { ReportTheme } from '../../../utils/reportTheme'

export interface MapPoint {
    lat: number
    lng: number
    name: string
    type?: 'location' | 'story'
}

interface Props {
    points: MapPoint[]
    width: number
    height: number
    theme: ReportTheme
}

// Map palette. Kept independent of the brand accent so pins always contrast
// against the land beneath them, whatever colour the charity uses.
const SEA = '#e3ebf1'
const LAND = '#ffffff'
const COAST = '#adbcc8'

type Ring = [number, number][]

interface Country {
    rings: Ring[]
    bbox: [number, number, number, number] // minLng, minLat, maxLng, maxLat
}

/**
 * Natural Earth country outlines at 110m, decoded once per session.
 *
 * A graticule alone reads as a blank grid — pins floating in nothing. Real
 * coastlines are what make the plot legible, and embedding them keeps the
 * render deterministic and offline, unlike tile providers (which also need an
 * API key and reintroduce the load race the old export died on).
 */
let cachedCountries: Country[] | null = null

function getCountries(): Country[] {
    if (cachedCountries) return cachedCountries

    const collection = feature(topology as any, (topology as any).objects.countries) as any
    const out: Country[] = []

    for (const f of collection.features) {
        const geom = f.geometry
        if (!geom) continue
        const polygons: Ring[][] =
            geom.type === 'Polygon' ? [geom.coordinates] :
            geom.type === 'MultiPolygon' ? geom.coordinates :
            []

        for (const poly of polygons) {
            // Outer ring only — interior holes are invisible at this scale and
            // double the path data.
            const ring = poly[0] as Ring
            if (!ring || ring.length < 3) continue
            let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
            for (const [lng, lat] of ring) {
                if (lng < minLng) minLng = lng
                if (lng > maxLng) maxLng = lng
                if (lat < minLat) minLat = lat
                if (lat > maxLat) maxLat = lat
            }
            out.push({ rings: [ring], bbox: [minLng, minLat, maxLng, maxLat] })
        }
    }

    cachedCountries = out
    return out
}

/**
 * Location plot for the one-page report.
 *
 * Equirectangular projection auto-fitted to the points' bounding box, with the
 * aspect ratio preserved so clusters aren't stretched.
 */
export default function ReportMap({ points, width, height, theme }: Props) {
    if (points.length === 0) return null

    const pad = 6
    const inner = { w: width - pad * 2, h: height - pad * 2 }

    const lats = points.map((p) => p.lat)
    const lngs = points.map((p) => p.lng)
    let minLat = Math.min(...lats)
    let maxLat = Math.max(...lats)
    let minLng = Math.min(...lngs)
    let maxLng = Math.max(...lngs)

    // Keep enough of the surrounding region in frame that the shape of the
    // country is recognisable — zoomed to a single city, land fills the frame
    // as an unreadable block.
    const MIN_SPAN = 14
    if (maxLat - minLat < MIN_SPAN) {
        const mid = (maxLat + minLat) / 2
        minLat = mid - MIN_SPAN / 2
        maxLat = mid + MIN_SPAN / 2
    }
    if (maxLng - minLng < MIN_SPAN) {
        const mid = (maxLng + minLng) / 2
        minLng = mid - MIN_SPAN / 2
        maxLng = mid + MIN_SPAN / 2
    }

    const latPad = (maxLat - minLat) * 0.12
    const lngPad = (maxLng - minLng) * 0.12
    minLat -= latPad; maxLat += latPad
    minLng -= lngPad; maxLng += lngPad

    // Match the window's aspect to the frame's by *widening the geography*, not
    // by shrinking the drawn area. Scaling to fit left bands of empty sea above
    // and below the plot on a tall frame — land that should have continued
    // simply wasn't drawn. Growing the span instead fills the frame with real
    // map and, unlike cropping to cover, can never push a pin out of view.
    const boxAspect = inner.w / inner.h
    let spanLat = maxLat - minLat
    let spanLng = maxLng - minLng

    if (spanLng / spanLat < boxAspect) {
        const target = spanLat * boxAspect
        const mid = (minLng + maxLng) / 2
        minLng = mid - target / 2
        maxLng = mid + target / 2
        spanLng = target
    } else {
        const target = spanLng / boxAspect
        const mid = (minLat + maxLat) / 2
        minLat = mid - target / 2
        maxLat = mid + target / 2
        spanLat = target
    }

    // Latitude has hard limits; longitude does not. On a near-global spread the
    // expansion above asks for >180° of latitude, so clamp to the poles and
    // centre what remains — otherwise the whole world bunches at the top with
    // the leftover sea dumped underneath it.
    if (spanLat >= 180) {
        minLat = -90
        maxLat = 90
    } else if (minLat < -90) {
        maxLat += -90 - minLat
        minLat = -90
    } else if (maxLat > 90) {
        minLat -= maxLat - 90
        maxLat = 90
    }
    spanLat = maxLat - minLat

    const scale = inner.w / spanLng
    const offsetX = pad
    const offsetY = pad + Math.max(0, (inner.h - spanLat * scale) / 2)

    const px = (lng: number) => offsetX + (lng - minLng) * scale
    // SVG y grows downward; latitude grows upward.
    const py = (lat: number) => offsetY + (maxLat - lat) * scale

    // Only build paths for land actually in view.
    const visible = getCountries().filter(
        (c) => c.bbox[0] <= maxLng && c.bbox[2] >= minLng && c.bbox[1] <= maxLat && c.bbox[3] >= minLat
    )

    const paths = visible.map((c) =>
        c.rings
            .map((ring) => {
                let d = ''
                let lastX = NaN
                let lastY = NaN
                let lastLng = NaN
                let penDown = false
                for (let i = 0; i < ring.length; i++) {
                    const lng = ring[i][0]
                    const x = px(lng)
                    const y = py(ring[i][1])

                    // Countries spanning the antimeridian (Russia, Fiji) jump a
                    // full world-width between consecutive points; drawing that
                    // as a line streaks a bar straight across the map. Lift the
                    // pen and restart the subpath instead.
                    if (penDown && Math.abs(lng - lastLng) > 180) {
                        penDown = false
                    }

                    // Drop points that round to the same device position — at
                    // world zoom this halves the path data with no visible
                    // difference.
                    if (penDown && Math.abs(x - lastX) < 0.35 && Math.abs(y - lastY) < 0.35) continue

                    d += `${penDown ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
                    penDown = true
                    lastX = x
                    lastY = y
                    lastLng = lng
                }
                return d ? `${d}Z` : ''
            })
            .filter(Boolean)
            .join(' ')
    ).filter(Boolean)

    // Deduplicate pins that land on the same spot.
    const seen = new Set<string>()
    const plotted = points.filter((p) => {
        const key = `${Math.round(px(p.lng))}:${Math.round(py(p.lat))}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })

    return (
        <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
            {/* Sea. Land is drawn lighter on top, with a definite coastline —
                white-on-near-white read as an empty box. */}
            <Rect x={0} y={0} width={width} height={height} fill={SEA} rx={4} />

            <G>
                {paths.map((d, i) => (
                    <Path key={i} d={d} fill={LAND} stroke={COAST} strokeWidth={0.5} />
                ))}
            </G>

            {plotted.map((p, i) => (
                <G key={`${p.name}-${i}`}>
                    <Circle cx={px(p.lng)} cy={py(p.lat)} r={6} fill={theme.accent} opacity={0.3} />
                    <Circle
                        cx={px(p.lng)} cy={py(p.lat)} r={2.6}
                        fill={theme.accent} stroke="#ffffff" strokeWidth={0.8}
                    />
                </G>
            ))}
        </Svg>
    )
}
