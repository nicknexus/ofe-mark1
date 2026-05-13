import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    Building2, MapPin, BarChart3, ArrowLeft, Globe,
    BookOpen, FileText, Calendar, ChevronRight, ChevronLeft,
    TrendingUp, ChevronDown, X, Target, Image, LineChart, Compass, ArrowRight
} from 'lucide-react'
import PublicDonateButton from '../components/public/PublicDonateButton'
import {
    publicApi,
    PublicOrganization,
    PublicInitiative,
    PublicKPI,
    PublicStory,
    PublicLocation,
    PublicEvidence,
    PublicStatCard,
    PublicMetricTag,
    OrganizationStats
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagFilter from '../components/public/PublicTagFilter'
import PublicTagChip from '../components/public/PublicTagChip'
import DateRangePicker from '../components/DateRangePicker'
import { PublicPageBackground } from '../components/public/publicStyles'
import { formatDate, compareClaimsByEffectiveDateDesc } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts'

// Lazy load the globe component
const ImpactGlobe = lazy(() => import('../components/landing/ImpactGlobe'))

/**
 * WebGL is fragile: Chrome refuses to create more than ~16 contexts per page,
 * older GPUs can fail outright, and `react-globe.gl` will throw a hard error
 * inside React's render if the context can't be acquired. Without an error
 * boundary the whole org page blanks out. This boundary renders a neutral
 * placeholder instead, so location data still loads — just without the globe.
 */
class GlobeErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
    state = { hasError: false }
    static getDerivedStateFromError() { return { hasError: true } }
    componentDidCatch(error: Error) {
        console.warn('[ImpactGlobe] WebGL unavailable, falling back to placeholder:', error.message)
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    <div className="w-48 h-48 rounded-full bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-200/80 flex items-center justify-center">
                        <span>Globe unavailable</span>
                    </div>
                </div>
            )
        }
        return this.props.children
    }
}

// Toggle view types for the feature area
type FeatureView = 'globe' | 'stories' | 'highlights' | 'initiatives' | 'graph'

// Chart colors
const CHART_COLORS = [
    '#c0dfa1', '#8ecae6', '#ffb703', '#fb8500', '#219ebc',
    '#023047', '#8338ec', '#ff006e', '#3a86ff', '#06d6a0'
]

