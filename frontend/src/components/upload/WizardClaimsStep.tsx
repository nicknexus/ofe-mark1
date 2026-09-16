import React, { useMemo } from 'react'
import { BarChart3, Plus, Tag as TagIcon, TrendingUp } from 'lucide-react'
import { KPI, MetricTag } from '../../types'
import { ClaimEntry, WizardState, filledClaimEntries, kpiHasTags } from './wizardTypes'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { WizardMetricClaimCard } from './WizardMetricCard'

interface WizardClaimsStepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  kpis: KPI[]
  tags?: MetricTag[]
  /** Restrict the list to one metric (per-metric entry points). */
  lockedMetricId?: string
  /** Inline "new metric" affordance; omitted when the user can't add metrics. */
  onCreateMetric?: () => void
}

/**
 * "Both" flow claims step — metrics shown as the same cards as the Metrics
 * tab, each with an optional result input inside the card. A tag picked in
 * scope applies to every claim entered here; the server attaches it to any
 * metric that doesn't list it yet, so nothing is hidden.
 */
export default function WizardClaimsStep({ state, update, kpis, tags = [], lockedMetricId, onCreateMetric }: WizardClaimsStepProps) {
  const list = useMemo(
    () => (lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis),
    [kpis, lockedMetricId],
  )

  const filledCount = filledClaimEntries(state, list).length

  const colorByKpi = useMemo(
    () => Object.fromEntries(kpis.map((k, i) => [k.id, getKPIColor(k.category, i)])),
    [kpis],
  )

  const tagNames = state.tagIds
    .map(id => tags.find(t => t.id === id)?.name)
    .filter(Boolean) as string[]
  const newlyTagged = state.tagIds.length > 0
    ? list.filter(k => !kpiHasTags(k, state.tagIds)).length
    : 0

  const setEntry = (kpiId: string, patch: Partial<ClaimEntry>) => {
    const existing = state.claimEntries[kpiId] || { value: '', label: '', note: '' }
    update({ claimEntries: { ...state.claimEntries, [kpiId]: { ...existing, ...patch } } })
  }

  if (list.length === 0) {
    return (
      <div className="app-card p-8 text-center max-w-md mx-auto">
        <div className="app-icon-tile mx-auto mb-4">
          <BarChart3 className="w-5 h-5 text-primary-800" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No metrics yet</p>
        <p className="text-xs text-gray-500 mb-4">Metrics are what you measure, like "Students trained". Add one to log a result against it.</p>
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
      {tagNames.length > 0 && (
        <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
          <TagIcon className="w-3.5 h-3.5 text-gray-400" />
          Every claim here is tagged {tagNames.map(n => `"${n}"`).join(', ')}.
          {newlyTagged > 0 && <span className="text-gray-400">The tag is added to {newlyTagged === 1 ? 'one metric' : `${newlyTagged} metrics`} that didn't have it.</span>}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((kpi, index) => {
          const entry = state.claimEntries[kpi.id!] || { value: '', label: '', note: '' }
          return (
            <WizardMetricClaimCard
              key={kpi.id}
              kpi={kpi}
              color={colorByKpi[kpi.id!] ?? getKPIColor(kpi.category, index)}
              value={entry.value}
              label={entry.label}
              note={entry.note}
              onValueChange={(v) => setEntry(kpi.id!, { value: v })}
              onLabelChange={(l) => setEntry(kpi.id!, { label: l })}
              onNoteChange={(n) => setEntry(kpi.id!, { note: n })}
            />
          )
        })}
        {onCreateMetric && !lockedMetricId && (
          <button
            type="button"
            onClick={onCreateMetric}
            className="min-h-[7rem] flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/40 text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New metric
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <TrendingUp className="w-4 h-4 text-claim-600 flex-shrink-0" />
        <p className="text-sm text-gray-600">
          {filledCount === 0
            ? 'Enter a result for at least one metric. The rest can stay blank.'
            : `${filledCount} claim${filledCount === 1 ? '' : 's'} will be added`}
        </p>
      </div>
    </div>
  )
}
