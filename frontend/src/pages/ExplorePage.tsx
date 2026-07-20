import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
    Search, Building2, Target, MapPin, Loader2, ArrowRight, ArrowLeft, Globe2,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    publicApi, PublicOrganization, SearchResult, ShowcaseImpactClaim,
} from '../services/publicApi'
import { supabase } from '../services/supabase'
import ImpactGlobe from '../components/landing/ImpactGlobe'
import { easeOut } from '../components/landing/motion'

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

const SPOTLIGHT_MS = 6000
// How long the globe holds on the last hovered charity before the auto tour resumes.
const OVERRIDE_HOLD_MS = 15000

/** A point the globe should fly to; carries a claim when there's one to feature. */
interface FocusTarget {
    lat: number
    lng: number
    claim?: ShowcaseImpactClaim
}

function formatClaimValue(claim: ShowcaseImpactClaim): string {
    const value = claim.value.toLocaleString()
    if (claim.metric_type === 'percentage') return `${value}%`
    return claim.unit_of_measurement ? `${value} ${claim.unit_of_measurement}` : value
}

interface ExplorePageProps {
    embedded?: boolean
}

export default function ExplorePage({ embedded = false }: ExplorePageProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<SearchResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [initialOrgs, setInitialOrgs] = useState<PublicOrganization[]>([])
    const [loadingInitial, setLoadingInitial] = useState(true)
    const [isLoggedIn, setIsLoggedIn] = useState(false)
    const [claims, setClaims] = useState<ShowcaseImpactClaim[]>([])

    // Globe focus: auto-cycling spotlight, overridden while hovering a list row.
    const [spotIdx, setSpotIdx] = useState(0)
    const [override, setOverride] = useState<FocusTarget | null>(null)
    const lastScrollRef = useRef(0)
    const lastHoverRef = useRef(0)
    const globeHoverRef = useRef(false)
    const searchInputRef = useRef<HTMLInputElement>(null)

    const debouncedQuery = useDebounce(searchQuery, 300)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session))
    }, [])

    useEffect(() => {
        let alive = true
        setLoadingInitial(true)
        Promise.allSettled([publicApi.getOrganizations(), publicApi.getShowcase(24)]).then(([orgsRes, showcaseRes]) => {
            if (!alive) return
            if (orgsRes.status === 'fulfilled') setInitialOrgs(orgsRes.value)
            else console.error('Failed to load organizations:', orgsRes.reason)
            if (showcaseRes.status === 'fulfilled') {
                setClaims(showcaseRes.value?.impact_claims ?? [])
            }
            setLoadingInitial(false)
        })
        return () => { alive = false }
    }, [])

    useEffect(() => {
        if (debouncedQuery.trim()) performSearch(debouncedQuery)
        else setResults(null)
    }, [debouncedQuery])

    const performSearch = async (query: string) => {
        try {
            setLoading(true)
            const searchResults = await publicApi.search(query)
            setResults(searchResults)
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setLoading(false)
        }
    }

    // "/" anywhere jumps to the search field.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
            const el = document.activeElement
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
            e.preventDefault()
            searchInputRef.current?.focus()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    // Track scrolling so globe spotlight swaps never fire mid-scroll.
    useEffect(() => {
        const onScroll = () => { lastScrollRef.current = performance.now() }
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    // Auto-cycle the spotlight through impact claims while the user is idle.
    // A hover override sticks — the globe stays on the last hovered charity —
    // and the ambient tour only resumes after a stretch of no interaction.
    useEffect(() => {
        if (claims.length < 2) return
        const timer = setInterval(() => {
            if (globeHoverRef.current) return
            if (performance.now() - lastScrollRef.current < 500) return
            if (override) {
                if (performance.now() - lastHoverRef.current < OVERRIDE_HOLD_MS) return
                setOverride(null)
                return
            }
            setSpotIdx((i) => (i + 1) % claims.length)
        }, SPOTLIGHT_MS)
        return () => clearInterval(timer)
    }, [claims.length, override])

    const claimsByOrg = useMemo(() => {
        const map = new Map<string, ShowcaseImpactClaim[]>()
        for (const claim of claims) {
            if (!claim.org_slug) continue
            const list = map.get(claim.org_slug) ?? []
            list.push(claim)
            map.set(claim.org_slug, list)
        }
        return map
    }, [claims])

    // Pins for the globe — one per distinct location.
    const globeLocations = useMemo(() => {
        const seen = new Set<string>()
        const pins: { lat: number; lng: number; name: string }[] = []
        for (const claim of claims) {
            const key = `${claim.lat.toFixed(3)},${claim.lng.toFixed(3)}`
            if (seen.has(key)) continue
            seen.add(key)
            pins.push({ lat: claim.lat, lng: claim.lng, name: claim.location_name || claim.org_name || 'Impact' })
        }
        return pins
    }, [claims])

    const autoClaim = claims.length > 0 ? claims[spotIdx % claims.length] : null
    const activeClaim = override ? override.claim ?? null : autoClaim
    const focusLocation = override
        ? { lat: override.lat, lng: override.lng }
        : autoClaim
            ? { lat: autoClaim.lat, lng: autoClaim.lng }
            : null

    const focusOrg = (org: PublicOrganization) => {
        const orgClaims = claimsByOrg.get(org.slug)
        if (orgClaims && orgClaims.length > 0) {
            lastHoverRef.current = performance.now()
            setOverride({ lat: orgClaims[0].lat, lng: orgClaims[0].lng, claim: orgClaims[0] })
        }
    }
    const focusPoint = (lat: number, lng: number) => {
        lastHoverRef.current = performance.now()
        setOverride({ lat, lng })
    }

    const hasResults = results && (results.organizations.length > 0 || results.initiatives.length > 0 || results.locationMatches.length > 0)
    const showInitialOrgs = !searchQuery.trim() && !loading

    if (loadingInitial && initialOrgs.length === 0) {
        return (
            <div className={`landing-page ${embedded ? 'min-h-0 py-24' : 'min-h-screen'} relative flex items-center justify-center bg-gradient-to-br from-steel-light to-ink-soft`}>
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-seafoam animate-spin mx-auto mb-4" />
                    <p className="text-sm text-white/60 font-figtree">Charting the atlas…</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`landing-page ${embedded ? 'min-h-0 pb-4' : 'min-h-screen lg:h-screen lg:overflow-hidden'} font-figtree relative animate-fadeIn flex flex-col`}>
            {/* Dark atlas backdrop — same palette as the landing "Why it matters" band */}
            <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 pointer-events-none bg-gradient-to-br from-steel-light to-ink-soft`}>
                {/* Faint chart grid */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:60px_60px]" />
                {/* Soft accent glows */}
                <div className="absolute -top-32 -left-24 w-[30rem] h-[30rem] rounded-full bg-seafoam/15 blur-3xl" />
                <div className="absolute top-1/3 -right-40 w-[36rem] h-[36rem] rounded-full bg-sage/10 blur-3xl" />
                <div className="absolute -bottom-40 left-1/4 w-[28rem] h-[28rem] rounded-full bg-seafoam/10 blur-3xl" />
            </div>

            <div className={`relative z-10 flex-1 min-h-0 flex flex-col w-full max-w-[1560px] mx-auto px-4 sm:px-6 ${embedded ? 'pt-2' : 'pt-3 sm:pt-4 pb-4'}`}>
                {!embedded && (
                    <nav className="mb-4 sm:mb-5">
                        <div className="bg-white/5 backdrop-blur-xl rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between border border-white/10">
                            <Link to="/" className="flex items-center gap-2 group">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden bg-white/90">
                                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg sm:text-xl font-newsreader font-extralight text-white">Nexus Impacts</span>
                            </Link>
                            <div className="flex items-center gap-2 sm:gap-4">
                                {isLoggedIn ? (
                                    <Link to="/" className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-seafoam text-steel-ink text-xs sm:text-sm font-medium rounded-xl hover:bg-seafoam/90 transition-colors">
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        Back to Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/login" className="text-xs sm:text-sm text-white/60 hover:text-seafoam transition-colors">Sign In</Link>
                                        <Link to="/login" className="px-3 sm:px-4 py-2 bg-seafoam text-steel-ink text-xs sm:text-sm font-medium rounded-xl hover:bg-seafoam/90 transition-colors">Get Started</Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </nav>
                )}

                {/* Centered title */}
                <div className="text-center mb-4 sm:mb-6">
                    <p className="inline-flex items-center justify-center gap-2 text-[11px] font-semibold text-seafoam uppercase tracking-[0.2em] mb-1.5">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-seafoam opacity-75 animate-ping" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-seafoam" />
                        </span>
                        The impact atlas
                    </p>
                    <h1 className="text-2xl sm:text-3xl font-fraunces font-light text-white leading-snug">
                        Impact transparency,
                        <span className="text-seafoam"> all in one place.</span>
                    </h1>
                </div>

                {/* Atlas layout: list panel left, globe right — fits the viewport on desktop */}
                <div className={`flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[390px_minmax(0,1fr)] gap-6 ${embedded ? 'pb-2' : ''}`}>
                    {/* Globe — fills the right column */}
                    <div className="order-2 lg:h-full lg:min-h-0">
                        <div
                            className={`relative ${embedded ? 'h-[300px]' : 'h-[360px] sm:h-[460px] lg:h-full'}`}
                            onPointerEnter={() => { globeHoverRef.current = true }}
                            onPointerLeave={() => { globeHoverRef.current = false }}
                        >
                            {/* Halo behind the globe */}
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-3/4 h-3/4 rounded-full bg-[radial-gradient(circle,rgba(151,199,203,0.14)_0%,transparent_65%)]" />
                            </div>
                            <ImpactGlobe
                                locations={globeLocations.length > 0 ? globeLocations : undefined}
                                enableZoom
                                focusLocation={focusLocation}
                                initialAltitude={1.45}
                            />

                            {/* Spotlight card for the featured claim */}
                            <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none px-4">
                                <AnimatePresence mode="wait">
                                    {activeClaim && (
                                        <motion.div
                                            key={activeClaim.id}
                                            initial={{ opacity: 0, y: 12 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -8 }}
                                            transition={{ duration: 0.35, ease: easeOut }}
                                            className="pointer-events-auto w-full max-w-sm"
                                        >
                                            <Link
                                                to={activeClaim.org_slug && activeClaim.initiative_slug
                                                    ? `/org/${activeClaim.org_slug}/${activeClaim.initiative_slug}`
                                                    : activeClaim.org_slug ? `/org/${activeClaim.org_slug}` : '/explore'}
                                                className="group block bg-steel-ink/80 backdrop-blur-md rounded-2xl border border-white/10 p-4 hover:border-seafoam/40 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 bg-white">
                                                        {activeClaim.org_logo_url ? (
                                                            <img src={activeClaim.org_logo_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Globe2 className="w-4 h-4 text-seafoam" />
                                                        )}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-lg font-fraunces font-light text-seafoam leading-none mb-1">
                                                            {formatClaimValue(activeClaim)}
                                                        </p>
                                                        <p className="text-xs text-white/70 truncate">
                                                            {activeClaim.metric_title || activeClaim.label || 'Verified impact'}
                                                            {activeClaim.org_name && <span className="text-white/40"> · {activeClaim.org_name}</span>}
                                                        </p>
                                                        {(activeClaim.location_name || activeClaim.country) && (
                                                            <p className="text-[11px] text-white/40 flex items-center gap-1 mt-0.5 truncate">
                                                                <MapPin className="w-3 h-3 text-seafoam flex-shrink-0" />
                                                                {[activeClaim.location_name, activeClaim.country].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <ArrowRight className="w-4 h-4 text-white/40 group-hover:text-seafoam group-hover:translate-x-1 transition-all flex-shrink-0" />
                                                </div>
                                            </Link>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    {/* Search + list panel */}
                    <div className="order-1 min-w-0 flex flex-col lg:min-h-0">
                        {/* Search */}
                        <div className="relative mb-4 flex-shrink-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-seafoam" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search organizations, initiatives, places…"
                                autoFocus={!embedded}
                                className="w-full pl-11 pr-12 py-3.5 bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 text-sm sm:text-base text-white placeholder-white/40 focus:border-seafoam/60 focus:ring-2 focus:ring-seafoam/30 focus:outline-none transition-all"
                            />
                            {loading ? (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-seafoam animate-spin" />
                            ) : (
                                <kbd className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center w-6 h-6 rounded-md bg-white/10 border border-white/10 text-[11px] text-white/50">/</kbd>
                            )}
                        </div>

                        {/* Results scroll region — the page itself never scrolls on desktop */}
                        <div className={embedded ? '' : 'lg:flex-1 lg:min-h-0 lg:overflow-y-auto scrollbar-thin-light lg:pr-1.5'}>

                        {/* Search results */}
                        {searchQuery.trim() && results && (
                            <div className="space-y-8">
                                {results.organizations.length > 0 && (
                                    <ResultSection title="Organizations" icon={Building2} count={results.organizations.length}>
                                        {results.organizations.map((org) => (
                                            <OrgRow
                                                key={org.id}
                                                org={org}
                                                pinCount={claimsByOrg.get(org.slug)?.length ?? 0}
                                                onEnter={() => focusOrg(org)}
                                            />
                                        ))}
                                    </ResultSection>
                                )}
                                {results.initiatives.length > 0 && (
                                    <ResultSection title="Initiatives" icon={Target} count={results.initiatives.length}>
                                        {results.initiatives.map((init) => (
                                            <Link
                                                key={init.id}
                                                to={`/org/${init.org_slug}/${init.slug}`}
                                                className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                                            >
                                                <RowLogo url={init.organization_logo_url} fallback={<Target className="w-5 h-5 text-seafoam" />} />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-white group-hover:text-seafoam transition-colors truncate text-sm sm:text-base">{init.title}</h3>
                                                    <p className="text-xs text-white/50 truncate">
                                                        {init.organization_name}
                                                        {init.region && <span className="text-white/35"> · {init.region}</span>}
                                                    </p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-seafoam group-hover:translate-x-1 transition-all flex-shrink-0" />
                                            </Link>
                                        ))}
                                    </ResultSection>
                                )}
                                {results.locationMatches.length > 0 && (
                                    <ResultSection title="Places" icon={MapPin} count={results.locationMatches.length}>
                                        {results.locationMatches.map((match, idx) => (
                                            <Link
                                                key={idx}
                                                to={`/org/${match.organization.slug}/${match.initiative.slug}`}
                                                onMouseEnter={() => focusPoint(match.location.latitude, match.location.longitude)}
                                                className="group flex items-center gap-3.5 p-3.5 rounded-2xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
                                            >
                                                <RowLogo url={match.organization.logo_url} fallback={<MapPin className="w-5 h-5 text-seafoam" />} />
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-medium text-white group-hover:text-seafoam transition-colors truncate text-sm sm:text-base">{match.location.name}</h3>
                                                    <p className="text-xs text-white/50 truncate">{match.initiative.title} · {match.organization.name}</p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-seafoam group-hover:translate-x-1 transition-all flex-shrink-0" />
                                            </Link>
                                        ))}
                                    </ResultSection>
                                )}
                                {!hasResults && !loading && (
                                    <div className="bg-white/5 backdrop-blur-xl p-10 rounded-2xl text-center border border-white/10">
                                        <Search className="w-10 h-10 text-white/20 mx-auto mb-4" />
                                        <h3 className="text-base font-semibold text-white mb-1.5">No results found</h3>
                                        <p className="text-sm text-white/50">Try different keywords, or browse every organization below.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* All organizations */}
                        {showInitialOrgs && (
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg sm:text-xl font-fraunces font-light text-white">All organizations</h2>
                                    <span className="text-xs text-seafoam px-2.5 py-1 bg-seafoam/10 border border-seafoam/20 rounded-full">{initialOrgs.length}</span>
                                </div>
                                {initialOrgs.length === 0 ? (
                                    <div className="bg-white/5 backdrop-blur-xl p-12 rounded-2xl text-center border border-white/10">
                                        <Building2 className="w-10 h-10 text-white/20 mx-auto mb-4" />
                                        <p className="text-sm text-white/50">No public organizations available yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {initialOrgs.map((org) => (
                                            <OrgRow
                                                key={org.id}
                                                org={org}
                                                pinCount={claimsByOrg.get(org.slug)?.length ?? 0}
                                                onEnter={() => focusOrg(org)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// Components
// ============================================

function ResultSection({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <Icon className="w-3.5 h-3.5 text-seafoam" />
                <h2 className="text-xs font-semibold text-seafoam uppercase tracking-[0.15em]">{title}</h2>
                <span className="text-xs text-white/40">{count}</span>
            </div>
            <div className="space-y-1.5">{children}</div>
        </div>
    )
}

function RowLogo({ url, fallback }: { url?: string; fallback: React.ReactNode }) {
    return (
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white border border-white/10">
            {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : fallback}
        </div>
    )
}

function OrgRow({ org, pinCount, onEnter }: {
    org: PublicOrganization
    pinCount: number
    onEnter: () => void
}) {
    const accent = org.brand_color || '#97C7CB'
    return (
        <Link
            to={`/org/${org.slug}`}
            onMouseEnter={onEnter}
            className="group relative flex items-center gap-3.5 p-3.5 rounded-2xl border border-transparent hover:border-white/10 hover:bg-white/5 transition-all"
        >
            {/* Brand accent edge, lights up on hover */}
            <span
                className="absolute left-0 top-1/2 -translate-y-1/2 h-0 group-hover:h-3/5 w-[3px] rounded-full transition-all duration-300"
                style={{ backgroundColor: accent }}
            />
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden border border-white/10 bg-white">
                {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover" />
                ) : (
                    <Building2 className="w-5 h-5" style={{ color: accent }} />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white group-hover:text-seafoam transition-colors truncate text-sm sm:text-base">{org.name}</h3>
                {org.description && <p className="text-xs text-white/50 line-clamp-1 mt-0.5">{org.description}</p>}
            </div>
            {pinCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-seafoam/80 px-2 py-0.5 rounded-full bg-seafoam/10 border border-seafoam/20 flex-shrink-0">
                    <MapPin className="w-3 h-3" />
                    {pinCount}
                </span>
            )}
            <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-seafoam group-hover:translate-x-1 transition-all flex-shrink-0" />
        </Link>
    )
}
