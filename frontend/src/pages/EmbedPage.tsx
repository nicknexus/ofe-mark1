import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react'
import {
    publicApi,
    PublicOrganization,
    PublicKPI,
    PublicStory,
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

// Synthesise a "stat card" for padding when an org has fewer than 4 metrics with totals.
type StatCard = {
    id: string
    value: string
    label: string
}

function metricToCard(m: PublicKPI): StatCard {
    return {
        id: m.id,
        value: m.metric_type === 'percentage'
            ? `${Math.round(m.total_value || 0)}%`
            : formatBig(m.total_value || 0),
        label: m.unit_of_measurement || m.title,
    }
}

export default function EmbedPage() {
    const { slug } = useParams<{ slug: string }>()

    const [org, setOrg] = useState<PublicOrganization | null>(null)
    const [stats, setStats] = useState<OrganizationStats | null>(null)
    const [metrics, setMetrics] = useState<PublicKPI[]>([])
    const [stories, setStories] = useState<PublicStory[]>([])
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
                const [orgRes, mets, sts] = await Promise.all([
                    publicApi.getOrganization(slug!),
                    publicApi.getOrganizationMetrics(slug!),
                    publicApi.getOrganizationStories(slug!, 6).catch(() => [] as PublicStory[]),
                ])
                if (cancelled) return
                setOrg(orgRes.organization)
                setStats(orgRes.stats)
                setMetrics(mets)
                setStories(sts)
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
    }, [slug, loading, metrics.length, stories.length])

    // ── Build exactly 4 hero stat cards. Real metrics first, padded with org stats. ──
    const heroCards = useMemo<StatCard[]>(() => {
        const real = [...metrics]
            .filter(m => (m.total_value || 0) > 0)
            .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
            .slice(0, 4)
            .map(metricToCard)

        if (real.length >= 4 || !stats) return real

        const padding: StatCard[] = []
        if (stats.initiatives > 0) padding.push({ id: 'pad-init', value: String(stats.initiatives), label: stats.initiatives === 1 ? 'Initiative' : 'Initiatives' })
        if (stats.locations > 0) padding.push({ id: 'pad-loc', value: String(stats.locations), label: stats.locations === 1 ? 'Location' : 'Locations' })
        if (stats.stories > 0) padding.push({ id: 'pad-st', value: String(stats.stories), label: stats.stories === 1 ? 'Story' : 'Stories' })
        if (stats.kpis > 0) padding.push({ id: 'pad-kpi', value: String(stats.kpis), label: stats.kpis === 1 ? 'Metric' : 'Metrics' })

        const out = [...real]
        for (const p of padding) {
            if (out.length >= 4) break
            out.push(p)
        }
        return out
    }, [metrics, stats])

    // ── Pick up to 3 stories with a photo first, then any other recent story. ──
    const featuredStories = useMemo(() => {
        const withPhoto = stories.filter(s => s.media_url && s.media_type === 'photo')
        const others = stories.filter(s => !(s.media_url && s.media_type === 'photo'))
        return [...withPhoto, ...others].slice(0, 3)
    }, [stories])

    const brand = org?.brand_color || '#c0dfa1'
    const brandText = readableOn(brand)
    const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.nexusimpacts.ai'
    const publicUrl = org ? `${siteOrigin}/org/${org.slug}` : '#'

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
            <div ref={rootRef} className="min-h-[320px] flex items-center justify-center p-6 bg-white">
                <div className="w-7 h-7 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
        )
    }

    // Soft brand-tinted background that adapts to the org's brand colour.
    const widgetBg = `linear-gradient(135deg, ${brand}10 0%, ${brand}05 60%, #ffffff 100%)`

    return (
        <div
            ref={rootRef}
            className="text-gray-900 antialiased"
            style={{ background: widgetBg }}
        >
            <div className="w-full px-5 py-5 sm:px-7 sm:py-7">

                {/* ── Top bar: org branding (left) | Nexus Impacts (right) ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <a
                        href={publicUrl}
                        target="_top"
                        rel="noopener"
                        className="flex items-center gap-2.5 group min-w-0"
                    >
                        {org.logo_url ? (
                            <img
                                src={org.logo_url}
                                alt={org.name}
                                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl object-cover bg-white flex-shrink-0"
                            />
                        ) : (
                            <div
                                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-semibold text-base sm:text-lg flex-shrink-0"
                                style={{ backgroundColor: brand, color: brandText }}
                            >
                                {org.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <span className="text-[16px] sm:text-[18px] font-semibold tracking-tight text-gray-900 truncate group-hover:underline">
                            {org.name}
                        </span>
                    </a>

                    <a
                        href="https://nexusimpacts.ai"
                        target="_top"
                        rel="noopener"
                        className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900 transition-colors group flex-shrink-0"
                    >
                        <img
                            src="/Nexuslogo.png"
                            alt=""
                            className="w-7 h-7 object-contain opacity-95 group-hover:opacity-100 transition-opacity"
                        />
                        <span className="text-[17px] sm:text-[19px] font-newsreader font-extralight tracking-tight">
                            Nexus Impacts
                        </span>
                    </a>
                </div>

                {/* ── Body: left intro column | right metrics + stories column ── */}
                <div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-12 gap-6 sm:gap-8">

                    {/* LEFT: headline + description + CTA — vertically centred, content centred */}
                    <div className="md:col-span-4 flex flex-col items-center text-center md:justify-center">
                        <h2 className="text-[28px] sm:text-[34px] leading-[1.05] font-semibold tracking-tight text-gray-900">
                            Real Impact.
                            <br />
                            <span style={{ color: brand, filter: 'saturate(1.15) brightness(0.92)' }}>
                                Real Change.
                            </span>
                            <Heart
                                className="inline-block ml-1.5 align-baseline"
                                style={{ width: 20, height: 20, color: brand, fill: brand, filter: 'saturate(1.15) brightness(0.92)' }}
                            />
                        </h2>

                        {org.statement && (
                            <p className="mt-4 text-[15px] sm:text-[15.5px] leading-relaxed text-gray-600 max-w-[34ch]">
                                {org.statement}
                            </p>
                        )}

                        <a
                            href={publicUrl}
                            target="_top"
                            rel="noopener"
                            className="mt-6 group inline-flex items-center gap-2 rounded-full px-5 py-3 text-[12.5px] font-semibold uppercase tracking-[0.08em] transition-all hover:shadow-lg"
                            style={{
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                boxShadow: `0 6px 20px ${brand}35`,
                            }}
                        >
                            See our full impact
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                        </a>

                        <a
                            href="https://nexusimpacts.ai"
                            target="_top"
                            rel="noopener"
                            className="mt-3 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
                        >
                            Powered by Nexus Impacts
                        </a>
                    </div>

                    {/* RIGHT: 4 metric cards + 3 stories */}
                    <div className="md:col-span-8 flex flex-col gap-5">

                        {/* Metric cards: auto-fits 1–4 columns based on available width. */}
                        {heroCards.length > 0 && (
                            <div
                                className="grid gap-2.5 sm:gap-3"
                                style={{
                                    gridTemplateColumns: `repeat(auto-fit, minmax(120px, 1fr))`,
                                }}
                            >
                                {heroCards.map(c => (
                                    <div
                                        key={c.id}
                                        className="rounded-2xl bg-white border border-gray-100 px-3 py-4 sm:py-5 text-center shadow-sm"
                                    >
                                        <div
                                            className="text-[22px] sm:text-[26px] font-bold leading-none tabular-nums tracking-tight"
                                            style={{ color: '#0f172a' }}
                                        >
                                            {c.value}
                                        </div>
                                        <div className="mt-1.5 text-[11px] sm:text-[12px] leading-tight text-gray-600 line-clamp-3">
                                            {c.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Stories section */}
                        {featuredStories.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2.5">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <Heart
                                            className="flex-shrink-0"
                                            style={{ width: 14, height: 14, color: brand, fill: brand, filter: 'saturate(1.15) brightness(0.92)' }}
                                        />
                                        <span className="text-[13px] sm:text-[14px] font-semibold tracking-tight text-gray-900 truncate">
                                            Real Stories. Real Impact.
                                        </span>
                                    </div>
                                    <a
                                        href={publicUrl}
                                        target="_top"
                                        rel="noopener"
                                        className="inline-flex items-center gap-1 text-[10.5px] sm:text-[11px] uppercase tracking-[0.08em] font-semibold whitespace-nowrap transition-colors"
                                        style={{ color: brand, filter: 'saturate(1.15) brightness(0.85)' }}
                                    >
                                        View all stories
                                        <ArrowRight className="w-3 h-3" />
                                    </a>
                                </div>

                                <div className={`grid gap-2.5 sm:gap-3 ${
                                    featuredStories.length === 1 ? 'grid-cols-1' :
                                    featuredStories.length === 2 ? 'grid-cols-2' :
                                    'grid-cols-1 sm:grid-cols-3'
                                }`}>
                                    {featuredStories.map(s => (
                                        <a
                                            key={s.id}
                                            href={publicUrl}
                                            target="_top"
                                            rel="noopener"
                                            className="group block rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            {s.media_url && s.media_type === 'photo' ? (
                                                <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                                                    <img
                                                        src={s.media_url}
                                                        alt={s.title}
                                                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className="aspect-[4/3] flex items-center justify-center"
                                                    style={{ background: `linear-gradient(135deg, ${brand}40, ${brand}15)` }}
                                                >
                                                    <Heart
                                                        style={{ width: 28, height: 28, color: brand, fill: brand, filter: 'saturate(1.15) brightness(0.92)' }}
                                                    />
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <div className="text-[12.5px] font-semibold leading-snug text-gray-900 line-clamp-2">
                                                    {s.title}
                                                </div>
                                                {s.description && (
                                                    <div className="mt-1 text-[11.5px] leading-snug text-gray-600 line-clamp-2">
                                                        {s.description}
                                                    </div>
                                                )}
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Bottom transparency strip ── */}
            <div
                className="px-5 py-3.5 sm:px-7 sm:py-4 flex items-center justify-between gap-4 flex-wrap border-t"
                style={{
                    backgroundColor: `${brand}10`,
                    borderColor: `${brand}25`,
                }}
            >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${brand}30` }}
                    >
                        <ShieldCheck
                            className="w-4 h-4"
                            style={{ color: brand, filter: 'saturate(1.15) brightness(0.85)' }}
                        />
                    </div>
                    <div className="min-w-0">
                        <div className="text-[12px] sm:text-[12.5px] font-semibold text-gray-900 leading-tight">
                            Transparency you can trust. Impact you can see.
                        </div>
                        <div className="text-[11px] text-gray-600 leading-tight mt-0.5">
                            All impact data is verified and updated in real time.
                        </div>
                    </div>
                </div>
                <a
                    href="https://nexusimpacts.ai"
                    target="_top"
                    rel="noopener"
                    className="inline-flex items-center gap-1 text-[11px] sm:text-[11.5px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap transition-colors hover:underline"
                    style={{ color: brand, filter: 'saturate(1.15) brightness(0.85)' }}
                >
                    Learn more
                    <ArrowRight className="w-3 h-3" />
                </a>
            </div>
        </div>
    )
}
