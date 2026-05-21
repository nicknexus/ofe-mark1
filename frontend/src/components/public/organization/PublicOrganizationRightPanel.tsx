import React from 'react'
import { Link } from 'react-router-dom'
import {
    BarChart3,
    ChevronLeft,
    ChevronRight,
    FileText,
    Image,
    MapPin,
    Target,
    TrendingUp,
    ArrowUpRight,
} from 'lucide-react'
import type {
    PublicEvidence,
    PublicInitiative,
    PublicKPI,
    PublicOrganization,
    PublicMetricTag,
} from '../../../services/publicApi'
import PublicTagChip from '../PublicTagChip'
import { formatAbbreviatedMetricTotal, formatDate } from '../../../utils'
import { generateMetricSlug } from '../initiative/metricColors'

/** Flattened claim row assembled on the org page — keep loose for parity. */
export type OrgImpactClaimCard = Record<string, any>

type Props = {
    slug: string
    orgLinkBase: string
    brandColor: string
    organization: PublicOrganization
    filteredInitiatives: PublicInitiative[]
    heroInitiativePage: number
    setHeroInitiativePage: React.Dispatch<React.SetStateAction<number>>
    filteredMetrics: PublicKPI[]
    keyMetricsScrollRef: React.RefObject<HTMLDivElement | null>
    keyMetricsRowPx: number | null
    allImpactClaims: OrgImpactClaimCard[]
    tagsById: Map<string, PublicMetricTag>
    selectedTagIds: string[]
    setSelectedTagIds: React.Dispatch<React.SetStateAction<string[]>>
    filteredEvidence: PublicEvidence[]
    evidencePage: number
    setEvidencePage: React.Dispatch<React.SetStateAction<number>>
    totalEvidencePages: number
    displayedEvidence: PublicEvidence[]
}

