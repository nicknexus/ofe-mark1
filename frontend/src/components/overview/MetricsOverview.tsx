import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Plus, Maximize2 } from 'lucide-react'
import { User, Organization } from '../../types'
import { UserProfileMenu } from '../ui'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { generateMetricsDashboardChartData } from '../metricsDashboard/generateMetricsDashboardChartData'
import { generateKpiChartData, type TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import { staggerContainer, fadeUp } from '../timeline/motion'

const TIMEFRAMES: Array<{ key: TimeFrameKey; label: string }> = [
 { key: 'all', label: 'All' },
 { key: '1month', label: '1M' },
 { key: '6months', label: '6M' },
 { key: '1year', label: '1Y' },
 { key: '5years', label: '5Y' },
]

interface MetricsOverviewProps {
 initiativeId: string
 kpis: any[]
 kpiTotals: Record<string, number>
 kpiUpdates: any[]
 onAddKPI?: () => void
 /** Opens the full metric detail (chart + edit/delete) at /metrics/:kpiId. */
 onMetricDetailClick?: (kpiId: string) => void
 /** Overrides the default URL navigation to the metric-filtered Timeline (mobile). */
 onOpenTimelineForMetric?: (kpiId: string) => void
 user?: User | null
 organization?: Organization | null
}

/** Cumulative mini-trend for one metric's card. */
function MetricSparkline({ updates, color }: { updates: any[]; color: string }) {
 const data = useMemo(() => generateKpiChartData({
 filteredKpiUpdates: updates,
 datePickerValue: {},
 timeFrame: 'all',
 isCumulative: true,
 isPercentageMetric: false,
 }), [updates])

 if (data.length < 2) {
 return <div className="h-10 flex items-end"><div className="w-full border-b border-dashed border-gray-200" /></div>
 }

 return (
 <div className="h-10 -mx-1">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
 <Line
 type="monotone"
 dataKey="cumulative"
 stroke={color}
 strokeWidth={2}
 dot={false}
 isAnimationActive={false}
 connectNulls
 />
 </LineChart>
 </ResponsiveContainer>
 </div>
 )
}

/**
 * The Overview tab: a metrics-focused dashboard — metric cards with trends
 * and one combined chart. No map, no big stat tiles; creating metrics and
 * reading performance happen here, while day-to-day activity (claims,
 * evidence, connections) lives on the Timeline. Clicking a metric opens the
 * Timeline pre-filtered to it.
 */
export default function MetricsOverview({
 initiativeId,
 kpis,
 kpiTotals,
 kpiUpdates,
 onAddKPI,
 onMetricDetailClick,
 onOpenTimelineForMetric,
 user,
 organization,
}: MetricsOverviewProps) {
 const navigate = useNavigate()
 const [isCumulative, setIsCumulative] = useState(true)
 const [timeFrame, setTimeFrame] = useState<TimeFrameKey>('all')

 const updatesByKpi = useMemo(() => {
 const map: Record<string, any[]> = {}
 for (const update of kpiUpdates) {
 if (!update?.kpi_id) continue
 if (!map[update.kpi_id]) map[update.kpi_id] = []
 map[update.kpi_id].push(update)
 }
 return map
 }, [kpiUpdates])

 const colorByKpi = useMemo(() => {
 const map: Record<string, string> = {}
 kpis.forEach((kpi, index) => { map[kpi.id] = getKPIColor(kpi.category, index) })
 return map
 }, [kpis])

 const chartData = useMemo(() => generateMetricsDashboardChartData({
 filteredUpdates: kpiUpdates,
 filteredKPIs: kpis,
 kpis,
 visibleKPIs: new Set(kpis.map(k => k.id)),
 datePickerValue: {},
 timeFrame,
 isCumulative,
 isPercentageMode: false,
 }), [kpiUpdates, kpis, timeFrame, isCumulative])

 const openTimelineForMetric = (kpiId: string) => {
 if (onOpenTimelineForMetric) {
 onOpenTimelineForMetric(kpiId)
 return
 }
 navigate(`/initiatives/${initiativeId}?tab=timeline&metric=${kpiId}`)
 }

 return (
 <div className="h-full overflow-y-auto">
 <div className="p-4 sm:p-6 space-y-5 max-w-6xl mx-auto">
 {/* Header */}
 <div className="flex items-center justify-between gap-3">
 <div className="min-w-0">
 <h2 className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">Overview</h2>
 <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
 Your metrics and how they're trending
 </p>
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {onAddKPI && (
 <button onClick={onAddKPI} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 <span className="hidden sm:inline">Add metric</span>
 </button>
 )}
 {user && (
 <UserProfileMenu user={user} organizationName={organization?.name} />
 )}
 </div>
 </div>

 {/* Metric cards */}
 <motion.div
 className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
 variants={staggerContainer}
 initial="hidden"
 animate="visible"
 >
 {kpis.map(kpi => {
 const color = colorByKpi[kpi.id]
 const total = kpiTotals[kpi.id] ?? 0
 const updates = updatesByKpi[kpi.id] || []
 return (
 <motion.div key={kpi.id} variants={fadeUp}>
 <div
 onClick={() => openTimelineForMetric(kpi.id)}
 className="app-card-interactive p-4 cursor-pointer group relative"
 >
 {onMetricDetailClick && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onMetricDetailClick(kpi.id)
 }}
 title="Open metric detail"
 className="absolute top-2.5 right-2.5 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
 >
 <Maximize2 className="w-3.5 h-3.5" />
 </button>
 )}
 <div className="flex items-center gap-1.5 mb-2">
 <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
 <p className="text-xs font-medium text-gray-500 truncate">{kpi.title}</p>
 </div>
 <div className="flex items-baseline gap-1.5 mb-1">
 <span className="text-2xl font-semibold text-gray-900 tabular-nums">
 {kpi.metric_type === 'percentage' && updates.length > 0
 ? `${Math.round(total / updates.length)}%`
 : total.toLocaleString()}
 </span>
 {kpi.metric_type !== 'percentage' && kpi.unit_of_measurement && (
 <span className="text-xs text-gray-400 truncate">{kpi.unit_of_measurement}</span>
 )}
 </div>
 <MetricSparkline updates={updates} color={color} />
 <p className="text-[11px] text-gray-400 mt-2">
 {updates.length} claim{updates.length === 1 ? '' : 's'}
 {typeof kpi.evidence_percentage === 'number' ? ` · ${kpi.evidence_percentage}% evidenced` : ''}
 </p>
 </div>
 </motion.div>
 )
 })}

 {onAddKPI && (
 <motion.div variants={fadeUp}>
 <button
 onClick={onAddKPI}
 className="w-full h-full min-h-[140px] rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-primary-700"
 >
 <Plus className="w-5 h-5" />
 <span className="text-xs font-medium">Add metric</span>
 </button>
 </motion.div>
 )}
 </motion.div>

 {/* Combined chart */}
 {kpis.length > 0 && (
 <div className="app-card p-4 sm:p-5">
 <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
 <h3 className="text-sm font-semibold text-gray-800">Metrics over time</h3>
 <div className="flex items-center gap-2">
 <div className="flex rounded-full border border-gray-200 overflow-hidden">
 {(['Monthly', 'Cumulative'] as const).map(mode => {
 const active = (mode === 'Cumulative') === isCumulative
 return (
 <button
 key={mode}
 onClick={() => setIsCumulative(mode === 'Cumulative')}
 className={`px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-primary-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
 >
 {mode}
 </button>
 )
 })}
 </div>
 <div className="flex rounded-full border border-gray-200 overflow-hidden">
 {TIMEFRAMES.map(tf => (
 <button
 key={tf.key}
 onClick={() => setTimeFrame(tf.key)}
 className={`px-2.5 py-1 text-xs font-medium transition-colors ${timeFrame === tf.key ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
 >
 {tf.label}
 </button>
 ))}
 </div>
 </div>
 </div>
 <div className="h-64 sm:h-72">
 <ResponsiveContainer width="100%" height="100%">
 <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
 <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
 <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
 <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
 <Tooltip
 formatter={(value: any, key: any) => [
 typeof value === 'number' ? value.toLocaleString() : value,
 kpis.find(k => k.id === key)?.title || key,
 ]}
 labelStyle={{ fontSize: 12, color: '#475569' }}
 contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
 />
 {kpis.map(kpi => (
 <Line
 key={kpi.id}
 type="monotone"
 dataKey={kpi.id}
 stroke={colorByKpi[kpi.id]}
 strokeWidth={2}
 dot={false}
 connectNulls
 isAnimationActive={false}
 />
 ))}
 </LineChart>
 </ResponsiveContainer>
 </div>
 {/* Legend */}
 <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
 {kpis.map(kpi => (
 <button
 key={kpi.id}
 onClick={() => openTimelineForMetric(kpi.id)}
 className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
 >
 <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorByKpi[kpi.id] }} />
 {kpi.title}
 </button>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 )
}
