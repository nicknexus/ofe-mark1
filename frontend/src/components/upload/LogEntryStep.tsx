import React, { useState } from 'react'
import { BarChart3, Check, Copy, FileText, Link2, Plus, Search, Settings2, Trash2 } from 'lucide-react'
import type { BeneficiaryGroup, Evidence, KPI, Location, MetricTag, TimelineClaim } from '../../types'
import type { DateRangePickerHandle } from '../DateRangePicker'
import FileDropList from './FileDropList'
import LogDetailsFields from './LogDetailsFields'
import { fileRows, LogDetails, LogMetricRow, logDates, newLogRow, rowDetails, rowHasResult, sharedLogDetails } from './logDraft'
import type { WizardState } from './wizardTypes'

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

/** One responsive workspace; extra detail appears only where the user needs it. */
export default function LogEntryStep({ state, update, kpis, locations, tags, beneficiaryGroups, canCreateClaim, canCreateEvidence, lockedMetricId, evidenceForClaim, onAddFiles, onRemoveFile, onRetryFile, onSetFileType, onSetAllTypes, onCreateMetric, onCreateLocation, onCreateTag }: LogEntryStepProps) {
 const [showTypes, setShowTypes] = useState(false)
 const [search, setSearch] = useState('')
 const rows = state.logRows || []
 const [pickerOpen, setPickerOpen] = useState(rows.length === 0)
 const resultCount = rows.filter(row => rowHasResult(state, row)).length
 const metrics = lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis
 const setRow = (id: string, patch: Partial<LogMetricRow>) => update({ logRows: rows.map(row => row.id === id ? { ...row, ...patch } : row) })
 const addMetric = (id: string) => update({ logRows: [...rows, newLogRow(id)] })
 const removeRow = (id: string) => update({ logRows: rows.filter(row => row.id !== id), files: state.files.map(file => ({ ...file, rowIds: file.rowIds?.filter(rowId => rowId !== id) })) })
 const scopeSummary = (row: LogMetricRow) => {
  const details = rowDetails(state, row)
  const { start, end } = logDates(details)
  return [locations.find(l => l.id === details.locationIds[0])?.name || 'Location not set', start === end ? start : `${start} to ${end}`, ...details.tagIds.map(id => tags.find(t => t.id === id)?.name)].filter(Boolean).join(' · ')
 }
 const rowName = (row: LogMetricRow) => `${kpis.find(k => k.id === row.kpiId)?.title || 'Metric'}${rows.filter(r => r.kpiId === row.kpiId).length > 1 ? ` (${scopeSummary(row)})` : ''}`
 const fieldProps = { locations, tags, beneficiaryGroups }

 return (
  <div className={`grid items-start gap-5 ${canCreateEvidence ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
   {canCreateEvidence && <aside className="app-card p-4 sm:p-5 min-w-0 lg:sticky lg:top-5 lg:max-h-[calc(100dvh-12rem)] lg:overflow-y-auto" aria-labelledby="log-files-heading">
    <div className="flex items-center justify-between gap-2 mb-2">
     <h2 id="log-files-heading" className="app-card-title flex items-center gap-2"><FileText className="w-4 h-4 text-evidence-600" /> Evidence <span className="app-chip">{state.files.length}</span></h2>
     {state.files.length > 0 && <button type="button" onClick={() => setShowTypes(v => !v)} aria-expanded={showTypes} className="app-btn app-btn-ghost app-btn-sm">Types</button>}
    </div>
    <p className="app-help mb-4">Upload once. Choose what each file supports. You can also save evidence on its own.</p>
    <FileDropList files={state.files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} onRetryFile={onRetryFile} compact showTypePicker={showTypes} onSetFileType={onSetFileType} onSetAllTypes={onSetAllTypes} renderFileDetails={file => {
     const selected = fileRows(state, file)
     const setAssignment = (rowIds: string[] | undefined, all = false) => update({ files: state.files.map(f => all || f.id === file.id ? { ...f, rowIds } : f) })
     if (evidenceForClaim) return <p className="text-xs text-primary-700">Supports this result</p>
     return <details className="border-t border-gray-100 pt-2">
      <summary className="cursor-pointer text-xs font-medium text-primary-700">{!rows.length ? 'Assign metrics when ready' : file.rowIds === undefined ? `All metric cards (${rows.length})` : selected.length ? `${selected.length} metric card${selected.length === 1 ? '' : 's'} selected` : 'Unassigned. Save for later'}</summary>
      <div className="mt-3 space-y-2">
       <label className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={file.rowIds === undefined} onChange={e => setAssignment(e.target.checked ? undefined : selected.map(r => r.id))} /><span>Follow all metric cards<span className="block text-secondary-500 mt-0.5">Includes cards added later.</span></span></label>
       {rows.map(row => <label key={row.id} className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={selected.some(r => r.id === row.id)} onChange={e => setAssignment(e.target.checked ? [...selected.map(r => r.id), row.id] : selected.filter(r => r.id !== row.id).map(r => r.id))} /><span>{rowName(row)}</span></label>)}
       {rows.length === 0 && <p className="app-help">Add metric cards to assign this file, or save it unassigned.</p>}
       {selected.length > 0 && <p className="app-help">Supports all tags on the selected cards. Other results with matching details also connect automatically.</p>}
       <button type="button" className="text-xs text-secondary-500 hover:underline" onClick={() => setAssignment([])}>Leave unassigned</button>
       {state.files.length > 1 && <button type="button" className="block text-xs text-primary-700 hover:underline" onClick={() => setAssignment(file.rowIds, true)}>Apply this selection to all files</button>}
      </div>
     </details>
    }} />
    {state.files.length > 0 && <p className="app-help mt-3" aria-live="polite">{state.files.filter(f => f.status === 'done').length} of {state.files.length} files uploaded. Saved when you confirm the log.</p>}
   </aside>}

   <div className="space-y-5 min-w-0">
    <section className="app-card p-4 sm:p-5" aria-labelledby="log-context-heading">
     <div className="flex items-center gap-2 mb-1"><Settings2 className="w-4 h-4 text-primary-700" /><h2 id="log-context-heading" className="app-card-title">Shared details</h2></div>
     <p className="app-help mb-4">{evidenceForClaim ? 'Date, location and tags are taken from the result you are supporting.' : 'Set these once. Changes apply to every metric unless you customize that field.'}</p>
     <LogDetailsFields {...fieldProps} id="shared" value={sharedLogDetails(state)} onChange={update} locked={!!evidenceForClaim} onCreateLocation={onCreateLocation} onCreateTag={onCreateTag} />
    </section>

    {!evidenceForClaim && <section aria-labelledby="log-results-heading">
     <div className="flex items-center justify-between gap-3 mb-1">
      <h2 id="log-results-heading" className="app-card-title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-secondary-500" /> Metrics {rows.length > 0 && <span className="app-chip">{rows.length}</span>}</h2>
      <button type="button" className="app-btn app-btn-secondary app-btn-sm" aria-expanded={pickerOpen} onClick={() => setPickerOpen(v => !v)}><Plus className="w-4 h-4" /> Add metric</button>
     </div>
     <p className="app-help mb-4">{canCreateClaim ? 'Enter a result, attach evidence, or do both. Leave numbers blank for evidence only.' : 'Choose the metrics your evidence supports. Results can be added by your team.'}</p>
     {pickerOpen && <div className="app-card p-4 mb-4">
      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-3 text-secondary-400" /><input aria-label="Search metrics" value={search} onChange={e => setSearch(e.target.value)} className="app-input !pl-9" placeholder="Find a metric in this program" /></div>
      <div className="flex flex-wrap gap-2 mt-3 max-h-44 overflow-y-auto">
       {metrics.filter(k => k.title.toLowerCase().includes(search.toLowerCase())).map(kpi => {
        const added = rows.some(row => row.kpiId === kpi.id)
        return <button type="button" key={kpi.id} disabled={added} onClick={() => addMetric(kpi.id!)} className={`app-btn app-btn-sm ${added ? 'app-btn-ghost' : 'app-btn-secondary'}`}>{added ? <Check className="w-3.5 h-3.5 text-primary-700" /> : <Plus className="w-3.5 h-3.5" />}{kpi.title}</button>
       })}
       {metrics.filter(k => k.title.toLowerCase().includes(search.toLowerCase())).length === 0 && <p className="app-help">No metrics found.</p>}
      </div>
      <div className="flex justify-between gap-2 mt-3">
       {onCreateMetric && !lockedMetricId ? <button type="button" onClick={onCreateMetric} className="text-xs text-primary-700 hover:underline">+ Create a new metric</button> : <span />}
       {rows.length > 0 && <button type="button" onClick={() => setPickerOpen(false)} className="app-btn app-btn-ghost app-btn-sm">Done choosing</button>}
      </div>
     </div>}
     <div className="grid xl:grid-cols-2 gap-4 items-start">
      {rows.map((row, index) => {
       const kpi = kpis.find(k => k.id === row.kpiId)
       const details = rowDetails(state, row)
       const customCount = Object.keys(row.overrides).length
       const supportedFiles = state.files.filter(file => fileRows(state, file).some(r => r.id === row.id))
       const allocated = details.tagIds.reduce((sum, id) => sum + (Number(row.tagValues[id]) || 0), 0)
       const setDetails = (patch: Partial<LogDetails>) => setRow(row.id, { overrides: { ...row.overrides, ...patch } })
       const resetDetails = (keys: Array<keyof LogDetails>) => {
        const overrides = { ...row.overrides }
        keys.forEach(key => delete overrides[key])
        setRow(row.id, { overrides })
       }
       return <article key={row.id} className="app-card min-w-0 overflow-hidden" aria-label={`Metric card ${index + 1}: ${kpi?.title}`}>
        <div className="p-4 bg-primary-50/50 border-b border-gray-100">
         <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-semibold text-secondary-900">{kpi?.title || 'Metric'}</h3><button type="button" onClick={() => removeRow(row.id)} className="text-secondary-400 hover:text-red-600 p-1 -mt-1" aria-label={`Remove metric card ${index + 1}`}><Trash2 className="w-4 h-4" /></button></div>
         <p className="text-xs text-secondary-500 mt-1">{kpi?.metric_type === 'percentage' ? '%' : kpi?.unit_of_measurement || 'Number'}</p>
        </div>
        <div className="p-4 space-y-4">
         {canCreateClaim && <div>
          <label htmlFor={`result-${row.id}`} className="app-label">Result <span className="font-normal text-secondary-500">(optional)</span></label>
          <input id={`result-${row.id}`} type="number" step="any" inputMode="decimal" className="app-input !text-xl font-semibold tabular-nums" value={row.value} onChange={e => setRow(row.id, { value: e.target.value })} placeholder="Enter a number" />
          {details.tagIds.length > 1 && <div className="mt-3 space-y-2">
           <p className="app-help">Split this total across tags. Each amount is saved once.</p>
           {details.tagIds.map(id => <div key={id} className="flex items-center gap-2"><label htmlFor={`${row.id}-tag-${id}`} className="text-xs text-secondary-700 flex-1">{tags.find(t => t.id === id)?.name || 'Tag'}</label><input id={`${row.id}-tag-${id}`} type="number" step="any" inputMode="decimal" className="app-input !w-24" value={row.tagValues[id] || ''} onChange={e => setRow(row.id, { tagValues: { ...row.tagValues, [id]: e.target.value } })} placeholder="Amount" /></div>)}
           <p className={`text-xs ${row.value !== '' && Math.abs(allocated - Number(row.value)) > 1e-9 ? 'text-amber-700' : 'text-secondary-500'}`} aria-live="polite">{allocated.toLocaleString()} of {row.value || '0'} allocated</p>
          </div>}
         </div>}
         <div className="text-xs text-secondary-500 space-y-1">
          <span className={`inline-flex items-center gap-1 font-medium ${customCount ? 'text-amber-700' : 'text-primary-700'}`}><Link2 className="w-3 h-3" />{customCount ? 'Customized details' : 'Using shared details'}</span>
          <p>{scopeSummary(row)}</p>
          {details.evidenceTitle && <p className="truncate" title={details.evidenceTitle}>{details.evidenceTitle}</p>}
         </div>
         <details>
          <summary className="cursor-pointer text-xs font-medium text-secondary-700">Customize details</summary>
          <div className="mt-4"><LogDetailsFields {...fieldProps} id={row.id} value={details} onChange={setDetails} overrides={row.overrides} onReset={resetDetails} /></div>
          {customCount > 0 && <button type="button" onClick={() => setRow(row.id, { overrides: {} })} className="text-xs text-primary-700 hover:underline mt-3">Reset all to shared details</button>}
         </details>
         {canCreateEvidence && <details className="border-t border-gray-100 pt-3">
          <summary className="cursor-pointer text-xs text-secondary-500">{supportedFiles.length} supporting file{supportedFiles.length === 1 ? '' : 's'}</summary>
          <ul className="mt-2 text-xs text-secondary-500 space-y-1">{supportedFiles.map(file => <li key={file.id} className="truncate">{file.name}</li>)}</ul>
          {!supportedFiles.length && <p className="app-help mt-2">Choose this card from a file in the evidence library.</p>}
         </details>}
         <button type="button" onClick={() => update({ logRows: [...rows, { ...newLogRow(row.kpiId), overrides: { ...row.overrides } }] })} className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline"><Copy className="w-3 h-3" /> Add another scope</button>
        </div>
       </article>
      })}
     </div>
     {rows.length === 0 && !pickerOpen && <div className="app-card-muted p-5 text-sm text-secondary-500">Add a metric to record results or connect files. Evidence can also be saved without a metric.</div>}
     {resultCount > 0 && <p className="app-help mt-3" aria-live="polite">{resultCount} metric card{resultCount === 1 ? '' : 's'} with results. Each result needs a location.</p>}
    </section>}
   </div>
  </div>
 )
}
