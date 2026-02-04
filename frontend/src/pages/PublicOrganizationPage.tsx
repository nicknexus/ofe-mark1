import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import { 
    Building2, MapPin, BarChart3, ArrowLeft, Globe, 
    BookOpen, FileText, Calendar, ChevronRight, ChevronLeft,
    TrendingUp, Filter, ChevronDown, X, Target, Image, LineChart
} from 'lucide-react'
import { 
    publicApi, 
    PublicOrganization, 
    PublicInitiative, 
    PublicKPI, 
    PublicStory, 
    PublicLocation,
    PublicEvidence,
    OrganizationStats
} from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
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

// Toggle view types for the feature area
type FeatureView = 'globe' | 'stories' | 'initiatives' | 'graph'

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
    const [organization, setOrganization] = useState<PublicOrganization | null>(null)
    const [stats, setStats] = useState<OrganizationStats | null>(null)
    const [initiatives, setInitiatives] = useState<PublicInitiative[]>([])
    const [metrics, setMetrics] = useState<PublicKPI[]>([])
    const [stories, setStories] = useState<PublicStory[]>([])
    const [locations, setLocations] = useState<PublicLocation[]>([])
    const [evidence, setEvidence] = useState<PublicEvidence[]>([])
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
    
    // Location popups state
    const [activePopups, setActivePopups] = useState<Array<{
        id: string
        name: string
        country?: string
        top: number
        left: number
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
            const [inits, mets, stors, locs, evid] = await Promise.all([
                publicApi.getOrganizationInitiatives(slug!),
                publicApi.getOrganizationMetrics(slug!),
                publicApi.getOrganizationStories(slug!, 20),
                publicApi.getOrganizationLocations(slug!),
                publicApi.getOrganizationEvidence(slug!, 20)
            ])
            setInitiatives(inits)
            setMetrics(mets)
            setStories(stors)
            setLocations(locs)
            setEvidence(evid)
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

    const filteredLocations = useMemo(() => {
        if (selectedInitiative !== 'all') {
            return locations.filter(l => l.initiative_id === selectedInitiative)
        }
        return locations
    }, [locations, selectedInitiative])
    
    // Random location popups effect
    useEffect(() => {
        if (activeView !== 'globe' || filteredLocations.length === 0) return
        
        const spawnPopup = () => {
            const randomLocation = filteredLocations[Math.floor(Math.random() * filteredLocations.length)]
            const popupId = `${randomLocation.id}-${Date.now()}`
            
            // Position around the edges, avoiding center where globe is
            const edge = Math.floor(Math.random() * 4) // 0=top, 1=right, 2=bottom, 3=left
            let top, left
            
            if (edge === 0) { // top edge
                top = 8 + Math.random() * 12
                left = 15 + Math.random() * 55
            } else if (edge === 1) { // right edge
                top = 20 + Math.random() * 55
                left = 60 + Math.random() * 25
            } else if (edge === 2) { // bottom edge
                top = 75 + Math.random() * 12
                left = 15 + Math.random() * 55
            } else { // left edge
                top = 20 + Math.random() * 55
                left = 8 + Math.random() * 18
            }
            
            const newPopup = {
                id: popupId,
                name: randomLocation.name,
                country: randomLocation.country,
                top,
                left,
            }
            
            setActivePopups(prev => [...prev, newPopup])
            
            // Remove after 7 seconds
            setTimeout(() => {
                setActivePopups(prev => prev.filter(p => p.id !== popupId))
            }, 7000)
        }
        
        // Spawn initial popups
        spawnPopup()
        setTimeout(spawnPopup, 500)
        
        // Spawn new popups every 3 seconds
        const interval = setInterval(() => {
            spawnPopup()
        }, 3000)
        
        return () => clearInterval(interval)
    }, [activeView, filteredLocations])

    const filteredInitiatives = useMemo(() => {
        if (selectedInitiative !== 'all') {
            return initiatives.filter(i => i.id === selectedInitiative)
        }
        return initiatives
    }, [initiatives, selectedInitiative])

    // Auto-cycle stories
    useEffect(() => {
        if (filteredStories.length <= 1) return
        const interval = setInterval(() => {
            setStoryIndex(prev => (prev + 1) % filteredStories.length)
        }, 6000)
        return () => clearInterval(interval)
    }, [filteredStories.length])

    // Reset indices when filters change
    useEffect(() => {
        setStoryIndex(0)
        setEvidencePage(0)
    }, [selectedInitiative, startDate, endDate])

    const hasActiveFilters = selectedInitiative !== 'all' || startDate || endDate
    const clearFilters = () => {
        setSelectedInitiative('all')
        setStartDate('')
        setEndDate('')
    }

    // Current story for carousel
    const currentStory = filteredStories[storyIndex]

    // Brand color with fallback
    const brandColor = organization?.brand_color || '#c0dfa1'
    
    // Get all impact claims (KPI updates) from metrics, filtered by initiative
    const allImpactClaims = useMemo(() => {
        const sourceMetrics = selectedInitiative === 'all' 
            ? metrics 
            : metrics.filter(m => m.initiative_id === selectedInitiative)
        
        return sourceMetrics.flatMap(m => 
            (m.updates || []).map(u => ({
                ...u,
                metricTitle: m.title,
                metricUnit: m.unit_of_measurement,
                initiativeTitle: m.initiative_title,
                initiativeSlug: m.initiative_slug,
                category: m.category
            }))
        ).sort((a, b) => new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
    }, [metrics, selectedInitiative])

    // Filter evidence based on selected initiative
    const filteredEvidence = useMemo(() => {
        if (selectedInitiative === 'all') return evidence
        return evidence.filter(e => e.initiative_id === selectedInitiative)
    }, [evidence, selectedInitiative])
    
    // Evidence pagination (must be after filteredEvidence)
    const evidencePerPage = 4
    const totalEvidencePages = Math.ceil(filteredEvidence.length / evidencePerPage)
    const displayedEvidence = filteredEvidence.slice(evidencePage * evidencePerPage, (evidencePage + 1) * evidencePerPage)

    // Memoize globe locations - group by country to avoid clutter
    const globeLocations = useMemo(() => {
        const validLocations = filteredLocations.filter(loc => loc.latitude && loc.longitude)
        
        // Group by country, use first location's coords for each country
        const countryMap = new Map<string, { lat: number; lng: number; name: string; count: number }>()
        
        validLocations.forEach(loc => {
            const country = loc.country || loc.name // Fallback to location name if no country
            if (!countryMap.has(country)) {
                countryMap.set(country, {
                    lat: loc.latitude,
                    lng: loc.longitude,
                    name: country,
                    count: 1
                })
            } else {
                // Increment count for this country
                const existing = countryMap.get(country)!
                existing.count++
            }
        })
        
        return Array.from(countryMap.values()).map(c => ({
            lat: c.lat,
            lng: c.lng,
            name: c.count > 1 ? `${c.name} (${c.count})` : c.name,
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
        
        // Sort each initiative's metrics by total_value descending
        metricsByInitiative.forEach(entry => {
            entry.metrics.sort((a, b) => (b.total_value || 0) - (a.total_value || 0))
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

    // Chart data: selected metrics over time (cumulative)
    const initiativeChartData = useMemo(() => {
        // Get all updates grouped by month, keyed by metric.id
        const monthlyData: Record<string, Record<string, number>> = {}
        
        chartMetrics.forEach(({ metric }) => {
            if (!metric.updates) return
            metric.updates.forEach(update => {
                const date = new Date(update.date_represented)
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
                if (!monthlyData[monthKey]) monthlyData[monthKey] = {}
                if (!monthlyData[monthKey][metric.id]) monthlyData[monthKey][metric.id] = 0
                monthlyData[monthKey][metric.id] += update.value
            })
        })
        
        // Sort months and create cumulative chart data
        const sortedMonths = Object.keys(monthlyData).sort()
        const cumulativeTotals: Record<string, number> = {}
        
        return sortedMonths.map(monthKey => {
            const [year, month] = monthKey.split('-')
            const date = new Date(parseInt(year), parseInt(month) - 1)
            const label = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
            
            const dataPoint: any = { date: label }
            chartMetrics.forEach(({ metric }) => {
                if (!cumulativeTotals[metric.id]) cumulativeTotals[metric.id] = 0
                cumulativeTotals[metric.id] += monthlyData[monthKey]?.[metric.id] || 0
                dataPoint[metric.id] = cumulativeTotals[metric.id]
            })
            return dataPoint
        })
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
                <div className="glass-card p-12 rounded-3xl text-center max-w-md">
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
            
            {/* Compact Header */}
            <header className="flex-shrink-0 bg-white/60 backdrop-blur-2xl border-b border-white/40 shadow-sm z-50 relative">
                <div className="px-3 md:px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
                            <Link to="/explore" className="flex items-center gap-1 md:gap-1.5 text-muted-foreground hover:text-accent transition-colors flex-shrink-0">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-xs font-medium hidden sm:inline">Explore</span>
                            </Link>
                            <div className="h-5 w-px bg-gray-200 hidden sm:block" />
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center overflow-hidden bg-white shadow-md border border-gray-200/50 flex-shrink-0">
                                    {organization.logo_url ? (
                                        <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <Building2 className="w-4 h-4 text-gray-400" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <h1 className="text-xs md:text-sm font-semibold text-foreground truncate">{organization.name}</h1>
                                </div>
                            </div>
                            
                            {/* Initiative Filter - Inline (hidden on mobile) */}
                            <div className="relative ml-2 md:ml-4 hidden md:block">
                                <button
                                    onClick={() => setShowInitiativeDropdown(!showInitiativeDropdown)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                                        selectedInitiative !== 'all'
                                            ? 'bg-gray-800 text-white border-gray-800'
                                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                    }`}
                                >
                                    <Filter className="w-3 h-3" />
                                    <span className="max-w-[120px] truncate">
                                        {selectedInitiative === 'all' ? 'All Initiatives' : initiatives.find(i => i.id === selectedInitiative)?.title || 'Select'}
                                    </span>
                                    <ChevronDown className="w-3 h-3" />
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
                            
                            {hasActiveFilters && (
                                <button onClick={clearFilters} className="hidden md:flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                                    <X className="w-3 h-3" /> Clear
                                </button>
                            )}
                        </div>
                        
                        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-6 h-6 rounded-lg overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm font-newsreader font-extralight text-foreground hidden md:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Organization Hero Section */}
            <div className="flex flex-col md:flex-row relative z-20">
                {/* Left Side - Logo, Name, Statement (aligned with feature area) */}
                <div className="hidden md:block w-16 flex-shrink-0"></div>
                <div className="w-full md:w-[45%] flex-shrink-0 p-3 md:p-4 md:pr-2">
                    <div className="flex items-start gap-3 md:gap-5">
                        {/* Logo */}
                        <div className="w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm">
                            {organization.logo_url ? (
                                <img src={organization.logo_url} alt={organization.name} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xl md:text-3xl font-bold text-gray-400">{organization.name.charAt(0)}</span>
                            )}
                        </div>
                        
                        {/* Name and Statement */}
                        <div className="flex-1 min-w-0 pt-1 md:pt-2">
                            <h1 className="text-xl md:text-3xl font-bold mb-1" style={{ color: '#465360' }}>{organization.name}</h1>
                            {organization.statement && (
                                <p className="text-sm md:text-base leading-relaxed line-clamp-3 md:line-clamp-none" style={{ color: '#6b7280' }}>{organization.statement}</p>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Right Side - Initiatives Container (aligned with right panel) */}
                <div className="flex-1 p-3 md:p-4 md:pl-2">
                    <div className="h-full overflow-hidden flex flex-col">
                        <div className="px-2 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                    <Target className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm md:text-base">Initiatives</h2>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredInitiatives.length}</span>
                            </div>
                            {filteredInitiatives.length > 4 && (
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setHeroInitiativePage(p => Math.max(0, p - 1))} 
                                        disabled={heroInitiativePage === 0}
                                        className="w-6 h-6 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <span className="text-xs text-muted-foreground w-10 text-center">
                                        {heroInitiativePage + 1}/{Math.ceil(filteredInitiatives.length / 4)}
                                    </span>
                                    <button 
                                        onClick={() => setHeroInitiativePage(p => Math.min(Math.ceil(filteredInitiatives.length / 4) - 1, p + 1))} 
                                        disabled={heroInitiativePage >= Math.ceil(filteredInitiatives.length / 4) - 1}
                                        className="w-6 h-6 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 px-2 md:px-3 pb-2">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 h-full">
                                {filteredInitiatives.slice(heroInitiativePage * 4, heroInitiativePage * 4 + 4).map((init) => (
                                    <Link 
                                        key={init.id} 
                                        to={`/org/${slug}/${init.slug}`}
                                        className="p-3 bg-white/60 backdrop-blur-lg rounded-xl border border-white/80 hover:bg-white/80 hover:shadow-lg transition-all group flex flex-col justify-center"
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
                </div>
            </div>

            {/* Main Content Area - Fixed Height */}
            <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
                {/* Mobile Toggle Tabs */}
                <div className="md:hidden flex items-center justify-center gap-2 py-2 px-3 bg-white/40 backdrop-blur-lg border-b border-white/40 flex-shrink-0">
                    <button
                        onClick={() => setActiveView('globe')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeView === 'globe'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white/60 text-gray-600'
                        }`}
                    >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Globe</span>
                    </button>
                    <button
                        onClick={() => setActiveView('stories')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeView === 'stories'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white/60 text-gray-600'
                        }`}
                    >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Stories</span>
                    </button>
                    <button
                        onClick={() => setActiveView('graph')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeView === 'graph'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white/60 text-gray-600'
                        }`}
                    >
                        <LineChart className="w-3.5 h-3.5" />
                        <span>Graph</span>
                    </button>
                    <button
                        onClick={() => setActiveView('initiatives')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                            activeView === 'initiatives'
                                ? 'bg-gray-800 text-white'
                                : 'bg-white/60 text-gray-600'
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
                            onClick={() => setActiveView('globe')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                                activeView === 'globe'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white/60 backdrop-blur-lg text-gray-600 hover:bg-white/80 hover:scale-105 border border-white/60'
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
                            onClick={() => setActiveView('stories')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                                activeView === 'stories'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white/60 backdrop-blur-lg text-gray-600 hover:bg-white/80 hover:scale-105 border border-white/60'
                            }`}
                        >
                            <BookOpen className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Stories
                        </div>
                    </div>
                    <div className="group relative z-[100]">
                        <button
                            onClick={() => setActiveView('graph')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                                activeView === 'graph'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white/60 backdrop-blur-lg text-gray-600 hover:bg-white/80 hover:scale-105 border border-white/60'
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
                            onClick={() => setActiveView('initiatives')}
                            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                                activeView === 'initiatives'
                                    ? 'bg-gray-800 text-white shadow-lg scale-110'
                                    : 'bg-white/60 backdrop-blur-lg text-gray-600 hover:bg-white/80 hover:scale-105 border border-white/60'
                            }`}
                        >
                            <Target className="w-5 h-5" />
                        </button>
                        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-800 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[100]">
                            Initiatives
                        </div>
                    </div>
                </div>

                {/* Feature Area (Left-Center) */}
                <div className="w-full md:w-[45%] flex-shrink-0 pt-0 pb-2 md:pb-4 px-2 md:px-0 md:pr-2 h-[50vh] md:h-auto">
                    <div className="h-full overflow-hidden relative">
                        {/* Globe View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                            activeView === 'globe' 
                                ? 'opacity-100 translate-x-0 z-10' 
                                : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                        }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                                            <Globe className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Global Impact</h2>
                                    </div>
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">
                                        {filteredLocations.length} locations
                                    </span>
                                </div>
                                <div className="flex-1 relative overflow-hidden">
                                    <Suspense fallback={
                                        <div className="w-full h-full flex items-center justify-center">
                                            <div className="w-48 h-48 rounded-full bg-gradient-to-br from-accent/60 to-accent/30 animate-pulse" />
                                        </div>
                                    }>
                                        <ImpactGlobe 
                                            locations={globeLocations}
                                            showLabels={true}
                                            brandColor={brandColor}
                                            enableZoom={true}
                                        />
                                    </Suspense>
                                    
                                    {/* Location Popups */}
                                    {activePopups.map(popup => (
                                        <div
                                            key={popup.id}
                                            className="absolute px-3 py-1.5 rounded-full text-white text-xs font-medium shadow-lg pointer-events-none"
                                            style={{
                                                top: `${popup.top}%`,
                                                left: `${popup.left}%`,
                                                backgroundColor: brandColor,
                                                animation: 'fadeInOut 7s ease-in-out forwards',
                                            }}
                                        >
                                            {popup.name}{popup.country ? `, ${popup.country}` : ''}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Stories View - Single Story Carousel */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                            activeView === 'stories' 
                                ? 'opacity-100 translate-x-0 z-10' 
                                : activeView === 'globe' 
                                    ? 'opacity-0 translate-x-8 z-0 pointer-events-none'
                                    : 'opacity-0 -translate-x-8 z-0 pointer-events-none'
                        }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                                            <BookOpen className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Stories</h2>
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredStories.length}</span>
                                    </div>
                                    {filteredStories.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => setStoryIndex(p => p === 0 ? filteredStories.length - 1 : p - 1)}
                                                className="w-8 h-8 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-muted-foreground w-12 text-center">{storyIndex + 1}/{filteredStories.length}</span>
                                            <button 
                                                onClick={() => setStoryIndex(p => (p + 1) % filteredStories.length)}
                                                className="w-8 h-8 rounded-lg bg-white/60 hover:bg-white/80 flex items-center justify-center transition-colors"
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
                                            to={`/org/${slug}/${currentStory.initiative_slug}?tab=stories`}
                                            className="flex-1 rounded-2xl overflow-hidden hover:shadow-lg transition-all group relative"
                                        >
                                            {currentStory.media_url && currentStory.media_type === 'photo' ? (
                                                <img 
                                                    src={currentStory.media_url} 
                                                    alt={currentStory.title} 
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-white/40">
                                                    <FileText className="w-16 h-16 text-gray-300" />
                                                </div>
                                            )}
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
                                                    className={`h-2 rounded-full transition-all ${
                                                        idx === storyIndex ? 'w-6 bg-gray-800' : 'w-2 bg-gray-300 hover:bg-gray-400'
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

                        {/* Initiatives View */}
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                            activeView === 'initiatives' 
                                ? 'opacity-100 translate-x-0 z-10' 
                                : 'opacity-0 translate-x-8 z-0 pointer-events-none'
                        }`}>
                            <div className="h-full flex flex-col">
                                <div className="px-4 py-3 flex items-center justify-between ">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                                            <Target className="w-4 h-4 text-gray-600" />
                                        </div>
                                        <h2 className="font-semibold text-foreground">Initiatives</h2>
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredInitiatives.length}</span>
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
                                                    to={`/org/${slug}/${init.slug}`}
                                                    className="block p-4 bg-white/60 backdrop-blur-lg rounded-xl border border-white/80 hover:bg-white/80 hover:shadow-lg transition-all group"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/80 border border-white/50">
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
                        <div className={`absolute inset-0 transition-all duration-500 ease-out ${
                            activeView === 'graph' 
                                ? 'opacity-100 translate-x-0 z-10' 
                                : 'opacity-0 translate-x-8 z-0 pointer-events-none'
                        }`}>
                            <div className="h-full p-4">
                                <div className="h-full bg-white/40 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-2xl shadow-black/10 flex flex-col">
                                    <div className="px-4 py-3 flex items-center justify-between border-b border-white/50">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/60">
                                                <LineChart className="w-4 h-4 text-gray-600" />
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
                                                                        <stop offset="5%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.3}/>
                                                                        <stop offset="95%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0}/>
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
                                                                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
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
                                                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-white/30">
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
                    {/* Top Row - Metrics + Impact Claims (larger) */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-3 md:h-[65%]">
                        {/* Key Metrics (Scrollable 2x2 Grid) */}
                        <div className="w-full md:w-[60%] overflow-hidden flex flex-col max-h-[350px] md:max-h-none md:min-h-0">
                            <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <BarChart3 className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-sm md:text-base">Key Metrics</h2>
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredMetrics.length}</span>
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
                                                to={`/org/${slug}/${metric.initiative_slug}/metric/${generateMetricSlug(metric.title)}`}
                                                className="p-3 md:p-4 h-[100px] md:h-[19vh] rounded-xl bg-white/60 backdrop-blur-lg border border-white/80 hover:bg-white/80 hover:shadow-lg transition-all flex flex-col justify-between"
                                            >
                                                <div>
                                                    <span className="text-2xl md:text-4xl font-bold text-foreground">{metric.total_value?.toLocaleString() || '—'}</span>
                                                    <span className="text-xs md:text-sm text-muted-foreground ml-1">{metric.unit_of_measurement}</span>
                                                </div>
                                                <h4 className="font-normal text-muted-foreground text-xs md:text-sm line-clamp-2 leading-snug">{metric.title}</h4>
                                            </Link>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Impact Claims Container (Scrollable) */}
                        <div className="w-full md:w-[40%] overflow-hidden flex flex-col max-h-[280px] md:max-h-none md:min-h-0">
                            <div className="px-3 md:px-4 py-2 md:py-3 flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center bg-white/60">
                                        <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-600" />
                                    </div>
                                    <h2 className="font-semibold text-foreground text-sm md:text-base">Impact Claims</h2>
                                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{allImpactClaims.length}</span>
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
                                            <div 
                                                key={`${claim.id}-${idx}`}
                                                className="p-3 rounded-xl bg-white/60 backdrop-blur-lg border border-white/80 hover:bg-white/80 transition-all"
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg font-bold text-foreground">{claim.value?.toLocaleString()}</span>
                                                            <span className="text-xs text-muted-foreground">{claim.metricUnit}</span>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate mt-0.5">{claim.metricTitle}</p>
                                                        <p className="text-[10px] text-muted-foreground/70 truncate">{claim.initiativeTitle}</p>
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <span className={`px-1.5 py-0.5 text-[9px] font-semibold rounded-full ${
                                                            claim.category === 'impact' ? 'bg-purple-100/80 text-purple-700' :
                                                            claim.category === 'output' ? 'bg-green-100/80 text-green-700' : 'bg-blue-100/80 text-blue-700'
                                                        }`}>{claim.category}</span>
                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                            {new Date(claim.date_represented).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Row - Evidence (with pagination) */}
                    <div className="min-h-[120px] md:h-[35%] overflow-hidden flex flex-col">
                        <div className="px-3 md:px-4 py-2 flex items-center justify-between flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/60">
                                    <Image className="w-3.5 h-3.5 text-gray-600" />
                                </div>
                                <h2 className="font-semibold text-foreground text-sm">Evidence</h2>
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-white/60 text-gray-600">{filteredEvidence.length}</span>
                            </div>
                            {totalEvidencePages > 1 && (
                                <div className="flex items-center gap-1">
                                    <button 
                                        onClick={() => setEvidencePage(p => Math.max(0, p - 1))} 
                                        disabled={evidencePage === 0}
                                        className="w-6 h-6 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                                    </button>
                                    <span className="text-xs text-muted-foreground w-10 text-center">{evidencePage + 1}/{totalEvidencePages}</span>
                                    <button 
                                        onClick={() => setEvidencePage(p => Math.min(totalEvidencePages - 1, p + 1))} 
                                        disabled={evidencePage >= totalEvidencePages - 1}
                                        className="w-6 h-6 rounded-lg bg-white/60 hover:bg-white/80 disabled:opacity-30 flex items-center justify-center transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-600" />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="flex-1 p-2 overflow-hidden">
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
                                        return (
                                            <Link 
                                                key={ev.id}
                                                to={`/org/${slug}/${ev.initiative_slug}?tab=evidence`}
                                                className="rounded-xl overflow-hidden hover:shadow-lg transition-all group h-[80px] md:h-full"
                                            >
                                                {isImage ? (
                                                    <img src={ev.file_url} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