// Generate metric slug
function generateMetricSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export default function PublicOrganizationPage() {
    const { slug } = useParams<{ slug: string }>()
    const [searchParams] = useSearchParams()
    const orgLinkBase = useOrgLinkBase()
    const [organization, setOrganization] = useState<PublicOrganization | null>(null)
    const [stats, setStats] = useState<OrganizationStats | null>(null)
    const [initiatives, setInitiatives] = useState<PublicInitiative[]>([])
    const [metrics, setMetrics] = useState<PublicKPI[]>([])
    const [stories, setStories] = useState<PublicStory[]>([])
    const [locations, setLocations] = useState<PublicLocation[]>([])
    const [evidence, setEvidence] = useState<PublicEvidence[]>([])
    const [tags, setTags] = useState<PublicMetricTag[]>([])
    const tagsById = useMemo(() => {
        const map = new Map<string, PublicMetricTag>()
        for (const t of tags) map.set(t.id, t)
        return map
    }, [tags])
    const [highlightCards, setHighlightCards] = useState<PublicStatCard[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Feature view toggle state
    const [activeView, setActiveView] = useState<FeatureView>('globe')

    // Story carousel state
    const [storyIndex, setStoryIndex] = useState(0)
    const [evidencePage, setEvidencePage] = useState(0)
    const [heroInitiativePage, setHeroInitiativePage] = useState(0)

    // Filter state
    const [selectedInitiative, setSelectedInitiative] = useState<string>('all')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')
    const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false)
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [showLocationDropdown, setShowLocationDropdown] = useState(false)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const initiativeBtnRef = useRef<HTMLButtonElement>(null)
    const locationBtnRef = useRef<HTMLButtonElement>(null)

    // Location popups state. `rightAnchored` flips CSS to use `right` instead of
    // `left`, so popups in the right band hug the right edge cleanly without
    // bleeding off-screen when the label is long.
    const [activePopups, setActivePopups] = useState<Array<{
        id: string
        name: string
        country?: string
        initiative_slug?: string
        top: number
        left: number
        rightAnchored: boolean
    }>>([])

    useEffect(() => {
        if (slug) loadOrganizationData()
    }, [slug])

    const loadOrganizationData = async () => {
        try {
            setLoading(true)
            // Clear cache when entering a DIFFERENT org (fresh load from explore)
            // If same org (e.g., coming back via breadcrumb), use cached data
            publicApi.clearCacheForOrg(slug!)
            const orgData = await publicApi.getOrganization(slug!)
            if (!orgData) { setError('Organization not found'); return }
            setOrganization(orgData.organization)
            setStats(orgData.stats)
            const [inits, mets, stors, locs, evid, ctx, tgs] = await Promise.all([
                publicApi.getOrganizationInitiatives(slug!),
                publicApi.getOrganizationMetrics(slug!),
                publicApi.getOrganizationStories(slug!, 20),
                publicApi.getOrganizationLocations(slug!),
                publicApi.getOrganizationEvidence(slug!, 20),
                publicApi.getOrganizationContext(slug!).catch(() => null),
                publicApi.getOrganizationTags(slug!).catch(() => [])
            ])
            setInitiatives(inits)
            setMetrics(mets)
            setStories(stors)
            setLocations(locs)
            setEvidence(evid)
            setTags(tgs)
            const cards = Array.isArray(ctx?.stats_and_statements) ? ctx!.stats_and_statements! : []
            const valid = cards.filter(c =>
                c?.type === 'stat'
                    ? !!(c.value || '').trim()
                    : !!((c?.title || '').trim() || (c?.description || '').trim())
            ).slice(0, 2)
            setHighlightCards(valid)
        } catch (err) {
            setError('Failed to load organization')
        } finally {
            setLoading(false)
        }
    }

    // DateRangePicker value adapter
    const datePickerValue = useMemo(() => {
        if (startDate && endDate && startDate === endDate) return { singleDate: startDate }
        if (startDate && endDate) return { startDate, endDate }
        if (startDate) return { singleDate: startDate }
        return {}
    }, [startDate, endDate])

    const handleDateChange = (value: { singleDate?: string; startDate?: string; endDate?: string }) => {
        if (value.singleDate) {
            setStartDate(value.singleDate)
            setEndDate(value.singleDate)
        } else if (value.startDate && value.endDate) {
            setStartDate(value.startDate)
            setEndDate(value.endDate)
        } else {
            setStartDate('')
            setEndDate('')
        }
    }

    // Helper: a location is in an initiative if either initiative_ids array
    // includes it (post-migration source of truth) or the legacy initiative_id matches.
    const locationLinkedToInitiative = (loc: typeof locations[number], initiativeId: string) => {
        if (loc.initiative_ids && loc.initiative_ids.length > 0) {
            return loc.initiative_ids.includes(initiativeId)
        }
        return loc.initiative_id === initiativeId
    }

    // Initiatives that operate at any of the selected locations.
    //
    // Returns `null` when no location filter is active OR when the only
    // selected locations are "global" (org-level, no initiative links). The
    // null sentinel is treated as "don't scope metrics/claims/stories by
    // initiative" downstream — global locations apply org-wide and shouldn't
    // zero out the dashboards just because they aren't tied to a single
    // initiative.
    const locationMatchedInitiativeIds = useMemo(() => {
        if (selectedLocationIds.length === 0) return null
        const ids = new Set<string>()
        let anyHasInitiativeLink = false
        locations.forEach(loc => {
            if (!loc.id || !selectedLocationIds.includes(loc.id)) return
            const linked = (loc.initiative_ids && loc.initiative_ids.length > 0)
                ? loc.initiative_ids
                : (loc.initiative_id ? [loc.initiative_id] : [])
            if (linked.length > 0) anyHasInitiativeLink = true
            linked.forEach(id => ids.add(id))
        })
        // All selected locations are global → skip initiative-based scoping.
        if (!anyHasInitiativeLink) return null
        return ids
    }, [selectedLocationIds, locations])

    // Locations available in the dropdown (scoped by selected initiative)
    const dropdownLocations = useMemo(() => {
        if (selectedInitiative !== 'all') {
            return locations.filter(l => locationLinkedToInitiative(l, selectedInitiative))
        }
        return locations
    }, [locations, selectedInitiative])

    // Helpers: tag intersection. A claim/evidence/story matches the tag
    // filter if any of its tag ids is selected. Metrics match if the metric
    // itself or any of its updates is tagged with a selected id.
    const tagMatchesAny = (ids: string[] | undefined | null) => {
        if (selectedTagIds.length === 0) return true
        if (!ids || ids.length === 0) return false
        return ids.some(id => selectedTagIds.includes(id))
    }
    const tagMatchesSingle = (id: string | undefined | null) => {
        if (selectedTagIds.length === 0) return true
        if (!id) return false
        return selectedTagIds.includes(id)
    }

    // Filter logic
    const filteredMetrics = useMemo(() => {
        let filtered = metrics
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(m => m.initiative_id === selectedInitiative)
        }
        if (selectedLocationIds.length > 0) {
            // Filter updates by their location_id. A metric is kept if any
            // of its updates references a selected location; totals are
            // recomputed from just the matching updates so the dashboard
            // numbers reflect the location filter.
            filtered = filtered
                .map(m => {
                    const matching = (m.updates || []).filter(u => u.location_id && selectedLocationIds.includes(u.location_id))
                    if (matching.length === 0) return null
                    const newTotal = aggregateKpiUpdates(matching as any, m.metric_type)
                    return { ...m, total_value: newTotal, update_count: matching.length, updates: matching }
                })
                .filter((m): m is NonNullable<typeof m> => m !== null)
        }
        if (selectedTagIds.length > 0) {
            // Keep metrics that either carry the tag themselves, or have at
            // least one update tagged with one of the selected ids.
            filtered = filtered.filter(m => {
                if (tagMatchesAny(m.tag_ids)) return true
                return (m.updates || []).some(u => tagMatchesSingle(u.tag_id))
            })
            // Recompute totals using only matching updates so dashboard
            // numbers reflect "tagged X" totals.
            filtered = filtered.map(m => {
                const matching = (m.updates || []).filter(u => tagMatchesSingle(u.tag_id))
                if (matching.length === 0) return m
                const newTotal = aggregateKpiUpdates(matching as any, m.metric_type)
                return { ...m, total_value: newTotal, update_count: matching.length, updates: matching }
            })
        }
        if (startDate || endDate) {
            filtered = filtered.filter(m => {
                if (!m.updates || m.updates.length === 0) return false
                return m.updates.some(update => {
                    const updateDate = new Date(update.date_represented)
                    if (startDate && updateDate < new Date(startDate)) return false
                    if (endDate && updateDate > new Date(endDate + 'T23:59:59')) return false
                    return true
                })
            })
            filtered = filtered.map(m => {
                const filteredUpdates = (m.updates || []).filter(update => {
                    const updateDate = new Date(update.date_represented)
                    if (startDate && updateDate < new Date(startDate)) return false
                    if (endDate && updateDate > new Date(endDate + 'T23:59:59')) return false
                    return true
                })
                const newTotal = aggregateKpiUpdates(filteredUpdates as any, m.metric_type)
                return { ...m, total_value: newTotal, update_count: filteredUpdates.length }
            })
        }
        // Highest total first — top-left has the biggest number, fills the
        // grid row-by-row in descending order. Percentage metrics use their
        // average value (already in total_value), so the comparison is
        // apples-to-apples per metric type, but mixing types in one grid will
        // surface the biggest absolute number regardless. That matches what
        // donors visually expect ("the impact you're proudest of, first").
        return [...filtered].sort((a, b) => (b.total_value ?? 0) - (a.total_value ?? 0))
    }, [metrics, selectedInitiative, selectedLocationIds, startDate, endDate, selectedTagIds])

    const filteredStories = useMemo(() => {
        let filtered = stories
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(s => s.initiative_id === selectedInitiative)
        }
        if (selectedLocationIds.length > 0) {
            filtered = filtered.filter(s => {
                const storyLocIds = s.location_ids || s.locations?.map(l => l.id) || []
                if (storyLocIds.length === 0) return false
                return storyLocIds.some(id => id && selectedLocationIds.includes(id))
            })
        }
        if (selectedTagIds.length > 0) {
            filtered = filtered.filter(s => tagMatchesAny(s.tag_ids))
        }
        if (startDate || endDate) {
            filtered = filtered.filter(s => {
                const storyDate = new Date(s.date_represented)
                if (startDate && storyDate < new Date(startDate)) return false
                if (endDate && storyDate > new Date(endDate + 'T23:59:59')) return false
                return true
            })
        }
        return filtered
    }, [stories, selectedInitiative, selectedLocationIds, startDate, endDate, selectedTagIds])

    const filteredLocations = useMemo(() => {
        let filtered = locations
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(l => locationLinkedToInitiative(l, selectedInitiative))
        }
        if (selectedLocationIds.length > 0) {
            filtered = filtered.filter(l => l.id && selectedLocationIds.includes(l.id))
        }
        return filtered
    }, [locations, selectedInitiative, selectedLocationIds])

    // Random location popups effect.
    // Mobile gets fewer concurrent popups, slower cadence, and collision-aware
    // placement so long location names don't stack on top of each other.
    useEffect(() => {
        if (activeView !== 'globe' || filteredLocations.length === 0) return

        const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
        const maxConcurrent = isMobile ? 2 : 5
        const spawnIntervalMs = isMobile ? 4500 : 3000
        const popupTtlMs = isMobile ? 5500 : 7000
        // Approximate footprint in % of container — wider on mobile because the
        // container is narrower so each popup occupies a bigger fraction.
        const minHorizontalGap = isMobile ? 32 : 22
        const minVerticalGap = isMobile ? 14 : 10

        const tryPickPosition = (existing: { top: number; left: number; rightAnchored: boolean }[]) => {
            for (let attempt = 0; attempt < 8; attempt++) {
                const edge = Math.floor(Math.random() * 4)
                let top: number, left: number, rightAnchored = false
                // top/bottom bands keep popups centered in the safe horizontal range
                if (edge === 0) { top = 6 + Math.random() * 10; left = 8 + Math.random() * 40 }
                else if (edge === 2) { top = 78 + Math.random() * 10; left = 8 + Math.random() * 40 }
                // right band: anchor from right edge so long labels never bleed off-screen
                else if (edge === 1) { top = 18 + Math.random() * 55; left = 4 + Math.random() * 14; rightAnchored = true }
                // left band
                else { top = 18 + Math.random() * 55; left = 4 + Math.random() * 14 }

                // Compare horizontal position in a normalized space so left- and
                // right-anchored popups are still detected as colliding when they
                // overlap visually.
                const normalizedLeft = rightAnchored ? 100 - left : left
                const collides = existing.some(p => {
                    const otherNormalized = p.rightAnchored ? 100 - p.left : p.left
                    return Math.abs(p.top - top) < minVerticalGap && Math.abs(otherNormalized - normalizedLeft) < minHorizontalGap
                })
                if (!collides) return { top, left, rightAnchored }
            }
            return null
        }

        const spawnPopup = () => {
            setActivePopups(prev => {
                if (prev.length >= maxConcurrent) return prev
                const pos = tryPickPosition(prev)
                if (!pos) return prev
                const randomLocation = filteredLocations[Math.floor(Math.random() * filteredLocations.length)]
                const popupId = `${randomLocation.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
                const next = [...prev, {
                id: popupId,
                name: randomLocation.name,
                country: randomLocation.country,
                initiative_slug: randomLocation.initiative_slug,
                    top: pos.top,
                    left: pos.left,
                    rightAnchored: pos.rightAnchored,
                }]
            setTimeout(() => {
                    setActivePopups(curr => curr.filter(p => p.id !== popupId))
                }, popupTtlMs)
                return next
            })
        }

        spawnPopup()
        if (!isMobile) setTimeout(spawnPopup, 500)

        const interval = setInterval(spawnPopup, spawnIntervalMs)
        return () => clearInterval(interval)
    }, [activeView, filteredLocations])

    const filteredInitiatives = useMemo(() => {
        let filtered = initiatives
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(i => i.id === selectedInitiative)
        }
        if (locationMatchedInitiativeIds) {
            filtered = filtered.filter(i => locationMatchedInitiativeIds.has(i.id))
        }
        return filtered
    }, [initiatives, selectedInitiative, locationMatchedInitiativeIds])

    // Auto-cycle stories. When a story is deep-linked (?story=...), we hold
    // off auto-rotation so the focused story stays put instead of rotating
    // past the user.
    const hasStoryDeepLink = !!searchParams.get('story')
    useEffect(() => {
        if (filteredStories.length <= 1) return
        if (hasStoryDeepLink) return
        const interval = setInterval(() => {
            setStoryIndex(prev => (prev + 1) % filteredStories.length)
        }, 10000)
        return () => clearInterval(interval)
    }, [filteredStories.length, hasStoryDeepLink])

    // Reset indices when filters change
    useEffect(() => {
        setStoryIndex(0)
        setEvidencePage(0)
        setHeroInitiativePage(0)
    }, [selectedInitiative, startDate, endDate, selectedLocationIds, selectedTagIds])

    // Deep-link: open a specific feature view and/or focus a specific story when
    // arriving via ?view=stories&story=<id> (used by the embed widget so that
    // clicking a widget story pops it up in the carousel rather than navigating
    // to the standalone story page).
    const deepLinkApplied = useRef(false)
    useEffect(() => {
        if (deepLinkApplied.current) return
        if (loading || stories.length === 0) return
        const view = searchParams.get('view') as FeatureView | null
        const storyParam = searchParams.get('story')
        if (view && ['globe', 'stories', 'highlights', 'initiatives', 'graph'].includes(view)) {
            setActiveView(view)
        }
        if (storyParam) {
            const idx = stories.findIndex(s => s.id === storyParam)
            if (idx >= 0) {
                setStoryIndex(idx)
                if (!view) setActiveView('stories')
            }
        }
        deepLinkApplied.current = true
    }, [loading, stories, searchParams])

    // Initial load behaviour: show the globe for the first 10 seconds, then
    // auto-switch to stories. The timer is cancelled the moment the user picks
    // any view (see `chooseView` below). Skipped entirely when a deep-link
    // specified a view.
    const autoSwitchTimerRef = useRef<number | null>(null)
    useEffect(() => {
        if (loading) return
        if (searchParams.get('view')) return
        autoSwitchTimerRef.current = window.setTimeout(() => {
            autoSwitchTimerRef.current = null
            setActiveView(prev => (prev === 'globe' ? 'stories' : prev))
        }, 10000)
        return () => {
            if (autoSwitchTimerRef.current) {
                window.clearTimeout(autoSwitchTimerRef.current)
                autoSwitchTimerRef.current = null
            }
        }
    }, [loading, searchParams])

    // User-driven view change: cancel the pending auto-switch immediately so
    // we never override their click a second later.
    const chooseView = (v: FeatureView) => {
        if (autoSwitchTimerRef.current) {
            window.clearTimeout(autoSwitchTimerRef.current)
            autoSwitchTimerRef.current = null
        }
        setActiveView(v)
    }

    const hasActiveFilters = selectedInitiative !== 'all' || startDate || endDate || selectedLocationIds.length > 0 || selectedTagIds.length > 0
    const clearFilters = () => {
        setSelectedInitiative('all')
        setStartDate('')
        setEndDate('')
        setSelectedLocationIds([])
        setSelectedTagIds([])
    }

    // Current story for carousel
    const currentStory = filteredStories[storyIndex]

    // Brand color with fallback
    const brandColor = organization?.brand_color || '#c0dfa1'

    const allImpactClaims = useMemo(() => {
        const sourceMetrics = selectedInitiative === 'all'
            ? metrics
            : metrics.filter(m => m.initiative_id === selectedInitiative)

        let claims = sourceMetrics.flatMap(m =>
            (m.updates || []).map(u => ({
                ...u,
                metricTitle: m.title,
                metricUnit: m.unit_of_measurement,
                metricType: m.metric_type,
                initiativeTitle: m.initiative_title,
                initiativeSlug: m.initiative_slug,
                category: m.category,
            }))
        ).sort(compareClaimsByEffectiveDateDesc)

        // Filter individual claims/updates by their own location_id (each
        // update belongs to one location). Falls through cleanly when no
        // location filter is active.
        if (selectedLocationIds.length > 0) {
            claims = claims.filter(c => c.location_id && selectedLocationIds.includes(c.location_id))
        }

        if (selectedTagIds.length > 0) {
            claims = claims.filter(c => tagMatchesSingle(c.tag_id))
        }

        if (startDate || endDate) {
            claims = claims.filter(c => {
                const claimDate = new Date(c.date_represented)
                if (startDate && claimDate < new Date(startDate)) return false
                if (endDate && claimDate > new Date(endDate + 'T23:59:59')) return false
                return true
            })
        }
        return claims
    }, [metrics, selectedInitiative, selectedLocationIds, startDate, endDate, selectedTagIds])

    const filteredEvidence = useMemo(() => {
        let filtered = evidence
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(e => e.initiative_id === selectedInitiative)
        }
        if (selectedLocationIds.length > 0) {
            filtered = filtered.filter(e => {
                if (e.locations && e.locations.length > 0) {
                    return e.locations.some(loc => selectedLocationIds.includes(loc.id))
                }
                // Evidence has no direct locations → fall back to checking
                // whether any of its impact claims reference a selected
                // location, so location-scoped evidence still shows up.
                if (e.impact_claims && e.impact_claims.length > 0) {
                    return e.impact_claims.some((c: any) => c.location_id && selectedLocationIds.includes(c.location_id))
                }
                return false
            })
        }
        if (selectedTagIds.length > 0) {
            filtered = filtered.filter(e => tagMatchesAny(e.tag_ids))
        }
        if (startDate || endDate) {
            filtered = filtered.filter(e => {
                if (!e.date_represented) return true
                const evDate = new Date(e.date_represented)
                if (startDate && evDate < new Date(startDate)) return false
                if (endDate && evDate > new Date(endDate + 'T23:59:59')) return false
                return true
            })
        }
        return filtered
    }, [evidence, selectedInitiative, selectedLocationIds, startDate, endDate, selectedTagIds])

    // Evidence pagination (must be after filteredEvidence).
    // Bias the order so the first page lands on viewable photos: images first,
    // then videos/YouTube (still inline-viewable), then everything else (PDFs,
    // unknown docs). Within each tier we preserve the original order, so the
    // overall feel stays "newest-ish first" while making the bottom-right tile
    // grid look intentional rather than dominated by document placeholders.
    const evidencePerPage = 4
    const evidenceVisualTier = useMemo(() => {
        const isImageUrl = (url?: string | null) => !!url && /\.(jpg|jpeg|png|gif|webp)$/i.test(url)
        const isVideoUrl = (url?: string | null) => !!url && (
            /\.(mp4|webm|mov|avi|mkv)$/i.test(url) ||
            /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url)
        )
        return (e: PublicEvidence) => {
            if (isImageUrl(e.file_url)) return 0
            if (isVideoUrl(e.file_url)) return 1
            return 2
        }
    }, [])
    const sortedEvidence = useMemo(() => {
        return [...filteredEvidence].sort((a, b) => evidenceVisualTier(a) - evidenceVisualTier(b))
    }, [filteredEvidence, evidenceVisualTier])
    const totalEvidencePages = Math.ceil(sortedEvidence.length / evidencePerPage)
    const displayedEvidence = sortedEvidence.slice(evidencePage * evidencePerPage, (evidencePage + 1) * evidencePerPage)

    // Memoize globe locations - group by country to avoid clutter
    const globeLocations = useMemo(() => {
        return filteredLocations
            .filter(loc => loc.latitude && loc.longitude)
            .map(loc => ({
                lat: loc.latitude,
                lng: loc.longitude,
                name: loc.country ? `${loc.name}, ${loc.country}` : loc.name,
            }))
    }, [filteredLocations])

    // Determine how many metrics to show per initiative (aim for ~6 total)
    const chartMetrics = useMemo(() => {
        // Group metrics by initiative
        const metricsByInitiative = new Map<string, { metrics: PublicKPI[]; initiative: PublicInitiative }>()

        filteredMetrics.forEach(metric => {
            const init = initiatives.find(i => i.id === metric.initiative_id)
            if (!init) return

            const existing = metricsByInitiative.get(metric.initiative_id)
            if (existing) {
                existing.metrics.push(metric)
            } else {
                metricsByInitiative.set(metric.initiative_id, { metrics: [metric], initiative: init })
            }
        })

        // Sort each initiative's metrics: prioritize those with actual updates, then by total_value descending
        metricsByInitiative.forEach(entry => {
            entry.metrics.sort((a, b) => {
                const aHasUpdates = a.updates && a.updates.length > 0
                const bHasUpdates = b.updates && b.updates.length > 0
                // Metrics with updates come first
                if (aHasUpdates && !bHasUpdates) return -1
                if (!aHasUpdates && bHasUpdates) return 1
                // Then sort by total_value descending
                return (b.total_value || 0) - (a.total_value || 0)
            })
        })

        const initiativeCount = metricsByInitiative.size

        // Determine metrics per initiative: 1 init = 6, 2 = 3, 3 = 2, 4+ = 1
        let metricsPerInitiative: number
        if (initiativeCount === 1) metricsPerInitiative = 6
        else if (initiativeCount === 2) metricsPerInitiative = 3
        else if (initiativeCount === 3) metricsPerInitiative = 2
        else metricsPerInitiative = 1

        // Collect top N metrics from each initiative
        const result: { metric: PublicKPI; initiative: PublicInitiative }[] = []
        metricsByInitiative.forEach(({ metrics, initiative }) => {
            metrics.slice(0, metricsPerInitiative).forEach(metric => {
                result.push({ metric, initiative })
            })
        })

        return result
    }, [filteredMetrics, initiatives])

    // Chart data: selected metrics over time (cumulative monthly, anchored to today's date)
    const initiativeChartData = useMemo(() => {
        if (chartMetrics.length === 0) return []

        // Collect all updates with their dates
        const allUpdates: { metricId: string; value: number; date: Date }[] = []
        chartMetrics.forEach(({ metric }) => {
            if (!metric.updates) return
            metric.updates.forEach(update => {
                allUpdates.push({
                    metricId: metric.id,
                    value: update.value,
                    date: new Date(update.date_represented)
                })
            })
        })

        if (allUpdates.length === 0) return []

        // Find the oldest update date
        const oldestDate = allUpdates.reduce((oldest, u) => u.date < oldest ? u.date : oldest, new Date())
        const now = new Date()

        // Group updates by metric for efficient lookup
        const updatesByMetric: Record<string, Array<{ value: number; date: Date }>> = {}
        allUpdates.forEach(u => {
            if (!updatesByMetric[u.metricId]) updatesByMetric[u.metricId] = []
            updatesByMetric[u.metricId].push({ value: u.value, date: u.date })
        })

        // Sort each metric's updates by date
        Object.values(updatesByMetric).forEach(updates => {
            updates.sort((a, b) => a.date.getTime() - b.date.getTime())
        })

        // Calculate stop date: one month before the oldest data's month
        const stopDate = new Date(oldestDate.getFullYear(), oldestDate.getMonth() - 1, oldestDate.getDate())

        // Generate monthly data points going backwards from today (Feb 5, Jan 5, Dec 5, etc.)
        const dataPoints: any[] = []
        const currentDate = new Date(now)

        // Go back month by month until we're a full month before the oldest data
        while (currentDate > stopDate) {
            const label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            const dataPoint: any = { date: label, fullDate: new Date(currentDate) }

            chartMetrics.forEach(({ metric }) => {
                // Calculate cumulative total up to this date
                const cumulative = (updatesByMetric[metric.id] || [])
                    .filter(u => u.date <= currentDate)
                    .reduce((sum, u) => sum + u.value, 0)
                dataPoint[metric.id] = cumulative
            })
            dataPoints.push(dataPoint)

            // Go back one month
            currentDate.setMonth(currentDate.getMonth() - 1)

            // Safety: limit to 24 months max
            if (dataPoints.length >= 24) break
        }

        // Reverse so oldest is first (left side of chart)
        return dataPoints.reverse()
    }, [chartMetrics])

    // List for chart legend (now uses chartMetrics directly)
    const chartInitiatives = useMemo(() => {
        return chartMetrics
    }, [chartMetrics])

    if (loading) {
        return <PublicLoader message="Loading dashboard..." />
    }

    if (error || !organization) {
        return (
            <div className="h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white border border-gray-100 shadow-sm p-12 rounded-3xl text-center max-w-md">
                    <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Organization Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error}</p>
                    <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                        Browse Organizations <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen md:h-screen flex flex-col font-figtree overflow-auto md:overflow-hidden relative animate-fadeIn">
            <PublicPageBackground brandColor={brandColor} />

            {/* Header with Filters */}
            <header className="flex-shrink-0 bg-white border-b border-gray-100 shadow-sm z-50 relative">
                <div className="px-2 sm:px-3 md:px-4 py-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                        {/* Left: Nav + Org */}
                        <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
                            <Link to="/explore" className="flex items-center gap-1 text-muted-foreground hover:text-accent transition-colors flex-shrink-0">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50 flex-shrink-0">
                                {organization.logo_url ? (
                                    <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                            {/* Branded Donate button — only when org has set a donation_url */}
                            <PublicDonateButton
                                donationUrl={organization.donation_url || null}
                                brandColor={brandColor}
                                orgName={organization.name}
                            />
                        </div>

                        {/* Center: Filters */}
                        <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                            <button
                                ref={initiativeBtnRef}
                                onClick={() => { setShowInitiativeDropdown(!showInitiativeDropdown); setShowLocationDropdown(false) }}
                                className="flex items-center pl-0 pr-2.5 sm:pr-3 h-8 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all shadow-sm flex-shrink-0"
                                style={{
                                    border: selectedInitiative !== 'all' ? `1.5px solid ${brandColor}` : '1px solid #e5e7eb',
                                    boxShadow: selectedInitiative !== 'all'
                                        ? `0 1px 2px rgba(15,23,42,0.06), 0 0 0 3px ${brandColor}20`
                                        : '0 1px 2px rgba(15,23,42,0.06)',
                                }}
                            >
                                <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                    <Target className="w-4 h-4 text-gray-600" />
                                </div>
                                <span className={`ml-1.5 sm:ml-2 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedInitiative !== 'all' ? 'text-gray-900' : 'text-gray-500'}`}>
                                    {selectedInitiative === 'all' ? 'Initiative' : initiatives.find(i => i.id === selectedInitiative)?.title || 'Select'}
                                </span>
                                {selectedInitiative !== 'all' ? (
                                    <X className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-0.5 sm:ml-1" onClick={(e) => { e.stopPropagation(); setSelectedInitiative('all') }} />
                                ) : (
                                    <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                                )}
                            </button>

                            <div className="flex-shrink-0">
                                <DateRangePicker
                                    value={datePickerValue.singleDate || datePickerValue.startDate ? datePickerValue : undefined}
                                    onChange={handleDateChange}
                                    placeholder="Date"
                                    activeColor={brandColor}
                                    className="[&>button]:!h-8 [&>button]:!text-xs [&>button]:!pr-2.5 sm:[&>button]:!pr-3 [&>button]:!font-medium [&>button>div]:!w-8 [&>button>div]:!h-8 [&>button>div>svg]:!w-4 [&>button>div>svg]:!h-4 [&>button>span]:!ml-1.5 sm:[&>button>span]:!ml-2"
                                />
                            </div>

                            {locations.length > 0 && (
                                <button
                                    ref={locationBtnRef}
                                    onClick={() => { setShowLocationDropdown(!showLocationDropdown); setShowInitiativeDropdown(false) }}
                                    className="flex items-center pl-0 pr-2.5 sm:pr-3 h-8 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all shadow-sm flex-shrink-0"
                                    style={{
                                        border: selectedLocationIds.length > 0 ? `1.5px solid ${brandColor}` : '1px solid #e5e7eb',
                                        boxShadow: selectedLocationIds.length > 0
                                            ? `0 1px 2px rgba(15,23,42,0.06), 0 0 0 3px ${brandColor}20`
                                            : '0 1px 2px rgba(15,23,42,0.06)',
                                    }}
                                >
                                    <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <MapPin className="w-4 h-4 text-gray-600" />
                                    </div>
                                    <span className={`ml-1.5 sm:ml-2 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedLocationIds.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {selectedLocationIds.length > 0
                                            ? `${selectedLocationIds.length} loc.`
                                            : 'Location'
                                        }
                                    </span>
                                    {selectedLocationIds.length > 0 ? (
                                        <X className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-0.5 sm:ml-1" onClick={(e) => { e.stopPropagation(); setSelectedLocationIds([]) }} />
                                    ) : (
                                        <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                                    )}
                                </button>
                            )}

                            <PublicTagFilter
                                tags={tags}
                                selectedTagIds={selectedTagIds}
                                onChange={setSelectedTagIds}
                                activeColor={brandColor}
                                onOpenChange={(open) => { if (open) { setShowInitiativeDropdown(false); setShowLocationDropdown(false) } }}
                                className="!h-8 !text-xs !pr-2.5 sm:!pr-3 [&>div]:!w-8 [&>div]:!h-8 [&>div>svg]:!w-4 [&>div>svg]:!h-4 [&>span]:!ml-1.5 sm:[&>span]:!ml-2"
                            />

                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-0.5 px-1.5 py-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                >
                                    <X className="w-3 h-3" /> Clear
                                </button>
                            )}
                        </div>

                        {/* Right: Nexus Logo */}
                        <Link to="/" className="hidden sm:flex items-center gap-2 flex-shrink-0">
                            <div className="w-7 h-7 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm font-newsreader font-extralight text-foreground hidden lg:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Initiative Dropdown Portal */}
            {showInitiativeDropdown && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowInitiativeDropdown(false)} />
                    <div
                        className="fixed w-64 bg-white rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 z-[9999] py-1 max-h-64 overflow-y-auto"
                        style={(() => {
                            const rect = initiativeBtnRef.current?.getBoundingClientRect()
                            if (!rect) return {}
                            return { top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) }
                        })()}
                    >
                        <button
                            onClick={() => { setSelectedInitiative('all'); setShowInitiativeDropdown(false) }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/10 ${selectedInitiative === 'all' ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                }`}
                        >
                            All Initiatives
                        </button>
                        {initiatives.map(init => (
                            <button
                                key={init.id}
                                onClick={() => { setSelectedInitiative(init.id); setShowInitiativeDropdown(false) }}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/10 truncate ${selectedInitiative === init.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                    }`}
                            >
                                {init.title}
                            </button>
                        ))}
                    </div>
                </>,
                document.body
            )}

            {/* Location Dropdown Portal */}
            {showLocationDropdown && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationDropdown(false)} />
                    <div
                        className="fixed w-64 bg-white rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 z-[9999] py-1 max-h-64 overflow-y-auto"
                        style={(() => {
                            const rect = locationBtnRef.current?.getBoundingClientRect()
                            if (!rect) return {}
                            return { top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) }
                        })()}
                    >
                        {selectedLocationIds.length > 0 && (
                            <button
                                onClick={() => setSelectedLocationIds([])}
                                className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-gray-50 border-b border-gray-100"
                            >
                                Clear location filter
                            </button>
                        )}
                        {dropdownLocations.map(loc => {
                            const isSelected = selectedLocationIds.includes(loc.id)
                            return (
                                <button
                                    key={loc.id}
                                    onClick={() => {
                                        setSelectedLocationIds(prev =>
                                            isSelected
                                                ? prev.filter(id => id !== loc.id)
                                                : [...prev, loc.id]
                                        )
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-blue-50 font-medium' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-blue-600 border-2 border-blue-600' : 'border-2 border-gray-300 bg-white'
                                        }`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <span className={`truncate block ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{loc.name}</span>
                                        {loc.country && <span className="text-[10px] text-gray-500">{loc.country}</span>}
                                    </div>
                                </button>
                            )
                        })}
                        {dropdownLocations.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No locations available</div>
                        )}
                    </div>
                </>,
                document.body
            )}

            {/* Organization Hero Section */}
            <div className="flex flex-col md:flex-row md:items-start relative z-20">
                {/* Left Side - Logo, Name, Statement (aligned with feature area) */}
                <div className="hidden md:block w-16 flex-shrink-0"></div>
                <div className="w-full md:w-[45%] flex-shrink-0 p-3 md:px-4 md:pt-3 md:pb-2">
                    {/* Logo is now vertically centered with the title + statement
                        + Context pill column, and grown into the extra space the
                        button used to occupy below the row. */}
                    <div className="flex items-center gap-3 md:gap-4">
                        {/* Logo */}
                        <div className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-xl md:rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white border border-gray-100 shadow-sm">
                            {organization.logo_url ? (
                                <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-2xl md:text-3xl font-bold text-gray-400">{organization.name.charAt(0)}</span>
                            )}
                        </div>

                        {/* Name, Statement, Context pill (all aligned to the
                            same left edge so the pill starts in line with the
                            title and description). */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl md:text-2xl font-bold mb-0.5 leading-tight" style={{ color: '#465360' }}>{organization.name}</h1>
                            {organization.statement && (
                                <p className="text-sm md:text-[13.5px] leading-snug line-clamp-3 md:line-clamp-2" style={{ color: '#6b7280' }}>{organization.statement}</p>
                            )}

                            {/* Context & Challenges button. Modern white pill
                                with brand accent + soft shadow; arrow slides in
                                on hover. Lives inside the text column so it
                                aligns with the title/statement left edge. */}
                            {(() => {
                                const brand = organization.brand_color || '#c0dfa1'
                                return (
                                    <Link
                                        to={`${orgLinkBase}/${slug}/context`}
                                        className="group inline-flex items-center gap-2 mt-2 pl-1 pr-3.5 py-1 rounded-full text-xs font-semibold text-gray-900 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-px"
                                        style={{
                                            border: `1.5px solid ${brand}`,
                                            boxShadow: `0 1px 2px rgba(15,23,42,0.06), 0 4px 14px -8px ${brand}80`,
                                        }}
                                        title="Context & Challenges"
                                    >
                                        <span
                                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ring-1 ring-black/[0.04]"
                                            style={{ backgroundColor: brand }}
                                        >
                                            <Compass className="w-3 h-3 text-white" strokeWidth={2.5} />
                                        </span>
                                        <span>Context &amp; Challenges</span>
                                        <ArrowRight className="w-3 h-3 text-gray-400 -ml-1 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                                    </Link>
                                )
                            })()}
                        </div>
                    </div>
                </div>

                {/* Right Side - Initiatives Container (aligned with right panel)
                    `md:self-end` pins this column to the bottom of the hero row so the
                    single row of initiative tiles sits flush above the metrics section,
                    instead of floating at the top of the hero with whitespace below it.
                    Mobile: hidden here; rendered below the feature area instead so the
                    primary content (globe / highlights) sits closer to the toggle tabs. */}
                <div className="hidden md:block md:self-end flex-1 p-3 md:px-4 md:pt-2 md:pb-3 md:pl-2">
                    <div className="h-full flex flex-col">
                        <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                >
                                    <Target
                                        className="w-3.5 h-3.5 md:w-4 md:h-4"
                                        style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                    />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm md:text-base">Initiatives</h2>
                                <span
                                    className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
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
                        <div className="px-2 md:px-3 pb-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                {filteredInitiatives.slice(heroInitiativePage * 4, heroInitiativePage * 4 + 4).map((init) => (
                                    <Link
                                        key={init.id}
                                        to={`${orgLinkBase}/${slug}/${init.slug}`}
                                        className="px-3 py-2 bg-white rounded-xl border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all group flex flex-col justify-center"
                                    >
                                        <h4 className="font-medium text-foreground text-xs line-clamp-2 group-hover:text-accent transition-colors leading-snug">{init.title}</h4>
                                        {init.region && (
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                <MapPin className="w-2.5 h-2.5" />{init.region}
                                            </p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area - Fixed Height */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Mobile Toggle Tabs */}
                <div className="md:hidden flex items-center gap-2 py-2 px-3 bg-white border-b border-gray-100 flex-shrink-0 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&>button]:flex-shrink-0">
                    <button
                        onClick={() => chooseView('globe')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'globe'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Globe</span>
                    </button>
                    <button
                        onClick={() => chooseView('stories')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'stories'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Stories</span>
                    </button>
                    {highlightCards.length > 0 && (
                        <button
                            onClick={() => chooseView('highlights')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'highlights'
                                    ? 'bg-gray-800 text-white'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                        >
                            <Compass className="w-3.5 h-3.5" />
                            <span>Context</span>
                        </button>
                    )}
                    <button
                        onClick={() => chooseView('graph')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'graph'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <LineChart className="w-3.5 h-3.5" />
                        <span>Graph</span>
                    </button>
                    <button
                        onClick={() => chooseView('initiatives')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${activeView === 'initiatives'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        <Target className="w-3.5 h-3.5" />
                        <span>List</span>
                    </button>
                </div>

                {/* Left Sidebar - Toggle Icons (Desktop only) */}
                <div className="hidden md:flex w-16 flex-shrink-0 flex-col items-center py-4 gap-4 relative z-30">
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => chooseView('globe')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'globe'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                }`}
                        >
                            <Globe className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Globe
                        </div>
                    </div>
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => chooseView('stories')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'stories'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                }`}
                        >
                            <BookOpen className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Stories
                        </div>
                    </div>
                    {highlightCards.length > 0 && (
                        <div className="group relative z-[100]">
                            <button
                                onClick={() => chooseView('highlights')}
                                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'highlights'
                                        ? 'bg-gray-800 text-white shadow-lg scale-110'
                                        : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                    }`}
                            >
                                <Compass className="w-5 h-5" />
                            </button>
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                                Context & Challenges
                            </div>
                        </div>
                    )}
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => chooseView('graph')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'graph'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                }`}
                        >
                            <LineChart className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Graph
                        </div>
                    </div>
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => chooseView('initiatives')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${activeView === 'initiatives'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 hover:scale-105 border border-gray-100 shadow-sm'
                                }`}
                        >
                            <Target className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Initiatives
                        </div>
                    </div>
                </div>

                {/* Feature Area (Left-Center).
                    On mobile the graph view needs more vertical room, so we bump the
                    feature area height when graph is active. Right panel (metrics) just
                    shifts down — it's already scrollable on mobile. Desktop unchanged. */}
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
                                        className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
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
                                        <GlobeErrorBoundary>
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
                                        </GlobeErrorBoundary>
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
                                        const className = "absolute px-2 py-0.5 md:px-3 md:py-1.5 rounded-full text-white text-[10px] md:text-xs font-medium shadow-lg transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-xl whitespace-nowrap max-w-[45%] md:max-w-[40%] flex items-center"

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
                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
                                            style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                        >{filteredStories.length}</span>
                                    </div>
                                    {filteredStories.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setStoryIndex(p => p === 0 ? filteredStories.length - 1 : p - 1)}
                                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-muted-foreground w-12 text-center">{storyIndex + 1}/{filteredStories.length}</span>
                                            <button
                                                onClick={() => setStoryIndex(p => (p + 1) % filteredStories.length)}
                                                className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
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
                                        className="text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center gap-1"
                                    >
                                        View all <ChevronRight className="w-3 h-3" />
                                    </Link>
                                </div>
                                {/* Mobile: vertical stack with auto height + scroll if needed.
                                    Desktop: original 2-row grid kept unchanged. */}
                                <div className="flex-1 px-4 pb-4 pt-0 overflow-y-auto md:overflow-hidden">
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
                                                        className="group relative rounded-2xl bg-white border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all p-4 flex flex-col overflow-hidden md:min-h-0"
                                                    >
                                                        <div
                                                            className="absolute left-0 top-0 bottom-0 w-1"
                                                            style={{ backgroundColor: brandColor }}
                                                        />
                                                        <div className="flex items-center gap-2 mb-2 pl-1">
                                                            <span
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
                                                                style={{ backgroundColor: `${brandColor}30`, color: '#374151' }}
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
                                                            <span className="text-[11px] font-medium text-gray-500 group-hover:text-gray-800 transition-colors">
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
                                            className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
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
                                                    className="block p-4 bg-white rounded-xl border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all group"
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
                            <div className="h-full p-4">
                                <div className="h-full bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col">
                                    <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
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
                                    <div className="flex-1 p-4 overflow-hidden flex flex-col">
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
                                                                tick={{ fontSize: 10, fill: '#6b7280' }}
                                                                tickLine={false}
                                                                axisLine={false}
                                                                angle={-45}
                                                                textAnchor="end"
                                                                height={50}
                                                            />
                                                            <YAxis
                                                                tick={{ fontSize: 10, fill: '#6b7280' }}
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
                </div>

                {/* Right Panel */}
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
                                    className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
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
                                        className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all group flex flex-col justify-center min-h-[64px]"
                                    >
                                        <h4 className="font-medium text-foreground text-xs line-clamp-2 group-hover:text-accent transition-colors">{init.title}</h4>
                                        {init.region && (
                                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
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
                        {/* Key Metrics (Scrollable 2x2 Grid) */}
                        <div className="w-full md:w-[52%] overflow-hidden flex flex-col max-h-[320px] md:max-h-none md:min-h-0">
                            <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between flex-shrink-0">
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
                                        className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
                                        style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                    >{filteredMetrics.length}</span>
                                </div>
                            </div>
                            <div className="flex-1 p-2 md:p-3 overflow-y-auto min-h-0 scrollbar-thin">
                                {filteredMetrics.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                            <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                            <p className="text-sm">No metrics yet</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {filteredMetrics.map((metric) => (
                                            <Link
                                                key={metric.id}
                                                to={`${orgLinkBase}/${slug}/${metric.initiative_slug}/metric/${generateMetricSlug(metric.title)}`}
                                                className="group relative rounded-xl bg-white border border-gray-200/80 overflow-hidden shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all h-[88px] md:h-[15.5vh] flex flex-col"
                                            >
                                                {metric.unit_of_measurement && metric.metric_type !== 'percentage' && (
                                                    <span className="absolute top-1 right-1.5 md:top-1.5 md:right-2 text-[9px] md:text-[10px] font-medium text-gray-400 leading-tight truncate max-w-[60%] text-right">
                                                        {metric.unit_of_measurement}
                                                    </span>
                                                )}
                                                <div className="flex-1 px-3 py-1.5 md:py-2 flex items-center justify-center">
                                                    <span
                                                        className="text-xl md:text-3xl font-bold leading-none tabular-nums tracking-tight"
                                                        style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                                    >
                                                        {metric.total_value?.toLocaleString() || '—'}{metric.metric_type === 'percentage' ? '%' : ''}
                                                    </span>
                                                </div>
                                                <div
                                                    className="px-2 py-1 text-center border-t flex items-center justify-center"
                                                    style={{
                                                        backgroundColor: `${brandColor}15`,
                                                        borderColor: `${brandColor}25`,
                                                        minHeight: 32,
                                                    }}
                                                >
                                                    <span className="text-[10.5px] md:text-[11.5px] font-semibold text-gray-800 line-clamp-2 leading-tight">
                                                        {metric.title}{metric.metric_type === 'percentage' ? ' (avg)' : ''}
                                                    </span>
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Impact Claims Container (Scrollable) */}
                        <div className="w-full md:w-[48%] overflow-hidden flex flex-col max-h-[280px] md:max-h-none md:min-h-0">
                            <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between flex-shrink-0">
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
                                        className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
                                        style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                                    >{allImpactClaims.length}</span>
                                </div>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto scrollbar-thin">
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
                                                className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all group"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className="text-lg font-bold tabular-nums tracking-tight"
                                                                style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                                            >{claim.value?.toLocaleString()}{claim.metricType === 'percentage' ? '%' : ''}</span>
                                                            {claim.metricType !== 'percentage' && <span className="text-xs text-muted-foreground">{claim.metricUnit}</span>}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{claim.metricTitle}</p>
                                                        <p className="text-[10px] text-muted-foreground/70 truncate">{claim.initiativeTitle}</p>
                                                        {claim.tag_id && tagsById.get(claim.tag_id) && (
                                                            <div className="mt-1 flex">
                                                                <PublicTagChip
                                                                    name={tagsById.get(claim.tag_id)!.name}
                                                                    size="xs"
                                                                    onClick={() => setSelectedTagIds(prev => prev.includes(claim.tag_id!) ? prev.filter(x => x !== claim.tag_id!) : [...prev, claim.tag_id!])}
                                                                    selected={selectedTagIds.includes(claim.tag_id)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${claim.category === 'impact' ? 'bg-purple-100/80 text-purple-700' :
                                                                claim.category === 'output' ? 'bg-green-100/80 text-green-700' : 'bg-blue-100/80 text-blue-700'
                                                            }`}>{claim.category}</span>
                                                        <p className="text-[10px] text-muted-foreground mt-1">
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
                        <div className="px-3 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                                    style={{ backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(15,23,42,0.06), inset 0 0 0 1px rgba(15,23,42,0.06)' }}
                                >
                                    <Image
                                        className="w-3.5 h-3.5"
                                        style={{ color: brandColor, filter: 'saturate(1.15) brightness(0.85)' }}
                                    />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm">Evidence</h2>
                                <span
                                    className="px-2 py-0.5 text-[11px] font-semibold rounded-full text-gray-700"
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
                        <div className="flex-1 p-2 pb-3 min-h-0">
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
                                                className="rounded-xl overflow-hidden bg-white border border-gray-200/80 shadow-[0_2px_8px_-1px_rgba(15,23,42,0.10),0_4px_16px_-4px_rgba(15,23,42,0.10)] hover:shadow-[0_4px_12px_-2px_rgba(15,23,42,0.14),0_6px_20px_-6px_rgba(15,23,42,0.14)] hover:border-gray-300 transition-all group h-[120px] md:h-full"
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
                                                        <span className="text-[10px] md:text-xs font-medium text-muted-foreground px-1 md:px-2 text-center line-clamp-1 md:line-clamp-2">{ev.title || 'Document'}</span>
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
            </main>
        </div>
    )
}
