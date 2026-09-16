import React, { useMemo } from 'react'
import { BarChart3, Plus } from 'lucide-react'
import { KPI } from '../../types'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { WizardState, includesClaim } from './wizardTypes'
import { WizardMetricPickerCard } from './WizardMetricCard'

interface WizardMetricStepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  kpis: KPI[]
  kpiTotals?: Record<string, number>
  /** Single-select (claim / both) auto-advances to the next step. */
  onAutoAdvance: () => void
  /** Inline "new metric" affordance; omitted when the user can't add metrics. */
  onCreateMetric?: () => void
}

/**
 * Step — pick the metric. Cards match the Metrics tab grid. With a claim
 * involved it's a single choice that advances on click; evidence-only can
 * select several (or all).
 */
export default function WizardMetricStep({ state, update, kpis, kpiTotals = {}, onAutoAdvance, onCreateMetric }: WizardMetricStepProps) {
  const single = includesClaim(state.kind)
  const selected = single
    ? (state.claimKpiId ? [state.claimKpiId] : [])
    : state.evidenceKpiIds
  const allSelected = !single && kpis.length > 0 && selected.length === kpis.length

  const colorByKpi = useMemo(
    () => Object.fromEntries(kpis.map((k, i) => [k.id, getKPIColor(k.category, i)])),
    [kpis],
  )

  const handleSelect = (kpiId: string) => {
    if (single) {
      update({ claimKpiId: kpiId })
      onAutoAdvance()
      return
    }
    update({
      evidenceKpiIds: selected.includes(kpiId)
        ? selected.filter(id => id !== kpiId)
        : [...selected, kpiId],
    })
  }

  if (kpis.length === 0) {
    return (
      <div className="app-card p-8 text-center max-w-md">
        <div className="app-icon-tile mx-auto mb-4">
          <BarChart3 className="w-5 h-5 text-primary-800" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No metrics yet</p>
        <p className="text-xs text-gray-500 mb-4">
          Metrics are what you measure, like &quot;Students trained&quot;. Add your first one here.
        </p>
        {onCreateMetric && (
          <button type="button" onClick={onCreateMetric} className="app-btn app-btn-primary app-btn-sm">
            <Plus className="w-4 h-4" /> New metric
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 w-full">
      {!single && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">Select every metric this evidence helps prove.</p>
          <button
            type="button"
            onClick={() => update({ evidenceKpiIds: allSelected ? [] : kpis.map(k => k.id!) })}
            className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors flex-shrink-0 ${allSelected
              ? 'border-primary-500 bg-primary-50 text-primary-800'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >
            {allSelected ? 'All selected' : 'Select all'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
        {kpis.map((kpi, index) => (
          <WizardMetricPickerCard
            key={kpi.id}
            kpi={kpi}
            color={colorByKpi[kpi.id!] ?? getKPIColor(kpi.category, index)}
            total={kpiTotals[kpi.id!] ?? 0}
            selected={selected.includes(kpi.id!)}
            onClick={() => handleSelect(kpi.id!)}
            titlesOnlyOnMobile
          />
        ))}
        {onCreateMetric && (
          <button
            type="button"
            onClick={onCreateMetric}
            className="min-h-[5.5rem] flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/40 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New metric
          </button>
        )}
      </div>
    </div>
  )
}
