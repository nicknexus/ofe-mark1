import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Camera } from 'lucide-react'
import { Chapter, CountUp, INK, PAPER, claimValue, compactNumber, evidenceForMetric, formatMetric, shortDate, updateTime, type RecentResult } from './orgShowcase'
import { getMetricColor } from '../initiative/metricColors'
import type { PublicEvidence, PublicKPI, PublicKPIUpdate, PublicLocation } from '../../../services/publicApi'

const MAX_SERIES = 12
const CLAIM_ROW = 64
const CLAIM_MS = 3200

function buildMetricChart(metrics: PublicKPI[]) {
    const withData = metrics.filter(metric => metric.updates && metric.updates.length)
    const numbers = withData.filter(metric => metric.metric_type !== 'percentage')
    const series = (numbers.length ? numbers : withData).slice(0, MAX_SERIES)
    const percentage = series.length > 0 && series.every(metric => metric.metric_type === 'percentage')
    const monthOf = (value: string) => {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return null
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    const byMetric = new Map<string, Map<string, number>>()
    const months = new Set<string>()
    for (const metric of series) {
        const updates = [...(metric.updates || [])].sort((a, b) => updateTime(a) - updateTime(b))
        const points = new Map<string, number>()
        let total = 0
        for (const update of updates) {
            const key = monthOf(update.date_represented)
            if (!key) continue
            months.add(key)
            if (metric.metric_type === 'percentage') points.set(key, update.value)
            else {
                total += update.value
                points.set(key, total)
            }
        }
        byMetric.set(metric.id, points)
    }
    const carry = new Map<string, number>()
    const rows = [...months].sort().map(key => {
        const [year, month] = key.split('-').map(Number)
        const row: Record<string, string | number | null> = {
            date: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        }
        for (const metric of series) {
            const value = byMetric.get(metric.id)?.get(key)
            if (value != null) carry.set(metric.id, value)
            row[metric.id] = metric.metric_type === 'percentage' ? (value ?? null) : (carry.get(metric.id) ?? 0)
        }
        return row
    })

    // End-of-line labels: keep the higher-ranked series when two finish too close together.
    const finals = series.map((metric, rank) => ({ id: metric.id, rank, value: Number(rows[rows.length - 1]?.[metric.id] ?? 0) }))
    const values = finals.map(row => row.value)
    const gap = (Math.max(...values, 0) - Math.min(...values, 0)) * 0.06
    const labelled = new Set<string>()
    for (const row of [...finals].sort((a, b) => a.rank - b.rank)) {
        if (finals.every(other => !labelled.has(other.id) || Math.abs(other.value - row.value) > gap)) labelled.add(row.id)
    }
    return { rows, series, percentage, labelled }
}

const shorten = (text: string, max = 20) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

export function OrgImpactDashboard({
    metrics,
    claims,
    evidence,
    colors,
    placeOf,
    brandColor,
    accent,
    orgLinkBase,
    slug,
    onOpenMetric,
}: {
    metrics: PublicKPI[]
    claims: RecentResult[]
    evidence: PublicEvidence[]
    colors: Map<string, string>
    placeOf: (update: PublicKPIUpdate) => PublicLocation | undefined
    brandColor: string
    accent: string
    orgLinkBase: string
    slug: string
    onOpenMetric: (metric: PublicKPI) => void
}) {
    const reduce = useReducedMotion()
    const [hover, setHover] = useState<string | null>(null)
    const [claimIndex, setClaimIndex] = useState(0)
    const [claimsPaused, setClaimsPaused] = useState(false)
    const stripRef = useRef<HTMLDivElement>(null)
    const claimWindow = useRef<HTMLDivElement>(null)
    const chart = useMemo(() => buildMetricChart(metrics), [metrics])
    const colorOf = (id: string) => colors.get(id) || getMetricColor(0)
    const lastRow = chart.rows.length - 1

    const visibleClaims = () => Math.max(1, Math.floor((claimWindow.current?.clientHeight || CLAIM_ROW * 5) / CLAIM_ROW))
    const stepClaims = (step: number) => {
        const maxIndex = Math.max(0, claims.length - visibleClaims())
        setClaimIndex(value => {
            const next = value + step
            if (next > maxIndex) return 0
            if (next < 0) return maxIndex
            return next
        })
    }

    useEffect(() => {
        if (reduce || claimsPaused || claims.length <= visibleClaims()) return
        const timer = window.setTimeout(() => stepClaims(1), CLAIM_MS)
        return () => window.clearTimeout(timer)
    })

    const scrollStrip = (direction: number) => {
        const strip = stripRef.current
        if (strip) strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' })
    }

    const arrow = 'h-9 w-9 rounded-full border bg-white inline-flex items-center justify-center hover:bg-black/[0.03] transition-colors'

    return (
        <section className="bg-white">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 py-10 lg:py-14">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <Chapter
                        kicker="Impact"
                        title="The data behind the words"
                        sub="Every metric and every claim they have logged. Open any metric to see the proof."
                        accent={accent}
                    />
                    {metrics.length > 4 && (
                        <div className="flex items-center gap-2">
                            <span className="text-[13px] text-secondary-500 mr-1">{metrics.length} metrics</span>
                            <button type="button" aria-label="Scroll metrics left" onClick={() => scrollStrip(-1)} className={arrow} style={{ borderColor: `${brandColor}44`, color: accent }}>
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button type="button" aria-label="Scroll metrics right" onClick={() => scrollStrip(1)} className={arrow} style={{ borderColor: `${brandColor}44`, color: accent }}>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {metrics.length > 0 && (
                    <div
                        ref={stripRef}
                        className="mt-5 flex overflow-x-auto snap-x rounded-2xl border divide-x divide-black/[0.06]"
                        style={{ borderColor: `${brandColor}2E`, background: PAPER, scrollbarWidth: 'none' }}
                    >
                        {metrics.map(metric => {
                            const proofCount = evidenceForMetric(metric, evidence).length
                            return (
                                <button
                                    key={metric.id}
                                    type="button"
                                    onClick={() => onOpenMetric(metric)}
                                    onMouseEnter={() => setHover(metric.id)}
                                    onMouseLeave={() => setHover(null)}
                                    onFocus={() => setHover(metric.id)}
                                    onBlur={() => setHover(null)}
                                    className="snap-start shrink-0 w-[13rem] sm:w-[15rem] px-5 py-4 text-left transition-colors hover:bg-white focus-visible:bg-white outline-none"
                                >
                                    <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-secondary-500">
                                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(metric.id) }} />
                                        <span className="truncate">{metric.initiative_title || 'Metric'}</span>
                                    </span>
                                    <span className="mt-2 block font-fraunces text-3xl leading-none tracking-tight" style={{ color: accent }}>
                                        <CountUp value={metric.total_value || 0} percentage={metric.metric_type === 'percentage'} />
                                    </span>
                                    <span className="mt-1.5 block text-[13px] font-semibold leading-snug line-clamp-2 min-h-[2.25rem]" style={{ color: INK }}>{metric.title}</span>
                                    <span className="mt-1 flex items-center gap-1 text-[11px] text-secondary-500">
                                        {proofCount > 0 ? <><Camera className="w-3 h-3" /> {proofCount} {proofCount === 1 ? 'proof' : 'proofs'}</> : 'See how'}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                )}

                <div className={`mt-4 grid grid-cols-1 gap-4 ${chart.rows.length > 0 && claims.length > 0 ? 'lg:grid-cols-[minmax(0,1fr)_20rem]' : ''}`}>
                    {chart.rows.length > 0 && (
                        <div className="rounded-2xl border p-4 pb-2" style={{ borderColor: `${brandColor}2E` }}>
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="text-[15px] font-semibold" style={{ color: INK }}>Growth over time</p>
                                <p className="text-[12px] text-secondary-500">{chart.percentage ? 'Latest value by month' : 'Running totals by month'}</p>
                            </div>
                            <div className="mt-2 h-[22rem] lg:h-[28rem]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chart.rows} margin={{ top: 8, right: 132, left: 0, bottom: 0 }}>
                                        <CartesianGrid stroke="#00000010" vertical={false} />
                                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                                        <YAxis
                                            tick={{ fill: '#6b7280', fontSize: 11 }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={36}
                                            tickFormatter={(value: number) => (chart.percentage ? `${value}%` : compactNumber(value))}
                                            domain={chart.percentage ? [0, 100] : ['auto', 'auto']}
                                        />
                                        <Tooltip formatter={(value: number) => formatMetric(value, chart.percentage)} />
                                        {chart.series.map(metric => {
                                            const color = colorOf(metric.id)
                                            const dim = hover !== null && hover !== metric.id
                                            const showLabel = hover ? hover === metric.id : chart.labelled.has(metric.id)
                                            return (
                                                <Line
                                                    key={metric.id}
                                                    type="monotone"
                                                    dataKey={metric.id}
                                                    name={metric.title}
                                                    stroke={color}
                                                    strokeOpacity={dim ? 0.15 : 1}
                                                    strokeWidth={hover === metric.id ? 3 : 2}
                                                    dot={false}
                                                    connectNulls
                                                    isAnimationActive={false}
                                                    label={(props: { x?: number; y?: number; index?: number }) =>
                                                        props.index === lastRow && showLabel && props.x != null && props.y != null ? (
                                                            <text key={`${metric.id}-label`} x={props.x + 6} y={props.y} dy={4} fontSize={11} fontWeight={600} fill={color}>
                                                                {shorten(metric.title)}
                                                            </text>
                                                        ) : <g key={`${metric.id}-${props.index}`} />
                                                    }
                                                />
                                            )
                                        })}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {claims.length > 0 && (
                        <div className="relative h-[24rem] lg:h-auto">
                            <div
                                className="absolute inset-0 rounded-2xl border flex flex-col"
                                style={{ borderColor: `${brandColor}2E`, background: PAPER }}
                                onMouseEnter={() => setClaimsPaused(true)}
                                onMouseLeave={() => setClaimsPaused(false)}
                            >
                                <div className="px-4 pt-4 pb-2 flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-[15px] font-semibold" style={{ color: INK }}>Impact claims</p>
                                        <p className="text-[12px] text-secondary-500">{claims.length} logged, newest first</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button type="button" aria-label="Previous claims" onClick={() => stepClaims(-1)} className="h-8 w-8 rounded-full border bg-white inline-flex items-center justify-center" style={{ borderColor: `${brandColor}44`, color: accent }}>
                                            <ChevronUp className="w-4 h-4" />
                                        </button>
                                        <button type="button" aria-label="Next claims" onClick={() => stepClaims(1)} className="h-8 w-8 rounded-full border bg-white inline-flex items-center justify-center" style={{ borderColor: `${brandColor}44`, color: accent }}>
                                            <ChevronDown className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <div ref={claimWindow} className="relative flex-1 min-h-0 overflow-hidden mx-2 mb-2">
                                    <motion.ul
                                        animate={{ y: -claimIndex * CLAIM_ROW }}
                                        transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                    >
                                        {claims.map(claim => {
                                            const { update, metric } = claim
                                            const place = placeOf(update)?.name
                                            const row = (
                                                <>
                                                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colorOf(metric.id) }} />
                                                    <span className="min-w-0 flex-1">
                                                        <span className="block text-[13px] font-medium leading-snug truncate" style={{ color: INK }}>{metric.title}</span>
                                                        <span className="block text-[12px] text-secondary-500 truncate">
                                                            {[place, shortDate(update.date_represented)].filter(Boolean).join(' · ')}
                                                        </span>
                                                    </span>
                                                    <span className="font-fraunces text-xl leading-none shrink-0" style={{ color: accent }}>{claimValue(claim)}</span>
                                                </>
                                            )
                                            const className = 'flex items-center gap-3 h-full rounded-xl bg-white px-3 hover:shadow-sm transition-shadow'
                                            return (
                                                <li key={update.id} style={{ height: CLAIM_ROW }} className="pb-1.5">
                                                    {metric.initiative_slug ? (
                                                        <Link to={`${orgLinkBase}/${slug}/${metric.initiative_slug}/claim/${update.id}`} className={className}>{row}</Link>
                                                    ) : (
                                                        <div className={className}>{row}</div>
                                                    )}
                                                </li>
                                            )
                                        })}
                                    </motion.ul>
                                    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-10" style={{ background: `linear-gradient(to bottom, transparent, ${PAPER})` }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
