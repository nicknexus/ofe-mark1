import React from 'react'
import { Check, BarChart3 } from 'lucide-react'
import { KPI } from '../../types'
import { WizardState, includesClaim } from './wizardTypes'

interface WizardMetricStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 kpis: KPI[]
 /** Single-select (claim / both) auto-advances to the next step. */
 onAutoAdvance: () => void
}

const CATEGORY_LABELS: Record<string, string> = {
 input: 'Input',
 output: 'Output',
 impact: 'Impact',
}

/**
 * Step — pick the metric. With a claim involved it's a single choice that
 * advances immediately on click; evidence-only uploads can support several
 * metrics (or all of them, for broad documents like annual reports).
 */
export default function WizardMetricStep({ state, update, kpis, onAutoAdvance }: WizardMetricStepProps) {
 const single = includesClaim(state.kind)
 const selected = single
 ? (state.claimKpiId ? [state.claimKpiId] : [])
 : state.evidenceKpiIds
 const allSelected = !single && kpis.length > 0 && selected.length === kpis.length

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
 <p className="text-xs text-gray-500">
 Metrics are what you measure — like "Students trained". Create your first one
 from the Overview tab, then come back here.
 </p>
 </div>
 )
 }

 return (
 <div className="space-y-3">
 {!single && (
 <div className="flex items-center justify-between">
 <p className="text-xs text-gray-500">Select every metric this evidence helps prove.</p>
 <button
 type="button"
 onClick={() => update({ evidenceKpiIds: allSelected ? [] : kpis.map(k => k.id!) })}
 className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${allSelected
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 text-gray-500 hover:bg-gray-50'
 }`}
 >
 {allSelected ? '✓ All selected' : 'Select all'}
 </button>
 </div>
 )}

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 {kpis.map(kpi => {
 const isSelected = selected.includes(kpi.id!)
 return (
 <button
 key={kpi.id}
 type="button"
 onClick={() => handleSelect(kpi.id!)}
 className={`relative text-left p-4 rounded-2xl border-2 transition-all ${isSelected
 ? 'border-primary-500 bg-primary-50 shadow-card'
 : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
 }`}
 >
 {isSelected && (
 <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary-600 flex items-center justify-center">
 <Check className="w-3 h-3 text-white" strokeWidth={3} />
 </span>
 )}
 <p className="text-sm font-semibold text-gray-800 pr-7">{kpi.title}</p>
 <p className="text-xs text-gray-500 mt-1">
 {kpi.metric_type === 'percentage' ? 'Percentage' : kpi.unit_of_measurement || 'Number'}
 {kpi.category ? ` · ${CATEGORY_LABELS[kpi.category] || kpi.category}` : ''}
 </p>
 </button>
 )
 })}
 </div>
 </div>
 )
}
