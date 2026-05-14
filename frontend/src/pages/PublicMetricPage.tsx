import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import {
    ArrowLeft, BarChart3, TrendingUp, FileText, Calendar,
    ExternalLink, MapPin, Target, Sparkles, CheckCircle2,
    ChevronLeft, ChevronRight, ChevronDown, X, Users
} from 'lucide-react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { publicApi, PublicMetricDetail, PublicMetricTag } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import PublicTagFilter from '../components/public/PublicTagFilter'
import PublicDonateButton from '../components/public/PublicDonateButton'
import PublicTagChip from '../components/public/PublicTagChip'
import DateRangePicker from '../components/DateRangePicker'
import {
    PublicPageBackground,
    PUBLIC_PANEL_STATIC_CLASS,
    PUBLIC_SECTION_CHIP_STYLE,
    brandIconStyle,
    publicActiveFilterStyle,
} from '../components/public/publicStyles'
import { getLocalDateString, formatDate, formatAbbreviatedMetricTotal, parseLocalDate, getClaimEffectiveDate, compareClaimsByEffectiveDateDesc } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import { metricCategoryConfig } from '../components/public/metric/metricCategoryConfig'
import { PublicMetricEvidenceGallerySection } from '../components/public/metric/PublicMetricEvidenceGallerySection'
import { PublicMetricImpactClaimCard } from '../components/public/metric/PublicMetricImpactClaimCard'
import { PublicMetricPercentageTooltip } from '../components/public/metric/PublicMetricPercentageTooltip'

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
                <div className="rounded-3xl bg-white border border-gray-200/80 shadow-public p-12 text-center max-w-md">
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

    const config = metricCategoryConfig[metric.category] || metricCategoryConfig.output

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

    // Prepare chart data (sorted by effective date — end-of-range for ranges)
    const chartData = [...filteredUpdates]
        .sort((a, b) => getClaimEffectiveDate(a).getTime() - getClaimEffectiveDate(b).getTime())
        .map(update => {
            const eff = getClaimEffectiveDate(update)
            return {
                date: formatDate(eff, { month: 'short', day: 'numeric' }),
                fullDate: getLocalDateString(eff),
                value: parseFloat(String(update.value)) || 0,
                note: update.note,
                location: update.location?.name
            }
        })

    // Calculate cumulative values
    let cumulative = 0
    const cumulativeData = chartData.map(d => {
        cumulative += d.value
        return { ...d, cumulative }
    })

    // Brand color from initiative/organization data
    const brandColor = metric.initiative.brand_color || '#c0dfa1'

    // Percentage-mode chart data (per-month, range claims spread, single overrides)
    const isPercentage = metric.metric_type === 'percentage'
    const percentageChartData = (() => {
        if (!isPercentage || filteredUpdates.length === 0) return [] as Array<{ date: string; fullDate: Date; value: number | null; claimCount: number; average: number }>
        const monthly: Record<string, { singleSum: number; singleCount: number; rangeSum: number; rangeCount: number }> = {}
        const ensure = (key: string) => {
            if (!monthly[key]) monthly[key] = { singleSum: 0, singleCount: 0, rangeSum: 0, rangeCount: 0 }
            return monthly[key]
        }
        let earliest: Date | null = null
        let latest: Date | null = null
        const bumpRange = (d: Date) => {
            if (!earliest || d < earliest) earliest = new Date(d)
            if (!latest || d > latest) latest = new Date(d)
        }
        filteredUpdates.forEach((u: any) => {
            const value = Number(u.value || 0)
            if (!Number.isFinite(value)) return
            if (u.date_range_start && u.date_range_end) {
                const cs = parseLocalDate(u.date_range_start); cs.setHours(0, 0, 0, 0)
                const ce = parseLocalDate(u.date_range_end); ce.setHours(0, 0, 0, 0)
                bumpRange(cs); bumpRange(ce)
                const cursor = new Date(cs.getFullYear(), cs.getMonth(), 1)
                const stop = new Date(ce.getFullYear(), ce.getMonth(), 1)
                while (cursor.getTime() <= stop.getTime()) {
                    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
                    const b = ensure(key)
                    b.rangeSum += value
                    b.rangeCount += 1
                    cursor.setMonth(cursor.getMonth() + 1)
                }
            } else {
                const d = parseLocalDate(u.date_represented); d.setHours(0, 0, 0, 0)
                bumpRange(d)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                const b = ensure(key)
                b.singleSum += value
                b.singleCount += 1
            }
        })
        if (!earliest || !latest) return []
        // Buffer one month before earliest
        const start = new Date((earliest as Date).getFullYear(), (earliest as Date).getMonth(), 1)
        start.setMonth(start.getMonth() - 1)
        const end = new Date((latest as Date).getFullYear(), (latest as Date).getMonth(), 1)
        const result: Array<{ date: string; fullDate: Date; value: number | null; claimCount: number; average: number }> = []
        const overallAvg = Number(filteredTotal) || 0
        const cursor = new Date(start)
        while (cursor.getTime() <= end.getTime()) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
            const b = monthly[key]
            let v: number | null = null
            let claimCount = 0
            if (b) {
                if (b.singleCount > 0) { v = b.singleSum / b.singleCount; claimCount = b.singleCount }
                else if (b.rangeCount > 0) { v = b.rangeSum / b.rangeCount; claimCount = b.rangeCount }
            }
            result.push({
                date: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                fullDate: new Date(cursor),
                value: v,
                claimCount,
                average: typeof overallAvg === 'number' ? overallAvg : 0
            })
            cursor.setMonth(cursor.getMonth() + 1)
        }
        return result
    })()
    const percentageOverallAvg = isPercentage ? (Number(filteredTotal) || 0) : 0
    const percentageYMax = (() => {
        if (!isPercentage) return 100
        let max = 100
        percentageChartData.forEach(d => {
            if (typeof d.value === 'number' && d.value > max) max = d.value
        })
        if (percentageOverallAvg > max) max = percentageOverallAvg
        return Math.ceil(max / 100) * 100
    })()
    const percentageYTicks = (() => {
        if (!isPercentage) return [] as number[]
        const step = percentageYMax / 4
        return [0, step, step * 2, step * 3, percentageYMax]
    })()

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            <PublicPageBackground brandColor={brandColor} />

            {/* Navigation Header */}
            <div className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                            <Link to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}?tab=metrics`} className="flex items-center gap-1.5 sm:gap-2 text-gray-600 hover:text-gray-800 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                                <span className="text-xs sm:text-sm font-medium">Back</span>
                            </Link>
                            <PublicDonateButton orgSlug={orgSlug} />
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0 justify-center overflow-x-auto scrollbar-none px-2">
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

                            {availableLocations.length > 0 && (
                                <button
                                    ref={locationBtnRef}
                                    onClick={() => { setShowLocationDropdown(!showLocationDropdown); setShowBenDropdown(false) }}
                                    className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all flex-shrink-0"
                                    style={publicActiveFilterStyle(brandColor, selectedLocationIds.length > 0)}
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
                                activeColor={brandColor}
                                onOpenChange={(open) => { if (open) { setShowLocationDropdown(false); setShowBenDropdown(false) } }}
                            />

                            {availableBenGroups.length > 0 && (
                                <button
                                    ref={benBtnRef}
                                    onClick={() => { setShowBenDropdown(!showBenDropdown); setShowLocationDropdown(false) }}
                                    className="flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-xs font-medium transition-all flex-shrink-0"
                                    style={publicActiveFilterStyle(brandColor, selectedBenGroupIds.length > 0)}
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
                                    className="flex items-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
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
                                <span className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-bold rounded-full text-white ${config.bg} uppercase tracking-wide`}>
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
                        <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public p-4 sm:p-6 lg:min-w-[200px] lg:max-w-[240px]">
                            <p className="text-gray-500 text-xs sm:text-sm font-medium mb-0.5 sm:mb-1">{metric.metric_type === 'percentage' ? 'Average' : 'Total Impact'}</p>
                            <p className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${config.text}`}>
                                {formatAbbreviatedMetricTotal(hasActiveFilters ? filteredTotal : metric.total_value, { isPercentage: metric.metric_type === 'percentage' })}
                                {metric.metric_type === 'percentage' ? '%' : ''}
                            </p>
                            <p className="text-gray-500 text-xs sm:text-sm mt-0.5 sm:mt-1">{metric.metric_type === 'percentage' ? 'across all claims' : metric.unit_of_measurement}</p>
                        </div>
                    </div>
                </div>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-5 sm:mb-8">
                    {/* Chart - Takes 2 columns */}
                    <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
                                {isPercentage ? 'Percentage Over Time' : 'Cumulative Progress'}
                            </h2>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 sm:px-3 py-1 rounded-full">
                                {hasActiveFilters ? 'Filtered' : 'All time'}
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
                                    {isPercentage ? (
                                        <LineChart data={percentageChartData} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                                            <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="#cbd5e1"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94a3b8' }}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                stroke="#cbd5e1"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#94a3b8' }}
                                                domain={[0, percentageYMax]}
                                                ticks={percentageYTicks}
                                                tickFormatter={(value: any) => `${Math.round(value)}%`}
                                                width={40}
                                            />
                                            <Tooltip content={(tooltipProps: { active?: boolean; label?: string }) => (
                                                <PublicMetricPercentageTooltip
                                                    active={tooltipProps.active}
                                                    label={tooltipProps.label}
                                                    percentageChartData={percentageChartData}
                                                    percentageOverallAvg={percentageOverallAvg}
                                                    accent={config.accent}
                                                />
                                            )} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                            {percentageOverallAvg > 0 && (
                                                <ReferenceLine
                                                    y={percentageOverallAvg}
                                                    stroke={config.accent}
                                                    strokeOpacity={0.5}
                                                    strokeWidth={1.25}
                                                    strokeDasharray="5 4"
                                                    ifOverflow="extendDomain"
                                                    label={{ value: `Avg ${Math.round(percentageOverallAvg)}%`, position: 'right', fill: config.accent, fontSize: 12, fontWeight: 500, offset: 6 }}
                                                />
                                            )}
                                            <Line
                                                type="monotone"
                                                dataKey="average"
                                                stroke="transparent"
                                                dot={false}
                                                activeDot={false}
                                                isAnimationActive={false}
                                                legendType="none"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke={config.accent}
                                                strokeWidth={2.25}
                                                dot={{ r: 2.5, fill: config.accent, strokeWidth: 0 }}
                                                activeDot={{ r: 4, fill: config.accent, stroke: 'white', strokeWidth: 1.5 }}
                                                strokeLinecap="round"
                                                connectNulls={true}
                                            />
                                        </LineChart>
                                    ) : (
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
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                                axisLine={{ stroke: '#e2e8f0' }}
                                                tickLine={false}
                                                interval="preserveStartEnd"
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: '#94a3b8' }}
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
                                    )}
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* Impact Claims - Right side scrollable */}
                    <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden flex flex-col max-h-[300px] sm:max-h-[400px]">
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
                                    .sort(compareClaimsByEffectiveDateDesc)
                                    .map((update, idx) => (
                                        <PublicMetricImpactClaimCard
                                            key={update.id || idx}
                                            update={update}
                                            unit={metric.unit_of_measurement}
                                            isPercentage={metric.metric_type === 'percentage'}
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
                <PublicMetricEvidenceGallerySection
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
                        className="fixed w-64 bg-white rounded-xl shadow-modal border border-gray-100 z-[9999] py-1 max-h-72 overflow-y-auto"
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
                        className="fixed w-64 bg-white rounded-xl shadow-modal border border-gray-100 z-[9999] py-1 max-h-72 overflow-y-auto"
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
            <div className="relative z-10 border-t border-gray-100 bg-white mt-8 sm:mt-12">
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
