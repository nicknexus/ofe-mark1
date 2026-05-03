import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'
import {
    publicApi,
    PublicOrganization,
    PublicInitiative,
    PublicKPI,
    PublicLocation,
    OrganizationStats,
} from '../services/publicApi'

// Compact format for big numbers: 1.2K, 3.4M, etc.
function formatBig(n: number): string {
    if (!isFinite(n)) return '0'
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M'
    if (abs >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'K'
    return Math.round(n).toLocaleString()
}

// Pick text colour (white or near-black) for legible contrast on a brand bg.
function readableOn(hex: string): string {
    const h = (hex || '').replace('#', '')
    if (h.length !== 6) return '#111827'
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const toLin = (c: number) => {
        const s = c / 255
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const L = 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b)
    return L > 0.55 ? '#111827' : '#ffffff'
}

export default function EmbedPage() {
    const { slug } = useParams<{ slug: string }>()
    const [searchParams] = useSearchParams()

    // ── Configuration from query params (set by embed.js bootstrapper) ──
    const initiativeCount = Math.min(2, Math.max(1, parseInt(searchParams.get('initiatives') || '1', 10) || 1))
    const metricCount = Math.min(4, Math.max(2, parseInt(searchParams.get('metrics') || '3', 10) || 3))

    const [org, setOrg] = useState<PublicOrganization | null>(null)
    const [stats, setStats] = useState<OrganizationStats | null>(null)
    const [initiatives, setInitiatives] = useState<PublicInitiative[]>([])
    const [metrics, setMetrics] = useState<PublicKPI[]>([])
    const [locations, setLocations] = useState<PublicLocation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const rootRef = useRef<HTMLDivElement>(null)

    // ── Load data ──
    useEffect(() => {
        let cancelled = false
        if (!slug) return

        async function load() {
            try {
                setLoading(true)
                const [orgRes, inits, mets, locs] = await Promise.all([
                    publicApi.getOrganization(slug!),
                    publicApi.getOrganizationInitiatives(slug!),
                    publicApi.getOrganizationMetrics(slug!),
                    publicApi.getOrganizationLocations(slug!).catch(() => [] as PublicLocation[]),
                ])
                if (cancelled) return
                setOrg(orgRes.organization)
                setStats(orgRes.stats)
                setInitiatives(inits)
                setMetrics(mets)
                setLocations(locs)
            } catch (err: any) {
                if (cancelled) return
                setError(err?.message || 'Failed to load')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => {
            cancelled = true
        }
    }, [slug])

    // ── Auto-resize: tell the parent window how tall we are. ──
    useEffect(() => {
        if (typeof window === 'undefined' || window.parent === window) return
        const el = rootRef.current
        if (!el) return

        let last = 0
        const post = () => {
            const h = Math.ceil(el.getBoundingClientRect().height)
            if (h && Math.abs(h - last) > 1) {
                last = h
                window.parent.postMessage({ type: 'nexus:embed:height', slug, height: h }, '*')
            }
        }
        post()
        const ro = new ResizeObserver(post)
        ro.observe(el)
        const onLoad = () => post()
        window.addEventListener('load', onLoad)
        const interval = window.setInterval(post, 1500) // belt-and-suspenders for layout settle
        return () => {
            ro.disconnect()
            window.removeEventListener('load', onLoad)
            window.clearInterval(interval)
        }
    }, [slug, loading, initiatives.length, metrics.length])

    // ── Computed: hero stats (top metrics by total_value, fallback to org stats) ──
    const heroMetrics = useMemo(() => {
        const sorted = [...metrics]
            .filter(m => (m.total_value || 0) > 0)
            .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
            .slice(0, metricCount)
        return sorted
    }, [metrics, metricCount])

    // ── Featured initiatives (most recently created) ──
    const featuredInitiatives = useMemo(() => {
        const sorted = [...initiatives].sort((a, b) => {
            const da = a.created_at ? new Date(a.created_at).getTime() : 0
            const db = b.created_at ? new Date(b.created_at).getTime() : 0
            return db - da
        })
        return sorted.slice(0, initiativeCount)
    }, [initiatives, initiativeCount])

    // For each featured initiative, grab its top 2 metrics
    const initiativeTopMetrics = useMemo(() => {
        const map = new Map<string, PublicKPI[]>()
        for (const init of featuredInitiatives) {
            const top = metrics
                .filter(m => m.initiative_id === init.id && (m.total_value || 0) > 0)
                .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
                .slice(0, 2)
            map.set(init.id, top)
        }
        return map
    }, [featuredInitiatives, metrics])

    const brand = org?.brand_color || '#c0dfa1'
    const brandText = readableOn(brand)
    // CTAs link out to the live public page on whatever origin this embed is being
    // served from (so dev → localhost, prod → www.nexusimpacts.ai, future custom
    // domain → that domain). Always opens at the top of the donor's tab.
    const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.nexusimpacts.ai'
    const publicUrl = org ? `${siteOrigin}/org/${org.slug}` : '#'

    // Derive country count for the locations strip.
    const countryCount = useMemo(() => {
        const set = new Set<string>()
        for (const l of locations) if (l.country) set.add(l.country)
        return set.size
    }, [locations])

    // ── Render ──
    if (error) {
        return (
            <div ref={rootRef} className="min-h-[200px] flex items-center justify-center p-6 bg-white">
                <div className="text-sm text-gray-500">Unable to load this widget.</div>
            </div>
        )
    }

    if (loading || !org) {
        return (
            <div ref={rootRef} className="min-h-[280px] flex items-center justify-center p-6 bg-white">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div ref={rootRef} className="bg-white text-gray-900 antialiased">
            <div className="max-w-[640px] mx-auto p-4 sm:p-5">
                {/* Header */}
                <div className="flex items-center gap-3">
                    {org.logo_url ? (
                        <img
                            src={org.logo_url}
                            alt={org.name}
                            className="w-10 h-10 rounded-lg object-cover bg-gray-50 flex-shrink-0"
                        />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-base flex-shrink-0"
                            style={{ backgroundColor: brand, color: brandText }}
                        >
                            {org.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0">
                        <div className="text-[15px] font-semibold leading-tight truncate">{org.name}</div>
                        {org.statement && (
                            <div className="text-[12px] text-gray-500 leading-snug line-clamp-1 mt-0.5">
                                {org.statement}
                            </div>
                        )}
                    </div>
                </div>

                {/* Brand-coloured underline */}
                <div className="mt-3 h-[3px] rounded-full" style={{ backgroundColor: brand }} />

                {/* Hero stats */}
                {heroMetrics.length > 0 && (
                    <div className={`mt-4 grid gap-2 ${heroMetrics.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {heroMetrics.map(m => (
                            <div
                                key={m.id}
                                className="rounded-xl px-3 py-3 border border-gray-100 bg-gray-50/60"
                            >
                                <div className="text-[20px] font-bold leading-none tabular-nums" style={{ color: brand, filter: 'saturate(1.2) brightness(0.85)' }}>
                                    {m.metric_type === 'percentage'
                                        ? `${Math.round(m.total_value || 0)}%`
                                        : formatBig(m.total_value || 0)}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-600 leading-tight line-clamp-2">
                                    {m.unit_of_measurement || m.title}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Initiatives */}
                {featuredInitiatives.length > 0 && (
                    <div className="mt-4 space-y-2.5">
                        {featuredInitiatives.map(init => {
                            const top = initiativeTopMetrics.get(init.id) || []
                            return (
                                <a
                                    key={init.id}
                                    href={`${siteOrigin}/org/${org.slug}/${init.slug}`}
                                    target="_top"
                                    rel="noopener"
                                    className="block group rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-colors overflow-hidden"
                                >
                                    <div className="flex">
                                        {/* Brand strip */}
                                        <div className="w-1.5 flex-shrink-0" style={{ backgroundColor: brand }} />
                                        <div className="p-3 flex-1 min-w-0">
                                            <div className="flex items-start gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-[13px] font-semibold leading-snug truncate">
                                                        {init.title}
                                                    </div>
                                                    {init.description && (
                                                        <div className="mt-0.5 text-[11.5px] text-gray-500 leading-snug line-clamp-2">
                                                            {init.description}
                                                        </div>
                                                    )}
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0 mt-0.5" />
                                            </div>
                                            {top.length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1.5">
                                                    {top.map(m => (
                                                        <span
                                                            key={m.id}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                                                            style={{ backgroundColor: `${brand}25`, color: '#1f2937' }}
                                                        >
                                                            <span className="font-semibold tabular-nums" style={{ color: brand, filter: 'saturate(1.2) brightness(0.7)' }}>
                                                                {m.metric_type === 'percentage'
                                                                    ? `${Math.round(m.total_value || 0)}%`
                                                                    : formatBig(m.total_value || 0)}
                                                            </span>
                                                            <span className="text-gray-700">{m.unit_of_measurement || m.title}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </a>
                            )
                        })}
                    </div>
                )}

                {/* Locations summary */}
                {locations.length > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-[11.5px] text-gray-500">
                        <MapPin className="w-3.5 h-3.5" style={{ color: brand }} />
                        <span>
                            Active in {locations.length} location{locations.length === 1 ? '' : 's'}
                            {countryCount > 1 ? ` across ${countryCount} countries` : ''}
                        </span>
                    </div>
                )}

                {/* CTA */}
                <a
                    href={publicUrl}
                    target="_top"
                    rel="noopener"
                    className="mt-4 group inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all hover:shadow-md"
                    style={{
                        backgroundColor: brand,
                        color: brandText,
                        boxShadow: `0 1px 0 ${brand}, 0 4px 12px ${brand}30`,
                    }}
                >
                    View full impact
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </a>

                {/* Nexus Impacts attribution — wordmark with logo, with a hairline divider */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-center">
                    <a
                        href="https://nexusimpacts.ai"
                        target="_top"
                        rel="noopener"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors group"
                    >
                        <span className="text-[10px] uppercase tracking-[0.08em] text-gray-400">Powered by</span>
                        <img
                            src="/Nexuslogo.png"
                            alt=""
                            className="w-5 h-5 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="text-[14px] font-newsreader font-extralight tracking-tight">
                            Nexus Impacts
                        </span>
                    </a>
                </div>

                {/* Debug-only stats fallback when no metric totals are available */}
                {heroMetrics.length === 0 && stats && (
                    <div className="hidden">
                        {/* Reserved for future fallback hero. */}
                        {stats.kpis} {stats.locations} {stats.stories} {stats.initiatives}
                    </div>
                )}
            </div>
        </div>
    )
}
