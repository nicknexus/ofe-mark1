import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    ArrowLeft, BarChart3, TrendingUp, FileText, Calendar,
    ExternalLink, MapPin, Target, Sparkles, CheckCircle2,
    ChevronLeft, ChevronRight, ChevronDown, X, Users
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { publicApi, PublicMetricDetail, PublicEvidence, PublicMetricTag } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagFilter from '../components/public/PublicTagFilter'
import PublicTagChip from '../components/public/PublicTagChip'
import DateRangePicker from '../components/DateRangePicker'
import { getLocalDateString, formatDate } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'

// Category colors
const categoryConfig: Record<string, { bg: string; text: string; gradient: string; accent: string }> = {
    impact: { bg: 'bg-purple-500', text: 'text-purple-600', gradient: 'from-purple-500 to-purple-600', accent: '#8b5cf6' },
    output: { bg: 'bg-accent', text: 'text-accent', gradient: 'from-accent to-primary-600', accent: '#c0dfa1' },
    input: { bg: 'bg-blue-500', text: 'text-blue-600', gradient: 'from-blue-500 to-blue-600', accent: '#3b82f6' }
}

export default function PublicMetricPage() {
    const { orgSlug, initiativeSlug, metricSlug } = useParams<{
        orgSlug: string;
        initiativeSlug: string;
        metricSlug: string
    }>()
    const orgLinkBase = useOrgLinkBase()

    const [searchParams, setSearchParams] = useSearchParams()
    const [metric, setMetric] = useState<PublicMetricDetail | null>(null)
    const [tags, setTags] = useState<PublicMetricTag[]>([])
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [selectedBenGroupIds, setSelectedBenGroupIds] = useState<string[]>([])
    const [showLocationDropdown, setShowLocationDropdown] = useState(false)
    const [showBenDropdown, setShowBenDropdown] = useState(false)
    const locationBtnRef = useRef<HTMLButtonElement>(null)
    const benBtnRef = useRef<HTMLButtonElement>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [dateFilter, setDateFilter] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>(() => {
        const s = searchParams.get('startDate')
        const e = searchParams.get('endDate')
        if (s && e) return { startDate: s, endDate: e }
        if (s) return { singleDate: s }
        return {}
    })
    const filterStart = dateFilter.singleDate || dateFilter.startDate || ''
    const filterEnd = dateFilter.endDate || dateFilter.singleDate || ''

    // Evidence gallery state
    const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    useEffect(() => {
        const loadMetric = async () => {
            if (!orgSlug || !initiativeSlug || !metricSlug) return

            try {
                setLoading(true)
                setError(null)
                const data = await publicApi.getMetricDetail(orgSlug, initiativeSlug, metricSlug)
                setMetric(data)
            } catch (err) {
                console.error('Error loading metric:', err)
                setError('Failed to load metric')
            } finally {
                setLoading(false)
            }
        }

        loadMetric()
    }, [orgSlug, initiativeSlug, metricSlug])

    useEffect(() => {
        if (orgSlug) {
            publicApi.getOrganizationTags(orgSlug).then(setTags).catch(() => setTags([]))
        }
    }, [orgSlug])

    if (loading) {
        return <PublicLoader message="Loading metric..." />
    }

    if (error || !metric) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center px-6">
                <div className="bg-white/50 backdrop-blur-2xl border border-white/60 shadow-xl p-12 rounded-3xl text-center max-w-md">
                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-6" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-3">Metric Not Found</h1>
                    <p className="text-gray-500 mb-8">{error || 'This metric does not exist.'}</p>
                    <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics`}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-colors font-medium">
                        <ArrowLeft className="w-4 h-4" /> Back to Metrics
                    </Link>
                </div>
            </div>
        )
    }

    const config = categoryConfig[metric.category] || categoryConfig.output

    // Date-filter updates and evidence
    const isInDateRange = (dateStr: string) => {
        if (!filterStart) return true
        const d = dateStr?.slice(0, 10)
        if (!d) return true
        if (filterEnd) return d >= filterStart && d <= filterEnd
        return d === filterStart
    }

    const tagsById = new Map(tags.map(t => [t.id, t]))
    // Restrict the dropdown to tags actually used on this metric (its tag_ids
    // plus any tag attached to one of its claims/evidence).
    const metricTagIds = new Set<string>([
        ...(metric.tag_ids || []),
        ...(metric.updates || []).map(u => u.tag_id).filter(Boolean) as string[],
        ...(metric.evidence || []).flatMap(e => e.tag_ids || []),
    ])
    const metricTags = tags.filter(t => metricTagIds.has(t.id))

    const tagMatchSingle = (id?: string | null) => {
        if (selectedTagIds.length === 0) return true
        if (!id) return false
        return selectedTagIds.includes(id)
    }
    const tagMatchAny = (ids?: string[] | null) => {
        if (selectedTagIds.length === 0) return true
        if (!ids || ids.length === 0) return false
        return ids.some(i => selectedTagIds.includes(i))
    }

    // Available locations and beneficiary groups for filter dropdowns. Pulled
    // from the claims + evidence so the dropdown only ever offers options
    // that will actually filter something in this metric.
    const availableLocations = (() => {
        const map = new Map<string, { id: string; name: string }>()
        ;(metric.updates || []).forEach(u => {
            if (u.location_id && u.location?.name) map.set(u.location_id, { id: u.location_id, name: u.location.name })
        })
        ;(metric.evidence || []).forEach(e => {
            (e.locations || []).forEach(l => { if (l.id) map.set(l.id, { id: l.id, name: l.name }) })
        })
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
    })()
    const availableBenGroups = (() => {
        const map = new Map<string, { id: string; name: string }>()
        ;(metric.updates || []).forEach(u => {
            (u.beneficiary_groups || []).forEach(b => { if (b.id) map.set(b.id, { id: b.id, name: b.name }) })
        })
        ;(metric.evidence || []).forEach(e => {
            (e.beneficiary_groups || []).forEach(b => { if (b.id) map.set(b.id, { id: b.id, name: b.name }) })
        })
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
    })()

    const locationMatchSingle = (id?: string | null) => {
        if (selectedLocationIds.length === 0) return true
        if (!id) return false
        return selectedLocationIds.includes(id)
    }
    const locationMatchAny = (locs?: { id: string }[] | null) => {
        if (selectedLocationIds.length === 0) return true
        if (!locs || locs.length === 0) return false
        return locs.some(l => selectedLocationIds.includes(l.id))
    }
    const benMatchAny = (groups?: { id: string }[] | null) => {
        if (selectedBenGroupIds.length === 0) return true
        if (!groups || groups.length === 0) return false
        return groups.some(g => selectedBenGroupIds.includes(g.id))
    }

    const filteredUpdates = (metric.updates || [])
        .filter(u => isInDateRange(u.date_represented))
        .filter(u => tagMatchSingle(u.tag_id))
        .filter(u => locationMatchSingle(u.location_id))
        .filter(u => benMatchAny(u.beneficiary_groups))
    const filteredEvidence = (metric.evidence || [])
        .filter(e => isInDateRange(e.date_represented))
        .filter(e => tagMatchAny(e.tag_ids))
        .filter(e => locationMatchAny(e.locations))
        .filter(e => benMatchAny(e.beneficiary_groups))
    const filteredTotal = aggregateKpiUpdates(filteredUpdates as any, metric.metric_type)
    const hasActiveFilters = !!(filterStart || selectedTagIds.length || selectedLocationIds.length || selectedBenGroupIds.length)
    const clearAllFilters = () => {
        setDateFilter({})
        setSelectedTagIds([])
        setSelectedLocationIds([])
        setSelectedBenGroupIds([])
    }

    // Prepare chart data (sorted by date)
    const chartData = [...filteredUpdates]
        .sort((a, b) => new Date(a.date_represented).getTime() - new Date(b.date_represented).getTime())
        .map(update => ({
            date: formatDate(update.date_represented, { month: 'short', day: 'numeric' }),
            fullDate: update.date_represented,
            value: parseFloat(String(update.value)) || 0,
            note: update.note,
            location: update.location?.name
        }))

    // Calculate cumulative values
    let cumulative = 0
    const cumulativeData = chartData.map(d => {
        cumulative += d.value
        return { ...d, cumulative }
    })

    // Brand color from initiative/organization data
    const brandColor = metric.initiative.brand_color || '#c0dfa1'

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

            {/* Navigation Header */}
            <div className="sticky top-0 z-50 bg-white/60 backdrop-blur-2xl border-b border-white/40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex items-center justify-between">
                        <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics`} className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-xs sm:text-sm font-medium">Back</span>
                        </Link>
                        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-center overflow-x-auto scrollbar-none px-2">
                            <div className="flex-shrink-0">
                                <DateRangePicker
                                    value={dateFilter}
                                    onChange={setDateFilter}
                                    maxDate={getLocalDateString(new Date())}
                                    placeholder="Date"
                                    className="[&>button]:h-7 [&>button]:text-[11px] [&>button]:pr-1.5 sm:[&>button]:pr-2.5 [&>button>div]:w-7 [&>button>div]:h-7 [&>button>div>svg]:w-3.5 [&>button>div>svg]:h-3.5 [&>button>span]:ml-1 sm:[&>button>span]:ml-1.5"
                                />
                            </div>

                            {availableLocations.length > 0 && (
                                <button
                                    ref={locationBtnRef}
                                    onClick={() => { setShowLocationDropdown(!showLocationDropdown); setShowBenDropdown(false) }}
                                    className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-[11px] font-medium transition-all border border-gray-200 shadow-sm flex-shrink-0"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <MapPin className="w-3.5 h-3.5 text-gray-600" />
                                    </div>
                                    <span className={`ml-1 sm:ml-1.5 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedLocationIds.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {selectedLocationIds.length > 0 ? `${selectedLocationIds.length} loc.` : 'Location'}
                                    </span>
                                    {selectedLocationIds.length > 0 ? (
                                        <X className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-0.5 sm:ml-1" onClick={(e) => { e.stopPropagation(); setSelectedLocationIds([]) }} />
                                    ) : (
                                        <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                                    )}
                                </button>
                            )}

                            <PublicTagFilter
                                tags={metricTags}
                                selectedTagIds={selectedTagIds}
                                onChange={setSelectedTagIds}
                                onOpenChange={(open) => { if (open) { setShowLocationDropdown(false); setShowBenDropdown(false) } }}
                            />

                            {availableBenGroups.length > 0 && (
                                <button
                                    ref={benBtnRef}
                                    onClick={() => { setShowBenDropdown(!showBenDropdown); setShowLocationDropdown(false) }}
                                    className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-[11px] font-medium transition-all border border-gray-200 shadow-sm flex-shrink-0"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                                        <Users className="w-3.5 h-3.5 text-gray-600" />
                                    </div>
                                    <span className={`ml-1 sm:ml-1.5 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedBenGroupIds.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                                        {selectedBenGroupIds.length > 0 ? `${selectedBenGroupIds.length} group${selectedBenGroupIds.length === 1 ? '' : 's'}` : 'Beneficiary'}
                                    </span>
                                    {selectedBenGroupIds.length > 0 ? (
                                        <X className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-0.5 sm:ml-1" onClick={(e) => { e.stopPropagation(); setSelectedBenGroupIds([]) }} />
                                    ) : (
                                        <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                                    )}
                                </button>
                            )}

                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="flex items-center gap-0.5 px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                                >
                                    <X className="w-2.5 h-2.5" /> Clear
                                </button>
                            )}
                        </div>
                        <Link to="/" className="flex items-center gap-2">
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center overflow-hidden">
                                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
                            </div>
                            <span className="text-sm sm:text-base font-newsreader font-extralight text-gray-800 hidden sm:block">Nexus Impacts</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                {/* Breadcrumb - Hidden on mobile */}
                <div className="hidden sm:block">
                    <PublicBreadcrumb
                        orgSlug={orgSlug!}
                        orgName={metric.initiative.org_name || ''}
                        items={[
                            { label: metric.initiative.title, href: `${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics` },
                            { label: metric.title }
                        ]}
                    />
                </div>

                {/* Hero Section */}
                <div className="mb-5 sm:mb-8">
                    <div className="flex flex-col gap-4 sm:gap-6">
                        {/* Metric Info */}
                        <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                                <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold rounded-full text-white ${config.bg} uppercase tracking-wide`}>
                                    {metric.category}
                                </span>
                                <span className="text-xs sm:text-sm text-gray-500 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    {metric.update_count} claim{metric.update_count !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-1 sm:mb-2">{metric.title}</h1>
                            {metric.description && (
                                <p className="text-sm sm:text-lg text-gray-600 max-w-2xl line-clamp-2 sm:line-clamp-none">{metric.description}</p>
                            )}
                            {metric.tag_ids && metric.tag_ids.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2 sm:mt-3">
                                    {metric.tag_ids.map(id => {
                                        const t = tagsById.get(id)
                                        if (!t) return null
                                        return (
                                            <PublicTagChip
                                                key={id}
                                                name={t.name}
                                                size="sm"
                                                selected={selectedTagIds.includes(id)}
                                                onClick={() => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                            />
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Big Total Card - Full width on mobile */}
                        <div className="bg-white/70 backdrop-blur-2xl p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-black/10 border border-white/60 lg:min-w-[200px] lg:max-w-[240px]">
                            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">Total Impact</p>
                            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${config.text}`}>
                                {(filterStart ? filteredTotal : metric.total_value).toLocaleString()}
                            </p>
                            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{metric.unit_of_measurement}</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-5 sm:mb-8">
                    {/* Chart - Takes 2 columns */}
                    <div className="lg:col-span-2 bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Cumulative Progress
                            </h2>
                            <span className="text-[10px] sm:text-xs text-gray-500 bg-white/60 px-2 sm:px-3 py-1 rounded-full">
                                All time
                            </span>
                        </div>

                        {chartData.length === 0 ? (
                            <div className="h-48 sm:h-72 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No impact claims recorded yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-48 sm:h-72 p-2 sm:p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={config.accent} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={config.accent} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toString()}
                                            width={35}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                                padding: '8px 12px',
                                                fontSize: '12px'
                                            }}
                                            formatter={(value: number) => [
                                                `${value.toLocaleString()} ${metric.unit_of_measurement}`,
                                                'Total'
                                            ]}
                                            labelFormatter={(label) => label}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="cumulative"
                                            stroke={config.accent}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#colorCumulative)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Impact Claims - Right side scrollable */}
                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex flex-col max-h-[300px] sm:max-h-[400px]">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex-shrink-0">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                Impact Claims
                            </h2>
                        </div>

                        {filteredUpdates.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 p-4 sm:p-6">
                                <div className="text-center">
                                    <Target className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs sm:text-sm">No claims yet</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
                                {[...filteredUpdates]
                                    .sort((a, b) => new Date(b.date_represented).getTime() - new Date(a.date_represented).getTime())
                                    .map((update, idx) => (
                                        <ImpactClaimCard
                                            key={update.id || idx}
                                            update={update}
                                            unit={metric.unit_of_measurement}
                                            config={config}
                                            orgSlug={orgSlug!}
                                            initiativeSlug={initiativeSlug!}
                                            tag={update.tag_id ? tagsById.get(update.tag_id) : undefined}
                                            selectedTagIds={selectedTagIds}
                                            onToggleTag={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                                        />
                                    ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Evidence Section */}
                <EvidenceGallerySection
                    evidence={filteredEvidence}
                    evidenceCount={filteredEvidence.length}
                    config={config}
                    galleryIndex={galleryIndex}
                    setGalleryIndex={setGalleryIndex}
                    currentFileIndex={currentFileIndex}
                    setCurrentFileIndex={setCurrentFileIndex}
                    orgSlug={orgSlug!}
                    initiativeSlug={initiativeSlug!}
                    tagsById={tagsById}
                    selectedTagIds={selectedTagIds}
                    onToggleTag={(id) => setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                />
            </div>

            {/* Location Dropdown Portal */}
            {showLocationDropdown && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationDropdown(false)} />
                    <div
                        className="fixed w-64 bg-white rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 z-[9999] py-1 max-h-72 overflow-y-auto"
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
                        {availableLocations.map(l => {
                            const isSelected = selectedLocationIds.includes(l.id)
                            return (
                                <button
                                    key={l.id}
                                    onClick={() => setSelectedLocationIds(prev => isSelected ? prev.filter(x => x !== l.id) : [...prev, l.id])}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-gray-900 border-2 border-gray-900' : 'border-2 border-gray-300 bg-white'}`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`truncate block ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{l.name}</span>
                                </button>
                            )
                        })}
                    </div>
                </>,
                document.body
            )}

            {/* Beneficiary Group Dropdown Portal */}
            {showBenDropdown && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setShowBenDropdown(false)} />
                    <div
                        className="fixed w-64 bg-white rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 z-[9999] py-1 max-h-72 overflow-y-auto"
                        style={(() => {
                            const rect = benBtnRef.current?.getBoundingClientRect()
                            if (!rect) return {}
                            return { top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) }
                        })()}
                    >
                        {selectedBenGroupIds.length > 0 && (
                            <button
                                onClick={() => setSelectedBenGroupIds([])}
                                className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-gray-50 border-b border-gray-100"
                            >
                                Clear beneficiary filter
                            </button>
                        )}
                        {availableBenGroups.map(g => {
                            const isSelected = selectedBenGroupIds.includes(g.id)
                            return (
                                <button
                                    key={g.id}
                                    onClick={() => setSelectedBenGroupIds(prev => isSelected ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-gray-900 border-2 border-gray-900' : 'border-2 border-gray-300 bg-white'}`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`truncate block ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{g.name}</span>
                                </button>
                            )
                        })}
                    </div>
                </>,
                document.body
            )}

            {/* Footer */}
            <div className="relative z-10 border-t border-white/40 bg-white/40 backdrop-blur-xl mt-8 sm:mt-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                        <p className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                            Part of <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics`} className="text-accent hover:underline font-medium">{metric.initiative.title}</Link>
                        </p>
                        <Link to={`${orgLinkBase}/${orgSlug}`} className="text-xs sm:text-sm text-accent hover:text-accent/80 font-medium flex items-center gap-1">
                            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Back to Organization
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}

// Impact Claim Card Component
function ImpactClaimCard({ update, unit, config, orgSlug, initiativeSlug, tag, selectedTagIds, onToggleTag }: {
    update: any;
    unit: string;
    config: { bg: string; text: string; gradient: string; accent: string };
    orgSlug: string;
    initiativeSlug: string;
    tag?: PublicMetricTag;
    selectedTagIds?: string[];
    onToggleTag?: (id: string) => void;
}) {
    const orgLinkBase = useOrgLinkBase()
    const hasDateRange = update.date_range_start && update.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(update.date_range_start, { month: 'short', day: 'numeric' })} - ${formatDate(update.date_range_end)}`
        : formatDate(update.date_represented)

    return (
        <Link
            to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/claim/${update.id}`}
            className="block p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-xl sm:rounded-2xl border border-white/50 hover:bg-white/80 hover:shadow-md hover:border-accent/30 transition-all group active:scale-[0.98]"
        >
            <div className="flex items-start justify-between gap-2 sm:gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                        <span className={`text-lg sm:text-xl font-bold ${config.text}`}>
                            +{parseFloat(update.value).toLocaleString()}
                        </span>
                        <span className="text-[10px] sm:text-xs text-gray-500">{unit}</span>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-500">
                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span>{displayDate}</span>
                    </div>
                </div>
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-accent/50 group-hover:text-accent transition-colors flex-shrink-0" />
            </div>
            {update.location && (
                <div className="mt-1.5 sm:mt-2 flex items-center gap-1 text-[10px] sm:text-xs text-gray-500">
                    <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span>{update.location.name}</span>
                </div>
            )}
            {tag && (
                <div className="mt-1.5 sm:mt-2 flex">
                    <PublicTagChip
                        name={tag.name}
                        size="xs"
                        selected={selectedTagIds?.includes(tag.id)}
                        onClick={onToggleTag ? () => onToggleTag(tag.id) : undefined}
                    />
                </div>
            )}
            {update.note && (
                <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500 line-clamp-2 italic">"{update.note}"</p>
            )}
        </Link>
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

