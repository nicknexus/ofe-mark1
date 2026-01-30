import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    Loader2, Building2, MapPin, BarChart3, ArrowLeft, Target, 
    BookOpen, FileText, Calendar, ChevronRight, ChevronLeft, ArrowRight,
    TrendingUp, Users, Sparkles
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

// Map tile configuration - matches internal app
const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

// Fix Leaflet marker icons
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
            attribution={useFallback 
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                : CARTO_ATTRIBUTION}
            url={useFallback 
                ? 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                : CARTO_VOYAGER_URL}
            subdomains={['a', 'b', 'c', 'd']}
            maxZoom={20}
        />
    )
}

// Custom marker component matching internal app style
function LocationMarker({ location, orgSlug }: { location: PublicLocation; orgSlug: string }) {
    const [isHovered, setIsHovered] = useState(false)
    
    const icon = useMemo(() => {
        const size = isHovered ? 36 : 32
        const color = '#c0dfa1' // Green accent color
        
        return L.divIcon({
            className: 'custom-marker',
            html: `
                <div style="
                    position: relative;
                    width: ${size}px;
                    height: ${size}px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                ">
                    ${isHovered ? `
                        <div style="
                            position: absolute;
                            width: 42px;
                            height: 42px;
                            border-radius: 50%;
                            background-color: ${color};
                            opacity: 0.2;
                            animation: ping 1s cubic-bezier(0, 0, 0.2, 1) infinite;
                        "></div>
                        <div style="
                            position: absolute;
                            width: 38px;
                            height: 38px;
                            border-radius: 50%;
                            background-color: ${color};
                            opacity: 0.3;
                        "></div>
                    ` : ''}
                    <div style="
                        width: ${isHovered ? '24px' : '20px'};
                        height: ${isHovered ? '24px' : '20px'};
                        border-radius: 50%;
                        background-color: ${color};
                        border: ${isHovered ? '4px' : '3px'} solid white;
                        position: relative;
                        z-index: 10;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
                    ">
                        <div style="
                            position: absolute;
                            left: 50%;
                            top: 50%;
                            transform: translate(-50%, -50%);
                            width: ${isHovered ? '10px' : '8px'};
                            height: ${isHovered ? '10px' : '8px'};
                            border-radius: 50%;
                            background-color: white;
                        "></div>
                    </div>
                </div>
            `,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
        })
    }, [isHovered])

    return (
        <Marker
            position={[location.latitude, location.longitude]}
            icon={icon}
            eventHandlers={{
                mouseover: () => setIsHovered(true),
                mouseout: () => setIsHovered(false),
            }}
        >
            <Tooltip direction="top" offset={[0, -15]}>
                <div className="font-sans">
                    <p className="font-semibold text-sm">{location.name}</p>
                    {location.initiative_title && (
                        <p className="text-xs text-gray-500">{location.initiative_title}</p>
                    )}
                </div>
            </Tooltip>
        </Marker>
    )
}

