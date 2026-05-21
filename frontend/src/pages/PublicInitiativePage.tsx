import React, { useEffect, useMemo, useState } from 'react'
import '../components/public/initiative/leafletSetup'
import { createPortal } from 'react-dom'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    ArrowLeft,
    BarChart3,
    BookOpen,
    Building2,
    ChevronDown,
    FileText,
    Globe,
    MapPin,
    Target,
    Users,
    X,
} from 'lucide-react'
import {
    publicApi,
    PublicBeneficiaryGroup,
    PublicEvidence,
    PublicInitiative,
    PublicLocation,
    PublicMetricTag,
    PublicStory,
    InitiativeDashboard,
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicTagFilter from '../components/public/PublicTagFilter'
import PublicDonateButton from '../components/public/PublicDonateButton'
import DateRangePicker from '../components/DateRangePicker'
import {
    PublicPageBackground,
    PUBLIC_HEADER_CLASS,
    PUBLIC_PANEL_STATIC_CLASS,
    PUBLIC_SECTION_CHIP_STYLE,
    publicActiveFilterStyle,
} from '../components/public/publicStyles'
import { getLocalDateString } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import { PublicTabTooltip } from '../components/public/initiative/PublicTabTooltip'
import { InitiativeOverviewTab } from '../components/public/initiative/InitiativeOverviewTab'
import { MetricsTab } from '../components/public/initiative/MetricsTab'
import { StoriesTab } from '../components/public/initiative/StoriesTab'
import { LocationsTab } from '../components/public/initiative/LocationsTab'
import { EvidenceTab } from '../components/public/initiative/EvidenceTab'
import { BeneficiariesTab } from '../components/public/initiative/BeneficiariesTab'

type TabType = 'overview' | 'metrics' | 'stories' | 'locations' | 'evidence' | 'beneficiaries'
export default function PublicInitiativePage() {
    const { orgSlug, initiativeSlug } = useParams<{ orgSlug: string; initiativeSlug: string }>()
    const navigate = useNavigate()
    const orgLinkBase = useOrgLinkBase()
    const [searchParams] = useSearchParams()

    const [initiative, setInitiative] = useState<PublicInitiative | null>(null)
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [initialLoading, setInitialLoading] = useState(true)
    const [switching, setSwitching] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Tab data
    const [stories, setStories] = useState<PublicStory[] | null>(null)
    const [locations, setLocations] = useState<PublicLocation[] | null>(null)
    const [evidence, setEvidence] = useState<PublicEvidence[] | null>(null)
    const [beneficiaries, setBeneficiaries] = useState<PublicBeneficiaryGroup[] | null>(null)

    // All initiatives for switcher
    const [allInitiatives, setAllInitiatives] = useState<PublicInitiative[]>([])
    const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false)
    const initiativeBtnRef = React.useRef<HTMLButtonElement>(null)

    // Location filter
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [showLocationDropdown, setShowLocationDropdown] = useState(false)
    const locationBtnRef = React.useRef<HTMLButtonElement>(null)

    // Tag filter
    const [tags, setTags] = useState<PublicMetricTag[]>([])
    const tagsById = useMemo(() => {
        const map = new Map<string, PublicMetricTag>()
        for (const t of tags) map.set(t.id, t)
        return map
    }, [tags])
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

    // Date filter state - initialize from URL params
    const [dateFilter, setDateFilter] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>(() => {
        const s = searchParams.get('startDate')
        const e = searchParams.get('endDate')
        if (s && e) return { startDate: s, endDate: e }
        if (s) return { singleDate: s }
        return {}
    })
    const startDate = dateFilter.singleDate || dateFilter.startDate || ''
    const endDate = dateFilter.endDate || dateFilter.singleDate || ''

    const dateQS = startDate && endDate ? `?startDate=${startDate}&endDate=${endDate}` : startDate ? `?startDate=${startDate}` : ''

    // Initialize tab from URL params
    useEffect(() => {
        const tabParam = searchParams.get('tab') as TabType | null
        if (tabParam && ['overview', 'metrics', 'stories', 'locations', 'evidence', 'beneficiaries'].includes(tabParam)) {
            setActiveTab(tabParam)
        }
    }, [searchParams])

    // Track if we've loaded before to detect switches
    const hasLoadedRef = React.useRef(false)

    useEffect(() => {
        if (orgSlug && initiativeSlug) {
            const isSwitch = hasLoadedRef.current
            loadInitiative(isSwitch)
            hasLoadedRef.current = true
        }
    }, [orgSlug, initiativeSlug])
    useEffect(() => { if (orgSlug && initiativeSlug) loadTabData(activeTab) }, [activeTab, orgSlug, initiativeSlug])

    // Load all initiatives for the org (for switcher)
    useEffect(() => {
        if (orgSlug) {
            publicApi.getOrganizationInitiatives(orgSlug).then(setAllInitiatives).catch(console.error)
        }
    }, [orgSlug])

    // Load org-wide tag catalog so the tag filter and chips know names/colors.
    useEffect(() => {
        if (orgSlug) {
            publicApi.getOrganizationTags(orgSlug).then(setTags).catch(() => setTags([]))
        }
    }, [orgSlug])

    // Tags actually present on this initiative's content (KPIs/stories/evidence).
    // Limits the dropdown to relevant tags rather than the whole org catalog.
    const initiativeTagIds = useMemo(() => {
        const set = new Set<string>()
        for (const k of dashboard?.kpis || []) {
            for (const id of k.tag_ids || []) set.add(id)
            for (const u of k.updates || []) if (u.tag_id) set.add(u.tag_id)
        }
        for (const s of stories || []) for (const id of s.tag_ids || []) set.add(id)
        for (const e of evidence || []) for (const id of e.tag_ids || []) set.add(id)
        return set
    }, [dashboard, stories, evidence])

    const initiativeTags = useMemo(
        () => tags.filter(t => initiativeTagIds.has(t.id)),
        [tags, initiativeTagIds]
    )

    const loadInitiative = async (isSwitch = false) => {
        try {
            if (isSwitch) {
                setSwitching(true)
            } else {
                setInitialLoading(true)
            }
            setError(null)

            // Clear tab data when switching initiatives
            if (isSwitch) {
                setStories(null)
                setLocations(null)
                setEvidence(null)
                setBeneficiaries(null)
            }

            const dashboardData = await publicApi.getInitiativeDashboard(orgSlug!, initiativeSlug!)
            if (!dashboardData) { setError('Initiative not found'); return }
            setInitiative(dashboardData.initiative)
            setDashboard(dashboardData)

            // After switching, reload the active tab's data since cache was cleared
            // (the separate loadTabData effect fires in the same render cycle and sees stale cached data)
            if (isSwitch) {
                try {
                    switch (activeTab) {
                        case 'stories': setStories(await publicApi.getInitiativeStories(orgSlug!, initiativeSlug!)); break
                        case 'locations': setLocations(await publicApi.getInitiativeLocations(orgSlug!, initiativeSlug!)); break
                        case 'evidence': setEvidence(await publicApi.getInitiativeEvidence(orgSlug!, initiativeSlug!)); break
                        case 'beneficiaries': setBeneficiaries(await publicApi.getInitiativeBeneficiaries(orgSlug!, initiativeSlug!)); break
                    }
                } catch (err) { console.error('Error reloading tab data:', err) }
            }
        } catch (err) {
            console.error('Error loading initiative:', err)
            setError('Failed to load initiative')
        } finally {
            setInitialLoading(false)
            setSwitching(false)
        }
    }

    const loadTabData = async (tab: TabType) => {
        if (!orgSlug || !initiativeSlug) return
        try {
            switch (tab) {
                case 'stories': if (!stories) setStories(await publicApi.getInitiativeStories(orgSlug, initiativeSlug)); break
                case 'locations': if (!locations) setLocations(await publicApi.getInitiativeLocations(orgSlug, initiativeSlug)); break
                case 'evidence': if (!evidence) setEvidence(await publicApi.getInitiativeEvidence(orgSlug, initiativeSlug)); break
                case 'beneficiaries': if (!beneficiaries) setBeneficiaries(await publicApi.getInitiativeBeneficiaries(orgSlug, initiativeSlug)); break
            }
        } catch (err) { console.error(`Error loading ${tab}:`, err) }
    }

    // Filter helpers
    const hasActiveFilters = startDate || endDate || selectedLocationIds.length > 0 || selectedTagIds.length > 0

    const clearFilters = () => {
        setDateFilter({})
        setSelectedLocationIds([])
        setSelectedTagIds([])
    }

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

    // Locations available for the dropdown (from dashboard or loaded locations)
    const availableLocations = useMemo(() => {
        if (locations && locations.length > 0) return locations
        if (dashboard?.locations && dashboard.locations.length > 0) return dashboard.locations
        return []
    }, [locations, dashboard])

    // Handle initiative switch
    const handleInitiativeSwitch = (slug: string) => {
        setShowInitiativeDropdown(false)
        if (slug === initiativeSlug) return

        // Build query params - preserve active tab and date filters
        const params = new URLSearchParams()
        if (activeTab !== 'overview') params.set('tab', activeTab)
        if (startDate) params.set('startDate', startDate)
        if (endDate) params.set('endDate', endDate)
        const queryString = params.toString()

        navigate(`${orgLinkBase}/${orgSlug}/${slug}${queryString ? `?${queryString}` : ''}`)
    }

    // Filter dashboard KPIs by date + tag + location — filter each KPI's
    // updates and recalculate totals so cards/charts/numbers all reflect the
    // active filters consistently.
    const filteredDashboard = useMemo(() => {
        if (!dashboard) return null
        if (!startDate && !endDate && selectedTagIds.length === 0 && selectedLocationIds.length === 0) return dashboard

        const sd = startDate ? new Date(startDate) : null
        const ed = endDate ? new Date(endDate + 'T23:59:59') : null

        let filteredKpis = dashboard.kpis.map(kpi => {
            if (!kpi.updates || kpi.updates.length === 0) return kpi

            const filtered = kpi.updates.filter(u => {
                const d = new Date(u.date_represented)
                if (sd && d < sd) return false
                if (ed && d > ed) return false
                if (selectedTagIds.length > 0 && !tagMatchesSingle(u.tag_id)) return false
                // Location filter: an update is kept only if its location_id
                // matches one of the selected locations. Updates without a
                // location_id are excluded when a location filter is active
                // (otherwise the filter would be effectively a no-op for any
                // metric with mostly "global" updates).
                if (selectedLocationIds.length > 0) {
                    if (!u.location_id || !selectedLocationIds.includes(u.location_id)) return false
                }
                return true
            })

            const totalValue = aggregateKpiUpdates(filtered as any, kpi.metric_type)
            return {
                ...kpi,
                updates: filtered,
                total_value: totalValue,
                update_count: filtered.length
            }
        })

        if (selectedTagIds.length > 0) {
            // Drop KPIs whose claims are not tagged with any of the selected
            // ids. A tag attached at the KPI level only declares which tags
            // its claims *may* carry, so falling back to `kpi.tag_ids` here
            // would surface metrics whose claims have nothing to do with the
            // selected tag (e.g. a freshly-created tag bound to a metric but
            // not yet applied to any claim).
            filteredKpis = filteredKpis.filter(kpi => (kpi.updates || []).length > 0)
        }

        if (selectedLocationIds.length > 0) {
            // Drop KPIs that ended up with no matching updates after the
            // location filter — keeping them would show "0" cards with no
            // explanation. This mirrors the org page's behavior.
            filteredKpis = filteredKpis.filter(kpi => (kpi.updates || []).length > 0)
        }

        return { ...dashboard, kpis: filteredKpis }
    }, [dashboard, startDate, endDate, selectedTagIds, selectedLocationIds])

    // Filter stories by date + location + tags
    const filteredStories = useMemo(() => {
        if (!stories) return null
        let filtered = stories

        if (selectedLocationIds.length > 0) {
            filtered = filtered.filter(s => {
                const storyLocIds = s.locations?.map((l: any) => l.id) || (s.location?.id ? [s.location.id] : [])
                return storyLocIds.some((id: string) => selectedLocationIds.includes(id))
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
    }, [stories, startDate, endDate, selectedLocationIds, selectedTagIds])

    // Filter evidence by date + location + tags
    const filteredEvidence = useMemo(() => {
        if (!evidence) return null
        let filtered = evidence

        if (selectedLocationIds.length > 0) {
            filtered = filtered.filter(e => {
                if (e.locations && e.locations.length > 0) {
                    return e.locations.some((loc: any) => selectedLocationIds.includes(loc.id))
                }
                // Evidence has no direct locations → fall back to checking
                // whether any of its impact claims reference a selected
                // location, so location-scoped evidence still shows up.
                if ((e as any).impact_claims && (e as any).impact_claims.length > 0) {
                    return (e as any).impact_claims.some((c: any) => c.location_id && selectedLocationIds.includes(c.location_id))
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
                const evidenceDate = new Date(e.date_represented)
                if (startDate && evidenceDate < new Date(startDate)) return false
                if (endDate && evidenceDate > new Date(endDate + 'T23:59:59')) return false
                return true
            })
        }

        return filtered
    }, [evidence, startDate, endDate, selectedLocationIds, selectedTagIds])

    // Early returns for initial loading/error states must come before accessing dashboard
    if (initialLoading && !initiative) {
        return <PublicLoader message="Loading initiative..." />
    }

    if (error || !initiative || !dashboard) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="rounded-3xl bg-white border border-gray-200/80 shadow-public p-12 text-center max-w-md">
                    <Globe className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Initiative Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error || 'This initiative does not exist.'}</p>
                    <Link to={`${orgLinkBase}/${orgSlug}`} className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Organization
                    </Link>
                </div>
            </div>
        )
    }

    const tabs: { id: TabType; label: string; icon: any; count?: number; tooltip: string }[] = [
        { id: 'overview', label: 'Overview', icon: Globe, tooltip: 'A snapshot of this initiative\'s key stats, metrics, and recent activity' },
        { id: 'metrics', label: 'Metrics', icon: BarChart3, count: filteredDashboard?.kpis.length || 0, tooltip: 'Measurable indicators tracking inputs, outputs, and impact over time' },
        { id: 'stories', label: 'Stories', icon: BookOpen, count: filteredStories?.length ?? dashboard.stats.stories, tooltip: 'First-hand accounts and narratives from the people and communities involved' },
        { id: 'locations', label: 'Locations', icon: MapPin, count: dashboard.stats.locations, tooltip: 'Geographic areas where this initiative operates and collects data' },
        { id: 'evidence', label: 'Evidence', icon: FileText, count: filteredEvidence?.length ?? dashboard.stats.evidence, tooltip: 'Photos, documents, and files that verify and support reported outcomes' },
        { id: 'beneficiaries', label: 'Beneficiaries', icon: Users, tooltip: 'The people and communities this initiative aims to serve' }
    ]

    // Brand color with fallback
    const brandColor = initiative.organization_brand_color || '#c0dfa1'

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            <PublicPageBackground brandColor={brandColor} />

            {/* Header with Filters — matches the public org dashboard. */}
            <header className={`sticky top-0 z-40 ${PUBLIC_HEADER_CLASS}`}>
                <div className="px-2 sm:px-3 md:px-5 py-2 sm:py-2.5">
                    <div className="flex items-center gap-1.5 sm:gap-3">
                        {/* Left: Nav + Org */}
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                            <Link to={`${orgLinkBase}/${orgSlug}`} className="flex items-center gap-1 text-muted-foreground hover:text-accent transition-colors flex-shrink-0">
                                <ArrowLeft className="w-4 h-4" />
                            </Link>
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50 flex-shrink-0">
                                {initiative.organization_logo_url ? (
                                    <img src={initiative.organization_logo_url} alt={initiative.organization_name || ''} className="w-full h-full object-cover" />
                                ) : (
                                    <Building2 className="w-4 h-4 text-gray-400" />
                                )}
                            </div>
                            {/* Top-bar title shows the CHARITY name; the initiative
                                is identified by the switcher pill below + the main page
                                content, so duplicating it here is just noise. */}
                            <h1 className="text-sm font-semibold text-foreground truncate max-w-[100px] md:max-w-[180px] hidden sm:block">{initiative.organization_name}</h1>
                            <PublicDonateButton orgSlug={orgSlug} />
                        </div>

                        {/* Center: Filters */}
                        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-none">
                            {/* Initiative Switcher — always carries the brand
                                border since this page is initiative-scoped. */}
                            <button
                                ref={initiativeBtnRef}
                                onClick={() => { setShowInitiativeDropdown(!showInitiativeDropdown); setShowLocationDropdown(false) }}
                                className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all flex-shrink-0"
                                style={publicActiveFilterStyle(brandColor, true)}
                            >
                                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                    <Target className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                                <span className="ml-1 sm:ml-1.5 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate text-gray-900">
                                    {initiative.title}
                                </span>
                                <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                            </button>

                            {/* Date Range Picker */}
                            <div className="flex-shrink-0">
                                <DateRangePicker
                                    value={dateFilter}
                                    onChange={setDateFilter}
                                    maxDate={getLocalDateString(new Date())}
                                    placeholder="Date"
                                    activeColor={brandColor}
                                    className="[&>button]:h-7 [&>button]:text-xs [&>button]:pr-1.5 sm:[&>button]:pr-2.5 [&>button>div]:w-7 [&>button>div]:h-7 [&>button>div>svg]:w-3.5 [&>button>div>svg]:h-3.5 [&>button>span]:ml-1 sm:[&>button>span]:ml-1.5"
                                />
                            </div>

                            {/* Location Filter */}
                            {availableLocations.length > 0 && (
                                <button
                                    ref={locationBtnRef}
                                    onClick={() => { setShowLocationDropdown(!showLocationDropdown); setShowInitiativeDropdown(false) }}
                                    className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all flex-shrink-0"
                                    style={publicActiveFilterStyle(brandColor, selectedLocationIds.length > 0)}
                                >
                                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <MapPin className="w-3.5 h-3.5 text-gray-600" />
                                    </div>
                                    <span className={`ml-1 sm:ml-1.5 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedLocationIds.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
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
                                tags={initiativeTags}
                                selectedTagIds={selectedTagIds}
                                onChange={setSelectedTagIds}
                                activeColor={brandColor}
                                onOpenChange={(open) => { if (open) { setShowInitiativeDropdown(false); setShowLocationDropdown(false) } }}
                            />

                            {hasActiveFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                >
                                    <X className="w-2.5 h-2.5" /> Clear
                                </button>
                            )}
                        </div>

                        {/* Right: Nexus Logo */}
                        <Link to="/" className="hidden sm:flex items-center gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-lg overflow-hidden">
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
                        {allInitiatives.map(init => (
                            <button
                                key={init.id}
                                onClick={() => handleInitiativeSwitch(init.slug)}
                                className={`w-full px-3 py-2 text-left text-sm hover:bg-accent/10 truncate ${init.slug === initiativeSlug ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
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
                        {availableLocations.map((loc: any) => {
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
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-primary-50 font-medium' : 'hover:bg-gray-50'
                                    }`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary-600 border-2 border-primary-600' : 'border-2 border-gray-300 bg-white'
                                    }`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <span className={`truncate block ${isSelected ? 'text-primary-800' : 'text-gray-900'}`}>{loc.name}</span>
                                        {loc.description && <span className="text-xs text-gray-500">{loc.description}</span>}
                                    </div>
                                </button>
                            )
                        })}
                        {availableLocations.length === 0 && (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground">No locations available</div>
                        )}
                    </div>
                </>,
                document.body
            )}

            {/* Main Content with Sidebar */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 relative">
                {/* Breadcrumb - Hidden on mobile */}
                <div className="hidden sm:block">
                    <PublicBreadcrumb
                        items={[
                            { label: initiative.title }
                        ]}
                        orgSlug={orgSlug!}
                        orgName={initiative.organization_name || 'Organization'}
                    />
                </div>

                <div className="flex gap-6">
                    {/* Sidebar */}
                    <div className="w-56 flex-shrink-0 hidden lg:block">
                        <div className="sticky top-[140px]">
                            {/* Initiative Info Card */}
                            <div className={`${PUBLIC_PANEL_STATIC_CLASS} p-4 mb-4`}>
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden" style={PUBLIC_SECTION_CHIP_STYLE}>
                                        {initiative.organization_logo_url ? (
                                            <img src={initiative.organization_logo_url} alt={initiative.organization_name || 'Organization'} className="w-full h-full object-cover" />
                                        ) : (
                                            <Globe className="w-5 h-5 text-gray-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-semibold text-foreground text-sm truncate">{initiative.title}</h2>
                                        <Link to={`${orgLinkBase}/${orgSlug}`} className="text-xs text-muted-foreground hover:text-foreground font-medium">
                                            {initiative.organization_name}
                                        </Link>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/50">
                                    <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.kpis}</p>
                                        <p className="text-xs text-muted-foreground font-medium">Metrics</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.evidence}</p>
                                        <p className="text-xs text-muted-foreground font-medium">Evidence</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-gray-50 border border-gray-100">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.stories}</p>
                                        <p className="text-xs text-muted-foreground font-medium">Stories</p>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <nav className={`${PUBLIC_PANEL_STATIC_CLASS} space-y-1 p-2`}>
                                {tabs.map((tab) => (
                                    <div key={tab.id} className="flex items-center gap-1">
                                        <button
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                                ? 'bg-gray-800 text-white shadow-lg'
                                                : 'text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            <span className="flex-1 text-left">{tab.label}</span>
                                            {tab.count !== undefined && (
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${activeTab === tab.id
                                                    ? 'bg-white/20 text-white'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                        <PublicTabTooltip text={tab.tooltip} />
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Mobile Tab Bar */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_8px_rgba(15,23,42,0.06)] z-30 safe-area-pb">
                        <div className="flex justify-around px-1 py-2">
                            {tabs.slice(0, 5).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-[52px] ${activeTab === tab.id
                                        ? 'text-foreground'
                                        : 'text-muted-foreground'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-lg transition-colors ${activeTab === tab.id ? 'bg-primary-100' : ''}`}>
                                        <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-primary-600' : ''}`} />
                                    </div>
                                    <span className="text-xs font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 pb-24 lg:pb-0 relative">
                        {switching ? (
                            <div className="flex items-center justify-center py-32">
                                <div className="flex flex-col items-center">
                                    {/* Nexus Logo */}
                                    <div className="w-12 h-12 mb-4">
                                        <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                    </div>
                                    {/* Three bouncing dots */}
                                    <div className="flex items-center gap-1.5 mb-3">
                                        <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                                        <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                                    </div>
                                    <p className="text-gray-400 text-sm font-medium">Loading...</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {activeTab === 'overview' && filteredDashboard && <InitiativeOverviewTab initiative={initiative} dashboard={filteredDashboard} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} dateQS={dateQS} tagsById={tagsById} onTagClick={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} selectedTagIds={selectedTagIds} />}
                                {activeTab === 'metrics' && filteredDashboard && <MetricsTab dashboard={filteredDashboard} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} dateQS={dateQS} tagsById={tagsById} onTagClick={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} selectedTagIds={selectedTagIds} />}
                                {activeTab === 'stories' && <StoriesTab stories={filteredStories} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} dateQS={dateQS} tagsById={tagsById} onTagClick={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} selectedTagIds={selectedTagIds} />}
                                {activeTab === 'locations' && <LocationsTab locations={locations || dashboard.locations} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} dateQS={dateQS} />}
                                {activeTab === 'evidence' && <EvidenceTab evidence={filteredEvidence} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} dateQS={dateQS} tagsById={tagsById} onTagClick={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])} selectedTagIds={selectedTagIds} />}
                                {activeTab === 'beneficiaries' && <BeneficiariesTab beneficiaries={beneficiaries} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
