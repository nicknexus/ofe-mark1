import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Search, Building2, Target, MapPin, Loader2, ArrowRight, Sparkles, ArrowLeft } from 'lucide-react'
import { publicApi, PublicOrganization, PublicInitiative, SearchResult } from '../services/publicApi'
import PublicLoader from '../components/public/PublicLoader'
import { supabase } from '../services/supabase'

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay)
        return () => clearTimeout(handler)
    }, [value, delay])
    return debouncedValue
}

export default function ExplorePage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [results, setResults] = useState<SearchResult | null>(null)
    const [loading, setLoading] = useState(false)
    const [initialOrgs, setInitialOrgs] = useState<PublicOrganization[]>([])
    const [loadingInitial, setLoadingInitial] = useState(true)
    const [isLoggedIn, setIsLoggedIn] = useState(false)

    const debouncedQuery = useDebounce(searchQuery, 300)

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session))
    }, [])
    useEffect(() => { loadInitialOrganizations() }, [])
    useEffect(() => {
        if (debouncedQuery.trim()) performSearch(debouncedQuery)
        else setResults(null)
    }, [debouncedQuery])

    const loadInitialOrganizations = async () => {
        try {
            setLoadingInitial(true)
            const orgs = await publicApi.getOrganizations()
            setInitialOrgs(orgs)
        } catch (error) {
            console.error('Failed to load organizations:', error)
        } finally {
            setLoadingInitial(false)
        }
    }

    const performSearch = async (query: string) => {
        try {
            setLoading(true)
            const searchResults = await publicApi.search(query)
            setResults(searchResults)
        } catch (error) {
            console.error('Search failed:', error)
        } finally {
            setLoading(false)
        }
    }

    const hasResults = results && (results.organizations.length > 0 || results.initiatives.length > 0 || results.locationMatches.length > 0)
    const showInitialOrgs = !searchQuery.trim() && !loading

    // Show loader only on initial page load
    if (loadingInitial && initialOrgs.length === 0) {
        return <PublicLoader message="Discovering organizations..." />
    }

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            {/* Flowing gradient background with fading grid */}
            <div className="fixed inset-0 pointer-events-none">
                {/* Subtle grid pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.2)_1px,transparent_1px)] bg-[size:60px_60px]" />

                {/* Radial gradient overlay to fade the grid */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,transparent_0%,white_60%)]" />

                {/* Green gradient blobs */}
                <div
                    className="absolute inset-0"
                    style={{
                        background: `
                            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(192, 223, 161, 0.5), transparent 60%),
                            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(192, 223, 161, 0.4), transparent 55%),
                            radial-gradient(ellipse 50% 60% at 60% 80%, rgba(192, 223, 161, 0.35), transparent 55%),
                            radial-gradient(ellipse 70% 40% at 10% 90%, rgba(192, 223, 161, 0.3), transparent 50%)
                        `
                    }}
                />
            </div>

            {/* Header */}
            <div className="relative z-10 pt-4 sm:pt-8 pb-8 sm:pb-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6">
                    {/* Navigation */}
                    <nav className="mb-6 sm:mb-12">
                        <div className="bg-white/40 backdrop-blur-2xl rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between border border-white/60 shadow-xl shadow-black/5">
                            <Link to="/" className="flex items-center gap-2 group">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                                    <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                                </div>
                                <span className="text-lg sm:text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
                            </Link>
                            <div className="flex items-center gap-2 sm:gap-4">
                                {isLoggedIn ? (
                                    <Link to="/" className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-primary-500 text-gray-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-primary-400 transition-colors">
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        Back to Dashboard
                                    </Link>
                                ) : (
                                    <>
                                        <Link to="/login" className="text-xs sm:text-sm text-muted-foreground hover:text-accent transition-colors">Sign In</Link>
                                        <Link to="/login" className="px-3 sm:px-4 py-2 bg-primary-500 text-gray-700 text-xs sm:text-sm font-medium rounded-xl hover:bg-primary-400 transition-colors">Get Started</Link>
                                    </>
                                )}
                            </div>
                        </div>
                    </nav>

                    {/* Hero Section */}
                    <div className="text-center mb-8 sm:mb-12">
                        <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-accent/15 rounded-full text-accent text-xs sm:text-sm font-medium mb-4 sm:mb-6 border border-accent/20">
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Discover Impact
                        </div>
                        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-newsreader font-light text-foreground leading-tight mb-4 sm:mb-6">
                            Explore <span className="text-accent">Organizations</span>
                        </h1>
                        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-6 sm:mb-10 px-2">
                            Search for organizations, initiatives, or locations to discover their verified impact data.
                        </p>

                        {/* Search Bar - GREEN focus */}
                        <div className="relative max-w-2xl mx-auto">
                            <div className="bg-white/50 backdrop-blur-2xl p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-white/60 shadow-xl shadow-black/5">
                                <div className="relative">
                                    <Search className="absolute left-3 sm:left-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search organizations..."
                                        className="w-full pl-10 sm:pl-14 pr-4 sm:pr-6 py-3 sm:py-4 text-base sm:text-lg bg-white/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-accent/20 focus:ring-2 focus:ring-accent focus:ring-[#c0dfa1] focus:border-accent focus:border-[#c0dfa1] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-[#c0dfa1] focus-visible:outline-none transition-all placeholder-muted-foreground"
                                        autoFocus
                                    />
                                    {loading && <Loader2 className="absolute right-3 sm:right-5 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-primary-500 animate-spin" />}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pb-10 sm:pb-20">
                {/* Search Results */}
                {searchQuery.trim() && results && (
                    <div className="space-y-6 sm:space-y-10">
                        {results.organizations.length > 0 && (
                            <ResultSection title="Organizations" icon={Building2} count={results.organizations.length}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {results.organizations.map((org) => <OrgCard key={org.id} org={org} />)}
                                </div>
                            </ResultSection>
                        )}
                        {results.initiatives.length > 0 && (
                            <ResultSection title="Initiatives" icon={Target} count={results.initiatives.length}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {results.initiatives.map((init) => <InitiativeCard key={init.id} initiative={init} />)}
                                </div>
                            </ResultSection>
                        )}
                        {results.locationMatches.length > 0 && (
                            <ResultSection title="Location Matches" icon={MapPin} count={results.locationMatches.length}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                    {results.locationMatches.map((match, idx) => <LocationMatchCard key={idx} match={match} />)}
                                </div>
                            </ResultSection>
                        )}
                        {!hasResults && !loading && (
                            <div className="bg-white/40 backdrop-blur-2xl p-8 sm:p-12 rounded-2xl sm:rounded-3xl text-center border border-white/60 shadow-xl shadow-black/5">
                                <Search className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-4 sm:mb-6" />
                                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">No results found</h3>
                                <p className="text-sm sm:text-base text-muted-foreground">Try searching with different keywords or browse organizations below.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Initial Organizations */}
                {showInitialOrgs && (
                    <div>
                        <div className="flex items-center justify-between mb-4 sm:mb-8">
                            <h2 className="text-xl sm:text-2xl font-newsreader font-light text-foreground">All Organizations</h2>
                            <span className="text-xs sm:text-sm text-muted-foreground px-2 sm:px-3 py-1 bg-accent/10 rounded-full">{initialOrgs.length} orgs</span>
                        </div>
                        {loadingInitial ? (
                            <div className="bg-white/40 backdrop-blur-2xl p-10 sm:p-16 rounded-2xl sm:rounded-3xl text-center border border-white/60 shadow-xl shadow-black/5">
                                <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-primary-500 animate-spin mx-auto mb-4" />
                                <p className="text-sm sm:text-base text-muted-foreground">Loading organizations...</p>
                            </div>
                        ) : initialOrgs.length === 0 ? (
                            <div className="bg-white/40 backdrop-blur-2xl p-10 sm:p-16 rounded-2xl sm:rounded-3xl text-center border border-white/60 shadow-xl shadow-black/5">
                                <Building2 className="w-12 h-12 sm:w-16 sm:h-16 text-muted-foreground/30 mx-auto mb-4 sm:mb-6" />
                                <p className="text-sm sm:text-base text-muted-foreground">No public organizations available yet.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                                {initialOrgs.map((org) => <OrgCard key={org.id} org={org} />)}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================
// Components
// ============================================

function ResultSection({ title, icon: Icon, count, children }: { title: string; icon: any; count: number; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-accent/15 flex items-center justify-center">
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                </div>
                <h2 className="text-lg sm:text-xl font-semibold text-foreground">{title}</h2>
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-accent/10 rounded-full text-xs sm:text-sm text-accent font-medium">{count}</span>
            </div>
            {children}
        </div>
    )
}

function OrgCard({ org }: { org: PublicOrganization }) {
    return (
        <Link to={`/org/${org.slug}`}
            className="group bg-white/50 backdrop-blur-xl p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:-translate-y-1 border border-white/60 hover:bg-white/70 hover:shadow-lg shadow-xl shadow-black/5 active:scale-[0.98]">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-accent/30 group-hover:to-accent/15 transition-colors border border-accent/20">
                    {org.logo_url ? (
                        <img src={org.logo_url} alt={org.name} className="w-full h-full object-cover rounded-lg sm:rounded-xl" />
                    ) : (
                        <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors truncate text-sm sm:text-base">{org.name}</h3>
                    {org.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{org.description}</p>}
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
            </div>
        </Link>
    )
}

function InitiativeCard({ initiative }: { initiative: PublicInitiative & { organization_name?: string; organization_logo_url?: string } }) {
    return (
        <Link to={`/org/${initiative.org_slug}/${initiative.slug}`}
            className="group bg-white/50 backdrop-blur-xl p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:-translate-y-1 border border-white/60 hover:bg-white/70 hover:shadow-lg shadow-xl shadow-black/5 active:scale-[0.98]">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-accent/30 group-hover:to-accent/15 transition-colors border border-accent/20 overflow-hidden">
                    {initiative.organization_logo_url ? (
                        <img src={initiative.organization_logo_url} alt={initiative.organization_name || 'Organization'} className="w-full h-full object-cover" />
                    ) : (
                        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors truncate text-sm sm:text-base">{initiative.title}</h3>
                    {initiative.organization_name && <p className="text-xs text-accent mt-0.5 font-medium">{initiative.organization_name}</p>}
                    {initiative.region && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-accent" />{initiative.region}
                        </p>
                    )}
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
            </div>
        </Link>
    )
}

function LocationMatchCard({ match }: { match: SearchResult['locationMatches'][0] }) {
    return (
        <Link to={`/org/${match.organization.slug}/${match.initiative.slug}`}
            className="group bg-white/50 backdrop-blur-xl p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-300 hover:-translate-y-1 border border-white/60 hover:bg-white/70 hover:shadow-lg shadow-xl shadow-black/5 active:scale-[0.98]">
            <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-accent/20 to-accent/10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 group-hover:from-accent/30 group-hover:to-accent/15 transition-colors border border-accent/20 overflow-hidden">
                    {match.organization.logo_url ? (
                        <img src={match.organization.logo_url} alt={match.organization.name} className="w-full h-full object-cover" />
                    ) : (
                        <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-accent" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground group-hover:text-accent transition-colors truncate text-sm sm:text-base">{match.location.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">in {match.initiative.title}</p>
                    <p className="text-xs text-accent font-medium mt-1">{match.organization.name}</p>
                </div>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
            </div>
        </Link>
    )
}