// Map resize handler
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
    
    // Carousel state
    const [storyIndex, setStoryIndex] = useState(0)

    useEffect(() => {
        if (slug) loadOrganizationData()
    }, [slug])

    // Auto-advance stories
    useEffect(() => {
        if (stories.length <= 1) return
        const interval = setInterval(() => {
            setStoryIndex(prev => (prev + 1) % stories.length)
        }, 5000)
        return () => clearInterval(interval)
    }, [stories.length])

    const loadOrganizationData = async () => {
        try {
            setLoading(true)
            setError(null)

            const orgData = await publicApi.getOrganization(slug!)
            if (!orgData) { setError('Organization not found'); return }

            setOrganization(orgData.organization)
            setStats(orgData.stats)

            const [inits, mets, stors, locs] = await Promise.all([
                publicApi.getOrganizationInitiatives(slug!),
                publicApi.getOrganizationMetrics(slug!),
                publicApi.getOrganizationStories(slug!, 10),
                publicApi.getOrganizationLocations(slug!)
            ])

            setInitiatives(inits)
            setMetrics(mets)
            setStories(stors)
            setLocations(locs)
        } catch (err) {
            console.error('Error loading organization:', err)
            setError('Failed to load organization')
        } finally {
            setLoading(false)
        }
    }

    // Map center calculation
    const mapCenter = locations.length > 0
        ? [
            locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length,
            locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length
        ] as [number, number]
        : [20, 0] as [number, number]

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary-500 mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading organization...</p>
                </div>
            </div>
        )
    }

    if (error || !organization) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
                    <Building2 className="w-16 h-16 text-muted-foreground/50 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-foreground mb-3">Organization Not Found</h1>
                    <p className="text-muted-foreground mb-8">{error || 'This organization does not exist.'}</p>
                    <Link to="/explore" className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium">
                        Browse Organizations <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 font-figtree">
            {/* Subtle grid background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(192,223,161,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(192,223,161,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            {/* Header */}
            <div className="relative z-10 pt-8">
                <div className="max-w-7xl mx-auto px-6">
                    {/* Navigation */}
                    <nav className="mb-8">
                        <div className="glass rounded-2xl px-6 py-3 flex items-center justify-between border-accent/20">
                            <Link to="/explore" className="flex items-center gap-2 text-muted-foreground hover:text-accent transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-sm font-medium">Back to Explore</span>
                            </Link>
                            <Link to="/" className="flex items-center gap-2 group">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden">
                                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg font-newsreader font-extralight text-foreground hidden sm:block">Nexus Impacts</span>
                            </Link>
                        </div>
                    </nav>

                    {/* Organization Header */}
                    <div className="glass-card p-8 rounded-3xl mb-6 border-accent/20">
                        <div className="flex flex-col md:flex-row items-start gap-6">
                            <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/10 rounded-2xl flex items-center justify-center flex-shrink-0 border border-accent/30">
                                {organization.logo_url ? (
                                    <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover rounded-2xl" />
                                ) : (
                                    <Building2 className="w-10 h-10 text-accent" />
                                )}
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl sm:text-4xl font-newsreader font-light text-foreground mb-2">{organization.name}</h1>
                                {organization.description && (
                                    <p className="text-muted-foreground text-lg max-w-3xl">{organization.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Stats */}
                        {stats && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
                                <StatCard icon={Target} label="Initiatives" value={stats.initiatives} />
                                <StatCard icon={BarChart3} label="Metrics" value={stats.kpis} />
                                <StatCard icon={MapPin} label="Locations" value={stats.locations} />
                                <StatCard icon={BookOpen} label="Stories" value={stats.stories} />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Dashboard Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
                {/* Row 1: Stories + Metrics - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    {/* Stories Carousel */}
                    <div className="glass-card p-5 rounded-2xl border-accent/20 h-[420px] flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                    <BookOpen className="w-4 h-4 text-accent" />
                                </div>
                                <h2 className="text-lg font-semibold text-foreground">Recent Stories</h2>
                            </div>
                            {stories.length > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button onClick={() => setStoryIndex(prev => prev === 0 ? stories.length - 1 : prev - 1)}
                                        className="w-7 h-7 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-colors">
                                        <ChevronLeft className="w-4 h-4 text-accent" />
                                    </button>
                                    <span className="text-xs text-muted-foreground w-10 text-center">{storyIndex + 1}/{stories.length}</span>
                                    <button onClick={() => setStoryIndex(prev => (prev + 1) % stories.length)}
                                        className="w-7 h-7 rounded-full bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-colors">
                                        <ChevronRight className="w-4 h-4 text-accent" />
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {stories.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground text-sm">No stories yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="relative overflow-hidden rounded-xl flex-1">
                                <div className="flex transition-transform duration-500 ease-out h-full"
                                    style={{ transform: `translateX(-${storyIndex * 100}%)` }}>
                                    {stories.map((story) => (
                                        <div key={story.id} className="w-full flex-shrink-0 h-full">
                                            <Link to={`/org/${slug}/${story.initiative_slug}`} className="block h-full group">
                                                <div className="flex flex-col h-full bg-gradient-to-br from-accent/5 to-transparent rounded-xl overflow-hidden border border-transparent group-hover:border-accent transition-colors">
                                                    <div className="h-40 bg-gray-100 overflow-hidden flex-shrink-0">
                                                        {story.media_url && story.media_type === 'photo' ? (
                                                            <img src={story.media_url} alt={story.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-accent/10 to-accent/5">
                                                                <FileText className="w-10 h-10 text-accent/40" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="p-4 flex-1 flex flex-col">
                                                        <span className="text-xs text-accent font-medium mb-1">{story.initiative_title}</span>
                                                        <h3 className="text-base font-semibold text-foreground group-hover:text-accent transition-colors line-clamp-2 mb-2">{story.title}</h3>
                                                        {story.description && <p className="text-sm text-muted-foreground line-clamp-2 flex-1">{story.description}</p>}
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(story.date_represented).toLocaleDateString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metrics - Scrollable Cards */}
                    <div className="glass-card p-5 rounded-2xl border-accent/20 h-[420px] flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                <BarChart3 className="w-4 h-4 text-accent" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground">Impact Metrics</h2>
                            <span className="px-2 py-0.5 bg-accent/10 rounded-full text-xs text-accent font-medium">{metrics.length}</span>
                        </div>
                        
                        {metrics.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center">
                                    <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground text-sm">No metrics yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                                {metrics.map((metric) => (
                                    <Link key={metric.id} to={`/org/${slug}/${metric.initiative_slug}`}
                                        className="block p-4 bg-gradient-to-r from-accent/5 to-transparent rounded-xl transition-all group border border-transparent hover:border-accent hover:shadow-[0_0_15px_rgba(192,223,161,0.2)]">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${
                                                        metric.category === 'impact' ? 'bg-accent/20 text-accent' :
                                                        metric.category === 'output' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                                                    }`}>{metric.category}</span>
                                                </div>
                                                <h3 className="font-medium text-foreground text-sm group-hover:text-accent transition-colors">{metric.title}</h3>
                                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{metric.initiative_title}</p>
                                            </div>
                                            <div className="text-right ml-4 flex-shrink-0">
                                                {metric.total_value !== undefined && metric.total_value !== null ? (
                                                    <>
                                                        <div className="text-2xl font-bold text-primary-500">
                                                            {metric.total_value.toLocaleString()}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">{metric.unit_of_measurement}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="text-2xl font-bold text-muted-foreground/40">—</div>
                                                        <p className="text-xs text-muted-foreground">{metric.unit_of_measurement}</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Row 2: Initiatives + Locations - Side by Side */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Initiatives */}
                    <div className="glass-card p-5 rounded-2xl border-accent/20">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                <Target className="w-4 h-4 text-accent" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground">Initiatives</h2>
                            <span className="px-2 py-0.5 bg-accent/10 rounded-full text-xs text-accent font-medium">{initiatives.length}</span>
                        </div>
                        
                        {initiatives.length === 0 ? (
                            <div className="py-12 text-center">
                                <Target className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground text-sm">No initiatives yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                                {initiatives.map((initiative) => (
                                    <Link key={initiative.id} to={`/org/${slug}/${initiative.slug}`}
                                        className="flex items-center justify-between p-3 bg-gradient-to-r from-accent/5 to-transparent rounded-xl transition-all group border border-transparent hover:border-accent hover:shadow-[0_0_15px_rgba(192,223,161,0.2)]">
                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                            <div className="w-9 h-9 bg-accent/20 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                {organization.logo_url ? (
                                                    <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Target className="w-4 h-4 text-accent" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-medium text-foreground text-sm group-hover:text-accent transition-colors truncate">{initiative.title}</h3>
                                                {initiative.region && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                        <MapPin className="w-3 h-3" />{initiative.region}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0 ml-2" />
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Locations Map */}
                    <div className="glass-card p-5 rounded-2xl border-accent/20 h-[420px] flex flex-col">
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-accent" />
                            </div>
                            <h2 className="text-lg font-semibold text-foreground">Impact Locations</h2>
                            <span className="px-2 py-0.5 bg-accent/10 rounded-full text-xs text-accent font-medium">{locations.length}</span>
                        </div>
                        
                        {locations.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center rounded-xl bg-gray-50">
                                <div className="text-center">
                                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                    <p className="text-muted-foreground text-sm">No locations yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 rounded-xl overflow-hidden border border-gray-200">
                                <MapContainer center={mapCenter} zoom={locations.length === 1 ? 8 : 3} className="w-full h-full" zoomControl={false} scrollWheelZoom={false}>
                                    <MapResizeHandler />
                                    <TileLayerWithFallback />
                                    {locations.map((location) => (
                                        <LocationMarker key={location.id} location={location} orgSlug={slug!} />
                                    ))}
                                </MapContainer>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 border-t border-accent/10 bg-white/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <p className="text-sm text-muted-foreground">Public impact dashboard for <span className="text-accent font-medium">{organization.name}</span></p>
                        <Link to="/explore" className="text-sm text-accent hover:text-accent/80 font-medium">Explore more organizations →</Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================
// Helper Components
// ============================================

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
    return (
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 rounded-xl p-3 flex items-center gap-3 border border-accent/20">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                <Icon className="w-5 h-5 text-accent" />
            </div>
            <div>
                <p className="text-xl font-bold text-primary-500">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
            </div>
        </div>
    )
}
