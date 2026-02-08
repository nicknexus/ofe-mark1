import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
    ArrowLeft, Globe, BarChart3, BookOpen, MapPin,
    FileText, Users, Calendar, ChevronRight, ChevronLeft, ExternalLink, TrendingUp,
    Building2, ChevronDown, Filter, X, Activity, Layers, Zap,
    Camera, MessageSquare, DollarSign, Target, Loader2, HelpCircle
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar
} from 'recharts'
import { createPortal } from 'react-dom'
import {
    publicApi,
    PublicInitiative,
    PublicKPI,
    PublicStory,
    PublicLocation,
    PublicEvidence,
    PublicBeneficiaryGroup,
    InitiativeDashboard,
    LocationDetail
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import DateRangePicker from '../components/DateRangePicker'
import { getLocalDateString } from '../utils'

// Map tile configuration - matches internal app
const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

delete (L.Icon.Default.prototype as any)._getIconUrl

// Tile layer with fallback
function TileLayerWithFallback() {
    const [useFallback, setUseFallback] = useState(false)
    const map = useMap()

    useEffect(() => {
        if (useFallback) return
        const testImg = new Image()
        testImg.onerror = () => setUseFallback(true)
        testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
        return () => { testImg.onerror = null }
    }, [useFallback])

    return (
        <TileLayer
            attribution={useFallback ? '&copy; OpenStreetMap contributors' : CARTO_ATTRIBUTION}
            url={useFallback ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : CARTO_VOYAGER_URL}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
    )
}

// Custom marker matching internal app style
function LocationMarker({ location }: { location: PublicLocation }) {
    const [isHovered, setIsHovered] = useState(false)

    const icon = useMemo(() => {
        const size = isHovered ? 36 : 32
        const color = '#c0dfa1'

        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${isHovered ? `
                        <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background-color: ${color}; opacity: 0.2; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${color}; opacity: 0.3;"></div>
                    ` : ''}
                    <div style="width: ${isHovered ? '24px' : '20px'}; height: ${isHovered ? '24px' : '20px'}; border-radius: 50%; background-color: ${color}; border: ${isHovered ? '4px' : '3px'} solid white; position: relative; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${isHovered ? '10px' : '8px'}; height: ${isHovered ? '10px' : '8px'}; border-radius: 50%; background-color: white;"></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isHovered])

    return (
        <Marker position={[location.latitude, location.longitude]} icon={icon}
            eventHandlers={{ mouseover: () => setIsHovered(true), mouseout: () => setIsHovered(false) }}>
            <Tooltip direction="top" offset={[0, -15]}>
                <div className="font-sans">
                    <p className="font-semibold text-sm">{location.name}</p>
                    {location.description && <p className="text-xs text-gray-500">{location.description}</p>}
                </div>
            </Tooltip>
        </Marker>
    )
}

function MapResizeHandler() {
    const map = useMap()
    useEffect(() => {
        const resizeObserver = new ResizeObserver(() => map.invalidateSize())
        resizeObserver.observe(map.getContainer())
        map.invalidateSize()
        return () => resizeObserver.disconnect()
    }, [map])
    return null
}

type TabType = 'overview' | 'metrics' | 'stories' | 'locations' | 'evidence' | 'beneficiaries'

function TabTooltip({ text }: { text: string }) {
    const [show, setShow] = useState(false)
    const [pos, setPos] = useState({ top: 0, left: 0 })
    const ref = React.useRef<HTMLButtonElement>(null)

    const handleEnter = () => {
        if (ref.current) {
            const rect = ref.current.getBoundingClientRect()
            setPos({ top: rect.top + rect.height / 2, left: rect.right + 10 })
        }
        setShow(true)
    }

    return (
        <>
            <button
                ref={ref}
                onMouseEnter={handleEnter}
                onMouseLeave={() => setShow(false)}
                className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-white/60 transition-colors"
            >
                <HelpCircle className="w-3.5 h-3.5" />
            </button>
            {show && createPortal(
                <div
                    className="fixed px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-xl max-w-[220px] leading-relaxed pointer-events-none"
                    style={{ top: pos.top, left: pos.left, transform: 'translateY(-50%)', zIndex: 9999 }}
                >
                    {text}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-gray-800" />
                </div>,
                document.body
            )}
        </>
    )
}

export default function PublicInitiativePage() {
    const { orgSlug, initiativeSlug } = useParams<{ orgSlug: string; initiativeSlug: string }>()
    const navigate = useNavigate()
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
    const hasActiveFilters = startDate || endDate

    const clearFilters = () => {
        setDateFilter({})
    }

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

        navigate(`/org/${orgSlug}/${slug}${queryString ? `?${queryString}` : ''}`)
    }

    // Filter dashboard KPIs by date — filter each KPI's updates and recalculate totals
    const filteredDashboard = useMemo(() => {
        if (!dashboard) return null
        if (!startDate && !endDate) return dashboard

        const sd = startDate ? new Date(startDate) : null
        const ed = endDate ? new Date(endDate + 'T23:59:59') : null

        const filteredKpis = dashboard.kpis.map(kpi => {
            if (!kpi.updates || kpi.updates.length === 0) return kpi

            const filtered = kpi.updates.filter(u => {
                const d = new Date(u.date_represented)
                if (sd && d < sd) return false
                if (ed && d > ed) return false
                return true
            })

            const totalValue = filtered.reduce((sum, u) => sum + (u.value || 0), 0)
            return {
                ...kpi,
                updates: filtered,
                total_value: totalValue,
                update_count: filtered.length
            }
        })

        return { ...dashboard, kpis: filteredKpis }
    }, [dashboard, startDate, endDate])

    // Filter stories by date
    const filteredStories = useMemo(() => {
        if (!stories) return null
        if (!startDate && !endDate) return stories

        return stories.filter(s => {
            const storyDate = new Date(s.date_represented)
            if (startDate && storyDate < new Date(startDate)) return false
            if (endDate && storyDate > new Date(endDate + 'T23:59:59')) return false
            return true
        })
    }, [stories, startDate, endDate])

    // Filter evidence by date
    const filteredEvidence = useMemo(() => {
        if (!evidence) return null
        if (!startDate && !endDate) return evidence

        return evidence.filter(e => {
            const evidenceDate = new Date(e.date_represented)
            if (startDate && evidenceDate < new Date(startDate)) return false
            if (endDate && evidenceDate > new Date(endDate + 'T23:59:59')) return false
            return true
        })
    }, [evidence, startDate, endDate])

    // Early returns for initial loading/error states must come before accessing dashboard
    if (initialLoading && !initiative) {
        return <PublicLoader message="Loading initiative..." />
    }

    if (error || !initiative || !dashboard) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <Globe className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Initiative Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error || 'This initiative does not exist.'}</p>
                    <Link to={`/org/${orgSlug}`} className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
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
            {/* Flowing gradient background */}
            <div
                className="fixed inset-0 pointer-events-none"
                style={{
                    background: `
                        radial-gradient(ellipse 80% 50% at 20% 40%, ${brandColor}90, transparent 60%),
                        radial-gradient(ellipse 60% 80% at 80% 20%, ${brandColor}70, transparent 55%),
                        radial-gradient(ellipse 50% 60% at 60% 80%, ${brandColor}60, transparent 55%),
                        radial-gradient(ellipse 70% 40% at 10% 90%, ${brandColor}50, transparent 50%),
                        linear-gradient(180deg, white 0%, #fafafa 100%)
                    `
                }}
            />

            {/* Fixed Header with Filter - Compact like org page */}
            <header className="sticky top-0 z-40 bg-white/60 backdrop-blur-2xl border-b border-white/40 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    {/* Top Row - Nav + Initiative Info + Logo */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <Link to={`/org/${orgSlug}`} className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-accent transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-xs sm:text-sm font-medium">Back</span>
                            </Link>
                            <div className="h-5 sm:h-6 w-px bg-gray-200" />
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50">
                                    {initiative.organization_logo_url ? (
                                        <img src={initiative.organization_logo_url} alt={initiative.organization_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate max-w-[120px] sm:max-w-[300px]">{initiative.title}</h1>
                                    <Link to={`/org/${orgSlug}`} className="text-[10px] sm:text-xs font-medium text-muted-foreground hover:text-accent transition-colors hidden sm:block">
                                        {initiative.organization_name}
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-base font-newsreader font-extralight text-foreground hidden md:block">Nexus Impacts</span>
                        </Link>
                    </div>

                    {/* Filter Row */}
                    <div className="flex items-center gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-200/50 flex-wrap pb-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="font-medium hidden sm:inline">Filter:</span>
                        </div>

                        {/* Initiative Switcher Dropdown */}
                        <div className="relative flex-shrink-0">
                            <button
                                onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border bg-gray-800 text-white border-gray-800 text-xs sm:text-sm font-medium transition-colors hover:bg-gray-700"
                            >
                                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span className="max-w-[80px] sm:max-w-[120px] truncate">{initiative.title}</span>
                                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>

                            {showInitiativeDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowInitiativeDropdown(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-64 sm:w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 max-h-64 overflow-y-auto">
                                        {allInitiatives.map(init => (
                                            <button
                                                key={init.id}
                                                onClick={() => handleInitiativeSwitch(init.slug)}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent/10 ${init.slug === initiativeSlug ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                                    }`}
                                            >
                                                <span className="truncate">{init.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Date Range Picker */}
                        <div className="hidden sm:block flex-shrink-0">
                            <DateRangePicker
                                value={dateFilter}
                                onChange={setDateFilter}
                                maxDate={getLocalDateString(new Date())}
                                placeholder="Filter by date"
                                className="w-auto"
                            />
                        </div>

                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </header>

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
                            <div className="bg-white/40 backdrop-blur-2xl p-4 rounded-2xl border border-white/60 shadow-xl shadow-black/5 mb-4">
                                <div className="flex items-center gap-3 mb-3">
                                    <div className="w-11 h-11 bg-white/60 rounded-xl flex items-center justify-center flex-shrink-0 border border-white/50 overflow-hidden shadow-md">
                                        {initiative.organization_logo_url ? (
                                            <img src={initiative.organization_logo_url} alt={initiative.organization_name || 'Organization'} className="w-full h-full object-cover" />
                                        ) : (
                                            <Globe className="w-5 h-5 text-gray-500" />
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="font-semibold text-foreground text-sm truncate">{initiative.title}</h2>
                                        <Link to={`/org/${orgSlug}`} className="text-xs text-muted-foreground hover:text-foreground font-medium">
                                            {initiative.organization_name}
                                        </Link>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/50">
                                    <div className="text-center p-2 rounded-lg bg-white/40">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.kpis}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">Metrics</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-white/40">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.evidence}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">Evidence</p>
                                    </div>
                                    <div className="text-center p-2 rounded-lg bg-white/40">
                                        <p className="text-lg font-bold text-foreground">{dashboard.stats.stories}</p>
                                        <p className="text-[10px] text-muted-foreground font-medium">Stories</p>
                                    </div>
                                </div>
                            </div>

                            {/* Navigation Tabs */}
                            <nav className="space-y-1 bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-2">
                                {tabs.map((tab) => (
                                    <div key={tab.id} className="flex items-center gap-1">
                                        <button
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                                ? 'bg-gray-800 text-white shadow-lg'
                                                : 'text-gray-700 hover:bg-white/60'
                                                }`}
                                        >
                                            <tab.icon className="w-4 h-4" />
                                            <span className="flex-1 text-left">{tab.label}</span>
                                            {tab.count !== undefined && (
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${activeTab === tab.id
                                                    ? 'bg-white/30 text-white'
                                                    : 'bg-white/60 text-gray-600'
                                                    }`}>
                                                    {tab.count}
                                                </span>
                                            )}
                                        </button>
                                        <TabTooltip text={tab.tooltip} />
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Mobile Tab Bar */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl border-t border-gray-200 z-30 safe-area-pb">
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
                                    <span className="text-[9px] font-medium">{tab.label}</span>
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
                                {activeTab === 'overview' && filteredDashboard && <InitiativeOverviewTab initiative={initiative} dashboard={filteredDashboard} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'metrics' && filteredDashboard && <MetricsTab dashboard={filteredDashboard} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'stories' && <StoriesTab stories={filteredStories} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'locations' && <LocationsTab locations={locations || dashboard.locations} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'evidence' && <EvidenceTab evidence={filteredEvidence} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'beneficiaries' && <BeneficiariesTab beneficiaries={beneficiaries} />}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// Tab Components
// ============================================

// Color palette for charts - matches MetricsDashboard
const METRIC_COLOR_PALETTE = [
    '#3b82f6', // blue
    '#10b981', // green
    '#8b5cf6', // purple
    '#f59e0b', // amber
    '#ef4444', // red
    '#06b6d4', // cyan
    '#ec4899', // pink
    '#84cc16', // lime
    '#f97316', // orange
    '#6366f1', // indigo
    '#14b8a6', // teal
    '#a855f7', // violet
]

const getMetricColor = (index: number): string => {
    return METRIC_COLOR_PALETTE[index % METRIC_COLOR_PALETTE.length]
}

const CATEGORY_COLORS = {
    input: '#3b82f6',
    output: '#10b981',
    impact: '#8b5cf6'
}

// Initiative Overview - Modern dashboard with multi-line chart like MetricsDashboard
function InitiativeOverviewTab({ initiative, dashboard, orgSlug, initiativeSlug }: {
    initiative: PublicInitiative;
    dashboard: InitiativeDashboard;
    orgSlug: string;
    initiativeSlug: string;
}) {
    const brandColor = initiative.organization_brand_color || '#c0dfa1'
    const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year'>('all')
    const [isCumulative, setIsCumulative] = useState(false)
    const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set(dashboard.kpis.map(k => k.id)))
    const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false)
    const [descExpanded, setDescExpanded] = useState(false)
    const descRef = React.useRef<HTMLParagraphElement>(null)
    const [descClamped, setDescClamped] = useState(false)

    useEffect(() => {
        const el = descRef.current
        if (el) {
            setDescClamped(el.scrollHeight > el.clientHeight + 2)
        }
    }, [initiative.description])

    // Flatten all updates from all KPIs
    const allUpdates = useMemo(() => {
        const updates: Array<{ kpi_id: string; value: number; date_represented: string }> = []
        dashboard.kpis.forEach(kpi => {
            if (kpi.updates && kpi.updates.length > 0) {
                kpi.updates.forEach(update => {
                    updates.push({
                        kpi_id: kpi.id,
                        value: update.value,
                        date_represented: update.date_represented
                    })
                })
            }
        })
        return updates
    }, [dashboard.kpis])

    // Generate chart data similar to MetricsDashboard
    const chartData = useMemo(() => {
        if (allUpdates.length === 0 || visibleKPIs.size === 0) return []

        // Get date range
        const now = new Date()
        let startDate: Date

        if (timeFrame === 'all') {
            // Find oldest update
            const oldestDate = allUpdates.reduce((oldest, update) => {
                const d = new Date(update.date_represented)
                return d < oldest ? d : oldest
            }, new Date())
            startDate = new Date(oldestDate)
            startDate.setMonth(startDate.getMonth() - 1)
        } else {
            startDate = new Date()
            switch (timeFrame) {
                case '1month': startDate.setMonth(now.getMonth() - 1); break
                case '6months': startDate.setMonth(now.getMonth() - 6); break
                case '1year': startDate.setFullYear(now.getFullYear() - 1); break
            }
        }

        // Group updates by KPI
        const updatesByKPI: Record<string, Array<{ value: number; date: Date }>> = {}
        allUpdates.forEach(update => {
            if (!updatesByKPI[update.kpi_id]) {
                updatesByKPI[update.kpi_id] = []
            }
            updatesByKPI[update.kpi_id].push({
                value: update.value,
                date: new Date(update.date_represented)
            })
        })

        // Sort updates by date
        Object.keys(updatesByKPI).forEach(kpiId => {
            updatesByKPI[kpiId].sort((a, b) => a.date.getTime() - b.date.getTime())
        })

        if (!isCumulative) {
            // Monthly aggregation
            const monthlyTotals: Record<string, Record<string, number>> = {}

            Object.keys(updatesByKPI).forEach(kpiId => {
                if (!visibleKPIs.has(kpiId)) return
                updatesByKPI[kpiId].forEach(update => {
                    if (update.date < startDate) return
                    const monthKey = `${update.date.getFullYear()}-${String(update.date.getMonth() + 1).padStart(2, '0')}`
                    if (!monthlyTotals[monthKey]) monthlyTotals[monthKey] = {}
                    if (!monthlyTotals[monthKey][kpiId]) monthlyTotals[monthKey][kpiId] = 0
                    monthlyTotals[monthKey][kpiId] += update.value
                })
            })

            // Generate data points for each month
            const result: any[] = []
            let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
            const endDate = new Date(now.getFullYear(), now.getMonth(), 1)

            while (currentDate <= endDate) {
                const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
                const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

                const dataPoint: any = { date: monthLabel, fullDate: new Date(currentDate) }
                Array.from(visibleKPIs).forEach(kpiId => {
                    dataPoint[kpiId] = monthlyTotals[monthKey]?.[kpiId] || 0
                })
                result.push(dataPoint)

                currentDate.setMonth(currentDate.getMonth() + 1)
            }

            return result
        } else {
            // Cumulative - daily data points
            const result: any[] = []
            const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 3600 * 24))

            for (let i = 0; i <= daysDiff; i++) {
                const currentDate = new Date(startDate)
                currentDate.setDate(startDate.getDate() + i)
                if (currentDate > now) break

                const dateLabel = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                const dataPoint: any = { date: dateLabel, fullDate: new Date(currentDate) }

                // Calculate cumulative for each visible KPI
                Array.from(visibleKPIs).forEach(kpiId => {
                    const cumulative = (updatesByKPI[kpiId] || [])
                        .filter(u => u.date <= currentDate)
                        .reduce((sum, u) => sum + u.value, 0)
                    dataPoint[kpiId] = cumulative
                })

                result.push(dataPoint)
            }

            // Reduce data points for better performance (every 7th day for cumulative)
            if (result.length > 60) {
                return result.filter((_, i) => i % 7 === 0 || i === result.length - 1)
            }
            return result
        }
    }, [allUpdates, timeFrame, isCumulative, visibleKPIs])

    // Category breakdown data
    const categoryData = useMemo(() => {
        const categories = { input: 0, output: 0, impact: 0 }
        dashboard.kpis.forEach(kpi => {
            if (kpi.category && categories.hasOwnProperty(kpi.category)) {
                categories[kpi.category as keyof typeof categories]++
            }
        })
        return Object.entries(categories)
            .filter(([_, count]) => count > 0)
            .map(([category, count]) => ({
                name: category.charAt(0).toUpperCase() + category.slice(1),
                value: count,
                color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS]
            }))
    }, [dashboard.kpis])

    const totalDataPoints = useMemo(() => {
        return dashboard.kpis.reduce((sum, kpi) => sum + (kpi.update_count || 0), 0)
    }, [dashboard.kpis])

    const toggleKPI = (kpiId: string) => {
        setVisibleKPIs(prev => {
            const newSet = new Set(prev)
            if (newSet.has(kpiId)) {
                newSet.delete(kpiId)
            } else {
                newSet.add(kpiId)
            }
            return newSet
        })
    }

    return (
        <div className="space-y-5">
            {/* Hero Section - Compact */}
            <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-6">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                        <h1 className="text-2xl font-semibold text-foreground mb-2">{initiative.title}</h1>
                        {initiative.description && (
                            <div>
                                <p
                                    ref={descRef}
                                    className={`text-muted-foreground leading-relaxed transition-all duration-300 ${descExpanded ? '' : 'line-clamp-2'}`}
                                >
                                    {initiative.description}
                                </p>
                                {descClamped && (
                                    <button
                                        onClick={() => setDescExpanded(prev => !prev)}
                                        className="text-accent text-sm font-medium mt-1 hover:underline"
                                    >
                                        {descExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {initiative.region && (
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 rounded-xl text-sm font-medium text-foreground border border-white/80">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                {initiative.region}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-white/60 rounded-xl text-sm font-medium text-foreground border border-white/80">
                            <Activity className="w-4 h-4 text-gray-500" />
                            {totalDataPoints} data points
                        </span>
                    </div>
                </div>
            </div>

            {/* Metric Cards Row - Links to metric detail pages */}
            {dashboard.kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {dashboard.kpis.slice(0, 12).map((kpi, index) => {
                        const metricColor = getMetricColor(index)
                        const metricSlug = generateMetricSlug(kpi.title)
                        return (
                            <Link
                                key={kpi.id}
                                to={`/org/${orgSlug}/${initiativeSlug}/metric/${metricSlug}`}
                                className="bg-white/60 backdrop-blur rounded-xl border border-white/80 p-3 transition-all hover:shadow-lg hover:border-accent group"
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                                    <span className="text-[10px] text-gray-400 truncate ml-1">{kpi.unit_of_measurement}</span>
                                </div>
                                <div className="text-xs font-medium text-gray-700 truncate mb-1 group-hover:text-accent transition-colors">{kpi.title}</div>
                                <div className="text-lg font-bold" style={{ color: metricColor }}>
                                    {(kpi.total_value || 0).toLocaleString()}
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}

            {/* Main Chart */}
            <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}30` }}>
                            <TrendingUp className="w-4 h-4" style={{ color: brandColor }} />
                        </div>
                        <h2 className="font-semibold text-foreground">Metrics Over Time</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Metrics Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setIsMetricDropdownOpen(!isMetricDropdownOpen)}
                                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl border-2 transition-all duration-200 ${visibleKPIs.size < dashboard.kpis.length
                                    ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
                                    : 'bg-white/60 text-gray-700 border-white/80 hover:bg-white/80'
                                    }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>
                                    {visibleKPIs.size === dashboard.kpis.length
                                        ? 'All Metrics'
                                        : visibleKPIs.size === 1
                                            ? '1 metric'
                                            : `${visibleKPIs.size} metrics`}
                                </span>
                                {visibleKPIs.size < dashboard.kpis.length && (
                                    <span className="bg-accent text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                        {visibleKPIs.size}
                                    </span>
                                )}
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMetricDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isMetricDropdownOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMetricDropdownOpen(false)} />
                                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                                        {/* Select all / Clear */}
                                        <div className="px-3 pb-2 mb-1 border-b border-gray-100 flex gap-2">
                                            <button
                                                onClick={() => setVisibleKPIs(new Set(dashboard.kpis.map(k => k.id)))}
                                                className="text-xs text-gray-500 hover:text-accent transition-colors"
                                            >
                                                Select all
                                            </button>
                                            <span className="text-gray-300">|</span>
                                            <button
                                                onClick={() => setVisibleKPIs(new Set())}
                                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                                            >
                                                Clear all
                                            </button>
                                        </div>

                                        {/* Metric options */}
                                        {dashboard.kpis.map((kpi, index) => {
                                            const isSelected = visibleKPIs.has(kpi.id)
                                            const metricColor = getMetricColor(index)
                                            return (
                                                <label
                                                    key={kpi.id}
                                                    className="w-full px-3 py-2 text-xs flex items-center gap-2.5 hover:bg-gray-50 transition-colors cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleKPI(kpi.id)}
                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-accent focus:ring-accent"
                                                    />
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                        style={{ backgroundColor: metricColor }}
                                                    />
                                                    <span className={`flex-1 truncate ${isSelected ? 'font-medium text-gray-700' : 'text-gray-500'}`}>
                                                        {kpi.title}
                                                    </span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Monthly/Cumulative Toggle */}
                        <div className="flex items-center bg-white/60 rounded-xl p-0.5 border border-white/80">
                            <button
                                onClick={() => setIsCumulative(false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!isCumulative ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setIsCumulative(true)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isCumulative ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
                                    }`}
                            >
                                Cumulative
                            </button>
                        </div>
                        {/* Time Frame */}
                        <div className="flex items-center bg-white/60 rounded-xl p-0.5 border border-white/80">
                            {(['all', '1month', '6months', '1year'] as const).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeFrame(tf)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${timeFrame === tf ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
                                        }`}
                                >
                                    {tf === 'all' ? 'All' : tf === '1month' ? '1M' : tf === '6months' ? '6M' : '1Y'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="h-[320px]">
                    {chartData.length > 0 && visibleKPIs.size > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                                <defs>
                                    {dashboard.kpis.map((kpi, index) => (
                                        <linearGradient key={kpi.id} id={`gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={getMetricColor(index)} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={getMetricColor(index)} stopOpacity={0.05} />
                                        </linearGradient>
                                    ))}
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9ca3af"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                    interval={chartData.length > 12 ? Math.floor(chartData.length / 12) : 0}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(value) => {
                                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                                        return value.toString()
                                    }}
                                />
                                <RechartsTooltip
                                    contentStyle={{
                                        backgroundColor: 'white',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                        fontSize: '12px'
                                    }}
                                    formatter={(value: number, name: string) => {
                                        const kpi = dashboard.kpis.find(k => k.id === name)
                                        return [value.toLocaleString() + (kpi?.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : ''), kpi?.title || name]
                                    }}
                                />
                                {dashboard.kpis.filter(kpi => visibleKPIs.has(kpi.id)).map((kpi, i) => {
                                    const originalIndex = dashboard.kpis.findIndex(k => k.id === kpi.id)
                                    return (
                                        <Area
                                            key={kpi.id}
                                            type="monotone"
                                            dataKey={kpi.id}
                                            stroke={getMetricColor(originalIndex)}
                                            strokeWidth={2}
                                            fill={`url(#gradient-${kpi.id})`}
                                            dot={false}
                                        />
                                    )
                                })}
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p>{visibleKPIs.size === 0 ? 'Toggle metrics below to show on chart' : 'No data available yet'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                {visibleKPIs.size > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-white/50">
                        {dashboard.kpis.filter(kpi => visibleKPIs.has(kpi.id)).map((kpi) => {
                            const originalIndex = dashboard.kpis.findIndex(k => k.id === kpi.id)
                            return (
                                <div key={kpi.id} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getMetricColor(originalIndex) }} />
                                    <span className="text-xs text-muted-foreground">{kpi.title}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Row: Stats + Category Breakdown + Locations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Stats */}
                <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}30` }}>
                            <BarChart3 className="w-4 h-4" style={{ color: brandColor }} />
                        </div>
                        <h2 className="font-semibold text-foreground">Quick Stats</h2>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                            <span className="text-sm text-muted-foreground">Metrics</span>
                            <span className="font-bold text-foreground">{dashboard.stats.kpis}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                            <span className="text-sm text-muted-foreground">Evidence</span>
                            <span className="font-bold text-foreground">{dashboard.stats.evidence}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                            <span className="text-sm text-muted-foreground">Stories</span>
                            <span className="font-bold text-foreground">{dashboard.stats.stories}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-white/60 rounded-xl">
                            <span className="text-sm text-muted-foreground">Locations</span>
                            <span className="font-bold text-foreground">{dashboard.stats.locations}</span>
                        </div>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-100">
                            <Layers className="w-4 h-4 text-purple-600" />
                        </div>
                        <h2 className="font-semibold text-foreground">Categories</h2>
                    </div>

                    {categoryData.length > 0 ? (
                        <>
                            <div className="h-[160px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={categoryData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={40}
                                            outerRadius={65}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {categoryData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="flex justify-center gap-4">
                                {categoryData.map((cat, i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                                        <span className="text-xs text-muted-foreground">{cat.name} ({cat.value})</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            <p className="text-sm">No metrics yet</p>
                        </div>
                    )}
                </div>

                {/* Locations Preview */}
                <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-amber-100">
                                <MapPin className="w-4 h-4 text-amber-600" />
                            </div>
                            <h2 className="font-semibold text-foreground">Locations</h2>
                        </div>
                        <span className="text-xs text-muted-foreground">{dashboard.locations?.length || 0}</span>
                    </div>

                    {dashboard.locations && dashboard.locations.length > 0 ? (
                        <>
                            <div className="h-[120px] rounded-xl overflow-hidden border border-gray-200 mb-3">
                                <MapContainer
                                    center={[
                                        dashboard.locations.reduce((s, l) => s + l.latitude, 0) / dashboard.locations.length,
                                        dashboard.locations.reduce((s, l) => s + l.longitude, 0) / dashboard.locations.length
                                    ]}
                                    zoom={dashboard.locations.length === 1 ? 8 : 3}
                                    className="w-full h-full"
                                    zoomControl={false}
                                    scrollWheelZoom={false}
                                    dragging={false}
                                >
                                    <TileLayerWithFallback />
                                    {dashboard.locations.map((loc) => (
                                        <LocationMarker key={loc.id} location={loc} />
                                    ))}
                                </MapContainer>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {dashboard.locations.slice(0, 5).map((loc) => (
                                    <span key={loc.id} className="px-2 py-1 bg-white/60 text-foreground rounded text-xs font-medium">
                                        {loc.name}
                                    </span>
                                ))}
                                {dashboard.locations.length > 5 && (
                                    <span className="px-2 py-1 text-muted-foreground text-xs">+{dashboard.locations.length - 5} more</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            <p className="text-sm">No locations yet</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Generate slug from metric title
function generateMetricSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
}

// Metrics Tab - Shows all metrics with links to detail pages
function MetricsTab({ dashboard, orgSlug, initiativeSlug }: {
    dashboard: InitiativeDashboard;
    orgSlug: string;
    initiativeSlug: string
}) {
    const { kpis } = dashboard

    if (kpis.length === 0) {
        return (
            <div className="glass-card p-12 rounded-2xl text-center border-accent/20">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No metrics available yet.</p>
            </div>
        )
    }

    const getCategoryConfig = (category: string) => {
        switch (category) {
            case 'impact': return { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', accent: 'text-purple-600' }
            case 'output': return { bg: 'bg-accent/20', text: 'text-accent', border: 'border-accent/30', accent: 'text-accent' }
            case 'input': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', accent: 'text-blue-600' }
            default: return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', accent: 'text-gray-600' }
        }
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {kpis.map((kpi) => {
                const config = getCategoryConfig(kpi.category)
                const metricSlug = generateMetricSlug(kpi.title)

                return (
                    <Link
                        key={kpi.id}
                        to={`/org/${orgSlug}/${initiativeSlug}/metric/${metricSlug}`}
                        className="glass-card rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all overflow-hidden group cursor-pointer"
                    >
                        {/* Header */}
                        <div className={`px-5 py-3 ${config.bg} border-b ${config.border}`}>
                            <div className="flex items-center justify-between">
                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full bg-white/60 ${config.text} capitalize`}>
                                    {kpi.category}
                                </span>
                                {kpi.update_count !== undefined && kpi.update_count > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <BarChart3 className="w-3 h-3" />
                                        {kpi.update_count} data point{kpi.update_count !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            <div className="flex items-start justify-between gap-2 mb-1">
                                <h4 className="font-semibold text-foreground text-lg group-hover:text-accent transition-colors">{kpi.title}</h4>
                                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors flex-shrink-0 mt-1" />
                            </div>
                            {kpi.description && (
                                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{kpi.description}</p>
                            )}

                            {/* Main Value */}
                            <div className="mb-4">
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-3xl font-bold ${config.accent}`}>
                                        {kpi.total_value !== undefined ? kpi.total_value.toLocaleString() : '—'}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{kpi.unit_of_measurement}</span>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-0.5">Evidence</p>
                                    <p className="text-sm font-semibold text-foreground">{kpi.evidence_count || 0} items</p>
                                </div>
                                <div className="text-center p-2 bg-gray-50 rounded-lg">
                                    <p className="text-xs text-muted-foreground mb-0.5">Coverage</p>
                                    <p className={`text-sm font-semibold ${(kpi.evidence_percentage || 0) >= 50 ? 'text-accent' : 'text-orange-500'}`}>
                                        {kpi.evidence_percentage || 0}%
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Link>
                )
            })}
        </div>
    )
}

function StoriesTab({ stories, orgSlug, initiativeSlug }: { stories: PublicStory[] | null; orgSlug: string; initiativeSlug: string }) {
    if (!stories) return <LoadingState />
    if (stories.length === 0) return <EmptyState icon={BookOpen} message="No stories available yet." />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story) => (
                <Link
                    key={story.id}
                    to={`/org/${orgSlug}/${initiativeSlug}/story/${story.id}`}
                    className="glass-card rounded-2xl overflow-hidden group border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all"
                >
                    <div className="h-44 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
                        {story.media_url && story.media_type === 'photo' ? (
                            <img src={story.media_url} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : story.media_type === 'video' && story.media_url ? (
                            <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                                <FileText className="w-12 h-12 text-white/30" />
                            </div>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-12 h-12 text-accent/30" />
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="font-semibold text-foreground mb-2 group-hover:text-accent transition-colors">{story.title}</h3>
                        {story.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{story.description}</p>}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-accent" />{new Date(story.date_represented).toLocaleDateString()}</span>
                            {story.location?.name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-accent" />{story.location.name}</span>}
                        </div>
                    </div>
                </Link>
            ))}
        </div>
    )
}

function ClickableLocationMarker({ location, onClick }: { location: PublicLocation; onClick: (loc: PublicLocation) => void }) {
    const [isHovered, setIsHovered] = useState(false)

    const icon = useMemo(() => {
        const size = isHovered ? 36 : 32
        const color = '#c0dfa1'
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
                    ${isHovered ? `
                        <div style="position: absolute; width: 42px; height: 42px; border-radius: 50%; background-color: ${color}; opacity: 0.2; animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                        <div style="position: absolute; width: 38px; height: 38px; border-radius: 50%; background-color: ${color}; opacity: 0.3;"></div>
                    ` : ''}
                    <div style="width: ${isHovered ? '24px' : '20px'}; height: ${isHovered ? '24px' : '20px'}; border-radius: 50%; background-color: ${color}; border: ${isHovered ? '4px' : '3px'} solid white; position: relative; z-index: 10; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                        <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: ${isHovered ? '10px' : '8px'}; height: ${isHovered ? '10px' : '8px'}; border-radius: 50%; background-color: white;"></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isHovered])

    return (
        <Marker position={[location.latitude, location.longitude]} icon={icon}
            eventHandlers={{
                mouseover: () => setIsHovered(true),
                mouseout: () => setIsHovered(false),
                click: () => onClick(location)
            }}>
            <Tooltip direction="top" offset={[0, -15]}>
                <div className="font-sans">
                    <p className="font-semibold text-sm">{location.name}</p>
                    {location.description && <p className="text-xs text-gray-500">{location.description}</p>}
                    <p className="text-[10px] text-accent mt-1">Click to explore</p>
                </div>
            </Tooltip>
        </Marker>
    )
}

function LocationsTab({ locations, orgSlug, initiativeSlug }: { locations: PublicLocation[] | null; orgSlug: string; initiativeSlug: string }) {
    const [selectedLocation, setSelectedLocation] = useState<PublicLocation | null>(null)
    const [locationDetail, setLocationDetail] = useState<LocationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)

    const openLocationDetail = useCallback(async (loc: PublicLocation) => {
        setSelectedLocation(loc)
        setDetailLoading(true)
        try {
            const detail = await publicApi.getLocationDetail(orgSlug, initiativeSlug, loc.id)
            setLocationDetail(detail)
        } catch (err) {
            console.error('Error loading location detail:', err)
        } finally {
            setDetailLoading(false)
        }
    }, [orgSlug, initiativeSlug])

    const closeDetail = useCallback(() => {
        setSelectedLocation(null)
        setLocationDetail(null)
    }, [])

    if (!locations) return <LoadingState />
    if (locations.length === 0) return <EmptyState icon={MapPin} message="No locations available yet." />

    const categoryConfig: Record<string, { bg: string; text: string }> = {
        impact: { bg: 'bg-purple-100', text: 'text-purple-700' },
        output: { bg: 'bg-green-100', text: 'text-green-700' },
        input: { bg: 'bg-blue-100', text: 'text-blue-700' }
    }

    // If a location is selected, show the detail view instead of the map entirely
    if (selectedLocation) {
        const evType: Record<string, string> = { visual_proof: 'Visual Proof', documentation: 'Documentation', testimony: 'Testimonies', financials: 'Financials' }
        const isImage = (url: string) => ['jpg','jpeg','png','gif','webp','svg'].includes(url.split('.').pop()?.toLowerCase() || '')

        return (
            <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={closeDetail} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">Back to Locations</span>
                        </button>
                        <div className="h-5 w-px bg-gray-200" />
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-accent" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-foreground text-sm sm:text-base">{selectedLocation.name}</h2>
                                {selectedLocation.description && <p className="text-xs text-muted-foreground">{selectedLocation.description}</p>}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                {detailLoading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    </div>
                ) : locationDetail ? (
                    locationDetail.metrics.length === 0 && locationDetail.evidence.length === 0 && locationDetail.stories.length === 0 ? (
                        <div className="text-center py-20">
                            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground">No activity recorded at this location yet</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            {/* Stories */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <BookOpen className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Stories</h3>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.stories.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.stories.length === 0 ? (
                                        <div className="text-center py-10">
                                            <BookOpen className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No stories here yet</p>
                                        </div>
                                    ) : locationDetail.stories.map((story) => (
                                        <Link key={story.id} to={`/org/${orgSlug}/${initiativeSlug}/story/${story.id}`}
                                            className="block rounded-xl border border-gray-100 hover:border-accent/30 p-3 transition-colors">
                                            {story.media_url && story.media_type === 'photo' && (
                                                <img src={story.media_url} alt={story.title} loading="lazy" className="w-full h-32 object-cover rounded-lg mb-2" />
                                            )}
                                            <h4 className="text-sm font-medium text-foreground">{story.title}</h4>
                                            {story.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{story.description}</p>}
                                            <p className="text-[10px] text-muted-foreground mt-1">{new Date(story.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>

                            {/* Metrics */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <BarChart3 className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Metrics</h3>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.metrics.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.metrics.length === 0 ? (
                                        <div className="text-center py-10">
                                            <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No metrics here yet</p>
                                        </div>
                                    ) : locationDetail.metrics.map((m) => {
                                        const cat = categoryConfig[m.category] || categoryConfig.output
                                        return (
                                            <Link key={m.id} to={`/org/${orgSlug}/${initiativeSlug}/metric/${m.slug}`}
                                                className="block p-3 rounded-xl border border-gray-100 hover:border-accent/30 transition-colors">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium text-foreground">{m.title}</p>
                                                        <p className="text-lg font-bold text-foreground mt-0.5">{m.total_value.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{m.unit_of_measurement}</span></p>
                                                        <p className="text-[10px] text-muted-foreground">{m.claim_count} claim{m.claim_count !== 1 ? 's' : ''} at this location</p>
                                                    </div>
                                                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${cat.bg} ${cat.text} capitalize`}>{m.category}</span>
                                                </div>
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Evidence */}
                            <div className="bg-white rounded-2xl border border-gray-200 p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-accent" />
                                        <h3 className="font-semibold text-gray-800 text-sm">Evidence</h3>
                                    </div>
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">{locationDetail.evidence.length}</span>
                                </div>
                                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                                    {locationDetail.evidence.length === 0 ? (
                                        <div className="text-center py-10">
                                            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                            <p className="text-xs text-muted-foreground">No evidence here yet</p>
                                        </div>
                                    ) : locationDetail.evidence.map((ev) => {
                                        const preview = ev.files?.find(f => isImage(f.file_url))?.file_url || (ev.file_url && isImage(ev.file_url) ? ev.file_url : null)
                                        return (
                                            <Link key={ev.id} to={`/org/${orgSlug}/${initiativeSlug}/evidence/${ev.id}`}
                                                className="block rounded-xl border border-gray-100 hover:border-accent/30 p-3 transition-colors">
                                                {preview && (
                                                    <img src={preview} alt={ev.title} loading="lazy" className="w-full h-32 object-cover rounded-lg mb-2" />
                                                )}
                                                <span className="text-[10px] text-muted-foreground">{evType[ev.type] || ev.type}</span>
                                                <h4 className="text-sm font-medium text-foreground mt-0.5">{ev.title}</h4>
                                                {ev.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ev.description}</p>}
                                            </Link>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="text-center py-20">
                        <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-muted-foreground">Failed to load location details</p>
                    </div>
                )}
            </div>
        )
    }

    const mapCenter = [
        locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length,
        locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length
    ] as [number, number]

    return (
        <div className="glass-card p-5 rounded-2xl border-accent/20">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 h-[450px] rounded-xl overflow-hidden border border-gray-200">
                    <MapContainer center={mapCenter} zoom={locations.length === 1 ? 8 : 3} className="w-full h-full" zoomControl={true} scrollWheelZoom={true}>
                        <MapResizeHandler />
                        <TileLayerWithFallback />
                        {locations.map((location) => (
                            <ClickableLocationMarker key={location.id} location={location} onClick={openLocationDetail} />
                        ))}
                    </MapContainer>
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                    {locations.map((location) => (
                        <button
                            key={location.id}
                            onClick={() => openLocationDetail(location)}
                            className="w-full text-left bg-gradient-to-r from-accent/5 to-transparent rounded-xl p-3 border border-transparent hover:border-accent hover:shadow-md transition-all group"
                        >
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-accent/30 transition-colors">
                                    <MapPin className="w-4 h-4 text-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-medium text-foreground text-sm group-hover:text-accent transition-colors">{location.name}</h4>
                                    {location.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{location.description}</p>}
                                    <p className="text-[10px] text-muted-foreground mt-1">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-accent flex-shrink-0 mt-2 transition-colors" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}

function EvidenceTab({ evidence, orgSlug, initiativeSlug }: { evidence: PublicEvidence[] | null; orgSlug: string; initiativeSlug: string }) {
    const [displayCount, setDisplayCount] = useState(8)
    const [selectedTypes, setSelectedTypes] = useState<string[]>([])
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // Gallery state
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    // Evidence types with icons matching the signed-in app
    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera },
        { value: 'documentation', label: 'Documentation', icon: FileText },
        { value: 'testimony', label: 'Testimonies', icon: MessageSquare },
        { value: 'financials', label: 'Financials', icon: DollarSign }
    ] as const

    // Colors matching the signed-in app
    const typeConfig: Record<string, { bg: string; label: string; color: string }> = {
        visual_proof: {
            bg: 'bg-pink-100 text-pink-800',
            label: 'Visual Support',
            color: 'text-pink-500'
        },
        documentation: {
            bg: 'bg-blue-100 text-blue-700',
            label: 'Documentation',
            color: 'text-blue-500'
        },
        testimony: {
            bg: 'bg-orange-100 text-orange-800',
            label: 'Testimonies',
            color: 'text-orange-500'
        },
        financials: {
            bg: 'bg-primary-100 text-primary-800',
            label: 'Financials',
            color: 'text-primary-500'
        }
    }

    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    }

    const isPdfFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ext === 'pdf'
    }

    const getPreviewUrl = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) {
            const imageFile = item.files.find(f => isImageFile(f.file_url))
            if (imageFile) return imageFile.file_url
        }
        if (item.file_url && isImageFile(item.file_url)) {
            return item.file_url
        }
        return null
    }

    // Get all files for an evidence item
    const getAllFiles = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) return item.files
        if (item.file_url) return [{ id: '0', file_url: item.file_url, file_name: item.title, file_type: item.type, display_order: 0 }]
        return []
    }

    // Filter evidence
    const filteredEvidence = useMemo(() =>
        selectedTypes.length > 0
            ? (evidence || []).filter(e => selectedTypes.includes(e.type))
            : (evidence || []),
        [evidence, selectedTypes]
    )

    // Count by type
    const typeCounts = useMemo(() =>
        (evidence || []).reduce((acc, e) => {
            acc[e.type] = (acc[e.type] || 0) + 1
            return acc
        }, {} as Record<string, number>),
        [evidence]
    )

    const displayedEvidence = filteredEvidence.slice(0, displayCount)
    const hasMore = displayCount < filteredEvidence.length

    const toggleType = (type: string) => {
        if (selectedTypes.includes(type)) {
            setSelectedTypes(selectedTypes.filter(t => t !== type))
        } else {
            setSelectedTypes([...selectedTypes, type])
        }
        setDisplayCount(8)
    }

    // Gallery navigation
    const galleryItem = galleryIndex !== null ? filteredEvidence[galleryIndex] : null
    const galleryFiles = galleryItem ? getAllFiles(galleryItem) : []
    const galleryFile = galleryFiles[currentFileIndex] || null

    const openGallery = (index: number) => {
        setGalleryIndex(index)
        setCurrentFileIndex(0)
    }

    const closeGallery = useCallback(() => {
        setGalleryIndex(null)
        setCurrentFileIndex(0)
    }, [])

    const goToPrevEvidence = useCallback(() => {
        if (galleryIndex === null) return
        const prev = galleryIndex === 0 ? filteredEvidence.length - 1 : galleryIndex - 1
        setGalleryIndex(prev)
        setCurrentFileIndex(0)
    }, [galleryIndex, filteredEvidence.length])

    const goToNextEvidence = useCallback(() => {
        if (galleryIndex === null) return
        const next = (galleryIndex + 1) % filteredEvidence.length
        setGalleryIndex(next)
        setCurrentFileIndex(0)
    }, [galleryIndex, filteredEvidence.length])

    // Keyboard navigation
    useEffect(() => {
        if (galleryIndex === null) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGallery()
            else if (e.key === 'ArrowLeft') {
                if (e.shiftKey) goToPrevEvidence()
                else if (galleryFiles.length > 1) setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)
                else goToPrevEvidence()
            }
            else if (e.key === 'ArrowRight') {
                if (e.shiftKey) goToNextEvidence()
                else if (galleryFiles.length > 1) {
                    setCurrentFileIndex(i => {
                        const next = i + 1
                        // If at last file, go to next evidence
                        if (next >= galleryFiles.length) {
                            goToNextEvidence()
                            return 0
                        }
                        return next
                    })
                }
                else goToNextEvidence()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [galleryIndex, galleryFiles.length, closeGallery, goToPrevEvidence, goToNextEvidence])

    // Lock body scroll when gallery is open
    useEffect(() => {
        if (galleryIndex !== null) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [galleryIndex])

    if (!evidence) return <LoadingState />
    if (evidence.length === 0) return <EmptyState icon={FileText} message="No evidence available yet." />

    return (
        <div>
            {/* Filter Dropdown */}
            <div className="mb-5 flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground">Filter by type:</span>
                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border-2 transition-all duration-200 shadow-sm ${selectedTypes.length > 0
                            ? 'bg-accent/10 text-accent border-accent/30 hover:bg-accent/20'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            }`}
                    >
                        <FileText className="w-4 h-4" />
                        <span>
                            {selectedTypes.length === 0
                                ? `All Types`
                                : selectedTypes.length === 1
                                    ? evidenceTypes.find(et => et.value === selectedTypes[0])?.label || '1 type'
                                    : `${selectedTypes.length} types`}
                        </span>
                        {selectedTypes.length > 0 && (
                            <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                                {selectedTypes.length}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                                {selectedTypes.length > 0 && (
                                    <>
                                        <button
                                            onClick={() => { setSelectedTypes([]); setDisplayCount(8) }}
                                            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                            Clear all filters
                                        </button>
                                        <div className="h-px bg-gray-100 my-1" />
                                    </>
                                )}
                                {evidenceTypes.map((type) => {
                                    const count = typeCounts[type.value] || 0
                                    const isSelected = selectedTypes.includes(type.value)
                                    const TypeIcon = type.icon
                                    return (
                                        <label
                                            key={type.value}
                                            className={`w-full px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 transition-colors cursor-pointer ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => count > 0 && toggleType(type.value)}
                                                disabled={count === 0}
                                                className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                                            />
                                            <TypeIcon className={`w-4 h-4 ${typeConfig[type.value]?.color || 'text-gray-500'}`} />
                                            <span className={`flex-1 ${isSelected ? 'font-medium text-accent' : 'text-gray-700'}`}>{type.label}</span>
                                            <span className="text-xs text-muted-foreground">{count}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </>
                    )}
                </div>

                {selectedTypes.length > 0 && (
                    <button
                        onClick={() => { setSelectedTypes([]); setDisplayCount(8) }}
                        className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-3.5 h-3.5" /> Clear
                    </button>
                )}
            </div>

            {/* Evidence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayedEvidence.map((item, idx) => {
                    const previewUrl = getPreviewUrl(item)
                    const fileCount = item.files?.length || (item.file_url ? 1 : 0)
                    // Map display index to filteredEvidence index
                    const filteredIndex = filteredEvidence.indexOf(item)

                    return (
                        <button
                            key={item.id}
                            onClick={() => openGallery(filteredIndex)}
                            className="glass-card rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all overflow-hidden group text-left"
                        >
                            {previewUrl ? (
                                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                    <img src={previewUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                    {fileCount > 1 && (
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                                            {fileCount} files
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                    <div className="text-center">
                                        <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                        <span className="text-sm text-muted-foreground">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            )}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig[item.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                        {typeConfig[item.type]?.label || item.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{new Date(item.date_represented).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-accent transition-colors">{item.title}</h3>
                                {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>}
                                {/* Impact Claims */}
                                {item.kpis && item.kpis.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                        {item.kpis.slice(0, 2).map((kpi) => {
                                            const catColor = kpi.category === 'impact' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : kpi.category === 'output' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                            return (
                                                <Link key={kpi.id} to={`/org/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}`} className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${catColor} transition-colors`} onClick={e => e.stopPropagation()}>
                                                    {kpi.title}
                                                </Link>
                                            )
                                        })}
                                        {item.kpis.length > 2 && (
                                            <span className="text-[10px] text-muted-foreground">+{item.kpis.length - 2}</span>
                                        )}
                                    </div>
                                )}
                                {item.locations && item.locations.length > 0 && (
                                    <div className="mt-1.5 flex flex-wrap gap-1">
                                        {item.locations.map((loc) => (
                                            <span key={loc.id} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{loc.name}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Load More */}
            {hasMore && (
                <div className="text-center mt-6">
                    <button
                        onClick={() => setDisplayCount(prev => prev + 8)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors font-medium border border-accent/20 hover:border-accent"
                    >
                        <ChevronDown className="w-4 h-4" />
                        Load More ({filteredEvidence.length - displayCount} remaining)
                    </button>
                </div>
            )}

            {/* ===== Evidence Gallery Modal ===== */}
            {galleryIndex !== null && galleryItem && (
                <div className="fixed inset-0 z-[100]">
                    {/* Backdrop - light frosted glass */}
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl" onClick={closeGallery} />

                    {/* Gallery Content */}
                    <div className="relative z-10 w-full h-full max-w-6xl mx-auto flex flex-col p-3 sm:p-6">
                        {/* Top bar */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={closeGallery}
                                    className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Evidence</span>
                                </button>
                                <div className="h-5 w-px bg-gray-200" />
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[galleryItem.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                    {typeConfig[galleryItem.type]?.label || galleryItem.type}
                                </span>
                                <span className="text-muted-foreground text-sm">
                                    {galleryIndex + 1} of {filteredEvidence.length}
                                </span>
                            </div>
                            <button
                                onClick={closeGallery}
                                className="w-9 h-9 rounded-full bg-white/60 hover:bg-white/80 border border-gray-200/50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Main area */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                            {/* File preview */}
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex-1 flex flex-col">
                                    <div className="relative bg-gray-900 flex-1 min-h-[250px] sm:min-h-[400px] flex items-center justify-center">
                                        {galleryFile ? (
                                            isImageFile(galleryFile.file_url) ? (
                                                <img
                                                    src={galleryFile.file_url}
                                                    alt={galleryFile.file_name || galleryItem.title}
                                                    className="max-w-full max-h-full object-contain"
                                                />
                                            ) : isPdfFile(galleryFile.file_url) ? (
                                                <iframe
                                                    src={galleryFile.file_url}
                                                    className="w-full h-full"
                                                    title={galleryFile.file_name || galleryItem.title}
                                                />
                                            ) : (
                                                <div className="text-center text-white">
                                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                                    <p className="text-sm opacity-70 mb-4">{galleryFile.file_name}</p>
                                                    <a
                                                        href={galleryFile.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
                                                    >
                                                        <ExternalLink className="w-4 h-4" /> Open File
                                                    </a>
                                                </div>
                                            )
                                        ) : (
                                            <div className="text-center text-white/50">
                                                <FileText className="w-16 h-16 mx-auto mb-4" />
                                                <p>No preview available</p>
                                            </div>
                                        )}

                                        {/* File navigation arrows (within one evidence item) */}
                                        {galleryFiles.length > 1 && (
                                            <>
                                                <button
                                                    onClick={() => setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)}
                                                    className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button
                                                    onClick={() => setCurrentFileIndex(i => (i + 1) % galleryFiles.length)}
                                                    className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                                                    {galleryFiles.map((_, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setCurrentFileIndex(i)}
                                                            className={`h-1.5 rounded-full transition-all ${i === currentFileIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`}
                                                        />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* File info bar */}
                                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/30 border-t border-white/30 flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate flex-1">
                                            {galleryFile?.file_name}
                                            {galleryFiles.length > 1 && (
                                                <span className="text-[10px] sm:text-xs text-gray-400 ml-2">
                                                    ({currentFileIndex + 1}/{galleryFiles.length})
                                                </span>
                                            )}
                                        </span>
                                        {galleryFile?.file_url && (
                                            <a
                                                href={galleryFile.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Open in New Tab</span>
                                                <span className="sm:hidden">Open</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Info sidebar - glass card style */}
                            <div className="lg:col-span-1 flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                                {/* Evidence Info Card */}
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                    <h2 className="font-semibold text-foreground text-base sm:text-lg mb-1">{galleryItem.title}</h2>
                                    {galleryItem.description && (
                                        <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-4">{galleryItem.description}</p>
                                    )}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {new Date(galleryItem.date_represented).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                                    </div>
                                    {galleryItem.locations && galleryItem.locations.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {galleryItem.locations.map((loc) => (
                                                <span key={loc.id} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">{loc.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Impact Claims Card */}
                                {galleryItem.kpis && galleryItem.kpis.length > 0 && (
                                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supporting Impact Claims</h3>
                                        <div className="space-y-2">
                                            {galleryItem.kpis.map((kpi) => {
                                                const badgeColor = kpi.category === 'impact'
                                                    ? 'bg-purple-100 text-purple-700'
                                                    : kpi.category === 'output'
                                                        ? 'bg-green-100 text-green-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                return (
                                                    <Link key={kpi.id} to={`/org/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}`} className="block p-3 rounded-xl bg-white/60 border border-white/80 hover:bg-white/80 hover:border-accent/30 hover:shadow-md transition-all group">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{kpi.title}</p>
                                                            {kpi.category && (
                                                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${badgeColor} capitalize flex-shrink-0`}>
                                                                    {kpi.category}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {kpi.unit_of_measurement && (
                                                            <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.unit_of_measurement}</p>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Bottom evidence navigation */}
                        <div className="flex items-center justify-between mt-3 sm:mt-4 flex-shrink-0">
                            <button
                                onClick={goToPrevEvidence}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            {/* Thumbnail strip */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50vw] scrollbar-hide px-2">
                                {filteredEvidence.slice(
                                    Math.max(0, galleryIndex - 3),
                                    Math.min(filteredEvidence.length, galleryIndex + 4)
                                ).map((item, i) => {
                                    const actualIndex = Math.max(0, galleryIndex - 3) + i
                                    const thumb = getPreviewUrl(item)
                                    return (
                                        <button
                                            key={item.id}
                                            onClick={() => { setGalleryIndex(actualIndex); setCurrentFileIndex(0) }}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${actualIndex === galleryIndex
                                                ? 'border-gray-800 scale-110 shadow-md'
                                                : 'border-white/60 opacity-60 hover:opacity-90 hover:border-gray-300'
                                                }`}
                                        >
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                    <FileText className="w-4 h-4 text-gray-400" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button
                                onClick={goToNextEvidence}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function BeneficiariesTab({ beneficiaries }: { beneficiaries: PublicBeneficiaryGroup[] | null }) {
    if (!beneficiaries) return <LoadingState />
    if (beneficiaries.length === 0) return <EmptyState icon={Users} message="No beneficiary groups defined yet." />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beneficiaries.map((group) => (
                <div key={group.id} className="glass-card p-5 rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-accent/20 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Users className="w-6 h-6 text-accent" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-foreground mb-1">{group.name}</h3>
                            {group.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{group.description}</p>}
                            <div className="space-y-1 text-sm text-muted-foreground">
                                {group.total_number && <p className="font-medium text-accent">{group.total_number.toLocaleString()} beneficiaries</p>}
                                {(group.age_range_start || group.age_range_end) && <p>Ages: {group.age_range_start || '?'} - {group.age_range_end || '?'}</p>}
                                {group.location?.name && <p className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-accent" />{group.location.name}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function LoadingState() {
    return (
        <div className="glass-card p-16 rounded-2xl text-center border-accent/20">
            <div className="flex flex-col items-center">
                {/* Nexus Logo */}
                <div className="w-12 h-12 mb-4">
                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                </div>
                {/* Three bouncing dots */}
                <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '0ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '150ms', animationDuration: '600ms' }} />
                    <div className="w-2 h-2 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '300ms', animationDuration: '600ms' }} />
                </div>
            </div>
        </div>
    )
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
    return (
        <div className="glass-card p-12 rounded-2xl text-center border-accent/20">
            <Icon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">{message}</p>
        </div>
    )
}
