import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Globe2, Map as MapIcon } from 'lucide-react'
import { OrganizationGlobeErrorBoundary } from './OrganizationGlobeErrorBoundary'
import { Chapter, INK, claimValue, plural, shortDate, tint, type RecentResult } from './orgShowcase'
import { getMetricColor } from '../initiative/metricColors'
import type { PublicInitiative, PublicKPIUpdate, PublicLocation, PublicOrganization } from '../../../services/publicApi'

const ImpactGlobe = lazy(() => import('../../landing/ImpactGlobe'))
const PublicOrgLocationsMap = lazy(() => import('./PublicOrgLocationsMap').then(module => ({ default: module.PublicOrgLocationsMap })))

type LatLng = { lat: number; lng: number }

const MAX_PROGRAMS = 10

const TICK_MS = 3600
const TICK_SPOTS = [
    'top-[8%] left-[2%]',
    'top-[36%] right-[2%]',
    'bottom-[18%] left-[4%]',
    'top-[4%] right-[12%]',
    'bottom-[14%] right-[6%]',
]

/** Results pop over the globe one at a time, newest first, and the globe turns to where each happened. */
function GlobeTicker({
    claims,
    colors,
    placeOf,
    onFocus,
}: {
    claims: RecentResult[]
    colors: Map<string, string>
    placeOf: (update: PublicKPIUpdate) => PublicLocation | undefined
    onFocus: (point: LatLng | null) => void
}) {
    const reduce = useReducedMotion()
    const [index, setIndex] = useState(0)
    const [paused, setPaused] = useState(false)
    const count = claims.length
    const current = claims[index % Math.max(count, 1)]

    useEffect(() => {
        if (reduce || paused || count < 2) return
        const timer = window.setTimeout(() => setIndex(value => (value + 1) % count), TICK_MS)
        return () => window.clearTimeout(timer)
    }, [index, reduce, paused, count])

    const place = current ? placeOf(current.update) : undefined
    useEffect(() => {
        onFocus(place?.latitude && place?.longitude ? { lat: place.latitude, lng: place.longitude } : null)
    }, [place?.latitude, place?.longitude, onFocus])

    if (!current) return null
    const color = colors.get(current.metric.id) || getMetricColor(0)

    return (
        <div className="absolute inset-0 pointer-events-none z-[500]">
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.update.id}
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    className={`absolute ${TICK_SPOTS[index % TICK_SPOTS.length]} pointer-events-auto max-w-[17rem] rounded-2xl bg-white/95 backdrop-blur shadow-lg border px-4 py-3`}
                    style={{ borderColor: `${color}55` }}
                    initial={reduce ? false : { opacity: 0, y: 12, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.97 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="flex items-baseline gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0 self-center" style={{ background: color }} />
                        <span className="font-fraunces text-2xl leading-none" style={{ color: INK }}>{claimValue(current)}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] font-semibold leading-snug line-clamp-2" style={{ color: INK }}>{current.metric.title}</p>
                    <p className="mt-0.5 text-[12px] text-secondary-500 truncate">
                        {[place?.name, shortDate(current.update.date_represented)].filter(Boolean).join(' · ')}
                    </p>
                </motion.div>
            </AnimatePresence>
        </div>
    )
}

