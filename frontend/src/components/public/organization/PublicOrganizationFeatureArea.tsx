import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    BookOpen,
    ChevronLeft,
    ChevronRight,
    Compass,
    Globe,
    LineChart,
    Map as MapIcon,
    MapPin,
    Target,
} from 'lucide-react'
import { PublicOrgLocationsMap } from './PublicOrgLocationsMap'
import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts'
import {
    publicApi,
    type PublicInitiative,
    type PublicKPI,
    type PublicOrganization,
    type PublicOrgPost,
    type PublicStatCard,
    type PublicStory,
    type PublicLocation,
} from '../../../services/publicApi'
import { shade } from './orgShowcase'
import { FieldFeatureCard, type FeedItem } from './OrgPostTimeline'
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
    focusStoryId?: string | null
    highlightCards: PublicStatCard[]
    filteredInitiatives: PublicInitiative[]
    organization: PublicOrganization
    initiativeChartData: any[]
    chartInitiatives: { metric: PublicKPI; initiative: PublicInitiative }[]
    /** True when the chart pool is entirely percentage metrics. Switches the
     * Y-axis + tooltip to `%` formatting and updates the title; numbers and
     * percentages can never be mixed (the page filters one out). */
    isPercentageChart?: boolean
    /** Controlled Globe/Map sub-mode for the Globe section. The page owns
     * this state so the autoplay sequence (globe → map → stories) and any
     * user click can cancel from the same source. */
    globeMode: 'globe' | 'map'
    onGlobeModeChange: (mode: 'globe' | 'map') => void
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
        focusStoryId,
        highlightCards,
        filteredInitiatives,
        organization,
        initiativeChartData,
        chartInitiatives,
        isPercentageChart = false,
        globeMode,
        onGlobeModeChange,
    } = props

    const [posts, setPosts] = useState<PublicOrgPost[] | null>(null)
    const [fieldIndex, setFieldIndex] = useState(0)
    const focusedStory = useRef(false)
    const accent = shade(brandColor, 0.45)

    useEffect(() => {
        let cancelled = false
        publicApi.getOrganizationPosts(slug)
            .then(rows => { if (!cancelled) setPosts(rows) })
            .catch(() => { if (!cancelled) setPosts([]) })
        return () => { cancelled = true }
    }, [slug])

    const fieldFeed = useMemo(() => {
        const items: FeedItem[] = []
        for (const post of posts || []) {
            items.push({
                key: `post-${post.id}`,
                at: new Date(post.published_at).getTime() || 0,
                title: post.hook,
                body: post.body,
                image: post.image_url,
                kind: 'Post',
            })
        }
        for (const story of filteredStories) {
            const url = story.media_url
            const youtubeId = url?.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1]
            items.push({
                key: `story-${story.id}`,
                at: new Date(story.date_represented).getTime() || 0,
                title: story.title,
                body: story.description,
                image: story.media_type === 'photo' && url ? url : youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
                href: story.initiative_slug ? `${orgLinkBase}/${slug}/${story.initiative_slug}/story/${story.id}` : undefined,
                kind: 'Story',
            })
        }
        return items.sort((a, b) => b.at - a.at)
    }, [posts, filteredStories, orgLinkBase, slug])

    useEffect(() => { setFieldIndex(0) }, [filteredStories])

    useEffect(() => {
        if (focusedStory.current || !focusStoryId) return
        const index = fieldFeed.findIndex(item => item.key === `story-${focusStoryId}`)
        if (index >= 0) {
            setFieldIndex(index)
            focusedStory.current = true
        }
    }, [focusStoryId, fieldFeed])

    const fieldCount = fieldFeed.length
    const safeFieldIndex = Math.min(fieldIndex, Math.max(fieldCount - 1, 0))
    const currentField = fieldFeed[safeFieldIndex]

    return (
        <div className={`w-full md:w-[45%] flex-shrink-0 pt-0 pb-2 md:pb-4 px-2 md:px-0 md:pr-2 ${activeView === 'graph' ? 'h-[72vh]' : 'h-[50vh]'} md:h-auto`}>
                    <div className="h-full overflow-hidden relative">
                        {/* Globe View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${activeView === 'globe'
                                ? 'opacity-100 translate-x-0 z-10'
                                : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                            }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div
                                            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                            style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                        >
                                            {globeMode === 'globe' ? (
                                                <Globe
                                                    className="w-4 h-4"
                                                    style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                                />
                                            ) : (
                                                <MapIcon
                                                    className="w-4 h-4"
                                                    style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                                />
                                            )}
                                        </div>
                                        <h2 className="font-semibold text-foreground truncate">Global Impact</h2>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                        {/* Globe / Map sub-toggle. Lives inside the
                                            section so it doesn't pollute the outer
                                            view chooser. Brand-tinted active pill
                                            keeps it visually consistent with the
                                            location count chip. */}
                                        <div
                                            className="inline-flex items-center p-0.5 rounded-full bg-gray-100"
                                            role="tablist"
                                            aria-label="Choose globe or map view"
                                        >
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={globeMode === 'globe'}
                                                onClick={() => onGlobeModeChange('globe')}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                                    globeMode === 'globe'
                                                        ? 'bg-white text-gray-900 shadow-sm'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                <Globe className="w-3 h-3" />
                                                <span>Globe</span>
                                            </button>
                                            <button
                                                type="button"
                                                role="tab"
                                                aria-selected={globeMode === 'map'}
                                                onClick={() => onGlobeModeChange('map')}
                                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                                                    globeMode === 'map'
                                                        ? 'bg-white text-gray-900 shadow-sm'
                                                        : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                            >
                                                <MapIcon className="w-3 h-3" />
                                                <span>Map</span>
                                            </button>
                                        </div>
                                        <span
                                            className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700 whitespace-nowrap"
                                            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                        >
                                            {filteredLocations.length} locations
                                        </span>
                                    </div>
                                </div>
                                <div className="flex-1 relative overflow-hidden">
                                    {/* Mount the globe only when its view is active AND
                                        the user hasn't switched to map. The component
                                        is heavy (Three.js scene + animation loop) so
                                        leaving it mounted in the background burns
                                        CPU/GPU even when invisible. The map is also
                                        only mounted when selected so leaflet doesn't
                                        eagerly fetch tiles for an unseen view. */}
                                    {activeView === 'globe' && globeMode === 'globe' ? (
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
                                    ) : activeView === 'globe' && globeMode === 'map' ? (
                                        <PublicOrgLocationsMap locations={filteredLocations} />
                                    ) : (
                                        <div className="w-full h-full" />
                                    )}

                                    {/* Location Popups (globe mode only — the leaflet
                                        map already shows location names via marker
                                        tooltips, so the floating brand pills would
                                        just collide with them). whitespace-nowrap +
                                        truncate + max-w cap keeps each popup as a
                                        single-line pill; right-anchored popups use
                                        `right` instead of `left` so long labels
                                        never bleed off the screen edge. */}
                                    {globeMode === 'globe' && (<>
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
                                    </>)}
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
                                        <h2 className="font-semibold text-foreground">Posts & Stories</h2>
                                        <span
                                            className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                        >{fieldCount}</span>
                                    </div>
                                    {fieldCount > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setFieldIndex(safeFieldIndex === 0 ? fieldCount - 1 : safeFieldIndex - 1)}
                                                className="w-8 h-8 md:w-6 md:h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-muted-foreground w-12 text-center">{safeFieldIndex + 1}/{fieldCount}</span>
                                            <button
                                                type="button"
                                                onClick={() => setFieldIndex((safeFieldIndex + 1) % fieldCount)}
                                                className="w-8 h-8 md:w-6 md:h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4 md:w-3.5 md:h-3.5 text-gray-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 p-4 pt-0 overflow-hidden">
                                    {!currentField ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p>No posts or stories yet</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <FieldFeatureCard item={currentField} brandColor={brandColor} accent={accent} />
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
                                {/* Layout per count:
                                      1   →  1 col × 1 row (full bleed)
                                      2   →  1 col × 2 rows
                                      3-4 →  2 cols × 2 rows (last cell empty when 3)
                                    `auto-rows-fr` divides the available height
                                    equally so cards never overflow the section.
                                    Mobile keeps a 1-col stack that scrolls when
                                    content is denser than the viewport. */}
                                <div className="flex-1 px-4 pb-4 pt-0 overflow-y-auto md:overflow-hidden">
                                    {highlightCards.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-muted-foreground">
                                            <div className="text-center">
                                                <Compass className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p>No context yet</p>
                                            </div>
                                        </div>
                                    ) : (() => {
                                        const count = highlightCards.length
                                        const dense = count >= 3
                                        const desktopGrid = dense
                                            ? 'md:grid-cols-2 md:auto-rows-fr'
                                            : 'md:grid-cols-1 md:auto-rows-fr'
                                        return (
                                        <div className={`grid grid-cols-1 gap-2 md:gap-3 md:h-full ${desktopGrid}`}>
                                            {highlightCards.map((card, idx) => {
                                                const isStat = card.type === 'stat'
                                                const title = (card.title || '').trim()
                                                const description = (card.description || '').trim()
                                                const value = (card.value || '').trim()
                                                return (
                                                    <Link
                                                        key={card.id || idx}
                                                        to={`${orgLinkBase}/${slug}/context`}
                                                        className="group relative rounded-2xl bg-white border border-gray-200/80 shadow-surface hover:shadow-surface-hover hover:border-gray-300 hover:-translate-y-px transition-all duration-200 p-3 md:p-4 flex flex-col overflow-hidden md:min-h-0"
                                                    >
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1"
                                                            style={{ backgroundColor: brandColor }}
                                                        />
                                                        <div className="flex items-center gap-2 mb-1.5 md:mb-2 pl-1">
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-800"
                                                                style={{ backgroundColor: `${brandColor}30` }}
                                                            >
                                                                {isStat ? 'Stat' : 'Statement'}
                                                            </span>
                                                        </div>
                                                        <div className="flex-1 min-h-0 pl-1 overflow-hidden">
                                                            {isStat ? (
                                                                <div className="flex flex-col h-full">
                                                                    <div
                                                                        className={`font-bold leading-tight mb-1 break-words ${
                                                                            dense
                                                                                ? 'text-xl sm:text-2xl md:text-2xl lg:text-3xl'
                                                                                : 'text-2xl sm:text-3xl md:text-4xl'
                                                                        }`}
                                                                        style={{ color: brandColor, filter: 'saturate(1.2) brightness(0.8)' }}
                                                                    >
                                                                        {value}
                                                                    </div>
                                                                    {title && (
                                                                        <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                                                                            {title}
                                                                        </h3>
                                                                    )}
                                                                    {description && (
                                                                        <p className={`text-xs text-muted-foreground mt-1 ${dense ? 'line-clamp-2' : 'line-clamp-3 md:line-clamp-2'}`}>
                                                                            {description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex flex-col h-full">
                                                                    {title && (
                                                                        <h3 className={`font-bold text-foreground leading-snug ${
                                                                            dense
                                                                                ? 'text-sm md:text-base line-clamp-2'
                                                                                : 'text-base md:text-lg line-clamp-3 md:line-clamp-2'
                                                                        }`}>
                                                                            {title}
                                                                        </h3>
                                                                    )}
                                                                    {description && (
                                                                        <p className={`text-xs text-muted-foreground mt-1 ${dense ? 'line-clamp-3' : 'line-clamp-3 md:line-clamp-2'}`}>
                                                                            {description}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="pl-1 mt-1.5 md:mt-2 flex items-center justify-between">
                                                            <span className="text-xs font-medium text-gray-500 group-hover:text-gray-800 transition-colors">
                                                                Read more
                                                            </span>
                                                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-800 transition-colors" />
                                                        </div>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                        )
                                    })()}
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
                                        <h2 className="font-semibold text-foreground">Programs</h2>
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
                                                <p>No programs match filters</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredInitiatives.map((init) => (
                                                <Link
                                                    key={init.id}
                                                    to={`${orgLinkBase}/${slug}/${init.slug}`}
                                                    className="block p-4 bg-white rounded-xl border border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5 transition-all duration-200 group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
                                                            <img
                                                                src={organization.logo_url || '/Nexuslogo.png'}
                                                                alt=""
                                                                className="w-full h-full object-contain"
                                                                onError={(e) => {
                                                                    ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png'
                                                                }}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">{init.title}</h3>
                                                            {init.region && (
                                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                                    <MapPin className="w-3 h-3" />{init.region}
                                                                </p>
                                                            )}
                                                            {init.description && (
                                                                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{init.description}</p>
                                                            )}
                                                        </div>
                                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
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
                                        <h2 className="font-semibold text-foreground">{isPercentageChart ? 'Performance Over Time' : 'Cumulative Impact'}</h2>
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
                                                                tickFormatter={(v) => isPercentageChart
                                                                    ? `${Math.round(v)}%`
                                                                    : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
                                                                domain={isPercentageChart ? [0, 100] : ['auto', 'auto']}
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
                                                                    const isPct = entry?.metric.metric_type === 'percentage'
                                                                    const display = value == null
                                                                        ? '—'
                                                                        : isPct
                                                                            ? `${Math.round(value)}%`
                                                                            : value.toLocaleString()
                                                                    return [display, entry?.metric.title || name]
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
                                                                    connectNulls
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
