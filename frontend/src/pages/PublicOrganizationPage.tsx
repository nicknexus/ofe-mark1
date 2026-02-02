import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    Building2, MapPin, BarChart3, ArrowLeft, Globe, 
    BookOpen, FileText, Calendar, ChevronRight, ChevronLeft, ArrowRight,
    TrendingUp, Filter, ChevronDown, X
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { 
    publicApi, 
    PublicOrganization, 
    PublicInitiative, 
    PublicKPI, 
    PublicStory, 
    PublicLocation,
    OrganizationStats
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'

// Map tile configuration
const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; OpenStreetMap contributors &copy; CARTO'

delete (L.Icon.Default.prototype as any)._getIconUrl

function TileLayerWithFallback() {
    const [useFallback, setUseFallback] = useState(false)
    useEffect(() => {
        const testImg = new Image()
        testImg.onerror = () => setUseFallback(true)
        testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
        return () => { testImg.onerror = null }
    }, [])
    return (
        <TileLayer
            attribution={useFallback ? '&copy; OpenStreetMap' : CARTO_ATTRIBUTION}
            url={useFallback ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' : CARTO_VOYAGER_URL}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
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

function LocationMarker({ location, brandColor }: { location: PublicLocation; brandColor: string }) {
    const icon = useMemo(() => L.divIcon({
        className: 'custom-marker',
        html: `<div style="width:16px;height:16px;border-radius:50%;background:#374151;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
    }), [brandColor])

    return location.latitude && location.longitude ? (
        <Marker position={[location.latitude, location.longitude]} icon={icon}>
            <Tooltip><span className="font-medium text-sm">{location.name}</span></Tooltip>
        </Marker>
    ) : null
}

// Generate metric slug
function generateMetricSlug(title: string): string {
    return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()
}

export default function PublicOrganizationPage() {
    const { slug } = useParams<{ slug: string }>()
    const [organization, setOrganization] = useState<PublicOrganization | null>(null)
    const [stats, setStats] = useState<OrganizationStats | null>(null)
    const [initiatives, setInitiatives] = useState<PublicInitiative[]>([])
    const [metrics, setMetrics] = useState<PublicKPI[]>([])
    const [stories, setStories] = useState<PublicStory[]>([])
    const [locations, setLocations] = useState<PublicLocation[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    
    // Pagination state
    const [metricPage, setMetricPage] = useState(0)
    const [initiativePage, setInitiativePage] = useState(0)
    const [storyIndex, setStoryIndex] = useState(0)
    
    // Filter state
    const [selectedInitiative, setSelectedInitiative] = useState<string>('all')
    const [startDate, setStartDate] = useState<string>('')
    const [endDate, setEndDate] = useState<string>('')
    const [showInitiativeDropdown, setShowInitiativeDropdown] = useState(false)

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
            const [inits, mets, stors, locs] = await Promise.all([
                publicApi.getOrganizationInitiatives(slug!),
                publicApi.getOrganizationMetrics(slug!),
                publicApi.getOrganizationStories(slug!, 20),
                publicApi.getOrganizationLocations(slug!)
            ])
            setInitiatives(inits)
            setMetrics(mets)
            setStories(stors)
            setLocations(locs)
        } catch (err) {
            setError('Failed to load organization')
        } finally {
            setLoading(false)
        }
    }

    // Filter logic
    const filteredMetrics = useMemo(() => {
        let filtered = metrics
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(m => m.initiative_id === selectedInitiative)
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
                const newTotal = filteredUpdates.reduce((sum, u) => sum + (parseFloat(String(u.value)) || 0), 0)
                return { ...m, total_value: newTotal, update_count: filteredUpdates.length }
            })
        }
        return filtered
    }, [metrics, selectedInitiative, startDate, endDate])

    const filteredStories = useMemo(() => {
        let filtered = stories
        if (selectedInitiative !== 'all') {
            filtered = filtered.filter(s => s.initiative_id === selectedInitiative)
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
    }, [stories, selectedInitiative, startDate, endDate])

    // Auto-cycle stories
    useEffect(() => {
        if (filteredStories.length <= 1) return
        const interval = setInterval(() => {
            setStoryIndex(prev => (prev + 1) % filteredStories.length)
        }, 6000)
        return () => clearInterval(interval)
    }, [filteredStories.length])

    const filteredLocations = useMemo(() => {
        if (selectedInitiative !== 'all') {
            return locations.filter(l => l.initiative_id === selectedInitiative)
        }
        return locations
    }, [locations, selectedInitiative])

    const filteredInitiatives = useMemo(() => {
        if (selectedInitiative !== 'all') {
            return initiatives.filter(i => i.id === selectedInitiative)
        }
        return initiatives
    }, [initiatives, selectedInitiative])

    // Reset pagination when filters change
    useEffect(() => {
        setMetricPage(0)
        setInitiativePage(0)
        setStoryIndex(0)
    }, [selectedInitiative, startDate, endDate])

    const hasActiveFilters = selectedInitiative !== 'all' || startDate || endDate
    const clearFilters = () => {
        setSelectedInitiative('all')
        setStartDate('')
        setEndDate('')
    }

    // Pagination helpers
    const metricsPerPage = 4
    const initiativesPerPage = 2
    const totalMetricPages = Math.ceil(filteredMetrics.length / metricsPerPage)
    const totalInitiativePages = Math.ceil(filteredInitiatives.length / initiativesPerPage)
    const displayedMetrics = filteredMetrics.slice(metricPage * metricsPerPage, (metricPage + 1) * metricsPerPage)
    const displayedInitiatives = filteredInitiatives.slice(initiativePage * initiativesPerPage, (initiativePage + 1) * initiativesPerPage)
    const currentStory = filteredStories[storyIndex]

    const mapCenter = filteredLocations.length > 0
        ? [filteredLocations.reduce((s, l) => s + l.latitude, 0) / filteredLocations.length,
           filteredLocations.reduce((s, l) => s + l.longitude, 0) / filteredLocations.length] as [number, number]
        : [20, 0] as [number, number]

    // Brand color with fallback
    const brandColor = organization?.brand_color || '#c0dfa1'

    if (loading) {
        return <PublicLoader message="Loading dashboard..." />
    }

    if (error || !organization) {
        return (
            <div className="h-screen bg-background flex items-center justify-center px-6">
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Organization Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error}</p>
                    <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                        Browse Organizations <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen lg:h-screen flex flex-col font-figtree lg:overflow-hidden relative animate-fadeIn">
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
            
            {/* Fixed Header */}
            <header className="flex-shrink-0 bg-white/60 backdrop-blur-2xl border-b border-white/40 shadow-sm z-50 relative">
                <div className="max-w-[1800px] mx-auto px-4 sm:px-6 py-3">
                    {/* Top Row */}
                    <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <div className="flex items-center gap-2 sm:gap-4">
                            <Link to="/explore" className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-accent transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-xs sm:text-sm font-medium">Explore</span>
                            </Link>
                            <div className="h-5 sm:h-6 w-px bg-gray-200" />
                            <div className="flex items-center gap-2 sm:gap-3">
                                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50">
                                    {organization.logo_url ? (
                                        <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate max-w-[140px] sm:max-w-none">{organization.name}</h1>
                                    <p className="text-[10px] sm:text-xs font-medium text-muted-foreground hidden sm:block">Public Dashboard</p>
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

                    {/* Filter Row - Scrollable on mobile */}
                    <div className="flex items-center gap-2 sm:gap-3 pt-2 sm:pt-3 border-t border-gray-200/50 overflow-x-auto scrollbar-hide pb-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                            <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span className="font-medium hidden sm:inline">Filter:</span>
                        </div>
                        
                        {/* Initiative Dropdown */}
                        <div className="relative flex-shrink-0">
                            <button
                                onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition-all ${
                                    selectedInitiative !== 'all'
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                            >
                                <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                <span className="max-w-[80px] sm:max-w-[140px] truncate">
                                    {selectedInitiative === 'all' ? 'All' : initiatives.find(i => i.id === selectedInitiative)?.title || 'Select'}
                                </span>
                                <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </button>
                            
                            {showInitiativeDropdown && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowInitiativeDropdown(false)} />
                                    <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-2 max-h-64 overflow-y-auto">
                                        <button
                                            onClick={() => { setSelectedInitiative('all'); setShowInitiativeDropdown(false) }}
                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-accent/10 ${
                                                selectedInitiative === 'all' ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                            }`}
                                        >
                                            All Initiatives
                                        </button>
                                        {initiatives.map(init => (
                                            <button
                                                key={init.id}
                                                onClick={() => { setSelectedInitiative(init.id); setShowInitiativeDropdown(false) }}
                                                className={`w-full px-4 py-2 text-left text-sm hover:bg-accent/10 ${
                                                    selectedInitiative === init.id ? 'bg-accent/10 text-accent font-medium' : 'text-foreground'
                                                }`}
                                            >
                                                <span className="truncate">{init.title}</span>
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        
                        {/* Date Range - Hidden on small mobile */}
                        <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
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
                            <button onClick={clearFilters} className="flex items-center gap-1 px-2 py-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                                <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Clear
                            </button>
                        )}

                        {/* Stats Pills - Scrollable with the rest */}
                        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                            <span className="px-2 sm:px-3 py-1 bg-white/60 text-gray-600 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
                                <BarChart3 className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {filteredMetrics.length}
                            </span>
                            <span className="px-2 sm:px-3 py-1 bg-white/60 text-gray-600 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
                                <BookOpen className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {filteredStories.length}
                            </span>
                            <span className="px-2 sm:px-3 py-1 bg-white/60 text-gray-600 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1 backdrop-blur-sm whitespace-nowrap">
                                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> {filteredLocations.length}
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Dashboard Grid */}
            <main className="flex-1 overflow-y-auto lg:overflow-hidden p-3 sm:p-4 relative min-h-0">
                <div className="max-w-[1800px] mx-auto h-auto lg:h-full grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4">
                    
                    {/* Left Column - Initiatives & Metrics */}
                    <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-4 lg:h-full min-h-0">
                        {/* Initiatives Module */}
                        <div className="bg-white/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/60 shadow-2xl shadow-black/10 flex-1 flex flex-col overflow-hidden min-h-[200px] lg:min-h-0">
                            <div className="px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between flex-shrink-0 border-b border-white/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-xs sm:text-sm lg:text-base">Initiatives</h2>
                                    <span className="px-1.5 lg:px-2 py-0.5 text-[10px] lg:text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredInitiatives.length}</span>
                                </div>
                                {totalInitiativePages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setInitiativePage(p => Math.max(0, p - 1))} disabled={initiativePage === 0}
                                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors">
                                            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                        </button>
                                        <span className="text-[10px] sm:text-xs text-muted-foreground w-10 sm:w-12 text-center">{initiativePage + 1}/{totalInitiativePages}</span>
                                        <button onClick={() => setInitiativePage(p => Math.min(totalInitiativePages - 1, p + 1))} disabled={initiativePage >= totalInitiativePages - 1}
                                            className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors">
                                            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 p-2 lg:p-3 overflow-y-auto min-h-0">
                                {displayedInitiatives.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs sm:text-sm py-6 lg:py-0">
                                        <div className="text-center">
                                            <Globe className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-30" />
                                            <p>No initiatives match filters</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {displayedInitiatives.map((init) => (
                                            <Link key={init.id} to={`/org/${slug}/${init.slug}`}
                                                className="block p-2 bg-white/60 backdrop-blur-lg rounded-lg border border-white/80 hover:bg-white/80 hover:shadow-lg transition-all group active:scale-[0.98]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/80 border border-white/50">
                                                        {organization.logo_url ? (
                                                            <img src={organization.logo_url} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="font-medium text-foreground text-xs transition-colors truncate">{init.title}</h3>
                                                        {init.region && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{init.region}</p>}
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                                </div>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Metrics Module */}
                        <div className="bg-white/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/60 shadow-2xl shadow-black/10 flex-[1.5] flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                            <div className="px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between flex-shrink-0 border-b border-white/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-xs sm:text-sm lg:text-base">Metrics</h2>
                                    <span className="px-1.5 lg:px-2 py-0.5 text-[10px] lg:text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredMetrics.length}</span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    {filteredMetrics.length > 0 && (
                                        <Link 
                                            to={`/org/${slug}/${selectedInitiative !== 'all' 
                                                ? initiatives.find(i => i.id === selectedInitiative)?.slug 
                                                : filteredMetrics[0]?.initiative_slug}?tab=metrics`}
                                            className="text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                                        >
                                            See All →
                                        </Link>
                                    )}
                                    {totalMetricPages > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setMetricPage(p => Math.max(0, p - 1))} disabled={metricPage === 0}
                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors">
                                                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                            </button>
                                            <span className="text-[10px] sm:text-xs text-muted-foreground w-10 sm:w-12 text-center">{metricPage + 1}/{totalMetricPages}</span>
                                            <button onClick={() => setMetricPage(p => Math.min(totalMetricPages - 1, p + 1))} disabled={metricPage >= totalMetricPages - 1}
                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors">
                                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 p-2 lg:p-3 overflow-y-auto min-h-0">
                                {displayedMetrics.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs sm:text-sm py-6 lg:py-0">
                                        <div className="text-center">
                                            <BarChart3 className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-30" />
                                            <p>No metrics match filters</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {displayedMetrics.map((metric) => (
                                            <Link key={metric.id} to={`/org/${slug}/${metric.initiative_slug}/metric/${generateMetricSlug(metric.title)}`}
                                                className="p-2 rounded-lg transition-all group flex flex-col bg-white/60 backdrop-blur-lg border border-white/80 hover:bg-white/80 hover:shadow-lg active:scale-[0.98]">
                                                <span className={`self-start px-1.5 py-0.5 text-[8px] sm:text-[9px] font-semibold rounded-full mb-1 ${
                                                    metric.category === 'impact' ? 'bg-purple-100/80 text-purple-700' :
                                                    metric.category === 'output' ? 'bg-green-100/80 text-green-700' : 'bg-blue-100/80 text-blue-700'
                                                }`}>{metric.category}</span>
                                                <h4 className="font-medium text-foreground text-[10px] sm:text-xs transition-colors line-clamp-2 mb-auto">{metric.title}</h4>
                                                <div className="mt-1">
                                                    <span className="text-base sm:text-lg font-bold text-foreground">{metric.total_value?.toLocaleString() || '—'}</span>
                                                    <span className="text-[9px] sm:text-[10px] text-muted-foreground ml-0.5">{metric.unit_of_measurement}</span>
                                                </div>
                                                <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5 truncate">{metric.initiative_title}</p>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Center Column - Story */}
                    <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-4 lg:h-full min-h-0">
                        <div className="bg-white/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/60 shadow-2xl shadow-black/10 flex-1 flex flex-col overflow-hidden min-h-[300px] lg:min-h-0">
                            <div className="px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between flex-shrink-0 border-b border-white/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <BookOpen className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-xs sm:text-sm lg:text-base">Stories</h2>
                                    <span className="px-1.5 lg:px-2 py-0.5 text-[10px] lg:text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredStories.length}</span>
                                </div>
                                <div className="flex items-center gap-1 sm:gap-2">
                                    {filteredStories.length > 0 && (
                                        <Link 
                                            to={`/org/${slug}/${selectedInitiative !== 'all' 
                                                ? initiatives.find(i => i.id === selectedInitiative)?.slug 
                                                : filteredStories[0]?.initiative_slug}?tab=stories`}
                                            className="text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                                        >
                                            See All →
                                        </Link>
                                    )}
                                    {filteredStories.length > 1 && (
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setStoryIndex(p => p === 0 ? filteredStories.length - 1 : p - 1)}
                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors">
                                                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                            </button>
                                            <span className="text-[10px] sm:text-xs text-muted-foreground w-10 sm:w-12 text-center">{storyIndex + 1}/{filteredStories.length}</span>
                                            <button onClick={() => setStoryIndex(p => (p + 1) % filteredStories.length)}
                                                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors">
                                                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex-1 p-2 sm:p-3 lg:p-4 overflow-hidden min-h-0">
                                {!currentStory ? (
                                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs sm:text-sm py-6 lg:py-0">
                                        <div className="text-center">
                                            <BookOpen className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
                                            <p>No stories match filters</p>
                                        </div>
                                    </div>
                                ) : (
                                    <Link to={`/org/${slug}/${currentStory.initiative_slug}?tab=stories`} className="block h-full group">
                                        <div className="h-full flex flex-col bg-white/60 backdrop-blur-lg rounded-xl overflow-hidden border border-white/80 hover:bg-white/80 hover:shadow-lg transition-all active:scale-[0.98]">
                                            {currentStory.media_url && currentStory.media_type === 'photo' ? (
                                                <div className="h-[120px] sm:h-[30%] sm:min-h-[100px] sm:max-h-[180px] flex-shrink-0 overflow-hidden">
                                                    <img src={currentStory.media_url} alt={currentStory.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                </div>
                                            ) : (
                                                <div className="h-[80px] sm:h-[20%] sm:min-h-[80px] sm:max-h-[120px] flex-shrink-0 flex items-center justify-center bg-white/40">
                                                    <FileText className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400" />
                                                </div>
                                            )}
                                            <div className="p-3 sm:p-4 flex-1 flex flex-col">
                                                <span className="text-[10px] sm:text-xs font-semibold mb-1 text-muted-foreground">{currentStory.initiative_title}</span>
                                                <h3 className="text-sm sm:text-lg font-semibold text-foreground transition-colors line-clamp-2 mb-1 sm:mb-2">{currentStory.title}</h3>
                                                {currentStory.description && <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 sm:line-clamp-3 flex-1">{currentStory.description}</p>}
                                                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-muted-foreground mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-white/50">
                                                    <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    {new Date(currentStory.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                )}
                            </div>
                            {/* Story Progress Dots */}
                            {filteredStories.length > 1 && (
                                <div className="px-3 sm:px-4 pb-2 sm:pb-3 flex justify-center gap-1.5">
                                    {filteredStories.slice(0, 8).map((_, idx) => (
                                        <button key={idx} onClick={() => setStoryIndex(idx)}
                                            className={`h-1.5 sm:h-2 rounded-full transition-all ${idx === storyIndex ? 'w-5 sm:w-6 bg-gray-800' : 'w-1.5 sm:w-2 bg-gray-300 hover:bg-gray-400'}`} />
                                    ))}
                                    {filteredStories.length > 8 && <span className="text-[10px] sm:text-xs text-muted-foreground ml-1">+{filteredStories.length - 8}</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Map */}
                    <div className="lg:col-span-4 flex flex-col gap-3 lg:gap-4 lg:h-full min-h-0">
                        <div className="bg-white/40 backdrop-blur-2xl rounded-xl sm:rounded-2xl border border-white/60 shadow-2xl shadow-black/10 flex-1 flex flex-col overflow-hidden min-h-[250px] lg:min-h-0">
                            <div className="px-3 lg:px-4 py-2 lg:py-3 flex items-center justify-between flex-shrink-0 border-b border-white/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 lg:w-4 lg:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-xs sm:text-sm lg:text-base">Locations</h2>
                                    <span className="px-1.5 lg:px-2 py-0.5 text-[10px] lg:text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredLocations.length}</span>
                                </div>
                                {filteredLocations.length > 0 && (
                                    <Link 
                                        to={`/org/${slug}/${selectedInitiative !== 'all' 
                                            ? initiatives.find(i => i.id === selectedInitiative)?.slug 
                                            : filteredLocations[0]?.initiative_slug}?tab=locations`}
                                        className="text-[10px] sm:text-xs font-medium text-gray-500 hover:text-gray-800 transition-colors"
                                    >
                                        See All →
                                    </Link>
                                )}
                            </div>
                            <div className="flex-1 relative min-h-[150px] lg:min-h-0">
                                {filteredLocations.length === 0 ? (
                                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-xs sm:text-sm bg-gray-50">
                                        <div className="text-center">
                                            <MapPin className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
                                            <p>No locations match filters</p>
                                        </div>
                                    </div>
                                ) : (
                                    <MapContainer center={mapCenter} zoom={filteredLocations.length === 1 ? 8 : 2} className="w-full h-full" zoomControl={false} scrollWheelZoom={false}>
                                        <MapResizeHandler />
                                        <TileLayerWithFallback />
                                        {filteredLocations.map((loc) => <LocationMarker key={loc.id} location={loc} brandColor={brandColor} />)}
                                    </MapContainer>
                                )}
                            </div>
                            {/* Location List */}
                            {filteredLocations.length > 0 && (
                                <div className="p-2 lg:p-3 max-h-20 sm:max-h-24 lg:max-h-32 overflow-y-auto border-t border-white/50 flex-shrink-0">
                                    <div className="flex flex-wrap gap-1">
                                        {filteredLocations.map((loc) => (
                                            <span key={loc.id} className="px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] lg:text-xs font-medium bg-white/60 text-gray-600">
                                                {loc.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}
