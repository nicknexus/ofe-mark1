import React, { useMemo } from 'react'
import { KPI } from '../../types'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { WizardState } from './wizardTypes'
import { WizardMetricClaimEntryPanel } from './WizardMetricCard'

interface WizardClaimStepProps {
  state: WizardState
  update: (patch: Partial<WizardState>) => void
  kpis: KPI[]
}

/**
 * Step — claim the result for the metric chosen in the previous step.
 * Shows the metric as a Metrics-tab card, then value + label inputs.
 */
export default function WizardClaimStep({ state, update, kpis }: WizardClaimStepProps) {
  const kpi = kpis.find(k => k.id === state.claimKpiId)
  const color = useMemo(() => {
    if (!kpi) return getKPIColor('', 0)
    const index = kpis.findIndex(k => k.id === kpi.id)
    return getKPIColor(kpi.category, index >= 0 ? index : 0)
  }, [kpi, kpis])

  if (!kpi) {
    return <p className="text-sm text-gray-500">Choose a metric first.</p>
  }

  return (
    <WizardMetricClaimEntryPanel
      kpi={kpi}
      color={color}
      value={state.claimValue}
      label={state.claimLabel}
      note={state.claimNote}
      onValueChange={(v) => update({ claimValue: v })}
      onLabelChange={(l) => update({ claimLabel: l })}
      onNoteChange={(n) => update({ claimNote: n })}
    />
  )
}