export function PublicOrganizationRightPanel(props: Props) {
    const {
        slug,
        orgLinkBase,
        brandColor,
        organization,
        filteredInitiatives,
        heroInitiativePage,
        setHeroInitiativePage,
        filteredMetrics,
        keyMetricsScrollRef,
        keyMetricsRowPx,
        allImpactClaims,
        tagsById,
        selectedTagIds,
        setSelectedTagIds,
        filteredEvidence,
        evidencePage,
        setEvidencePage,
        totalEvidencePages,
        displayedEvidence,
    } = props
    return (
                <div className="flex-1 pt-0 pb-2 md:pb-4 px-2 md:pr-4 md:pl-2 flex flex-col gap-2 md:gap-3 overflow-y-auto md:overflow-hidden">
                    {/* Mobile-only Initiatives section (placed below feature area).
                        Mirrors the desktop hero initiatives container but lives here so on
                        mobile it appears AFTER the toggle tabs + active feature view, per
                        product requirement. Hidden on md+. */}
                    <div className="md:hidden flex flex-col flex-shrink-0">
                        <div className="px-2 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                >
                                    <Target
                                        className="w-3.5 h-3.5"
                                        style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                    />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm">Initiatives</h2>
                                <span
                                    className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                    style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                >{filteredInitiatives.length}</span>
                            </div>
                            {filteredInitiatives.length > 4 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setHeroInitiativePage(p => Math.max(0, p - 1))}
                                        disabled={heroInitiativePage === 0}
                                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <span className="text-xs text-muted-foreground w-10 text-center">
                                        {heroInitiativePage + 1}/{Math.ceil(filteredInitiatives.length / 4)}
                                    </span>
                                    <button
                                        onClick={() => setHeroInitiativePage(p => Math.min(Math.ceil(filteredInitiatives.length / 4) - 1, p + 1))}
                                        disabled={heroInitiativePage >= Math.ceil(filteredInitiatives.length / 4) - 1}
                                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="px-2 pb-2">
                            <div className="grid grid-cols-2 gap-2">
                                {filteredInitiatives.slice(heroInitiativePage * 4, heroInitiativePage * 4 + 4).map((init) => (
                                    <Link
                                        key={init.id}
                                        to={`${orgLinkBase}/${slug}/${init.slug}`}
                                        className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 group flex flex-col justify-center min-h-[64px]"
                                    >
                                        <h4 className="font-medium text-foreground text-sm line-clamp-2 group-hover:text-accent transition-colors">{init.title}</h4>
                                        {init.region && (
                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                <MapPin className="w-2.5 h-2.5" />{init.region}
                                            </p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Top Row - Metrics + Impact Claims (larger) */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:h-[68%]">
                        {/* Key Metrics (Scrollable 2x2 Grid)
                            Mobile: tall enough to fit a full 2x2 of cards
                            comfortably with the same square-ish proportions as
                            desktop. Desktop sizing (`md:*`) untouched. */}
                        <div className="w-full md:w-[62%] overflow-hidden flex flex-col max-h-[440px] md:max-h-none md:min-h-0">
                            <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                    >
                                        <BarChart3
                                            className="w-3.5 h-3.5 md:w-4 md:h-4"
                                            style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                        />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-sm md:text-base">Key Metrics</h2>
                                    <span
                                        className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                        style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                    >{filteredMetrics.length}</span>
                                </div>
                            </div>
                            <div
                                ref={keyMetricsScrollRef as React.RefObject<HTMLDivElement>}
                                className="flex-1 px-2 md:px-3 pb-2 overflow-y-auto min-h-0 scrollbar-thin"
                            >
                                {filteredMetrics.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No metrics yet</p>
                                        </div>
                                    </div>
                                ) : (
                                    // Mobile: fixed `auto-rows: minmax(160px, 1fr)`
                                    // so cards never stretch into elongated
                                    // rectangles when fewer than 4 metrics
                                    // exist. Desktop (`md:`) keeps the original
                                    // 50%-of-height behaviour to fill the panel.
                                    <div
                                        className="grid grid-cols-2 gap-2 h-full [grid-auto-rows:minmax(160px,1fr)] md:[grid-auto-rows:calc(50%-4px)]"
                                    >
                                        {filteredMetrics.map((metric) => {
                                            const isPct = metric.metric_type === 'percentage'
                                            const unit = metric.unit_of_measurement?.trim()
                                            const hasTarget = metric.target_value != null && metric.total_value != null
                                            const subLabel = isPct ? 'average' : unit
                                            return (
                                                <Link
                                                    key={metric.id}
                                                    to={`${orgLinkBase}/${slug}/${metric.initiative_slug}/metric/${generateMetricSlug(metric.title)}`}
                                                    className="group relative h-full min-h-0 rounded-xl border border-gray-200/80 bg-white shadow-surface hover:shadow-surface-hover hover:border-gray-300/90 hover:-translate-y-px transition-all duration-200 flex flex-col overflow-hidden"
                                                >
                                                    <span
                                                        className="absolute top-0 left-0 right-0 h-[3px] pointer-events-none z-[1]"
                                                        style={{ backgroundColor: brandColor, opacity: 0.85 }}
                                                        aria-hidden
                                                    />
                                                    <ArrowUpRight
                                                        className="absolute top-2.5 right-2.5 w-3.5 h-3.5 z-[1] text-gray-300 group-hover:text-gray-500 transition-colors"
                                                        aria-hidden
                                                    />

                                                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-2 pt-5 pb-2 gap-1 overflow-hidden">
                                                        <span
                                                            className="font-bold leading-none tabular-nums tracking-tight text-3xl sm:text-4xl md:text-2xl lg:text-3xl xl:text-4xl 2xl:text-6xl"
                                                            style={{ color: brandColor, filter: 'saturate(1.1) brightness(0.78)' }}
                                                        >
                                                            {formatAbbreviatedMetricTotal(metric.total_value, { isPercentage: isPct })}{isPct ? '%' : ''}
                                                        </span>
                                                        {subLabel && (
                                                            <span className="text-[10px] md:text-[11px] font-semibold text-gray-400 line-clamp-1">{subLabel}</span>
                                                        )}
                                                    </div>

                                                    {hasTarget && (
                                                        <div className="px-3 pb-2">
                                                            <div className="h-1 rounded-full bg-black/5 overflow-hidden">
                                                                <div
                                                                    className="h-full rounded-full"
                                                                    style={{
                                                                        width: `${Math.min(100, ((metric.total_value as number) / (metric.target_value as number)) * 100).toFixed(1)}%`,
                                                                        backgroundColor: brandColor,
                                                                        opacity: 0.55,
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div
                                                        className="border-t px-2 h-10 flex items-center justify-center text-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                                        style={{
                                                            background: `linear-gradient(180deg, ${brandColor}14 0%, ${brandColor}26 100%)`,
                                                            borderColor: `${brandColor}38`,
                                                        }}
                                                    >
                                                        <p className="text-xs md:text-sm font-semibold text-foreground/90 leading-snug line-clamp-2">
                                                            {metric.title}
                                                        </p>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Impact Claims Container (Scrollable) */}
                        <div className="w-full md:w-[38%] overflow-hidden md:overflow-visible flex flex-col max-h-[280px] md:max-h-none md:min-h-0">
                            <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                                        style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                    >
                                        <TrendingUp
                                            className="w-3.5 h-3.5 md:w-4 md:h-4"
                                            style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                        />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-sm md:text-base">Impact Claims</h2>
                                    <span
                                        className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                        style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                    >{allImpactClaims.length}</span>
                                </div>
                            </div>
                            <div className="flex-1 px-2 md:px-3 pb-2 overflow-y-auto min-h-0 scrollbar-thin">
                                {allImpactClaims.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No impact claims yet</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {allImpactClaims.map((claim, idx) => (
                                            <Link
                                                key={`${claim.id}-${idx}`}
                                                to={`${orgLinkBase}/${slug}/${claim.initiativeSlug}/claim/${claim.id}?from=org`}
                                                className="block p-2.5 rounded-xl bg-white border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-xl md:text-2xl font-bold tabular-nums tracking-tight leading-none"
                                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                                            >{claim.value?.toLocaleString()}{claim.metricType === 'percentage' ? '%' : ''}</span>
                                                            {claim.metricType !== 'percentage' && <span className="text-sm text-muted-foreground">{claim.metricUnit}</span>}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground truncate mt-0.5">{claim.metricTitle}</p>
                                                        <p className="text-sm text-muted-foreground/70 truncate">{claim.initiativeTitle}</p>
                                                        {claim.tag_id && tagsById.get(claim.tag_id) && (
                                                            <div className="mt-1 flex">
                                                                <PublicTagChip
                                                                    name={tagsById.get(claim.tag_id)!.name}
                                                                    size="sm"
                                                                    onClick={() => setSelectedTagIds(prev => prev.includes(claim.tag_id!) ? prev.filter(x => x !== claim.tag_id!) : [...prev, claim.tag_id!])}
                                                                    selected={selectedTagIds.includes(claim.tag_id)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <span className={`px-2 py-0.5 text-sm font-semibold rounded-full ${claim.category === 'impact' ? 'bg-purple-100/80 text-purple-700' :
                                                                claim.category === 'output' ? 'bg-green-100/80 text-green-700' : 'bg-blue-100/80 text-blue-700'
                                                            }`}>{claim.category}</span>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {formatDate(claim.date_represented)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row - Evidence (with pagination) */}
                    <div className="min-h-[160px] md:h-[30%] flex flex-col">
                        <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                >
                                    <Image
                                        className="w-3.5 h-3.5 md:w-4 md:h-4"
                                        style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                    />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm md:text-base">Evidence</h2>
                                <span
                                    className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                    style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                >{filteredEvidence.length}</span>
                            </div>
                            {totalEvidencePages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setEvidencePage(p => Math.max(0, p - 1))}
                                        disabled={evidencePage === 0}
                                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <span className="text-xs text-muted-foreground w-10 text-center">{evidencePage + 1}/{totalEvidencePages}</span>
                                    <button
                                        onClick={() => setEvidencePage(p => Math.min(totalEvidencePages - 1, p + 1))}
                                        disabled={evidencePage >= totalEvidencePages - 1}
                                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 px-2 md:px-3 pb-2 min-h-0">
                            {filteredEvidence.length === 0 ? (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <Image className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No evidence yet</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 h-full">
                                    {displayedEvidence.map((ev) => {
                                        const isImage = ev.file_url && /\.(jpg|jpeg|png|gif|webp)$/i.test(ev.file_url)
                                        const isVid = ev.file_url && /\.(mp4|webm|mov|avi|mkv)$/i.test(ev.file_url)
                                        const isYT = ev.file_url && /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(ev.file_url)
                                        const ytMatch = isYT && ev.file_url ? ev.file_url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) : null
                                        const ytId = ytMatch ? ytMatch[1] : null
                                        return (
                                            <Link
                                                key={ev.id}
                                                to={`${orgLinkBase}/${slug}/${ev.initiative_slug}?tab=evidence`}
                                                className="rounded-xl overflow-hidden bg-white border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 group h-[120px] md:h-full"
                                            >
                                                {isImage ? (
                                                    <img src={ev.file_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                ) : isVid ? (
                                                    <div className="relative w-full h-full">
                                                        <video src={ev.file_url} className="w-full h-full object-cover" muted preload="metadata" />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="w-8 h-8 md:w-10 md:h-10 bg-black/60 rounded-full flex items-center justify-center shadow-lg">
                                                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : ytId ? (
                                                    <div className="relative w-full h-full">
                                                        <img src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                            <div className="w-8 h-8 md:w-10 md:h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                                <svg className="w-3.5 h-3.5 md:w-4 md:h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="w-full h-full flex flex-col items-center justify-center gap-1 md:gap-2 group-hover:scale-105 transition-transform duration-500"
                                                        style={{ backgroundColor: organization?.brand_color ? `${organization.brand_color}20` : 'rgba(100,100,100,0.1)' }}
                                                    >
                                                        <div
                                                            className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center"
                                                            style={{ backgroundColor: organization?.brand_color || '#6b7280' }}
                                                        >
                                                            <FileText className="w-4 h-4 md:w-6 md:h-6 text-white" />
                                                        </div>
                                                        <span className="text-xs font-medium text-muted-foreground px-1 md:px-2 text-center line-clamp-1 md:line-clamp-2">{ev.title || 'Document'}</span>
                                                    </div>
                                                )}
                                            </Link>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
    )
}
