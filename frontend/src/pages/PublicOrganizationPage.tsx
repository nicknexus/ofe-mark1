import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    ArrowLeft,
    Building2,
    ChevronDown,
    ChevronRight,
    MapPin,
    Target,
    X,
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
    PublicMetricTag,
    PublicStatCard,
    OrganizationStats,
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagFilter from '../components/public/PublicTagFilter'
import DateRangePicker from '../components/DateRangePicker'
import { PublicPageBackground, PUBLIC_HEADER_CLASS, PUBLIC_PANEL_STATIC_CLASS } from '../components/public/publicStyles'
import { compareClaimsByEffectiveDateDesc } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import type { FeatureView } from '../components/public/organization/organizationTypes'
import { PublicOrganizationHero } from '../components/public/organization/PublicOrganizationHero'
import { PublicOrganizationViewToggles } from '../components/public/organization/PublicOrganizationViewToggles'
import { PublicOrganizationFeatureArea } from '../components/public/organization/PublicOrganizationFeatureArea'
import { PublicOrganizationRightPanel } from '../components/public/organization/PublicOrganizationRightPanel'


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
    const keyMetricsScrollRef = useRef<HTMLDivElement>(null)

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

    const [keyMetricsRowPx, setKeyMetricsRowPx] = useState<number | null>(null)
    useLayoutEffect(() => {
        const el = keyMetricsScrollRef.current
        if (!el || filteredMetrics.length === 0) {
            setKeyMetricsRowPx(null)
            return
        }
        const gapPx = 8
        const measure = () => {
            const h = el.clientHeight
            if (h <= 0) return
            setKeyMetricsRowPx(Math.max(124, Math.floor((h - gapPx) / 2)))
        }
        measure()
        const ro = new ResizeObserver(measure)
        ro.observe(el)
        return () => ro.disconnect()
    }, [filteredMetrics.length, loading])

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
                <div className={`${PUBLIC_PANEL_STATIC_CLASS} p-12 rounded-3xl text-center max-w-md`}>
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
            <header className={PUBLIC_HEADER_CLASS}>
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
                                    className="flex items-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
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
                        className="fixed w-64 bg-white rounded-xl shadow-modal border border-gray-100 z-[9999] py-1 max-h-64 overflow-y-auto"
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
                        className="fixed w-64 bg-white rounded-xl shadow-modal border border-gray-100 z-[9999] py-1 max-h-64 overflow-y-auto"
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
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-accent/10 font-medium' : 'hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-accent border-2 border-accent' : 'border-2 border-gray-300 bg-white'
                                        }`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <span className={`truncate block ${isSelected ? 'text-accent' : 'text-gray-900'}`}>{loc.name}</span>
                                        {loc.country && <span className="text-xs text-gray-500">{loc.country}</span>}
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


            <PublicOrganizationHero
                organization={organization}
                slug={slug!}
                orgLinkBase={orgLinkBase}
                brandColor={brandColor}
                filteredInitiatives={filteredInitiatives}
                heroInitiativePage={heroInitiativePage}
                setHeroInitiativePage={setHeroInitiativePage}
            />



            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                <PublicOrganizationViewToggles
                    activeView={activeView}
                    chooseView={chooseView}
                    highlightCards={highlightCards}
                />
                <PublicOrganizationFeatureArea
                    activeView={activeView}
                    brandColor={brandColor}
                    slug={slug!}
                    orgLinkBase={orgLinkBase}
                    filteredLocations={filteredLocations}
                    globeLocations={globeLocations}
                    activePopups={activePopups}
                    filteredStories={filteredStories}
                    storyIndex={storyIndex}
                    setStoryIndex={setStoryIndex}
                    currentStory={currentStory}
                    highlightCards={highlightCards}
                    filteredInitiatives={filteredInitiatives}
                    organization={organization}
                    initiativeChartData={initiativeChartData}
                    chartInitiatives={chartInitiatives}
                />
                <PublicOrganizationRightPanel
                    slug={slug!}
                    orgLinkBase={orgLinkBase}
                    brandColor={brandColor}
                    organization={organization}
                    filteredInitiatives={filteredInitiatives}
                    heroInitiativePage={heroInitiativePage}
                    setHeroInitiativePage={setHeroInitiativePage}
                    filteredMetrics={filteredMetrics}
                    keyMetricsScrollRef={keyMetricsScrollRef}
                    keyMetricsRowPx={keyMetricsRowPx}
                    allImpactClaims={allImpactClaims}
                    tagsById={tagsById}
                    selectedTagIds={selectedTagIds}
                    setSelectedTagIds={setSelectedTagIds}
                    filteredEvidence={filteredEvidence}
                    evidencePage={evidencePage}
                    setEvidencePage={setEvidencePage}
                    totalEvidencePages={totalEvidencePages}
                    displayedEvidence={displayedEvidence}
                />
            </main>

        </div>
    )
}
