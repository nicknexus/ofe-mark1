import React from 'react'
import { TrendingUp } from 'lucide-react'
import { KPI } from '../../types'
import { WizardState } from './wizardTypes'

interface WizardClaimStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 kpis: KPI[]
}

/**
 * Step — claim the result: the number achieved for the chosen metric,
 * plus an optional label so the claim is easy to recognise later.
 */
export default function WizardClaimStep({ state, update, kpis }: WizardClaimStepProps) {
 const kpi = kpis.find(k => k.id === state.claimKpiId)
 const unit = kpi?.metric_type === 'percentage' ? '%' : (kpi?.unit_of_measurement || '')

 return (
 <div className="space-y-5 max-w-md">
 {/* Context: which metric this result belongs to */}
 <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary-50 border border-primary-100">
 <TrendingUp className="w-4 h-4 text-primary-700 flex-shrink-0" />
 <p className="text-sm text-primary-900">
 Recording a result for <span className="font-semibold">{kpi?.title || 'your metric'}</span>
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 How many{unit ? ` ${unit.toLowerCase()}` : ''}?
 </label>
 <div className="flex items-center gap-2">
 <input
 type="number"
 autoFocus
 value={state.claimValue}
 onChange={(e) => update({ claimValue: e.target.value })}
 placeholder="e.g. 32"
 className="w-40 px-4 py-3 bg-white border border-gray-200 rounded-xl text-xl font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 {unit && <span className="text-sm text-gray-500">{unit}</span>}
 </div>
 <p className="text-xs text-gray-400 mt-1.5">
 The amount achieved in the period you'll pick next — e.g. 32 students trained.
 </p>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Label <span className="text-gray-400 font-normal">(optional)</span>
 </label>
 <input
 type="text"
 value={state.claimLabel}
 onChange={(e) => update({ claimLabel: e.target.value })}
 placeholder="e.g. July training cohort"
 className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 <p className="text-xs text-gray-400 mt-1.5">A short name to recognise this claim in your Logs.</p>
 </div>
 </div>
 )
}
