import React, { useState } from 'react'
import { BarChart3, MapPin, Plus, Tag, Users } from 'lucide-react'
import { BeneficiaryGroup, Evidence, KPI, Location, MetricTag, TimelineClaim } from '../../types'
import { getLocalDateString } from '../../utils'
import DateRangePicker, { type DateRangePickerHandle } from '../DateRangePicker'
import FileDropList from './FileDropList'
import { ScopeChips } from './WizardScopeStep'
import { ClaimEntry, WizardState, filledClaimEntries, wizardHasClaims } from './wizardTypes'

interface LogEntryStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 canCreateClaim: boolean
 canCreateEvidence: boolean
 lockedMetricId?: string
 evidenceForClaim?: TimelineClaim
 datePickerRef: React.Ref<DateRangePickerHandle>
 onAddFiles: (files: File[]) => void
 onRemoveFile: (id: string) => void
 onRetryFile: (id: string) => void
 onSetFileType: (id: string, type: Evidence['type']) => void
 onSetAllTypes: (type: Evidence['type']) => void
 onCreateMetric?: () => void
 onCreateLocation?: () => void
 onCreateTag?: (name: string) => Promise<void>
}

/** One capture surface. Results and classification can be completed as needed. */
export default function LogEntryStep({
 state, update, kpis, locations, tags, beneficiaryGroups, canCreateClaim,
 canCreateEvidence, lockedMetricId, evidenceForClaim, datePickerRef, onAddFiles,
 onRemoveFile, onRetryFile, onSetFileType, onSetAllTypes, onCreateMetric,
 onCreateLocation, onCreateTag,
}: LogEntryStepProps) {
 const [showTypes, setShowTypes] = useState(false)
 const hasResults = wizardHasClaims(state)
 const resultCount = filledClaimEntries(state).length
 const metrics = lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis
 const scopeLocked = !!evidenceForClaim
 const setEntry = (id: string, patch: Partial<ClaimEntry>) => update({
  claimEntries: { ...state.claimEntries, [id]: { ...(state.claimEntries[id] || { value: '', label: '', note: '' }), ...patch } },
 })
 const selectedTags = tags.filter(t => state.tagIds.includes(t.id)).map(t => t.name)
 const selectedGroups = beneficiaryGroups.filter(g => state.beneficiaryGroupIds.includes(g.id!)).map(g => g.name)
 const resultMetrics = new Set(filledClaimEntries(state).map(([id]) => id))
 const assignedMetrics = kpis.filter(k => state.evidenceKpiIds.includes(k.id!) || resultMetrics.has(k.id!))

 return (
  <div className="space-y-5">
   {evidenceForClaim && (
    <div className="app-card-muted p-3 text-sm text-secondary-700">
     Adding evidence to <strong>{evidenceForClaim.value} {kpis.find(k => k.id === evidenceForClaim.kpi_id)?.title}</strong>.
     <span className="block text-xs text-secondary-500 mt-1">The date, location and tags are taken from this result.</span>
    </div>
   )}

   {canCreateEvidence && (
    <section className="app-card p-4 sm:p-5" aria-labelledby="log-files-heading">
     <div className="flex items-center justify-between gap-3 mb-3">
      <h2 id="log-files-heading" className="app-card-title">Photos and documents</h2>
      {state.files.length > 0 && <button type="button" onClick={() => setShowTypes(v => !v)} aria-expanded={showTypes} className="app-btn app-btn-ghost app-btn-sm">File types</button>}
     </div>
     <FileDropList files={state.files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} onRetryFile={onRetryFile} compact showTypePicker={showTypes} onSetFileType={onSetFileType} onSetAllTypes={onSetAllTypes} />
     {state.files.length > 0 && (
      <div className="mt-4">
       <label htmlFor="log-evidence-title" className="app-label">Title</label>
       <input id="log-evidence-title" value={state.evidenceTitle} onChange={e => update({ evidenceTitle: e.target.value })} className="app-input" placeholder="Give these files a short name" />
       <details className="mt-3" open={state.evidenceDescription ? true : undefined}>
        <summary className="text-sm text-secondary-500 cursor-pointer">Add a description</summary>
        <textarea aria-label="Evidence description" className="app-input mt-2" rows={2} value={state.evidenceDescription} onChange={e => update({ evidenceDescription: e.target.value })} placeholder="What do these files show?" />
       </details>
      </div>
     )}
    </section>
   )}

   <section className="app-card p-4 sm:p-5 space-y-4" aria-labelledby="log-context-heading">
    <h2 id="log-context-heading" className="app-card-title">Where and when</h2>
    <fieldset disabled={scopeLocked} className="space-y-4 min-w-0">
     <div>
      <p className="app-label">Activity date</p>
      <DateRangePicker ref={datePickerRef} variant="pill" maxDate={getLocalDateString(new Date())} value={state.dateMode === 'single' ? { singleDate: state.dateSingle } : { startDate: state.dateStart, endDate: state.dateEnd }} onChange={value => update(value.singleDate
       ? { dateMode: 'single', dateSingle: value.singleDate, dateStart: '', dateEnd: '' }
       : { dateMode: 'range', dateSingle: '', dateStart: value.startDate || '', dateEnd: value.endDate || '' })} />
     </div>
     <ScopeChips icon={MapPin} label={hasResults ? 'Location' : 'Locations (optional)'} hint={hasResults ? 'These results share one location.' : 'Choose a location if you know it. It can be added later.'} options={locations.map(l => ({ id: l.id!, name: l.name }))} selected={state.locationIds} onChange={ids => update({ locationIds: ids })} single={hasResults || scopeLocked} onCreate={scopeLocked ? undefined : onCreateLocation} createLabel="New location" />
    </fieldset>
   </section>

   {canCreateClaim && !evidenceForClaim && (
    <details className="app-card p-4 sm:p-5" open={!canCreateEvidence || !!lockedMetricId || hasResults ? true : undefined}>
     <summary className="cursor-pointer text-sm font-semibold text-secondary-900">
      {resultCount > 0 ? `Results (${resultCount})` : 'Add results'}
      {canCreateEvidence && <span className="font-normal text-secondary-500 ml-2">Optional</span>}
     </summary>
     <p className="app-help mt-2 mb-3">Enter numbers for the metrics you measured. Leave the others blank.</p>
     <div className="space-y-3">
      {metrics.map(kpi => {
       const entry = state.claimEntries[kpi.id!] || { value: '', label: '', note: '' }
       return (
        <div key={kpi.id} className="border-t border-gray-100 pt-3">
         <div className="flex items-center gap-3">
          <label htmlFor={`log-result-${kpi.id}`} className="text-sm text-secondary-700 flex-1 min-w-0">{kpi.title}<span className="block text-xs text-secondary-500">{kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement}</span></label>
          <input id={`log-result-${kpi.id}`} type="number" step="any" inputMode="decimal" value={entry.value} onChange={e => setEntry(kpi.id!, { value: e.target.value })} className="app-input !w-28 shrink-0" placeholder="Number" />
         </div>
         {entry.value !== '' && (
          <details className="mt-2">
           <summary className="text-xs text-secondary-500 cursor-pointer">Result details</summary>
           <input aria-label={`Label for ${kpi.title}`} className="app-input mt-2" value={entry.label} onChange={e => setEntry(kpi.id!, { label: e.target.value })} placeholder="Short label (optional)" />
           <textarea aria-label={`Notes for ${kpi.title}`} className="app-input mt-2" rows={2} value={entry.note} onChange={e => setEntry(kpi.id!, { note: e.target.value })} placeholder="Notes (optional)" />
          </details>
         )}
        </div>
       )
      })}
      {metrics.length === 0 && <p className="app-help">Add a metric to record a result. You can still save photos and documents.</p>}
      {onCreateMetric && !lockedMetricId && <button type="button" onClick={onCreateMetric} className="app-btn app-btn-secondary app-btn-sm"><Plus className="w-4 h-4" /> New metric</button>}
     </div>
    </details>
   )}

   <details className="app-card p-4 sm:p-5">
    <summary className="cursor-pointer text-sm font-semibold text-secondary-900">Metrics, tags and groups<span className="block text-xs font-normal text-secondary-500 mt-1">{[...assignedMetrics.map(k => k.title), ...selectedTags, ...selectedGroups].join(', ') || 'Optional. Organize now or add details later.'}</span></summary>
    <fieldset disabled={scopeLocked} className="space-y-4 mt-4 min-w-0">
     {canCreateEvidence && !lockedMetricId && (
      <ScopeChips icon={BarChart3} label="Metrics this evidence supports" hint={hasResults ? 'Metrics with results are included automatically.' : 'Leave blank if you are not sure yet.'} options={kpis.map(k => ({ id: k.id!, name: k.title }))} selected={[...new Set([...state.evidenceKpiIds, ...resultMetrics])]} onChange={ids => update({ evidenceKpiIds: ids })} onCreate={onCreateMetric} createLabel="New metric" />
     )}
     <ScopeChips icon={Tag} label={hasResults ? 'Tag' : 'Tags'} options={tags.map(t => ({ id: t.id, name: t.name }))} selected={state.tagIds} onChange={ids => update({ tagIds: ids })} single={hasResults || scopeLocked} onCreate={onCreateTag ? name => onCreateTag(name || '') : undefined} createLabel="New tag" createInline />
     {beneficiaryGroups.length > 0 && <ScopeChips icon={Users} label="Beneficiary groups" options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))} selected={state.beneficiaryGroupIds} onChange={ids => update({ beneficiaryGroupIds: ids })} />}
    </fieldset>
   </details>
  </div>
 )
}
