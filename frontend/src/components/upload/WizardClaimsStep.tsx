import React, { useMemo } from 'react'
import { Tag as TagIcon, TrendingUp } from 'lucide-react'
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
}

/**
 * "Both" flow claims step — metrics shown as the same cards as the Metrics
 * tab, each with an optional result input inside the card.
 * If scope already picked tags, only metrics that carry those tags are shown.
 */
export default function WizardClaimsStep({ state, update, kpis, tags = [], lockedMetricId }: WizardClaimsStepProps) {
  const list = useMemo(() => {
    const base = lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis
    if (state.tagIds.length === 0) return base
    return base.filter(k => kpiHasTags(k, state.tagIds))
  }, [kpis, lockedMetricId, state.tagIds])

  const filledCount = filledClaimEntries(state, list).length

  const colorByKpi = useMemo(
    () => Object.fromEntries(kpis.map((k, i) => [k.id, getKPIColor(k.category, i)])),
    [kpis],
  )

  const tagNames = state.tagIds
    .map(id => tags.find(t => t.id === id)?.name)
    .filter(Boolean) as string[]

  const setEntry = (kpiId: string, patch: Partial<ClaimEntry>) => {
    const existing = state.claimEntries[kpiId] || { value: '', label: '', note: '' }
    update({ claimEntries: { ...state.claimEntries, [kpiId]: { ...existing, ...patch } } })
  }

  if (list.length === 0) {
    return (
      <div className="app-card p-8 text-center max-w-md mx-auto">
        <div className="app-icon-tile mx-auto mb-4">
          <TagIcon className="w-5 h-5 text-primary-800" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No metrics match your tags</p>
        <p className="text-xs text-gray-500">
          {tagNames.length > 0
            ? `None of this program’s metrics have ${tagNames.map(n => `“${n}”`).join(', ')}. Go back and clear the tag, or add it to a metric first.`
            : 'Go back and adjust your scope, or add tags to a metric first.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 w-full">
      {state.tagIds.length > 0 && (
        <p className="text-xs text-gray-500">
          Showing metrics tagged {tagNames.map(n => `“${n}”`).join(', ') || 'with your selection'}
          {list.length < kpis.length ? ` · ${list.length} of ${kpis.length}` : ''}
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
      </div>

      <div className="flex items-center gap-2 pt-1">
        <TrendingUp className="w-4 h-4 text-claim-600 flex-shrink-0" />
        <p className="text-sm text-gray-600">
          {filledCount === 0
            ? 'Enter a result for at least one metric — the rest can stay blank'
            : `${filledCount} claim${filledCount === 1 ? '' : 's'} will be added`}
        </p>
      </div>
    </div>
  )
}
