import React, { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { ArrowLeft, Edit, Plus } from 'lucide-react'
import { KPI, Location } from '../../types'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { generateMetricsDashboardChartData } from '../metricsDashboard/generateMetricsDashboardChartData'
import { type TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import { fadeUp, staggerContainer } from '../timeline/motion'
import LocationMap from '../LocationMap'
import TimelineTab from './TimelineTab'

const TIMEFRAMES: Array<{ key: TimeFrameKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: '1month', label: '1M' },
  { key: '6months', label: '6M' },
  { key: '1year', label: '1Y' },
  { key: '5years', label: '5Y' },
]

interface MetricDetailTabProps {
  initiativeId: string
  kpi: KPI
  kpis: KPI[]
  kpiTotal: number
  kpiUpdates: any[]
  onBack: () => void
  onEdit?: () => void
  onRefresh?: () => void
  onStoryClick?: (storyId: string) => void
}

/**
 * Dedicated metric-detail page. The scope stays fixed to one metric: a header
 * with its identity + headline total, a trend chart (left) and locations map
 * (right) styled to match the Metrics dashboard, and the full Logs interface
 * below — locked to this metric, so every view / filter / count is scoped to it.
 */
export default function MetricDetailTab({
  initiativeId,
  kpi,
  kpis,
  kpiTotal,
  kpiUpdates,
  onBack,
  onEdit,
  onRefresh,
  onStoryClick,
}: MetricDetailTabProps) {
  const { canAddImpactClaims, canAddEvidence, canEditMetrics } = useTeam()
  const [isCumulative, setIsCumulative] = useState(true)
  const [timeFrame, setTimeFrame] = useState<TimeFrameKey>('all')
  const [locations, setLocations] = useState<Location[]>([])
  const [addLogSignal, setAddLogSignal] = useState(0)

  const isPct = kpi.metric_type === 'percentage'
  const color = useMemo(() => {
    const idx = Math.max(0, kpis.findIndex(k => k.id === kpi.id))
    return getKPIColor(kpi.category, idx)
  }, [kpis, kpi])

  const updates = useMemo(() => kpiUpdates.filter(u => u.kpi_id === kpi.id), [kpiUpdates, kpi.id])
  const claimCount = updates.length

  useEffect(() => {
    if (!initiativeId) return
    apiService.getLocations(initiativeId).then(l => setLocations(l || [])).catch(() => setLocations([]))
  }, [initiativeId])

  // Map shows only locations tied to this metric's records (fallback: all).
  const mapLocations = useMemo(() => {
    const ids = new Set(updates.map(u => u.location_id).filter(Boolean))
    const scoped = locations.filter(l => ids.has(l.id!))
    return scoped.length > 0 ? scoped : locations
  }, [locations, updates])

  const chartData = useMemo(() => generateMetricsDashboardChartData({
    filteredUpdates: updates,
    filteredKPIs: [kpi],
    kpis: [kpi],
    visibleKPIs: new Set([kpi.id!]),
    datePickerValue: {},
    timeFrame,
    isCumulative,
    isPercentageMode: isPct,
  }), [updates, kpi, timeFrame, isCumulative, isPct])

  return (
    <div className="h-screen overflow-y-auto bg-gray-50 mobile-content-padding">
        <motion.div
          className="px-4 sm:px-6 py-5 space-y-4"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Header — title left, total centered in header band, actions right */}
          <motion.div variants={fadeUp} className="relative pb-1">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0 flex-1 md:max-w-[38%]">
                <button onClick={onBack} className="app-btn app-btn-ghost app-btn-icon flex-shrink-0 mt-0.5" aria-label="Back">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight truncate flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    {kpi.title}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1.5">
                    <span className="capitalize">{kpi.category}</span>
                    {` · ${claimCount} claim${claimCount === 1 ? '' : 's'}`}
                    {typeof (kpi as any).evidence_percentage === 'number' ? ` · ${(kpi as any).evidence_percentage}% evidenced` : ''}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
              {canEditMetrics && onEdit && (
                <button
                  onClick={onEdit}
                  className="app-btn app-btn-secondary shadow-sm"
                >
                  <Edit className="w-5 h-5" />
                  <span className="hidden sm:inline">Edit Metric</span>
                  <span className="sm:hidden">Edit</span>
                </button>
              )}
              {(canAddImpactClaims || canAddEvidence) && (
                <button
                  onClick={() => setAddLogSignal(n => n + 1)}
                  className="app-btn app-btn-primary shadow-sm"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Log</span>
                </button>
              )}
              </div>
            </div>
            <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 flex items-baseline justify-center gap-2 pointer-events-none max-w-[44%]">
              <span className="text-4xl sm:text-5xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">
                {isPct ? `${Math.round(kpiTotal)}%` : kpiTotal.toLocaleString()}
              </span>
              {!isPct && kpi.unit_of_measurement && (
                <span className="text-base sm:text-lg font-semibold text-gray-500 leading-none truncate">
                  {kpi.unit_of_measurement}
                </span>
              )}
            </div>
          </motion.div>

          {/* Trend chart (3/4) + locations map (1/4) */}
          <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-1">
            <motion.div variants={fadeUp} className="lg:col-span-3 app-card p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-gray-800">{isPct ? 'Metric over time (avg)' : 'Metric over time'}</h3>
                <div className="flex items-center gap-2">
                  {!isPct && (
                    <div className="flex rounded-full border border-gray-200 overflow-hidden">
                      {(['Monthly', 'Cumulative'] as const).map(m => {
                        const active = (m === 'Cumulative') === isCumulative
                        return (
                          <button
                            key={m}
                            onClick={() => setIsCumulative(m === 'Cumulative')}
                            className={`px-3 py-1 text-xs font-medium transition-colors ${active ? 'bg-primary-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                          >
                            {m}
                          </button>
                        )
                      })}
                    </div>
                  )}
                  <div className="hidden sm:flex rounded-full border border-gray-200 overflow-hidden">
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
              <div className="h-52 sm:h-64 xl:h-72">
                {chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-gray-400">No data yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                      <Tooltip
                        formatter={(value: any) => [
                          typeof value === 'number' ? (isPct ? `${Math.round(value)}%` : value.toLocaleString()) : value,
                          kpi.title,
                        ]}
                        labelStyle={{ fontSize: 12, color: '#475569' }}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                      />
                      <Line type="monotone" dataKey={kpi.id!} stroke={color} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* Locations map — chrome-less rounded map for a modern feel */}
            <motion.div variants={fadeUp} className="lg:col-span-1 relative min-h-[240px] rounded-3xl overflow-hidden border border-gray-200/60 shadow-card">
              <LocationMap
                locations={mapLocations}
                autoFit
                hideEmptyBanner
                initiativeId={initiativeId}
                onStoryClick={onStoryClick}
              />
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Logs — full-width section, locked to this metric. Same page bg so the
            filter/header strip doesn't read as a separate white band. */}
        <motion.div
          className="bg-gray-50"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
        >
          <TimelineTab
            initiativeId={initiativeId}
            lockedMetricId={kpi.id}
            embedded
            onRefresh={onRefresh}
            openAddLogSignal={addLogSignal}
          />
        </motion.div>
    </div>
  )
}
