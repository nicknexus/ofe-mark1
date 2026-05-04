import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowRight, ShieldCheck, Play } from 'lucide-react'
import {
    publicApi,
    PublicOrganization,
    PublicKPI,
    PublicStory,
} from '../services/publicApi'
import { getVideoThumbnailUrl, parseVideoUrl } from '../utils/videoEmbed'

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
        label: m.title || m.unit_of_measurement || '',
    }
}

// Small "play" overlay that signals a story has video content.
function PlayBadge({ brand }: { brand: string }) {
    return (
        <>
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.35) 100%)' }}
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shadow-md"
                    style={{ backgroundColor: brand, color: readableOn(brand) }}
                >
                    <Play className="w-4 h-4 sm:w-[18px] sm:h-[18px] ml-0.5" fill="currentColor" />
                </div>
            </div>
        </>
    )
}

export default function EmbedPage() {
    const { slug } = useParams<{ slug: string }>()

    const [org, setOrg] = useState<PublicOrganization | null>(null)
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

    // ── Strip the main app's Nexus-green radial backgrounds so only the
    //    org's brand colour shows through (otherwise green bleeds in around
    //    the widget when viewed directly at /embed/<slug>). Also hide any
    //    document-level scrollbars — the parent iframe auto-resizes via
    //    postMessage, so internal scrolling is never needed. ──
    useEffect(() => {
        if (typeof document === 'undefined') return
        const root = document.getElementById('root')
        const html = document.documentElement
        const prevBodyBg = document.body.style.background
        const prevRootBg = root?.style.background ?? ''
        const prevHtmlOverflow = html.style.overflow
        const prevBodyOverflow = document.body.style.overflow
        document.body.style.background = '#ffffff'
        if (root) root.style.background = '#ffffff'
        html.style.overflow = 'hidden'
        document.body.style.overflow = 'hidden'
        return () => {
            document.body.style.background = prevBodyBg
            if (root) root.style.background = prevRootBg
            html.style.overflow = prevHtmlOverflow
            document.body.style.overflow = prevBodyOverflow
        }
    }, [])

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

    // ── Hero stat cards: real metrics only, top 4 by value. No filler stats. ──
    const heroCards = useMemo<StatCard[]>(() => {
        return [...metrics]
            .filter(m => (m.total_value || 0) > 0)
            .sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
            .slice(0, 4)
            .map(metricToCard)
    }, [metrics])

    // Decide what visual to render for a story: a photo, a derived video
    // thumbnail (YouTube), a direct video file (first frame via <video>), or
    // a brand-tinted placeholder when nothing renders.
    type StoryVisual =
        | { kind: 'photo'; url: string }
        | { kind: 'video-thumb'; url: string }
        | { kind: 'video-file'; url: string }
        | { kind: 'placeholder' }

    function getStoryVisual(s: PublicStory): StoryVisual {
        if (s.media_type === 'photo' && s.media_url) {
            return { kind: 'photo', url: s.media_url }
        }
        if (s.media_type === 'video' && s.media_url) {
            const ytThumb = getVideoThumbnailUrl(s.media_url)
            if (ytThumb) return { kind: 'video-thumb', url: ytThumb }
            // If it's a recognised hosted video (e.g. Vimeo) we can't derive a
            // thumbnail without an API call — fall through to placeholder.
            if (parseVideoUrl(s.media_url)) return { kind: 'placeholder' }
            // Otherwise treat it as a direct file URL and render a muted
            // <video> element to show its first frame.
            return { kind: 'video-file', url: s.media_url }
        }
        return { kind: 'placeholder' }
    }

    // ── Pick up to 3 stories with renderable visuals first. ──
    const featuredStories = useMemo(() => {
        const visualKind = (s: PublicStory) => getStoryVisual(s).kind
        const withVisual = stories.filter(s => visualKind(s) !== 'placeholder')
        const others = stories.filter(s => visualKind(s) === 'placeholder')
        return [...withVisual, ...others].slice(0, 3)
    }, [stories])

    const brand = org?.brand_color || '#c0dfa1'
    const brandText = readableOn(brand)
    const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://www.nexusimpacts.ai'
    const publicUrl = org ? `${siteOrigin}/org/${org.slug}` : '#'

    // Per-story deep-link: open the public org page with the stories carousel
    // active and the clicked story focused. The org page reads ?view=stories&
    // story=<id> and pops that story up in the highlight carousel.
    function storyUrl(s: PublicStory): string {
        if (!org) return '#'
        return `${publicUrl}?view=stories&story=${encodeURIComponent(s.id)}`
    }

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
                                    <a
                                        key={c.id}
                                        href={publicUrl}
                                        target="_top"
                                        rel="noopener"
                                        className="group rounded-2xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col"
                                    >
                                        {/* Number section */}
                                        <div className="px-3 py-4 sm:py-5 flex items-center justify-center flex-1">
                                            <span
                                                className="text-[24px] sm:text-[28px] font-bold leading-none tabular-nums tracking-tight"
                                                style={{ color: brand, filter: 'saturate(1.15) brightness(0.85)' }}
                                            >
                                                {c.value}
                                            </span>
                                        </div>
                                        {/* Title section — tinted brand band, fixed height for 2 lines */}
                                        <div
                                            className="px-2.5 text-center border-t flex items-center justify-center"
                                            style={{
                                                backgroundColor: `${brand}15`,
                                                borderColor: `${brand}25`,
                                                minHeight: 50,
                                                height: 50,
                                            }}
                                        >
                                            <span
                                                className="text-[11.5px] sm:text-[12.5px] font-semibold text-gray-800 line-clamp-2"
                                                style={{ lineHeight: 1.25 }}
                                            >
                                                {c.label}
                                            </span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}

                        {/* Stories section */}
                        {featuredStories.length > 0 && (
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="inline-block w-1 h-4 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: brand, filter: 'saturate(1.15) brightness(0.92)' }}
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
                                            href={storyUrl(s)}
                                            target="_top"
                                            rel="noopener"
                                            className="group block rounded-2xl overflow-hidden bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                                        >
                                            {(() => {
                                                const v = getStoryVisual(s)
                                                if (v.kind === 'photo') {
                                                    return (
                                                        <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                                                            <img
                                                                src={v.url}
                                                                alt={s.title}
                                                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                                                loading="lazy"
                                                            />
                                                        </div>
                                                    )
                                                }
                                                if (v.kind === 'video-thumb') {
                                                    return (
                                                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                                                            <img
                                                                src={v.url}
                                                                alt={s.title}
                                                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                                                                loading="lazy"
                                                            />
                                                            <PlayBadge brand={brand} />
                                                        </div>
                                                    )
                                                }
                                                if (v.kind === 'video-file') {
                                                    return (
                                                        <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                                                            <video
                                                                src={`${v.url}#t=0.5`}
                                                                muted
                                                                playsInline
                                                                preload="metadata"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <PlayBadge brand={brand} />
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <div
                                                        className="aspect-[4/3]"
                                                        style={{ background: `linear-gradient(135deg, ${brand}40, ${brand}15)` }}
                                                    />
                                                )
                                            })()}
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
