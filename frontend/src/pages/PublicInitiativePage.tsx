import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    Loader2, ArrowLeft, Target, BarChart3, BookOpen, MapPin, 
    FileText, Users, Calendar, ChevronRight, ExternalLink, TrendingUp,
    Building2, ChevronDown
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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

type TabType = 'overview' | 'stories' | 'locations' | 'evidence' | 'beneficiaries'

export default function PublicInitiativePage() {
    const { orgSlug, initiativeSlug } = useParams<{ orgSlug: string; initiativeSlug: string }>()
    const [initiative, setInitiative] = useState<PublicInitiative | null>(null)
    const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
    const [activeTab, setActiveTab] = useState<TabType>('overview')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Tab data
    const [stories, setStories] = useState<PublicStory[] | null>(null)
    const [locations, setLocations] = useState<PublicLocation[] | null>(null)
    const [evidence, setEvidence] = useState<PublicEvidence[] | null>(null)
    const [beneficiaries, setBeneficiaries] = useState<PublicBeneficiaryGroup[] | null>(null)

    useEffect(() => { if (orgSlug && initiativeSlug) loadInitiative() }, [orgSlug, initiativeSlug])
    useEffect(() => { if (orgSlug && initiativeSlug) loadTabData(activeTab) }, [activeTab, orgSlug, initiativeSlug])

    const loadInitiative = async () => {
        try {
            setLoading(true)
            setError(null)
            const dashboardData = await publicApi.getInitiativeDashboard(orgSlug!, initiativeSlug!)
            if (!dashboardData) { setError('Initiative not found'); return }
            setInitiative(dashboardData.initiative)
            setDashboard(dashboardData)
        } catch (err) {
            console.error('Error loading initiative:', err)
            setError('Failed to load initiative')
        } finally {
            setLoading(false)
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

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading initiative...</p>
                </div>
            </div>
        )
    }

    if (error || !initiative || !dashboard) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <Target className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
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
        { id: 'overview', label: 'Overview', icon: BarChart3, count: dashboard.stats.kpis },
        { id: 'stories', label: 'Stories', icon: BookOpen, count: dashboard.stats.stories },
        { id: 'locations', label: 'Locations', icon: MapPin, count: dashboard.stats.locations },
        { id: 'evidence', label: 'Evidence', icon: FileText, count: dashboard.stats.evidence },
        { id: 'beneficiaries', label: 'Beneficiaries', icon: Users }
    ]

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 font-figtree">
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[15%] right-[10%] w-32 h-32 border-2 border-accent/15 rounded-3xl rotate-12 animate-float" />
                <div className="absolute bottom-[30%] left-[5%] w-20 h-20 bg-accent/10 rounded-2xl rotate-45 animate-float-slow" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(192,223,161,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(192,223,161,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 pt-8">
                <div className="max-w-7xl mx-auto px-6">
                    <nav className="mb-8">
                        <div className="glass rounded-2xl px-6 py-3 flex items-center justify-between border-accent/20">
                            <Link to={`/org/${orgSlug}`} className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm font-medium">Back to Organization</span>
                            </Link>
                            <Link to="/" className="flex items-center gap-2 group">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg font-newsreader font-extralight text-foreground hidden sm:block">Nexus Impacts</span>
                            </Link>
                        </div>
                    </nav>

                    {/* Initiative Header */}
                    <div className="glass-card p-6 rounded-3xl mb-6 border-accent/20">
                        <div className="flex flex-col lg:flex-row items-start gap-6">
                            <div className="w-14 h-14 bg-gradient-to-br from-accent/20 to-accent/10 rounded-xl flex items-center justify-center flex-shrink-0 border border-accent/30 overflow-hidden">
                                {initiative.organization_logo_url ? (
                                    <img src={initiative.organization_logo_url} alt={initiative.organization_name || 'Organization'} className="w-full h-full object-cover" />
                                ) : (
                                    <Target className="w-7 h-7 text-accent" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <Link to={`/org/${orgSlug}`} className="text-xs text-accent hover:text-accent/80 font-medium mb-1 inline-flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {initiative.organization_name || 'View Organization'}
                                </Link>
                                <h1 className="text-2xl sm:text-3xl font-newsreader font-light text-foreground mb-2">{initiative.title}</h1>
                                {initiative.description && <p className="text-muted-foreground max-w-3xl mb-2">{initiative.description}</p>}
                                {initiative.region && (
                                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-4 h-4 text-accent" />{initiative.region}
                                    </p>
                                )}
                            </div>
                            
                            {/* Quick Stats */}
                            <div className="flex gap-3 flex-shrink-0">
                                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl px-4 py-3 text-center border border-accent/20">
                                    <p className="text-xl font-bold text-foreground">{dashboard.stats.kpis}</p>
                                    <p className="text-xs text-muted-foreground">Metrics</p>
                                </div>
                                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl px-4 py-3 text-center border border-accent/20">
                                    <p className="text-xl font-bold text-foreground">{dashboard.stats.evidence}</p>
                                    <p className="text-xs text-muted-foreground">Evidence</p>
                                </div>
                                <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl px-4 py-3 text-center border border-accent/20">
                                    <p className="text-xl font-bold text-foreground">{dashboard.stats.stories}</p>
                                    <p className="text-xs text-muted-foreground">Stories</p>
                                </div>
                            </div>
                        </div>

                        {/* Tabs - Fixed text visibility */}
                        <div className="mt-6 flex flex-wrap gap-2">
                            {tabs.map((tab) => (
                                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                        activeTab === tab.id
                                            ? 'bg-primary-500 shadow-lg shadow-primary-500/25'
                                            : 'bg-white/60 text-foreground hover:bg-primary-100 hover:text-primary-700'
                                    }`}
                                    style={activeTab === tab.id ? { color: '#465360' } : {}}>
                                    <tab.icon className="w-4 h-4" style={activeTab === tab.id ? { color: '#465360' } : {}} />
                                    <span style={activeTab === tab.id ? { color: '#465360' } : {}}>{tab.label}</span>
                                    {tab.count !== undefined && (
                                        <span className={`px-1.5 py-0.5 text-xs rounded-full ${
                                            activeTab === tab.id ? 'bg-white/40' : 'bg-primary-100 text-primary-700'
                                        }`}
                                        style={activeTab === tab.id ? { color: '#465360' } : {}}>{tab.count}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tab Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                {activeTab === 'overview' && <OverviewTab dashboard={dashboard} orgLogoUrl={initiative.organization_logo_url} />}
                {activeTab === 'stories' && <StoriesTab stories={stories} />}
                {activeTab === 'locations' && <LocationsTab locations={locations || dashboard.locations} />}
                {activeTab === 'evidence' && <EvidenceTab evidence={evidence} />}
                {activeTab === 'beneficiaries' && <BeneficiariesTab beneficiaries={beneficiaries} />}
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-accent/10 bg-white/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <p className="text-center text-sm text-muted-foreground">
                        Impact data for <span className="text-accent font-medium">{initiative.title}</span>
                    </p>
                </div>
            </div>
        </div>
    )
}

// ============================================
// Tab Components
// ============================================

function OverviewTab({ dashboard, orgLogoUrl }: { dashboard: InitiativeDashboard; orgLogoUrl?: string }) {
    const { kpis } = dashboard

    if (kpis.length === 0) {
        return (
            <div className="glass-card p-12 rounded-2xl text-center border-accent/20">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">No metrics available yet.</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi) => (
                <div key={kpi.id} className="glass-card p-5 rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all">
                    <div className="flex items-start justify-between mb-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                            kpi.category === 'impact' ? 'bg-accent/20 text-accent' :
                            kpi.category === 'output' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>{kpi.category}</span>
                        {kpi.total_value !== undefined && (
                            <div className="flex items-center gap-1 text-primary-500">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-lg font-bold">{kpi.total_value.toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                    <h4 className="font-semibold text-foreground mb-1">{kpi.title}</h4>
                    <p className="text-sm text-muted-foreground">{kpi.unit_of_measurement}</p>
                    {kpi.update_count !== undefined && kpi.update_count > 0 && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                            <BarChart3 className="w-3 h-3" />{kpi.update_count} data point{kpi.update_count !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            ))}
        </div>
    )
}

function StoriesTab({ stories }: { stories: PublicStory[] | null }) {
    if (!stories) return <LoadingState />
    if (stories.length === 0) return <EmptyState icon={BookOpen} message="No stories available yet." />

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {stories.map((story) => (
                <div key={story.id} className="glass-card rounded-2xl overflow-hidden group border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all">
                    <div className="h-44 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
                        {story.media_url && story.media_type === 'photo' ? (
                            <img src={story.media_url} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : story.media_type === 'video' && story.media_url ? (
                            <video src={story.media_url} className="w-full h-full object-cover" controls />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-12 h-12 text-accent/30" />
                            </div>
                        )}
                    </div>
                    <div className="p-4">
                        <h3 className="font-semibold text-foreground mb-2">{story.title}</h3>
                        {story.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{story.description}</p>}
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-accent" />{new Date(story.date_represented).toLocaleDateString()}</span>
                            {story.location?.name && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-accent" />{story.location.name}</span>}
                        </div>
                    </div>
                </div>
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

function EvidenceTab({ evidence }: { evidence: PublicEvidence[] | null }) {
    const [displayCount, setDisplayCount] = useState(3)

    if (!evidence) return <LoadingState />
    if (evidence.length === 0) return <EmptyState icon={FileText} message="No evidence available yet." />

    const typeConfig: Record<string, { bg: string; label: string }> = {
        visual_proof: { bg: 'bg-accent/20 text-accent', label: 'Visual Proof' },
        documentation: { bg: 'bg-blue-100 text-blue-700', label: 'Documentation' },
        testimony: { bg: 'bg-purple-100 text-purple-700', label: 'Testimony' },
        financials: { bg: 'bg-yellow-100 text-yellow-700', label: 'Financials' }
    }

    const displayedEvidence = evidence.slice(0, displayCount)
    const hasMore = displayCount < evidence.length

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedEvidence.map((item) => (
                    <div key={item.id} className="glass-card p-5 rounded-2xl border border-transparent hover:border-accent hover:shadow-[0_0_20px_rgba(192,223,161,0.3)] transition-all">
                        <div className="flex items-start justify-between mb-3">
                            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[item.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                {typeConfig[item.type]?.label || item.type}
                            </span>
                            <span className="text-xs text-muted-foreground">{new Date(item.date_represented).toLocaleDateString()}</span>
                        </div>
                        <h3 className="font-semibold text-foreground mb-2">{item.title}</h3>
                        {item.description && <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.description}</p>}
                        {(item.file_url || (item.file_urls && item.file_urls.length > 0)) && (
                            <a href={item.file_url || item.file_urls?.[0]} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-accent hover:text-accent/80 font-medium">
                                <ExternalLink className="w-4 h-4" />View file{item.file_urls && item.file_urls.length > 1 ? `s (${item.file_urls.length})` : ''}
                            </a>
                        )}
                        {item.locations && item.locations.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                                {item.locations.map((loc) => (
                                    <span key={loc.id} className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-lg">{loc.name}</span>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            {hasMore && (
                <div className="text-center mt-6">
                    <button 
                        onClick={() => setDisplayCount(prev => prev + 3)}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors font-medium border border-accent/20 hover:border-accent"
                    >
                        <ChevronDown className="w-4 h-4" />
                        Load More ({evidence.length - displayCount} remaining)
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
            <Loader2 className="w-10 h-10 text-primary-500 animate-spin mx-auto" />
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
