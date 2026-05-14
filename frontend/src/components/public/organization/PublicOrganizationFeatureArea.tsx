import React, { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Compass,
    FileText,
    Globe,
    LineChart,
    MapPin,
    Target,
} from 'lucide-react'
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts'
import type {
    PublicInitiative,
    PublicKPI,
    PublicOrganization,
    PublicStatCard,
    PublicStory,
    PublicLocation,
} from '../../../services/publicApi'
import { OrganizationGlobeErrorBoundary } from './OrganizationGlobeErrorBoundary'
import { CHART_COLORS } from './organizationChartColors'
import type { OrganizationFeatureView } from './organizationTypes'

const ImpactGlobe = lazy(() => import('../../landing/ImpactGlobe'))

export type OrgLocationPopup = {
    id: string
    name: string
    country?: string
    initiative_slug?: string
    top: number
    left: number
    rightAnchored: boolean
}

type Props = {
    activeView: OrganizationFeatureView
    brandColor: string
    slug: string
    orgLinkBase: string
    filteredLocations: PublicLocation[]
    globeLocations: { lat: number; lng: number; name: string }[]
    activePopups: OrgLocationPopup[]
    filteredStories: PublicStory[]
    storyIndex: number
    setStoryIndex: React.Dispatch<React.SetStateAction<number>>
    currentStory: PublicStory | undefined
    highlightCards: PublicStatCard[]
    filteredInitiatives: PublicInitiative[]
    organization: PublicOrganization
    initiativeChartData: any[]
    chartInitiatives: { metric: PublicKPI; initiative: PublicInitiative }[]
}

