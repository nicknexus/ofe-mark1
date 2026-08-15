import React, { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { KPI } from '../../types'
import { ClaimEntry, WizardState, filledClaimEntries } from './wizardTypes'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { WizardMetricClaimCard } from './WizardMetricCard'

interface WizardClaimsStepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  kpis: KPI[]
  /** Restrict the list to one metric (per-metric entry points). */
  lockedMetricId?: string
}

/**
 * "Both" flow claims step — metrics shown as the same cards as the Metrics
 * tab, each with an optional result input inside the card.
 */
export default function WizardClaimsStep({ state, update, kpis, lockedMetricId }: WizardClaimsStepProps) {
  const list = lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis
  const filledCount = filledClaimEntries(state).length

  const colorByKpi = useMemo(
    () => Object.fromEntries(kpis.map((k, i) => [k.id, getKPIColor(k.category, i)])),
    [kpis],
  )

  const setEntry = (kpiId: string, patch: Partial<ClaimEntry>) => {
    const existing = state.claimEntries[kpiId] || { value: '', label: '', note: '' }
    update({ claimEntries: { ...state.claimEntries, [kpiId]: { ...existing, ...patch } } })
  }

  return (
    <div className="space-y-3 w-full">
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
