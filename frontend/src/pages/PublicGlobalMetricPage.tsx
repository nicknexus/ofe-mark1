import React, { useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { BarChart3, ChevronRight, Layers, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts'
import { useOrgLinkBase } from '../hooks/useOrgLinkBase'
import { publicApi, PublicGlobalMetric } from '../services/publicApi'
import PublicBreadcrumb from '../components/public/PublicBreadcrumb'
import PublicLoader from '../components/public/PublicLoader'
import {
    DEFAULT_PUBLIC_BRAND,
    PublicPageBackground,
    PUBLIC_PANEL_STATIC_CLASS,
    brandIconStyle,
} from '../components/public/publicStyles'
import { formatAbbreviatedMetricTotal, formatDate } from '../utils'
import { generateMetricSlug } from '../components/public/initiative/metricColors'

/**
 * One org-global metric across every initiative that reports it.
 *
 * Layout: total + initiatives on top, then pooled claims chart + scrollable
 * claim list. Cards for single-initiative metrics link straight past it.
 */
export default function PublicGlobalMetricPage() {
    const { orgSlug, metricSlug } = useParams<{ orgSlug: string; metricSlug: string }>()
    const orgLinkBase = useOrgLinkBase()

    const [metric, setMetric] = useState<PublicGlobalMetric | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        const load = async () => {
            if (!orgSlug || !metricSlug) return
            setLoading(true)
            try {
                const data = await publicApi.getOrganizationMetric(orgSlug, metricSlug)
                if (!cancelled) { setMetric(data); setError(null) }
            } catch (err) {
                if (!cancelled) setError((err as Error).message || 'Metric not found')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [orgSlug, metricSlug])

    const isPct = metric?.metric_type === 'percentage'
    const brandColor = metric?.organization_brand_color || DEFAULT_PUBLIC_BRAND

    const chartData = useMemo(() => {
        if (!metric) return []
        const byDate = new Map<string, { sum: number; count: number }>()
        for (const update of metric.updates || []) {
            const date = update.date_represented?.split('T')[0]
            if (!date) continue
            const prev = byDate.get(date) || { sum: 0, count: 0 }
            prev.sum += Number(update.value ?? 0)
            prev.count += 1
            byDate.set(date, prev)
        }
        return Array.from(byDate.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, { sum, count }]) => ({
                date,
                value: isPct ? sum / count : sum,
            }))
    }, [metric, isPct])

    if (loading) return <PublicLoader />

    if (error || !metric) {
        return (
            <div className="min-h-screen font-figtree relative animate-fadeIn">
                <PublicPageBackground />
                <div className="relative max-w-3xl mx-auto px-4 py-24 text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <h1 className="text-2xl font-semibold text-gray-800 mb-2">Metric not found</h1>
                    <p className="text-gray-500 mb-2">
                        This metric may have been removed or is no longer public.
                    </p>
                    {error && (
                        <p className="text-xs text-gray-400 font-mono mb-6 break-words">{error}</p>
                    )}
                    <Link to={`${orgLinkBase}/${orgSlug}`} className="text-primary-600 hover:underline">
                        Back to organization
                    </Link>
                </div>
            </div>
        )
    }

    const metricDetailSlug = generateMetricSlug(metric.title)

    return (
        <div className="min-h-screen font-figtree relative animate-fadeIn">
            <PublicPageBackground brandColor={brandColor} />
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                <PublicBreadcrumb
                    items={[{ label: metric.title }]}
                    orgSlug={orgSlug!}
                    orgName={metric.organization_name}
                />

                {/* Top: total (left) + initiatives (right) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    <div className={`${PUBLIC_PANEL_STATIC_CLASS} p-6 sm:p-8`}>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            <Layers className="w-3.5 h-3.5" />
                            Across {metric.initiatives.length} initiative{metric.initiatives.length === 1 ? '' : 's'}
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight mb-2">
                            {metric.title}
                        </h1>
                        {metric.description && (
                            <p className="text-gray-500 text-sm mb-6 line-clamp-3">{metric.description}</p>
                        )}

                        <div className="flex items-baseline gap-2">
                            <span
                                className="text-5xl sm:text-6xl font-bold tabular-nums tracking-tight"
                                style={{ color: brandColor, filter: 'saturate(1.1) brightness(0.78)' }}
                            >
                                {formatAbbreviatedMetricTotal(metric.total_value, { isPercentage: isPct })}
                                {isPct ? '%' : ''}
                            </span>
                            <span className="text-sm font-semibold text-gray-400">
                                {isPct ? 'organization average' : metric.unit_of_measurement}
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1.5">
                            {metric.update_count.toLocaleString()} impact claim{metric.update_count === 1 ? '' : 's'}
                            {isPct && ' · averaged, not summed'}
                        </p>
                    </div>

                    <div className={`${PUBLIC_PANEL_STATIC_CLASS} p-5 sm:p-6 flex flex-col min-h-0`}>
                        <h2 className="text-sm font-semibold text-gray-700 mb-1">Where this comes from</h2>
                        <p className="text-xs text-gray-400 mb-4">
                            Choose an initiative to see its claims and evidence.
                        </p>
                        <div className="space-y-1.5 overflow-y-auto max-h-[280px] pr-0.5">
                            {metric.initiatives.map(usage => (
                                <Link
                                    key={usage.initiative_id}
                                    to={`${orgLinkBase}/${orgSlug}/${usage.initiative_slug}/metric/${metricDetailSlug}`}
                                    className="group flex items-center gap-2.5 p-2 pr-2 bg-white rounded-xl border border-gray-200/70 shadow-card hover:border-primary-300/70 hover:shadow-card-hover transition-all"
                                    title={usage.initiative_title}
                                >
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
                                        <img
                                            src={metric.organization_logo_url || '/Nexuslogo.png'}
                                            alt=""
                                            className="w-full h-full object-contain"
                                            onError={(e) => {
                                                ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png'
                                            }}
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-xs font-semibold text-gray-900 leading-snug line-clamp-1">
                                            {usage.initiative_title}
                                        </h3>
                                        <p className="text-[11px] text-gray-400 tabular-nums">
                                            {formatAbbreviatedMetricTotal(usage.total_value, { isPercentage: isPct })}
                                            {isPct ? '%' : ''}
                                            {metric.unit_of_measurement && !isPct ? ` ${metric.unit_of_measurement}` : ''}
                                            {' · '}
                                            {usage.update_count} claim{usage.update_count === 1 ? '' : 's'}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom: same 2/3 chart + 1/3 claims spacing as initiative metric page */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <div className="lg:col-span-2 rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-800 flex items-center gap-2 text-sm sm:text-base">
                                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" style={brandIconStyle(brandColor)} />
                                All impact claims
                            </h2>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 sm:px-3 py-1 rounded-full">
                                Across initiatives
                            </span>
                        </div>
                        {chartData.length > 0 ? (
                            <div className="h-48 sm:h-72 p-2 sm:p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="globalMetricFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={brandColor} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={brandColor} stopOpacity={0.02} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={{ stroke: '#e2e8f0' }}
                                            tickLine={false}
                                            tickFormatter={(d: string) => formatDate(d)}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={40}
                                            tickFormatter={(v: number) =>
                                                isPct ? `${Math.round(v)}%` : formatAbbreviatedMetricTotal(v)
                                            }
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'white',
                                                border: 'none',
                                                borderRadius: '12px',
                                                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                                                padding: '8px 12px',
                                                fontSize: '12px',
                                            }}
                                            labelFormatter={(d) => formatDate(String(d))}
                                            formatter={(value: any) => [
                                                `${Number(value).toLocaleString()}${isPct ? '%' : ''}`,
                                                isPct ? 'Average' : (metric.unit_of_measurement || 'Total'),
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="value"
                                            stroke={brandColor}
                                            strokeWidth={2}
                                            fillOpacity={1}
                                            fill="url(#globalMetricFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-48 sm:h-72 flex items-center justify-center text-gray-500">
                                <div className="text-center">
                                    <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm">No impact claims recorded yet</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="rounded-2xl sm:rounded-3xl bg-white border border-gray-200/80 shadow-public overflow-hidden flex flex-col max-h-[300px] sm:max-h-[400px]">
                        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-white/40 flex-shrink-0 flex items-center justify-between gap-2">
                            <h2 className="font-semibold text-gray-800 text-sm sm:text-base">
                                Impact Claims
                            </h2>
                            <span
                                className="px-2 py-0.5 text-xs font-semibold rounded-full text-gray-700"
                                style={{ backgroundColor: `${brandColor}15`, border: `1px solid ${brandColor}25` }}
                            >
                                {metric.updates.length}
                            </span>
                        </div>
                        {metric.updates.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-gray-500 p-4 sm:p-6">
                                <p className="text-xs sm:text-sm">No claims yet</p>
                            </div>
                        ) : (
                            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
                                {metric.updates.map(claim => (
                                    <Link
                                        key={claim.id}
                                        to={
                                            claim.initiative_slug
                                                ? `${orgLinkBase}/${orgSlug}/${claim.initiative_slug}/claim/${claim.id}?from=org`
                                                : `${orgLinkBase}/${orgSlug}`
                                        }
                                        className="block p-3 rounded-xl bg-white border border-gray-200/80 shadow-public hover:shadow-public-hover hover:border-gray-300 transition-all"
                                    >
                                        <div className="flex items-baseline gap-1.5">
                                            <span
                                                className="text-lg font-semibold tabular-nums"
                                                style={{ color: brandColor, filter: 'saturate(1.1) brightness(0.78)' }}
                                            >
                                                {Number(claim.value).toLocaleString()}
                                                {isPct ? '%' : ''}
                                            </span>
                                            {!isPct && metric.unit_of_measurement && (
                                                <span className="text-xs text-gray-400">{metric.unit_of_measurement}</span>
                                            )}
                                        </div>
                                        {claim.initiative_title && (
                                            <p className="text-xs text-gray-500 truncate mt-0.5">
                                                {claim.initiative_title}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            {formatDate(claim.date_represented)}
                                        </p>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
