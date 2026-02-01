import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { 
    ArrowLeft, Globe, BarChart3, BookOpen, MapPin, 
    FileText, Users, Calendar, ChevronRight, ExternalLink, TrendingUp,
    Building2, ChevronDown, Filter, X, Activity, Layers, Zap
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
import { 
    publicApi, 
    PublicInitiative, 
    PublicKPI, 
    PublicStory, 
    PublicLocation,
    PublicEvidence,
    PublicBeneficiaryGroup,
    InitiativeDashboard
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'

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
    const [startDate, setStartDate] = useState<string>(searchParams.get('startDate') || '')
    const [endDate, setEndDate] = useState<string>(searchParams.get('endDate') || '')

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
        setStartDate('')
        setEndDate('')
    }
    
    // Handle initiative switch
    const handleInitiativeSwitch = (slug: string) => {
        setShowInitiativeDropdown(false)
        if (slug === initiativeSlug) return
        
        // Build query params
        const params = new URLSearchParams()
        if (startDate) params.set('startDate', startDate)
        if (endDate) params.set('endDate', endDate)
        const queryString = params.toString()
        
        navigate(`/org/${orgSlug}/${slug}${queryString ? `?${queryString}` : ''}`)
    }
    
    // Filter dashboard KPIs by date
    const filteredDashboard = useMemo(() => {
        if (!dashboard) return null
        if (!startDate && !endDate) return dashboard
        
        const filteredKpis = dashboard.kpis.map(kpi => {
            // Note: We don't have updates in dashboard kpis, so we can't filter by date here
            // The backend would need to support date filtering for accurate totals
            return kpi
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

    const tabs: { id: TabType; label: string; icon: any; count?: number }[] = [
        { id: 'overview', label: 'Overview', icon: Globe },
        { id: 'metrics', label: 'Metrics', icon: BarChart3, count: filteredDashboard?.kpis.length || 0 },
        { id: 'stories', label: 'Stories', icon: BookOpen, count: filteredStories?.length ?? dashboard.stats.stories },
        { id: 'locations', label: 'Locations', icon: MapPin, count: dashboard.stats.locations },
        { id: 'evidence', label: 'Evidence', icon: FileText, count: filteredEvidence?.length ?? dashboard.stats.evidence },
        { id: 'beneficiaries', label: 'Beneficiaries', icon: Users }
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
                <div className="max-w-7xl mx-auto px-6 py-3">
                    {/* Top Row - Nav + Initiative Info + Logo */}
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-4">
                            <Link to={`/org/${orgSlug}`} className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm font-medium hidden sm:inline">Back</span>
                            </Link>
                            <div className="h-6 w-px bg-gray-200" />
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50">
                                    {initiative.organization_logo_url ? (
                                        <img src={initiative.organization_logo_url} alt={initiative.organization_name || ''} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-5 h-5 text-gray-400" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-lg font-semibold text-foreground truncate max-w-[300px]">{initiative.title}</h1>
                                    <Link to={`/org/${orgSlug}`} className="text-xs font-medium text-muted-foreground hover:text-accent transition-colors">
                                        {initiative.organization_name}
                                    </Link>
                                </div>
                            </div>
                        </div>
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-base font-newsreader font-extralight text-foreground hidden md:block">Nexus Impacts</span>
                        </Link>
                    </div>

                    {/* Filter Row */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-gray-200/50">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Filter className="w-4 h-4" />
                            <span className="font-medium">Filter:</span>
                        </div>
                        
                        {/* Initiative Switcher Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-800 text-white border-gray-800 text-sm font-medium transition-colors hover:bg-gray-700"
                            >
                                <Globe className="w-3.5 h-3.5" />
                                <span className="max-w-[120px] truncate">{initiative.title}</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            
                            {showInitiativeDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowInitiativeDropdown(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 max-h-64 overflow-y-auto">
                                        {allInitiatives.map(init => (
                                            <button
                                                key={init.id}
                                                onClick={() => handleInitiativeSwitch(init.slug)}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent/10 ${
                                                    init.slug === initiativeSlug ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                                }`}
                                            >
                                                <span className="truncate">{init.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Date Range */}
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white w-[130px]"
                                />
                            </div>
                            <span className="text-muted-foreground text-sm">to</span>
                            <div className="relative">
                                <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-8 pr-2 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white w-[130px]"
                                />
                            </div>
                        </div>
                        
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                                <X className="w-3.5 h-3.5" /> Clear
                            </button>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content with Sidebar */}
            <div className="max-w-7xl mx-auto px-6 py-6 relative">
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
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                            activeTab === tab.id
                                                ? 'bg-gray-800 text-white shadow-lg'
                                                : 'text-gray-700 hover:bg-white/60'
                                        }`}
                                    >
                                        <tab.icon className="w-4 h-4" />
                                        <span className="flex-1 text-left">{tab.label}</span>
                                        {tab.count !== undefined && (
                                            <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                                                activeTab === tab.id 
                                                    ? 'bg-white/30 text-white' 
                                                    : 'bg-white/60 text-gray-600'
                                            }`}>
                                                {tab.count}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>

                    {/* Mobile Tab Bar */}
                    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-2xl border-t border-white/40 z-30 px-2 py-2">
                        <div className="flex justify-around">
                            {tabs.slice(0, 5).map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all ${
                                        activeTab === tab.id 
                                            ? 'text-foreground bg-gray-100' 
                                            : 'text-muted-foreground'
                                    }`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                    <span className="text-[10px] font-medium">{tab.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 min-w-0 pb-20 lg:pb-0 relative">
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
                                {activeTab === 'overview' && <InitiativeOverviewTab initiative={initiative} dashboard={dashboard} />}
                                {activeTab === 'metrics' && filteredDashboard && <MetricsTab dashboard={filteredDashboard} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'stories' && <StoriesTab stories={filteredStories} orgSlug={orgSlug!} initiativeSlug={initiativeSlug!} />}
                                {activeTab === 'locations' && <LocationsTab locations={locations || dashboard.locations} />}
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
function InitiativeOverviewTab({ initiative, dashboard }: { 
    initiative: PublicInitiative; 
    dashboard: InitiativeDashboard 
}) {
    const brandColor = initiative.organization_brand_color || '#c0dfa1'
    const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year'>('all')
    const [isCumulative, setIsCumulative] = useState(false)
    const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set(dashboard.kpis.map(k => k.id)))
    
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
                            <p className="text-muted-foreground leading-relaxed line-clamp-2">{initiative.description}</p>
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

            {/* Metric Cards Row */}
            {dashboard.kpis.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {dashboard.kpis.slice(0, 12).map((kpi, index) => {
                        const metricColor = getMetricColor(index)
                        const isVisible = visibleKPIs.has(kpi.id)
                        return (
                            <div
                                key={kpi.id}
                                onClick={() => toggleKPI(kpi.id)}
                                className={`bg-white/60 backdrop-blur rounded-xl border p-3 cursor-pointer transition-all hover:shadow-lg ${
                                    isVisible ? 'border-white/80' : 'border-gray-300 opacity-50'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: metricColor }} />
                                    <span className="text-[10px] text-gray-400 truncate ml-1">{kpi.unit_of_measurement}</span>
                                </div>
                                <div className="text-xs font-medium text-gray-700 truncate mb-1">{kpi.title}</div>
                                <div className="text-lg font-bold" style={{ color: metricColor }}>
                                    {(kpi.total_value || 0).toLocaleString()}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Main Chart */}
            <div className="bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${brandColor}30` }}>
                            <TrendingUp className="w-4 h-4" style={{ color: brandColor }} />
                        </div>
                        <h2 className="font-semibold text-foreground">Metrics Over Time</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Monthly/Cumulative Toggle */}
                        <div className="flex items-center bg-white/60 rounded-xl p-0.5 border border-white/80">
                            <button
                                onClick={() => setIsCumulative(false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    !isCumulative ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
                                }`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setIsCumulative(true)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                    isCumulative ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
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
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        timeFrame === tf ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'
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
                                            <stop offset="5%" stopColor={getMetricColor(index)} stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor={getMetricColor(index)} stopOpacity={0.05}/>
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
                                <p>{visibleKPIs.size === 0 ? 'Click metrics above to show on chart' : 'No data available yet'}</p>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Legend */}
                {visibleKPIs.size > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-white/50">
                        {dashboard.kpis.filter(kpi => visibleKPIs.has(kpi.id)).map((kpi, i) => {
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

function LocationsTab({ locations }: { locations: PublicLocation[] | null }) {
    if (!locations) return <LoadingState />
    if (locations.length === 0) return <EmptyState icon={MapPin} message="No locations available yet." />

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
                        {locations.map((location) => <LocationMarker key={location.id} location={location} />)}
                    </MapContainer>
                </div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                    {locations.map((location) => (
                        <div key={location.id} className="bg-gradient-to-r from-accent/5 to-transparent rounded-xl p-3 border border-transparent hover:border-accent transition-colors">
                            <div className="flex items-start gap-3">
                                <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-4 h-4 text-accent" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="font-medium text-foreground text-sm">{location.name}</h4>
                                    {location.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{location.description}</p>}
                                    <p className="text-[10px] text-muted-foreground mt-1">{location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

function EvidenceTab({ evidence, orgSlug, initiativeSlug }: { evidence: PublicEvidence[] | null; orgSlug: string; initiativeSlug: string }) {
    const [displayCount, setDisplayCount] = useState(8)
    const [activeFilter, setActiveFilter] = useState<string | null>(null)

    if (!evidence) return <LoadingState />
    if (evidence.length === 0) return <EmptyState icon={FileText} message="No evidence available yet." />

    // Colors matching the signed-in app
    const typeConfig: Record<string, { bg: string; label: string; filterBg: string; filterActive: string }> = {
        visual_proof: { 
            bg: 'bg-pink-100 text-pink-800', 
            label: 'Visual Proof',
            filterBg: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
            filterActive: 'bg-pink-500 text-white border-pink-500'
        },
        documentation: { 
            bg: 'bg-blue-100 text-blue-700', 
            label: 'Documentation',
            filterBg: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
            filterActive: 'bg-blue-500 text-white border-blue-500'
        },
        testimony: { 
            bg: 'bg-orange-100 text-orange-800', 
            label: 'Testimonies',
            filterBg: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
            filterActive: 'bg-orange-500 text-white border-orange-500'
        },
        financials: { 
            bg: 'bg-primary-100 text-primary-800', 
            label: 'Financials',
            filterBg: 'bg-primary-50 text-primary-700 border-primary-200 hover:bg-primary-100',
            filterActive: 'bg-primary-500 text-white border-primary-500'
        }
    }

    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
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

    // Filter evidence
    const filteredEvidence = activeFilter 
        ? evidence.filter(e => e.type === activeFilter)
        : evidence

    // Count by type
    const typeCounts = evidence.reduce((acc, e) => {
        acc[e.type] = (acc[e.type] || 0) + 1
        return acc
    }, {} as Record<string, number>)

    const displayedEvidence = filteredEvidence.slice(0, displayCount)
    const hasMore = displayCount < filteredEvidence.length

    return (
        <div>
            {/* Filter Bar */}
            <div className="glass-card p-4 rounded-2xl mb-5 border-accent/20">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground mr-2">Filter by type:</span>
                    <button
                        onClick={() => { setActiveFilter(null); setDisplayCount(8) }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                            activeFilter === null 
                                ? 'bg-accent text-white border-accent' 
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                        All ({evidence.length})
                    </button>
                    {Object.entries(typeConfig).map(([type, config]) => {
                        const count = typeCounts[type] || 0
                        if (count === 0) return null
                        return (
                            <button
                                key={type}
                                onClick={() => { setActiveFilter(type); setDisplayCount(8) }}
                                className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                                    activeFilter === type ? config.filterActive : config.filterBg
                                }`}
                            >
                                {config.label} ({count})
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Evidence Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {displayedEvidence.map((item) => {
                    const previewUrl = getPreviewUrl(item)
                    const fileCount = item.files?.length || (item.file_url ? 1 : 0)
                    
                    return (
                        <Link 
                            key={item.id} 
                            to={`/org/${orgSlug}/${initiativeSlug}/evidence/${item.id}`}
                            className="glass-card rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all overflow-hidden group"
                        >
                            {/* Image Preview */}
                            {previewUrl ? (
                                <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                    <img 
                                        src={previewUrl} 
                                        alt={item.title}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    />
                                    {fileCount > 1 && (
                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">
                                            +{fileCount - 1} more
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                    <div className="text-center">
                                        <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                        <span className="text-sm text-muted-foreground">
                                            {fileCount} file{fileCount > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Content */}
                            <div className="p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeConfig[item.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                        {typeConfig[item.type]?.label || item.type}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{new Date(item.date_represented).toLocaleDateString()}</span>
                                </div>
                                <h3 className="font-semibold text-foreground text-sm mb-1 group-hover:text-accent transition-colors">{item.title}</h3>
                                {item.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.description}</p>}
                                
                                {/* Locations */}
                                {item.locations && item.locations.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {item.locations.map((loc) => (
                                            <span key={loc.id} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">{loc.name}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Link>
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