// ===== Evidence Gallery Section =====
function EvidenceGallerySection({ evidence, evidenceCount, config, galleryIndex, setGalleryIndex, currentFileIndex, setCurrentFileIndex, orgSlug, initiativeSlug, tagsById, selectedTagIds, onToggleTag }: {
    evidence: PublicEvidence[]
    evidenceCount: number
    config: { bg: string; text: string; gradient: string; accent: string }
    galleryIndex: number | null
    setGalleryIndex: (i: number | null) => void
    orgSlug: string
    initiativeSlug: string
    currentFileIndex: number
    setCurrentFileIndex: (i: number | ((prev: number) => number)) => void
    tagsById?: Map<string, PublicMetricTag>
    selectedTagIds?: string[]
    onToggleTag?: (id: string) => void
}) {
    const orgLinkBase = useOrgLinkBase()
    const typeConfig: Record<string, { bg: string; label: string }> = {
        visual_proof: { bg: 'bg-pink-100 text-pink-800', label: 'Visual Proof' },
        documentation: { bg: 'bg-blue-100 text-blue-700', label: 'Documentation' },
        testimony: { bg: 'bg-orange-100 text-orange-800', label: 'Testimonies' },
        financials: { bg: 'bg-primary-100 text-primary-800', label: 'Financials' }
    }

    const isImageFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)
    }

    const isPdfFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ext === 'pdf'
    }

    const isVideoFile = (url: string) => {
        const ext = url.split('.').pop()?.toLowerCase() || ''
        return ['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(ext)
    }

    const isYouTubeUrl = (url: string) => {
        if (!url) return false
        return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(url)
    }

    const getYouTubeVideoId = (url: string): string | null => {
        if (!url) return null
        const match = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
        return match ? match[1] : null
    }

    const getPreviewUrl = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) {
            const imageFile = item.files.find(f => isImageFile(f.file_url))
            if (imageFile) return imageFile.file_url
            const ytFile = item.files.find(f => isYouTubeUrl(f.file_url))
            if (ytFile) {
                const vid = getYouTubeVideoId(ytFile.file_url)
                if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
            }
        }
        if (item.file_url && isImageFile(item.file_url)) return item.file_url
        if (item.file_url && isYouTubeUrl(item.file_url)) {
            const vid = getYouTubeVideoId(item.file_url)
            if (vid) return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`
        }
        return null
    }

    const getVideoPreviewUrl = (item: PublicEvidence): string | null => {
        if (item.files && item.files.length > 0) {
            const videoFile = item.files.find(f => isVideoFile(f.file_url))
            if (videoFile) return videoFile.file_url
        }
        if (item.file_url && isVideoFile(item.file_url)) return item.file_url
        return null
    }

    const getAllFiles = (item: PublicEvidence) => {
        if (item.files && item.files.length > 0) return item.files
        if (item.file_url) return [{ id: '0', file_url: item.file_url, file_name: item.title, file_type: item.type, display_order: 0 }]
        return []
    }

    const galleryItem = galleryIndex !== null ? evidence[galleryIndex] : null
    const galleryFiles = galleryItem ? getAllFiles(galleryItem) : []
    const galleryFile = galleryFiles[currentFileIndex] || null

    const openGallery = (index: number) => { setGalleryIndex(index); setCurrentFileIndex(0) }
    const closeGallery = useCallback(() => { setGalleryIndex(null); setCurrentFileIndex(0) }, [setGalleryIndex, setCurrentFileIndex])

    const goToPrev = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex(galleryIndex === 0 ? evidence.length - 1 : galleryIndex - 1)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    const goToNext = useCallback(() => {
        if (galleryIndex === null) return
        setGalleryIndex((galleryIndex + 1) % evidence.length)
        setCurrentFileIndex(0)
    }, [galleryIndex, evidence.length, setGalleryIndex, setCurrentFileIndex])

    // Keyboard nav
    useEffect(() => {
        if (galleryIndex === null) return
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeGallery()
            else if (e.key === 'ArrowLeft') {
                if (galleryFiles.length > 1 && !e.shiftKey) setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)
                else goToPrev()
            } else if (e.key === 'ArrowRight') {
                if (galleryFiles.length > 1 && !e.shiftKey) {
                    setCurrentFileIndex(i => {
                        if (i + 1 >= galleryFiles.length) { goToNext(); return 0 }
                        return i + 1
                    })
                } else goToNext()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [galleryIndex, galleryFiles.length, closeGallery, goToPrev, goToNext, setCurrentFileIndex])

    // Lock scroll
    useEffect(() => {
        if (galleryIndex !== null) {
            document.body.style.overflow = 'hidden'
            return () => { document.body.style.overflow = '' }
        }
    }, [galleryIndex])

    return (
        <>
            <div className="bg-white/50 backdrop-blur-2xl rounded-2xl sm:rounded-3xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                        <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                        Supporting Evidence
                    </h2>
                    <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-3 py-1 rounded-full ${config.bg} text-white`}>
                        {evidenceCount} item{evidenceCount !== 1 ? 's' : ''}
                    </span>
                </div>

                {evidence.length === 0 ? (
                    <div className="py-10 sm:py-16 text-center text-gray-500 px-4">
                        <FileText className="w-10 h-10 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 opacity-20" />
                        <p className="text-sm sm:text-lg font-medium mb-1">No evidence linked yet</p>
                        <p className="text-xs sm:text-sm">Evidence will appear here when linked to this metric</p>
                    </div>
                ) : (
                    <div className="p-3 sm:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                        {evidence.map((ev, idx) => {
                            const previewUrl = getPreviewUrl(ev)
                            const videoUrl = !previewUrl ? getVideoPreviewUrl(ev) : null
                            const fileCount = ev.files?.length || (ev.file_url ? 1 : 0)
                            const evTypeConfig = typeConfig[ev.type] || { bg: 'bg-gray-100 text-gray-600', label: ev.type }

                            return (
                                <button
                                    key={ev.id}
                                    onClick={() => openGallery(idx)}
                                    className="bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 hover:bg-white/80 hover:shadow-lg hover:border-accent transition-all overflow-hidden group text-left"
                                >
                                    {previewUrl ? (
                                        <div className="relative aspect-video bg-gray-100 overflow-hidden">
                                            <img src={previewUrl} alt={ev.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                                            {fileCount > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{fileCount} files</div>
                                            )}
                                        </div>
                                    ) : videoUrl ? (
                                        <div className="relative aspect-video bg-gray-900 overflow-hidden">
                                            <video src={videoUrl} className="w-full h-full object-cover" muted preload="metadata" />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center shadow-lg">
                                                    <svg className="w-5 h-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                                </div>
                                            </div>
                                            {fileCount > 1 && (
                                                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg">{fileCount} files</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="aspect-video bg-gradient-to-br from-accent/10 to-accent/5 flex items-center justify-center">
                                            <div className="text-center">
                                                <FileText className="w-10 h-10 text-accent/50 mx-auto mb-2" />
                                                <span className="text-sm text-gray-500">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${evTypeConfig.bg}`}>{evTypeConfig.label}</span>
                                            <span className="text-xs text-gray-500">{formatDate(ev.date_represented)}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-800 text-sm mb-1 group-hover:text-accent transition-colors">{ev.title}</h3>
                                        {ev.description && <p className="text-xs text-gray-500 line-clamp-2">{ev.description}</p>}
                                        {tagsById && ev.tag_ids && ev.tag_ids.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                                                {ev.tag_ids.slice(0, 3).map(id => {
                                                    const t = tagsById.get(id)
                                                    if (!t) return null
                                                    return (
                                                        <PublicTagChip
                                                            key={id}
                                                            name={t.name}
                                                            size="xs"
                                                            selected={selectedTagIds?.includes(id)}
                                                            onClick={onToggleTag ? () => onToggleTag(id) : undefined}
                                                        />
                                                    )
                                                })}
                                                {ev.tag_ids.length > 3 && (
                                                    <span className="text-[10px] text-gray-500 px-1">+{ev.tag_ids.length - 3}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Evidence Gallery Modal — portaled to body to escape z-10 stacking context */}
            {galleryIndex !== null && galleryItem && createPortal(
                <div className="fixed inset-0 z-[100]">
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl" onClick={closeGallery} />

                    <div className="relative z-10 w-full h-full max-w-6xl mx-auto flex flex-col p-3 sm:p-6">
                        {/* Top bar */}
                        <div className="flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <button onClick={closeGallery} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                    <ArrowLeft className="w-4 h-4" />
                                    <span className="text-sm font-medium">Back to Metric</span>
                                </button>
                                <div className="h-5 w-px bg-gray-200" />
                                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${typeConfig[galleryItem.type]?.bg || 'bg-gray-100 text-gray-600'}`}>
                                    {typeConfig[galleryItem.type]?.label || galleryItem.type}
                                </span>
                                <span className="text-muted-foreground text-sm">{galleryIndex + 1} of {evidence.length}</span>
                            </div>
                            <button onClick={closeGallery} className="w-9 h-9 rounded-full bg-white/60 hover:bg-white/80 border border-gray-200/50 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors shadow-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Main area */}
                        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
                            {/* File preview */}
                            <div className="lg:col-span-2 flex flex-col">
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 overflow-hidden flex-1 flex flex-col">
                                    <div className="relative bg-gray-900 flex-1 min-h-[250px] sm:min-h-[400px] max-h-[50vh] sm:max-h-[60vh] flex items-center justify-center">
                                        {galleryFile ? (
                                            isImageFile(galleryFile.file_url) ? (
                                                <img src={galleryFile.file_url} alt={galleryFile.file_name || galleryItem.title} className="max-w-full max-h-full object-contain" />
                                            ) : isVideoFile(galleryFile.file_url) ? (
                                                <video src={galleryFile.file_url} controls className="max-w-full max-h-full rounded-xl" preload="metadata" />
                                            ) : isPdfFile(galleryFile.file_url) ? (
                                                <iframe src={galleryFile.file_url} className="w-full h-full" title={galleryFile.file_name || galleryItem.title} />
                                            ) : isYouTubeUrl(galleryFile.file_url) ? (
                                                <div className="w-full h-full flex items-center justify-center p-4">
                                                    <div className="relative w-full max-w-2xl" style={{ paddingBottom: '56.25%' }}>
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${getYouTubeVideoId(galleryFile.file_url)}`}
                                                            title="YouTube video"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            className="absolute inset-0 w-full h-full rounded-lg"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center text-white">
                                                    <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                                                    <p className="text-sm opacity-70 mb-4">{galleryFile.file_name}</p>
                                                    <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm">
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

                                        {galleryFiles.length > 1 && (
                                            <>
                                                <button onClick={() => setCurrentFileIndex(i => i === 0 ? galleryFiles.length - 1 : i - 1)} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <button onClick={() => setCurrentFileIndex(i => (i + 1) % galleryFiles.length)} className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors">
                                                    <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                                                </button>
                                                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                                                    {galleryFiles.map((_, i) => (
                                                        <button key={i} onClick={() => setCurrentFileIndex(i)} className={`h-1.5 rounded-full transition-all ${i === currentFileIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'}`} />
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="px-3 sm:px-4 py-2 sm:py-3 bg-white/30 border-t border-white/30 flex items-center justify-between gap-2">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate flex-1">
                                            {galleryFile?.file_name}
                                            {galleryFiles.length > 1 && <span className="text-[10px] sm:text-xs text-gray-400 ml-2">({currentFileIndex + 1}/{galleryFiles.length})</span>}
                                        </span>
                                        {galleryFile?.file_url && (
                                            <a href={galleryFile.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-xs font-medium flex-shrink-0">
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                <span className="hidden sm:inline">Open in New Tab</span>
                                                <span className="sm:hidden">Open</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar */}
                            <div className="lg:col-span-1 flex flex-col gap-3 sm:gap-4 min-h-0 overflow-y-auto">
                                <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                    <h2 className="font-semibold text-foreground text-base sm:text-lg mb-1">{galleryItem.title}</h2>
                                    {galleryItem.description && <p className="text-muted-foreground text-xs sm:text-sm mb-3 line-clamp-4">{galleryItem.description}</p>}
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(galleryItem.date_represented)}
                                    </div>
                                    {galleryItem.locations && galleryItem.locations.length > 0 && (
                                        <div className="mt-3 flex flex-wrap gap-1">
                                            {galleryItem.locations.map((loc) => (
                                                <span key={loc.id} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded font-medium">{loc.name}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Impact Claims */}
                                {galleryItem.impact_claims && galleryItem.impact_claims.length > 0 ? (
                                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supporting Impact Claims</h3>
                                        <div className="space-y-2">
                                            {galleryItem.impact_claims.map((claim: any) => {
                                                const metricTitle = claim.kpis?.title || 'Unknown Metric'
                                                const metricSlug = claim.kpis?.title ? generateMetricSlug(claim.kpis.title) : ''
                                                const dateLabel = claim.date_range_start && claim.date_range_end
                                                    ? `${formatDate(claim.date_range_start, { month: 'short', day: 'numeric' })} – ${formatDate(claim.date_range_end)}`
                                                    : claim.date_represented
                                                        ? formatDate(claim.date_represented)
                                                        : ''
                                                return (
                                                    <Link key={claim.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${metricSlug}`} className="block p-3 rounded-xl bg-white/60 border border-white/80 hover:bg-white/80 hover:border-accent/30 hover:shadow-md transition-all group">
                                                        <p className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                                                            {claim.value} {claim.kpis?.unit_of_measurement || ''}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground mt-0.5">{metricTitle}</p>
                                                        {dateLabel && <p className="text-[10px] text-muted-foreground mt-0.5">{dateLabel}</p>}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ) : galleryItem.kpis && galleryItem.kpis.length > 0 ? (
                                    <div className="bg-white/50 backdrop-blur-2xl rounded-2xl border border-white/60 shadow-xl shadow-black/5 p-4 sm:p-5 flex-shrink-0">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Linked Metrics</h3>
                                        <div className="space-y-2">
                                            {galleryItem.kpis.map((kpi) => (
                                                <Link key={kpi.id} to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${generateMetricSlug(kpi.title)}`} className="block p-3 rounded-xl bg-white/60 border border-white/80 hover:bg-white/80 hover:border-accent/30 hover:shadow-md transition-all group">
                                                    <p className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">{kpi.title}</p>
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Bottom nav */}
                        <div className="flex items-center justify-between mt-3 sm:mt-4 flex-shrink-0">
                            <button onClick={goToPrev} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <ChevronLeft className="w-4 h-4" />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-[50vw] scrollbar-hide px-2">
                                {evidence.map((item, i) => {
                                    const thumb = getPreviewUrl(item)
                                    const vidThumb = !thumb ? getVideoPreviewUrl(item) : null
                                    return (
                                        <button key={item.id} onClick={() => { setGalleryIndex(i); setCurrentFileIndex(0) }}
                                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shadow-sm ${i === galleryIndex ? 'border-gray-800 scale-110 shadow-md' : 'border-white/60 opacity-60 hover:opacity-90 hover:border-gray-300'}`}>
                                            {thumb ? (
                                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                                            ) : vidThumb ? (
                                                <video src={vidThumb} className="w-full h-full object-cover" muted preload="metadata" />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center"><FileText className="w-4 h-4 text-gray-400" /></div>
                                            )}
                                        </button>
                                    )
                                })}
                            </div>

                            <button onClick={goToNext} className="flex items-center gap-2 px-4 py-2.5 bg-white/60 hover:bg-white/80 border border-gray-200/50 text-foreground rounded-xl transition-colors text-sm font-medium shadow-sm">
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
