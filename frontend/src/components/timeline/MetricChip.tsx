import React from 'react'
import { KPI } from '../../types'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'

/**
 * Small always-visible pill naming the metric a claim belongs to, with the
 * same color coding as the Overview metric cards so metrics can be scanned
 * across the app at a glance.
 */
export default function MetricChip({ kpi, kpis }: { kpi: KPI | undefined; kpis: KPI[] }) {
 const index = kpi ? kpis.findIndex(k => k.id === kpi.id) : -1
 const color = kpi ? getKPIColor(kpi.category, Math.max(index, 0)) : '#9ca3af'

 return (
 <span className="inline-flex items-center gap-1.5 max-w-full px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200">
 <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
 <span className="text-[11px] font-medium text-gray-600 truncate">{kpi?.title || 'Unknown metric'}</span>
 </span>
 )
}
