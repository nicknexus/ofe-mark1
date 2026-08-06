import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, Plus } from 'lucide-react'
import { MetricDefinitionWithUsage } from '../../types'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { SkeletonCard } from '../ui'

interface GlobalMetricsStripProps {
  definitions: MetricDefinitionWithUsage[]
  loading?: boolean
  canAddMetrics?: boolean
  onCreate?: () => void
}

/**
 * The org's global metrics on the dashboard, in the same card language the
 * initiative pages use — the point being that these numbers are the whole
 * organization, not one initiative.
 *
 * Totals come pre-pooled from the server; percentage metrics are averaged
 * across claims, so these are never a sum of per-initiative subtotals.
 */
export default function GlobalMetricsStrip({
  definitions,
  loading = false,
  canAddMetrics = false,
  onCreate,
}: GlobalMetricsStripProps) {
  // Every metric is rendered — the grid caps at two rows and scrolls past
  // that, so the map below keeps a predictable position no matter how many
  // metrics an org tracks. Metrics carrying data lead.
  const ranked = [...definitions].sort((a, b) => {
    if (a.update_count > 0 !== b.update_count > 0) return a.update_count > 0 ? -1 : 1
    return b.total_value - a.total_value
  })

  return (
    <div className="flex-shrink-0">
      <div className="flex items-center gap-2 mb-2.5 min-h-8">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Metrics
        </h2>
        <Link
          to="/metrics"
          className="ml-auto app-btn app-btn-primary app-btn-sm shadow-sm"
        >
          View all metrics
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 [grid-auto-rows:6.5rem] max-h-[13.75rem] overflow-y-auto pr-0.5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : definitions.length === 0 ? (
        <div className="app-card p-6 text-center">
          <div className="app-icon-tile app-icon-tile-accent mx-auto mb-3">
            <BarChart3 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-gray-800 mb-1">No metrics yet</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Metrics are shared across your whole organization — create one here and add it to any
            initiative.
          </p>
          {canAddMetrics && onCreate && (
            <button type="button" onClick={onCreate} className="app-btn app-btn-primary app-btn-sm">
              <Plus className="w-4 h-4" />
              New metric
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 [grid-auto-rows:6.5rem] max-h-[13.75rem] overflow-y-auto pr-0.5">
          {ranked.map((definition, index) => {
            const color = getKPIColor(definition.category, index)
            return (
              <Link
                key={definition.id}
                to="/metrics"
                className="app-card-interactive p-3 h-full flex flex-col justify-center overflow-hidden"
              >
                <div className="flex items-center justify-between mb-1">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-400 truncate ml-1 flex-1 text-right">
                    {definition.metric_type === 'percentage'
                      ? 'avg'
                      : definition.unit_of_measurement}
                  </span>
                </div>
                <div
                  className="text-xs font-medium text-gray-700 truncate mb-1"
                  title={definition.title}
                >
                  {definition.title}
                </div>
                <div className="text-base font-semibold" style={{ color }}>
                  {definition.total_value.toLocaleString()}
                  {definition.metric_type === 'percentage' ? '%' : ''}
                </div>
                <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                  {definition.initiative_count === 0
                    ? 'Not in use'
                    : `${definition.initiative_count} initiative${definition.initiative_count === 1 ? '' : 's'}`}
                </div>
              </Link>
            )
          })}

          {canAddMetrics && onCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/40 p-3 text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              New metric
            </button>
          )}
        </div>
      )}
    </div>
  )
}