export function OrgGlobeSection({
    organization,
    title,
    sub,
    initiatives,
    programStats,
    globeLocations,
    pinned,
    claims,
    colors,
    placeOf,
    brandColor,
    accent,
    orgLinkBase,
    slug,
}: {
    organization: PublicOrganization
    title: string
    sub?: string
    initiatives: PublicInitiative[]
    programStats: Map<string, { metrics: number; results: number }>
    globeLocations: { lat: number; lng: number; name: string }[]
    pinned: PublicLocation[]
    claims: RecentResult[]
    colors: Map<string, string>
    placeOf: (update: PublicKPIUpdate) => PublicLocation | undefined
    brandColor: string
    accent: string
    orgLinkBase: string
    slug: string
}) {
    const [mode, setMode] = useState<'globe' | 'map'>('globe')
    const [focus, setFocus] = useState<LatLng | null>(null)
    const hasPlaces = pinned.length > 0

    return (
        <section className="relative overflow-hidden" style={{ background: `linear-gradient(180deg, ${tint(brandColor, 0.09)} 0%, #FFFFFF 100%)` }}>
            {hasPlaces && (
                <div
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 right-[-12%] h-[70rem] w-[70rem] -translate-y-1/2 rounded-full blur-3xl opacity-50"
                    style={{ background: `radial-gradient(circle, ${brandColor}40 0%, ${brandColor}10 40%, transparent 68%)` }}
                />
            )}
            <div className="relative max-w-7xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Chapter kicker="What we do" title={title} sub={sub} accent={accent} />
                    {hasPlaces && (
                        <div className="inline-flex rounded-full bg-white/80 backdrop-blur border p-1 shadow-sm" style={{ borderColor: `${brandColor}33` }}>
                            {([['globe', 'Globe', Globe2], ['map', 'Map', MapIcon]] as const).map(([value, label, Icon]) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setMode(value)}
                                    aria-pressed={mode === value}
                                    className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[13px] font-semibold transition-colors"
                                    style={mode === value ? { background: accent, color: '#FFFFFF' } : { color: accent }}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className={`mt-6 ${hasPlaces ? 'grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-6 lg:gap-10 items-center' : ''}`}>
                    {initiatives.length > 0 && (
                        <ul
                            className={`flex gap-2.5 overflow-x-auto snap-x pb-1 ${hasPlaces ? 'lg:grid lg:grid-rows-[repeat(5,auto)] lg:grid-flow-col lg:auto-cols-[16rem] lg:overflow-visible lg:pb-0' : 'sm:grid sm:grid-cols-2 lg:grid-cols-3'}`}
                            style={{ scrollbarWidth: 'none' }}
                        >
                            {initiatives.slice(0, MAX_PROGRAMS).map(program => {
                                const stats = programStats.get(program.id)
                                return (
                                    <li key={program.id} className="snap-start shrink-0 w-[16rem] lg:w-auto lg:h-full">
                                        <Link
                                            to={`${orgLinkBase}/${slug}/${program.slug}`}
                                            className="flex h-full items-center gap-3 rounded-2xl bg-white/75 backdrop-blur border py-3 pl-3 pr-4 shadow-sm hover:bg-white hover:shadow-md transition-all min-w-0"
                                            style={{ borderColor: `${brandColor}33` }}
                                        >
                                            <span className="h-11 w-11 rounded-xl overflow-hidden bg-white border border-black/5 shrink-0 inline-flex items-center justify-center">
                                                {organization.logo_url ? (
                                                    <img src={organization.logo_url} alt="" className="h-full w-full object-cover" />
                                                ) : (
                                                    <span className="text-base font-semibold" style={{ color: accent }}>{program.title.charAt(0)}</span>
                                                )}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-[15px] font-semibold leading-snug line-clamp-2" style={{ color: INK }}>{program.title}</span>
                                                {stats && (
                                                    <span className="block text-[12px] text-secondary-500">
                                                        {plural(stats.metrics, 'metric')} · {plural(stats.results, 'result')}
                                                    </span>
                                                )}
                                            </span>
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                    {hasPlaces && (
                        <div className="relative h-[460px] sm:h-[600px] lg:h-[min(78vh,720px)] lg:ml-6">
                            {mode === 'globe' ? (
                                <OrganizationGlobeErrorBoundary>
                                    <Suspense fallback={<div className="h-full" />}>
                                        <ImpactGlobe locations={globeLocations} showLabels={false} brandColor={brandColor} enableZoom={false} focusLocation={focus} fill={0.9} />
                                    </Suspense>
                                </OrganizationGlobeErrorBoundary>
                            ) : (
                                <div className="h-full rounded-3xl overflow-hidden border shadow-sm bg-white" style={{ borderColor: `${brandColor}33` }}>
                                    <Suspense fallback={<div className="h-full" style={{ background: tint(brandColor, 0.06) }} />}>
                                        <PublicOrgLocationsMap locations={pinned} />
                                    </Suspense>
                                </div>
                            )}
                            <GlobeTicker claims={claims} colors={colors} placeOf={placeOf} onFocus={setFocus} />
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
