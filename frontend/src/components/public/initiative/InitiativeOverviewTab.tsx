import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrgLinkBase } from '../../../hooks/useOrgLinkBase'
import { Activity, BarChart3, ChevronDown, Globe, Layers, MapPin, TrendingUp } from 'lucide-react'
import { MapContainer } from 'react-leaflet'
import {
    Area,
    AreaChart,
    CartesianGrid,
    Cell,
    Line,
    LineChart,
    Pie,
    PieChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis,
} from 'recharts'
import { PublicInitiative, InitiativeDashboard, PublicMetricTag } from '../../../services/publicApi'
import { formatDate, formatAbbreviatedMetricTotal, parseLocalDate } from '../../../utils'
import { LocationMarker, TileLayerWithFallback } from './PublicInitiativeMap'
import { CATEGORY_COLORS, generateMetricSlug, getMetricColor } from './metricColors'
import { brandIconStyle, PUBLIC_SECTION_CHIP_STYLE } from '../publicStyles'

export function InitiativeOverviewTab({ initiative, dashboard, orgSlug, initiativeSlug, dateQS = '', tagsById, onTagClick, selectedTagIds }: {
    initiative: PublicInitiative;
    dashboard: InitiativeDashboard;
    orgSlug: string;
    initiativeSlug: string;
    dateQS?: string;
    tagsById?: Map<string, PublicMetricTag>;
    onTagClick?: (id: string) => void;
    selectedTagIds?: string[];
}) {
    const orgLinkBase = useOrgLinkBase()
    const brandColor = initiative.organization_brand_color || '#c0dfa1'
    const [timeFrame, setTimeFrame] = useState<'all' | '1month' | '6months' | '1year'>('all')
    const [isCumulative, setIsCumulative] = useState(false)
    const [isPercentageMode, setIsPercentageMode] = useState(false)
    const userPickedGraphModeRef = useRef(false)
    const [visibleKPIs, setVisibleKPIs] = useState<Set<string>>(new Set(dashboard.kpis.map(k => k.id)))
    const [isMetricDropdownOpen, setIsMetricDropdownOpen] = useState(false)

    const hasPercentageKpi = useMemo(() => dashboard.kpis.some(k => k.metric_type === 'percentage'), [dashboard.kpis])
    const hasNonPercentageKpi = useMemo(() => dashboard.kpis.some(k => k.metric_type !== 'percentage'), [dashboard.kpis])

    useEffect(() => {
        if (userPickedGraphModeRef.current) return
        if (!dashboard.kpis || dashboard.kpis.length === 0) return
        const allPercentage = dashboard.kpis.every(k => k.metric_type === 'percentage')
        setIsPercentageMode(allPercentage)
        if (allPercentage) setIsCumulative(false)
    }, [dashboard.kpis])

    const visiblePercentageKpis = useMemo(
        () => dashboard.kpis.filter(k => k.metric_type === 'percentage' && visibleKPIs.has(k.id)),
        [dashboard.kpis, visibleKPIs]
    )
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
        const updates: Array<{ kpi_id: string; value: number; date_represented: string; date_range_start?: string; date_range_end?: string }> = []
        dashboard.kpis.forEach(kpi => {
            if (kpi.updates && kpi.updates.length > 0) {
                kpi.updates.forEach(update => {
                    updates.push({
                        kpi_id: kpi.id,
                        value: update.value,
                        date_represented: update.date_represented,
                        date_range_start: update.date_range_start,
                        date_range_end: update.date_range_end
                    })
                })
            }
        })
        return updates
    }, [dashboard.kpis])

    // Per-metric overall average for percentage metrics (used by ref lines + ghost data)
    const percentageAveragesById = useMemo(() => {
        const out: Record<string, number> = {}
        visiblePercentageKpis.forEach(k => {
            const updates = (k.updates || []).map(u => ({ value: u.value }))
            if (updates.length === 0) { out[k.id] = 0; return }
            const sum = updates.reduce((acc, u) => acc + (Number(u.value) || 0), 0)
            out[k.id] = sum / updates.length
        })
        return out
    }, [visiblePercentageKpis])

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

        // Filter KPIs by mode: % mode = only percentage; otherwise = only non-percentage
        const kpiTypeById = new Map(dashboard.kpis.map(k => [k.id, k.metric_type]))
        const isModeKpi = (kpiId: string) => {
            const t = kpiTypeById.get(kpiId)
            return isPercentageMode ? t === 'percentage' : t !== 'percentage'
        }

        // Percentage mode: per-month per-kpi value with range/single override semantics
        if (isPercentageMode) {
            const pctKpiIds = dashboard.kpis
                .filter(k => k.metric_type === 'percentage' && visibleKPIs.has(k.id))
                .map(k => k.id)

            const monthly: Record<string, Record<string, { singleSum: number; singleCount: number; rangeSum: number; rangeCount: number }>> = {}
            const ensure = (key: string, kpiId: string) => {
                if (!monthly[key]) monthly[key] = {}
                if (!monthly[key][kpiId]) monthly[key][kpiId] = { singleSum: 0, singleCount: 0, rangeSum: 0, rangeCount: 0 }
                return monthly[key][kpiId]
            }

            allUpdates.forEach(update => {
                if (!pctKpiIds.includes(update.kpi_id)) return
                const value = Number(update.value || 0)
                if (!Number.isFinite(value)) return
                const isRange = !!(update.date_range_start && update.date_range_end)
                if (isRange) {
                    const cs = parseLocalDate(update.date_range_start as string); cs.setHours(0, 0, 0, 0)
                    const ce = parseLocalDate(update.date_range_end as string); ce.setHours(0, 0, 0, 0)
                    const cursor = new Date(cs.getFullYear(), cs.getMonth(), 1)
                    const stop = new Date(ce.getFullYear(), ce.getMonth(), 1)
                    while (cursor.getTime() <= stop.getTime()) {
                        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
                        const b = ensure(key, update.kpi_id)
                        b.rangeSum += value
                        b.rangeCount += 1
                        cursor.setMonth(cursor.getMonth() + 1)
                    }
                } else {
                    const d = parseLocalDate(update.date_represented); d.setHours(0, 0, 0, 0)
                    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                    const b = ensure(key, update.kpi_id)
                    b.singleSum += value
                    b.singleCount += 1
                }
            })

            const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1)
            firstMonth.setMonth(firstMonth.getMonth() - 1)
            const lastMonth = new Date(now.getFullYear(), now.getMonth(), 1)
            const result: any[] = []
            const cursor = new Date(firstMonth)
            while (cursor.getTime() <= lastMonth.getTime()) {
                const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
                const monthLabel = cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
                const dataPoint: any = { date: monthLabel, fullDate: new Date(cursor) }
                pctKpiIds.forEach(kpiId => {
                    const b = monthly[key]?.[kpiId]
                    let v: number | null = null
                    if (b) {
                        if (b.singleCount > 0) v = b.singleSum / b.singleCount
                        else if (b.rangeCount > 0) v = b.rangeSum / b.rangeCount
                    }
                    dataPoint[kpiId] = v
                    dataPoint[`${kpiId}__avg`] = percentageAveragesById[kpiId] || 0
                })
                result.push(dataPoint)
                cursor.setMonth(cursor.getMonth() + 1)
            }
            return result
        }

        // Group updates by KPI (non-percentage modes)
        const updatesByKPI: Record<string, Array<{ value: number; date: Date }>> = {}
        allUpdates.forEach(update => {
            if (!isModeKpi(update.kpi_id)) return
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
                    if (!isModeKpi(kpiId)) return
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
                    if (!isModeKpi(kpiId)) return
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
    }, [allUpdates, dashboard.kpis, timeFrame, isCumulative, isPercentageMode, visibleKPIs, percentageAveragesById])

    // Y-axis bounds for percentage mode (0-100 default; extends to next 100 if a value exceeds)
    const percentageYMax = useMemo(() => {
        if (!isPercentageMode || chartData.length === 0) return 100
        let max = 100
        chartData.forEach((d: any) => {
            visiblePercentageKpis.forEach(k => {
                const v = d[k.id]
                if (typeof v === 'number' && v > max) max = v
            })
        })
        return Math.ceil(max / 100) * 100
    }, [isPercentageMode, chartData, visiblePercentageKpis])
    const percentageYTicks = useMemo(() => {
        if (!isPercentageMode) return [] as number[]
        const step = percentageYMax / 4
        return [0, step, step * 2, step * 3, percentageYMax]
    }, [isPercentageMode, percentageYMax])

    // Tooltip for percentage mode: rows per visible % metric showing month value + overall avg
    const PercentageTooltip = ({ active, label }: any) => {
        if (!active) return null
        const dp = (chartData as any[]).find(d => d.date === label)
        if (!dp) return null
        const dateLabel = dp.fullDate ? formatDate(dp.fullDate) : (label || '')
        return (
            <div style={{ backgroundColor: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(8px)', border: '1px solid #f1f5f9', borderRadius: '12px', padding: '10px 12px', fontSize: '12px', boxShadow: '0 8px 24px rgba(15,23,42,0.08)', minWidth: 220 }}>
                <div style={{ fontWeight: 500, color: '#475569', marginBottom: 6 }}>{dateLabel}</div>
                {visiblePercentageKpis.length === 0 && (
                    <div style={{ color: '#94a3b8' }}>No percentage metrics selected</div>
                )}
                {visiblePercentageKpis.map(k => {
                    const originalIndex = dashboard.kpis.findIndex(x => x.id === k.id)
                    const color = getMetricColor(originalIndex)
                    const v = dp[k.id]
                    const avg = percentageAveragesById[k.id] || 0
                    return (
                        <div key={k.id} style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color, display: 'inline-block' }} />
                                <span style={{ fontWeight: 500, color: '#0f172a', fontSize: 12 }}>{k.title}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingLeft: 14 }}>
                                <span style={{ color: '#94a3b8' }}>This month</span>
                                <span style={{ fontWeight: 500, color: '#0f172a' }}>
                                    {typeof v === 'number' ? `${Math.round(v)}%` : 'No data'}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingLeft: 14 }}>
                                <span style={{ color, opacity: 0.85 }}>Overall avg</span>
                                <span style={{ fontWeight: 600, color }}>{Math.round(avg)}%</span>
                            </div>
                        </div>
                    )
                })}
            </div>
        )
    }

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
            <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-6">
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
                            <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-sm font-medium text-foreground border border-gray-200">
                                <MapPin className="w-4 h-4 text-gray-500" />
                                {initiative.region}
                            </span>
                        )}
                        <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl text-sm font-medium text-foreground border border-gray-200">
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
                                to={`${orgLinkBase}/${orgSlug}/${initiativeSlug}/metric/${metricSlug}${dateQS}`}
                                className="rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 overflow-hidden flex flex-col h-full min-h-[7rem] transition-all group"
                            >
                                <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center px-2 pt-3 pb-2">
                                    <div
                                        className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-center max-w-full min-w-0 shrink truncate px-1"
                                        style={{ color: metricColor }}
                                    >
                                        {formatAbbreviatedMetricTotal(kpi.total_value ?? 0, { isPercentage: kpi.metric_type === 'percentage' })}
                                        {kpi.metric_type === 'percentage' ? '%' : ''}
                                    </div>
                                    {(kpi.metric_type === 'percentage' || kpi.unit_of_measurement) && (
                                        <span className="text-[10px] text-muted-foreground mt-1 text-center line-clamp-1">
                                            {kpi.metric_type === 'percentage' ? 'average' : kpi.unit_of_measurement}
                                        </span>
                                    )}
                                </div>
                                <div
                                    className="shrink-0 h-[3.75rem] border-t px-2 py-0 flex items-center justify-center overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
                                    style={{
                                        background: `linear-gradient(180deg, ${brandColor}14 0%, ${brandColor}26 100%)`,
                                        borderColor: `${brandColor}38`,
                                    }}
                                >
                                    <p className="text-[11px] sm:text-xs font-semibold text-foreground/90 text-center leading-snug line-clamp-3 w-full px-0.5 min-h-0 group-hover:text-accent transition-colors">{kpi.title}</p>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}

            {/* Main Chart */}
            <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={PUBLIC_SECTION_CHIP_STYLE}>
                            <TrendingUp className="w-4 h-4" style={brandIconStyle(brandColor)} />
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
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
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
                                    <span className="bg-accent text-white text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
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

                        {/* Monthly / Cumulative / Percentages Toggle */}
                        <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
                            {hasNonPercentageKpi && (
                                <>
                            <button
                                        onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(false); setIsCumulative(false) }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${(!isCumulative && !isPercentageMode) ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'}`}
                            >
                                Monthly
                            </button>
                            <button
                                        onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(false); setIsCumulative(true) }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${(isCumulative && !isPercentageMode) ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'}`}
                            >
                                Cumulative
                            </button>
                                </>
                            )}
                            {hasPercentageKpi && (
                                <button
                                    onClick={() => { userPickedGraphModeRef.current = true; setIsPercentageMode(true) }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isPercentageMode ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'}`}
                                >
                                    Percentages
                                </button>
                            )}
                        </div>
                        {/* Time Frame */}
                        <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
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
                    {(() => {
                        const visibleNonPctKpis = dashboard.kpis.filter(k => visibleKPIs.has(k.id) && k.metric_type !== 'percentage')
                        const hasModeData = chartData.length > 0 && (isPercentageMode ? visiblePercentageKpis.length > 0 : visibleNonPctKpis.length > 0)
                        if (!hasModeData) {
                            return (
                                <div className="h-full flex items-center justify-center text-muted-foreground">
                                    <div className="text-center">
                                        <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>
                                            {visibleKPIs.size === 0
                                                ? 'Toggle metrics below to show on chart'
                                                : isPercentageMode && visiblePercentageKpis.length === 0
                                                    ? 'No percentage metrics selected'
                                                    : !isPercentageMode && visibleNonPctKpis.length === 0
                                                        ? 'Only percentage metrics selected — switch to Percentages'
                                                        : 'No data available yet'}
                                        </p>
                                    </div>
                                </div>
                            )
                        }
                        if (isPercentageMode) {
                            return (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 12, right: 20, left: 0, bottom: 30 }}>
                                        <CartesianGrid vertical={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="date"
                                            stroke="#cbd5e1"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            tick={{ fill: '#94a3b8' }}
                                            angle={-45}
                                            textAnchor="end"
                                            height={50}
                                            interval={chartData.length > 12 ? Math.floor(chartData.length / 12) : 0}
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
                                        />
                                        <RechartsTooltip content={<PercentageTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                        {visiblePercentageKpis.map(kpi => {
                                            const originalIndex = dashboard.kpis.findIndex(k => k.id === kpi.id)
                                            const color = getMetricColor(originalIndex)
                                            const avg = percentageAveragesById[kpi.id] || 0
                                            if (avg <= 0) return null
                                            return (
                                                <ReferenceLine
                                                    key={`ref-${kpi.id}`}
                                                    y={avg}
                                                    stroke={color}
                                                    strokeOpacity={0.4}
                                                    strokeWidth={1.25}
                                                    strokeDasharray="5 4"
                                                    ifOverflow="extendDomain"
                                                />
                                            )
                                        })}
                                        {visiblePercentageKpis.map(kpi => (
                                            <Line
                                                key={`ghost-${kpi.id}`}
                                                type="monotone"
                                                dataKey={`${kpi.id}__avg`}
                                                stroke="transparent"
                                                dot={false}
                                                activeDot={false}
                                                isAnimationActive={false}
                                                legendType="none"
                                            />
                                        ))}
                                        {visiblePercentageKpis.map(kpi => {
                                            const originalIndex = dashboard.kpis.findIndex(k => k.id === kpi.id)
                                            const color = getMetricColor(originalIndex)
                                            return (
                                                <Line
                                                    key={kpi.id}
                                                    type="monotone"
                                                    dataKey={kpi.id}
                                                    stroke={color}
                                                    strokeWidth={2.25}
                                                    dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
                                                    activeDot={{ r: 4, fill: color, stroke: 'white', strokeWidth: 1.5 }}
                                                    strokeLinecap="round"
                                                    connectNulls={true}
                                                />
                                            )
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            )
                        }
                        return (
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
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    angle={-45}
                                    textAnchor="end"
                                    height={50}
                                    interval={chartData.length > 12 ? Math.floor(chartData.length / 12) : 0}
                                />
                                <YAxis
                                    stroke="#9ca3af"
                                    fontSize={11}
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
                                    {visibleNonPctKpis.map((kpi) => {
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
                        )
                    })()}
                </div>

                {/* Legend */}
                {visibleKPIs.size > 0 && (
                    <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-white/50">
                        {dashboard.kpis.filter(kpi => visibleKPIs.has(kpi.id) && (isPercentageMode ? kpi.metric_type === 'percentage' : kpi.metric_type !== 'percentage')).map((kpi) => {
                            const originalIndex = dashboard.kpis.findIndex(k => k.id === kpi.id)
                            return (
                                <div key={kpi.id} className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getMetricColor(originalIndex) }} />
                                    <span className="text-xs text-muted-foreground">{kpi.title}{kpi.metric_type === 'percentage' ? ' (avg)' : ''}</span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Bottom Row: Stats + Category Breakdown + Locations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Stats */}
                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={PUBLIC_SECTION_CHIP_STYLE}>
                            <BarChart3 className="w-4 h-4" style={brandIconStyle(brandColor)} />
                        </div>
                        <h2 className="font-semibold text-foreground">Quick Stats</h2>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="text-sm text-muted-foreground">Metrics</span>
                            <span className="font-bold text-foreground">{dashboard.stats.kpis}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="text-sm text-muted-foreground">Evidence</span>
                            <span className="font-bold text-foreground">{dashboard.stats.evidence}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="text-sm text-muted-foreground">Stories</span>
                            <span className="font-bold text-foreground">{dashboard.stats.stories}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <span className="text-sm text-muted-foreground">Locations</span>
                            <span className="font-bold text-foreground">{dashboard.stats.locations}</span>
                        </div>
                    </div>
                </div>

                {/* Category Breakdown */}
                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-5">
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
                <div className="rounded-2xl bg-white border border-gray-200/80 shadow-public p-5">
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
                                    <span key={loc.id} className="px-2 py-1 bg-gray-100 text-foreground rounded text-xs font-medium border border-gray-200">
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