export function PublicOrganizationFeatureArea(props: Props) {
    const {
        activeView,
        brandColor,
        slug,
        orgLinkBase,
        filteredLocations,
        globeLocations,
        activePopups,
        filteredStories,
        storyIndex,
        setStoryIndex,
        currentStory,
        highlightCards,
        filteredInitiatives,
        organization,
        initiativeChartData,
        chartInitiatives,
    } = props
    return (
        <div className={`w-full md:w-[45%] flex-shrink-0 pt-0 pb-2 md:pb-4 px-2 md:px-0 md:pr-2 ${activeView === 'graph' ? 'h-[72vh]' : 'h-[50vh]'} md:h-auto`}>
                    <div className="h-full overflow-hidden relative">
                        {/* Globe View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'globe'
                                ? 'opacity-100 translate-x-0 z-10'
                                : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            <Globe
                                                className="w-4 h-4"
                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                            />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Global Impact</h2>
                                    </div>
                                    <span
                                        className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                        style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                    >
                                        {filteredLocations.length} locations
                                    </span>
                                </div>
                                <div className="flex-1 relative overflow-hidden">
                                    {/* Mount the globe only when its view is active. The
                                        component is heavy (Three.js scene + animation
                                        loop) so leaving it mounted in the background
                                        burns CPU/GPU even when invisible. */}
                                    {activeView === 'globe' ? (
                                        <OrganizationGlobeErrorBoundary>
                                            <Suspense fallback={
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-accent/60 to-accent/30 animate-pulse" />
                                                </div>
                                            }>
                                                <ImpactGlobe
                                                    locations={globeLocations}
                                                    showLabels={false}
                                                    brandColor={brandColor}
                                                    enableZoom={true}
                                                />
                                            </Suspense>
                                        </OrganizationGlobeErrorBoundary>
                                    ) : (
                                        <div className="w-full h-full" />
                                    )}

                                    {/* Location Popups.
                                        whitespace-nowrap + truncate + max-w cap keeps each
                                        popup as a single-line pill regardless of name length.
                                        Right-band popups anchor with `right` instead of `left`
                                        so long labels never bleed off the screen edge. */}
                                    {activePopups.map(popup => {
                                        const label = `${popup.name}${popup.country ? `, ${popup.country}` : ''}`
                                        const inner = (
                                            <>
                                                <MapPin className="w-3 h-3 mr-1 inline-block flex-shrink-0" />
                                                <span className="truncate">{label}</span>
                                            </>
                                        )
                                        const style: React.CSSProperties = popup.rightAnchored
                                            ? {
                                                top: `${popup.top}%`,
                                                right: `${popup.left}%`,
                                                backgroundColor: brandColor,
                                                animation: 'fadeInOut 7s ease-in-out forwards',
                                            }
                                            : {
                                            top: `${popup.top}%`,
                                            left: `${popup.left}%`,
                                            backgroundColor: brandColor,
                                            animation: 'fadeInOut 7s ease-in-out forwards',
                                        }
                                        const className = "absolute px-2 py-0.5 md:px-3 md:py-1.5 rounded-full text-white text-xs font-medium shadow-lg transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-xl whitespace-nowrap max-w-[45%] md:max-w-[40%] flex items-center"

                                        return popup.initiative_slug ? (
                                            <Link
                                                key={popup.id}
                                                to={`${orgLinkBase}/${slug}/${popup.initiative_slug}?tab=locations`}
                                                className={className + " cursor-pointer"}
                                                style={style}
                                            >
                                                {inner}
                                            </Link>
                                        ) : (
                                            <div key={popup.id} className={className + " pointer-events-none"} style={style}>
                                                {inner}
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Stories View - Single Story Carousel */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'stories'
                                ? 'opacity-100 translate-x-0 z-10'
                                : activeView === 'globe'
                                    ? 'opacity-0 translate-x-8 z-0 pointer-events-none'
                                    : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            <BookOpen
                                                className="w-4 h-4"
                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                            />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Stories</h2>
                                        <span
                                            className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                        >{filteredStories.length}</span>
                                    </div>
                                    {filteredStories.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setStoryIndex(p => p === 0 ? filteredStories.length - 1 : p - 1)}
                                                className="w-8 h-8 md:w-6 md:h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-muted-foreground w-12 text-center">{storyIndex + 1}/{filteredStories.length}</span>
                                            <button
                                                onClick={() => setStoryIndex(p => (p + 1) % filteredStories.length)}
                                                className="w-8 h-8 md:w-6 md:h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 p-4 pt-0 overflow-hidden flex flex-col">
                                    {!currentStory ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p>No stories yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <Link
                                            to={`${orgLinkBase}/${slug}/${currentStory.initiative_slug}?tab=stories`}
                                            className="flex-1 rounded-2xl overflow-hidden hover:shadow-lg transition-all group relative"
                                        >
                                            {(() => {
                                                const url = currentStory.media_url
                                                if (url && /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url)) {
                                                    const ytId = (url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]
                                                    return (
                                                        <div className="relative w-full h-full">
                                                            <img
                                                                src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                                                                alt={currentStory.title}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                                                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                if (url && currentStory.media_type === 'photo') {
                                                    return (
                                                        <img
                                                            src={url}
                                                            alt={currentStory.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        />
                                                    )
                                                }
                                                if (url && currentStory.media_type === 'video') {
                                                    // Self-uploaded video: render a muted <video> with preload=metadata
                                                    // so the browser paints the first frame as a thumbnail. Click is
                                                    // captured by the parent <Link>; overlay stays pointer-events:none.
                                                    return (
                                                        <div className="relative w-full h-full bg-black">
                                                            <video
                                                                src={`${url}#t=0.5`}
                                                                muted
                                                                playsInline
                                                                preload="metadata"
                                                                className="w-full h-full object-cover"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                                <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
                                                                    <svg className="w-5 h-5 text-gray-900 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                }
                                                return (
                                                    <div className="w-full h-full flex items-center justify-center bg-white/40">
                                                        <FileText className="w-16 h-16 text-gray-300" />
                                                    </div>
                                                )
                                            })()}
                                            {/* Overlay with title */}
                                            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent">
                                                <span className="text-xs font-medium text-white/80 mb-1 block">{currentStory.initiative_title}</span>
                                                <h3 className="text-lg font-bold text-white">{currentStory.title}</h3>
                                            </div>
                                        </Link>
                                    )}

                                    {/* Story Progress Dots */}
                                    {filteredStories.length > 1 && (
                                        <div className="flex justify-center gap-2 mt-3 flex-shrink-0">
                                            {filteredStories.slice(0, 10).map((_, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setStoryIndex(idx)}
                                                    className={`h-2 rounded-full transition-all ${idx === storyIndex ? 'w-6 bg-gray-800' : 'w-2 bg-gray-300 hover:bg-gray-400'
                                                        }`}
                                                />
                                            ))}
                                            {filteredStories.length > 10 && (
                                                <span className="text-xs text-muted-foreground ml-1">+{filteredStories.length - 10}</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Highlights View - First 2 Stats/Statements from Context */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'highlights'
                                ? 'opacity-100 translate-x-0 z-10'
                                : activeView === 'globe' || activeView === 'stories'
                                    ? 'opacity-0 translate-x-8 z-0 pointer-events-none'
                                    : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            <Compass
                                                className="w-4 h-4"
                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                            />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Context & Challenges</h2>
                                    </div>
                                    <Link
                                        to={`${orgLinkBase}/${slug}/context`}
                                        className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1"
                                    >
                                        View all <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>
                                {/* Mobile: vertical stack with auto height + scroll if needed.
                                    Desktop: original 2-row grid kept unchanged. */}
                                <div className="flex-1 px-4 pb-4 pt-0 overflow-y-auto md:overflow-visible">
                                    {highlightCards.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Compass className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p>No context yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className={`flex flex-col gap-3 md:h-full md:grid ${highlightCards.length === 1 ? 'md:grid-rows-1' : 'md:grid-rows-2'}`}>
                                            {highlightCards.map((card, idx) => {
                                                const isStat = card.type === 'stat'
                                                const title = (card.title || '').trim()
                                                const description = (card.description || '').trim()
                                                const value = (card.value || '').trim()
                                                return (
                                                    <Link
                                                        key={card.id || idx}
                                                        to={`${orgLinkBase}/${slug}/context`}
                                                        className="group relative rounded-2xl bg-white border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 p-4 flex flex-col overflow-hidden md:min-h-0"
                                                    >
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1"
                                                            style={{ backgroundColor: brandColor }}
                                                        />
                                                        <div className="flex items-center gap-2 mb-2 pl-1">
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider text-gray-800"
                                                                style={{ backgroundColor: `${brandColor}30` }}
                                                            >
                                                                {isStat ? 'Stat' : 'Statement'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-h-0 pl-1 overflow-hidden">
                                                            {isStat ? (
                                                                <div className="flex flex-col h-full">
                                                                    <div
                                                                        className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight mb-1 break-words"
                                                                        style={{ color: brandColor, filter: 'saturate(1.2) brightness(0.8)' }}
                                                                    >
                                                                        {value}
                                                                    </div>
                                                                    {title && (
                                                                        <h3 className="text-sm font-semibold text-foreground line-clamp-2 md:line-clamp-1">
                                                                            {title}
                                                                        </h3>
                                                                    )}
                                                                    {description && (
                                                                        <p className="text-xs text-muted-foreground line-clamp-3 md:line-clamp-2 mt-1">
                                                                            {description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col h-full">
                                                                    {title && (
                                                                        <h3 className="text-base md:text-lg font-bold text-foreground leading-snug line-clamp-3 md:line-clamp-2">
                                                                            {title}
                                                                        </h3>
                                                                    )}
                                                                    {description && (
                                                                        <p className="text-xs text-muted-foreground line-clamp-3 md:line-clamp-2 mt-1">
                                                                            {description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="pl-1 mt-2 flex items-center justify-between">
                                                            <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors">
                                                                Read more
                                                            </span>
                                                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-800 transition-colors" />
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Initiatives View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'initiatives'
                                ? 'opacity-100 translate-x-0 z-10'
                                : 'opacity-0 translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            <Target
                                                className="w-4 h-4"
                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                            />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Initiatives</h2>
                                        <span
                                            className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                        >{filteredInitiatives.length}</span>
                                    </div>
                                </div>
                                <div className="flex-1 p-4 overflow-y-auto">
                                    {filteredInitiatives.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p>No initiatives match filters</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredInitiatives.map((init) => (
                                                <Link
                                                    key={init.id}
                                                    to={`${orgLinkBase}/${slug}/${init.slug}`}
                                                    className="block p-4 bg-white rounded-xl border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 group"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-gray-50 border border-gray-100">
                                                            {organization.logo_url ? (
                                                                <img src={organization.logo_url} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <Target className="w-5 h-5 text-gray-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-foreground text-sm group-hover:text-accent transition-colors">{init.title}</h3>
                                                            {init.region && (
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                                    <MapPin className="w-3 h-3" />{init.region}
                                                                </p>
                                                            )}
                                                            {init.description && (
                                                                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{init.description}</p>
                                                            )}
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Graph View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'graph'
                                ? 'opacity-100 translate-x-0 z-10'
                                : 'opacity-0 translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            <LineChart
                                                className="w-4 h-4"
                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                            />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Cumulative Impact</h2>
                                    </div>
                                </div>
                                <div className="flex-1 p-4 pt-0 overflow-hidden flex flex-col">
                                        {initiativeChartData.length === 0 ? (
                                            <div className="h-full flex items-center justify-center text-muted-foreground">
                                                <div className="text-center">
                                                    <LineChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                    <p>No data available yet</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-h-0">
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <AreaChart data={initiativeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                                            <defs>
                                                                {chartInitiatives.map(({ metric }, index) => (
                                                                    <linearGradient key={metric.id} id={`gradient-${metric.id}`} x1="0" y1="0" x2="0" y2="1">
                                                                        <stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.3} />
                                                                        <stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0} />
                                                                    </linearGradient>
                                                                ))}
                                                            </defs>
                                                            <XAxis
                                                                dataKey="date"
                                                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                angle={-45}
                                                                textAnchor="end"
                                                                height={50}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 11, fill: '#6b7280' }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                                                                width={40}
                                                            />
                                                            <RechartsTooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                                                    border: 'none',
                                                                    borderRadius: '12px',
                                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                                                    padding: '12px'
                                                                }}
                                                                formatter={(value: number, name: string) => {
                                                                    const entry = chartInitiatives.find(c => c.metric.id === name)
                                                                    return [value.toLocaleString(), entry?.metric.title || name]
                                                                }}
                                                            />
                                                            {chartInitiatives.map(({ initiative, metric }, index) => (
                                                                <Area
                                                                    key={metric.id}
                                                                    type="monotone"
                                                                    dataKey={metric.id}
                                                                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                                                                    strokeWidth={2}
                                                                    fill={`url(#gradient-${metric.id})`}
                                                                    dot={false}
                                                                    activeDot={{ r: 4, strokeWidth: 2 }}
                                                                />
                                                            ))}
                                                        </AreaChart>
                                                    </ResponsiveContainer>
                                                </div>
                                                {/* Legend */}
                                                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-gray-100">
                                                    {chartInitiatives.map(({ initiative, metric }, index) => (
                                                        <div key={metric.id} className="flex items-center gap-2">
                                                            <div
                                                                className="w-3 h-3 rounded-full"
                                                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                                            />
                                                            <span className="text-xs text-muted-foreground truncate max-w-[120px]">{metric.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                </div>
                            </div>
                        </div>
                    </div>
        </div>
    )
}
