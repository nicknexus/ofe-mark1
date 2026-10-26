import React, { useState } from 'react'
import { BarChart3, Check, Copy, FileText, Search, Settings2, X } from 'lucide-react'
import type { BeneficiaryGroup, Evidence, KPI, Location, MetricTag, TimelineClaim } from '../../types'
import type { DateRangePickerHandle } from '../DateRangePicker'
import FileDropList from './FileDropList'
import LogDetailsFields from './LogDetailsFields'
import MetricEvidence from './MetricEvidence'
import { fileRows, LogDetails, LogMetricRow, logDates, newLogRow, removeLogRow, rowDetails, rowHasResult, setLogFileRow, setLogRowResult, sharedLogDetails } from './logDraft'
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

/** One workspace with per-metric details and per-file assignments on demand. */
export default function LogEntryStep({ state, update, kpis, locations, tags, beneficiaryGroups, canCreateClaim, canCreateEvidence, lockedMetricId, evidenceForClaim, onAddFiles, onRemoveFile, onRetryFile, onSetFileType, onSetAllTypes, onCreateMetric, onCreateLocation, onCreateTag }: LogEntryStepProps) {
 const [showTypes, setShowTypes] = useState(false)
 const [search, setSearch] = useState('')
 const rows = state.logRows || []
 const [expandedFileId, setExpandedFileId] = useState<string | null>(null)
 const toggleFile = (id: string) => setExpandedFileId(current => current === id ? null : id)
 const metrics = lockedMetricId ? kpis.filter(k => k.id === lockedMetricId) : kpis
 const setRow = (row: LogMetricRow, patch: Partial<LogMetricRow>) => update({
  logRows: rows.some(r => r.id === row.id) ? rows.map(r => r.id === row.id ? { ...r, ...patch } : r) : [...rows, { ...row, ...patch }],
 })
 const removeRow = (id: string) => update(removeLogRow(state, id))
 const scopeSummary = (row: LogMetricRow) => {
  const details = rowDetails(state, row)
  const { start, end } = logDates(details)
  return [locations.find(l => l.id === details.locationIds[0])?.name || 'Location not set', start === end ? start : `${start} to ${end}`, ...details.tagIds.map(id => tags.find(t => t.id === id)?.name)].filter(Boolean).join(' · ')
 }
 const rowName = (row: LogMetricRow) => {
  const siblings = rows.filter(r => r.kpiId === row.kpiId)
  return `${kpis.find(k => k.id === row.kpiId)?.title || 'Unavailable metric'}${siblings.length > 1 ? ` · Scope ${siblings.findIndex(r => r.id === row.id) + 1} (${scopeSummary(row)})` : ''}`
 }
 const fieldProps = { locations, tags, beneficiaryGroups }
 // Keep each first card's React key stable when its first keystroke includes it.
 const cards = metrics.flatMap(kpi => {
  const selected = rows.filter(row => row.kpiId === kpi.id)
  return (selected.length ? selected : [newLogRow(kpi.id!, `metric-${kpi.id}`)]).map((row, index) => ({ row, kpi, scope: index + 1, key: index ? row.id : `metric-${kpi.id}` }))
 })
 const missing = rows.filter(row => !kpis.some(kpi => kpi.id === row.kpiId))
 const visibleCards = cards.filter(({ kpi }) => kpi.title.toLowerCase().includes(search.trim().toLowerCase()))

 return (
  <div className={`grid items-start gap-4 ${canCreateEvidence ? 'lg:grid-cols-[280px_minmax(0,1fr)]' : ''}`}>
   {canCreateEvidence && <aside className="app-card p-4 min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto" aria-labelledby="log-files-heading">
    <div className="flex items-center justify-between gap-2 mb-3">
     <h2 id="log-files-heading" className="app-card-title flex items-center gap-2"><FileText className="w-4 h-4 text-evidence-600" /> Evidence <span className="app-chip">{state.files.length}</span></h2>
     {state.files.length > 0 && <button type="button" onClick={() => setShowTypes(v => !v)} aria-expanded={showTypes} className="app-btn app-btn-ghost app-btn-sm">Types</button>}
    </div>
    <FileDropList files={state.files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} onRetryFile={onRetryFile} compact showTypePicker={showTypes} onSetFileType={onSetFileType} onSetAllTypes={onSetAllTypes} onFileClick={evidenceForClaim ? undefined : toggleFile} expandedFileId={expandedFileId} renderFileDetails={!evidenceForClaim ? file => {
     const selected = fileRows(state, file)
     const setAssignment = (rowIds: string[] | undefined) => update({ files: state.files.map(f => f.id === file.id ? { ...f, rowIds } : f) })
     return <details open={expandedFileId === file.id} className="border-t border-gray-100 pt-2">
      <summary onClick={e => { e.preventDefault(); toggleFile(file.id) }} className="cursor-pointer text-xs font-medium text-primary-700">{file.rowIds === undefined ? 'All included metrics' : selected.length ? `${selected.length} scope${selected.length === 1 ? '' : 's'} selected` : 'Unassigned'}</summary>
      <div className="mt-3 space-y-2">
       <label className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={file.rowIds === undefined} onChange={e => setAssignment(e.target.checked ? undefined : selected.map(r => r.id))} /><span>All included metrics</span></label>
       {rows.map(row => <label key={row.id} className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={selected.some(r => r.id === row.id)} onChange={e => update(setLogFileRow(state, file.id, row.id, e.target.checked))} /><span>{rowName(row)}</span></label>)}
       {rows.length === 0 && <p className="app-help">Enter a result or include a metric for evidence.</p>}
       {selected.length > 0 && <p className="app-help">Other results with matching details also connect automatically.</p>}
       <button type="button" className="text-xs text-secondary-500 hover:underline" onClick={() => setAssignment([])}>Leave unassigned</button>
      </div>
     </details>
    } : undefined} />
    <p className="app-help mt-3">{evidenceForClaim ? 'Files support this result.' : state.files.some(file => file.rowIds !== undefined) ? 'Files use your custom assignments.' : 'Files support all included metrics.'}</p>
   </aside>}

   <div className="space-y-4 min-w-0">
    <section className="app-card p-4" aria-labelledby="log-context-heading">
     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
      <h2 id="log-context-heading" className="app-card-title flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary-700" /> Master scope</h2>
      <p className="app-help">{evidenceForClaim ? 'Date and scope come from the result.' : 'Applies to every metric unless you edit its details.'}</p>
     </div>
     <LogDetailsFields {...fieldProps} id="shared" value={sharedLogDetails(state)} onChange={update} locked={!!evidenceForClaim} onCreateLocation={onCreateLocation} onCreateTag={onCreateTag} />
    </section>

    {!evidenceForClaim && <section aria-labelledby="log-results-heading">
     <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex items-center gap-2"><h2 id="log-results-heading" className="app-card-title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-secondary-500" /> Metrics</h2><span className="text-xs text-secondary-500">{rows.length} included</span></div>
      <div className="flex items-center gap-2">
       {(metrics.length > 6 || search) && <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-secondary-400" /><input aria-label="Search metrics" value={search} onChange={e => setSearch(e.target.value)} className="app-input !pl-8 !py-1.5 !w-44" placeholder="Find a metric" /></div>}
       {onCreateMetric && !lockedMetricId && <button type="button" onClick={onCreateMetric} className="app-btn app-btn-ghost app-btn-sm">+ New metric</button>}
      </div>
     </div>
     {canCreateClaim && metrics.length > 0 && <p className="app-help mb-3">Enter a number to include a metric.</p>}
     <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 items-start lg:max-h-[60dvh] lg:overflow-y-auto p-1 -m-1" role="region" aria-label="Program metrics" tabIndex={metrics.length > 6 ? 0 : undefined}>
      {visibleCards.map(({ row, kpi, scope, key }) => {
       const included = rows.some(r => r.id === row.id)
       const details = rowDetails(state, row)
       const customCount = Object.keys(row.overrides).length
       const supportedFiles = included ? state.files.filter(file => fileRows(state, file).some(r => r.id === row.id)) : []
       const allocated = details.tagIds.reduce((sum, id) => sum + (Number(row.tagValues[id]) || 0), 0)
       const setDetails = (patch: Partial<LogDetails>) => setRow(row, { overrides: { ...row.overrides, ...patch } })
       const resetDetails = (keys: Array<keyof LogDetails>) => {
        const overrides = { ...row.overrides }
        keys.forEach(key => delete overrides[key])
        setRow(row, { overrides })
       }
       return <article key={key} className={`app-card min-w-0 overflow-hidden ${included ? '!border-primary-300' : ''}`} aria-label={`${kpi.title}${scope > 1 ? `, scope ${scope}` : ''}`}>
        <div className={`px-3 py-2.5 flex items-start justify-between gap-2 ${included ? 'bg-primary-50' : 'bg-gray-50'}`}>
         <h3 className="text-sm font-semibold text-secondary-900">{kpi.title}{scope > 1 && <span className="block text-xs font-normal text-secondary-500">Scope {scope}</span>}</h3>
         {included && <button type="button" onClick={() => removeRow(row.id)} className="text-primary-700 hover:text-red-600 p-0.5 shrink-0" aria-label={`Remove ${kpi.title}, scope ${scope}`} title="Remove from this log"><X className="w-4 h-4" /></button>}
        </div>
        <div className="p-3 space-y-3">
         {canCreateClaim && <div>
          <div className="flex items-center gap-2">
           <input id={`result-${row.id}`} aria-label={`${kpi.title}${scope > 1 ? ` scope ${scope}` : ''} result`} type="number" step="any" inputMode="decimal" className="app-input !text-xl font-semibold tabular-nums min-w-0" value={row.value} onChange={e => update(setLogRowResult(state, row, e.target.value))} placeholder="Amount" />
           <span className="text-xs text-secondary-500 max-w-[40%] break-words">{kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement || 'Number'}</span>
          </div>
          {included && details.tagIds.length > 1 && rowHasResult(state, row) && <div className="mt-3 space-y-2">
           <p className="app-help">Split the total across tags.</p>
           {details.tagIds.map(id => <div key={id} className="flex items-center gap-2"><label htmlFor={`${row.id}-tag-${id}`} className="text-xs text-secondary-700 flex-1">{tags.find(t => t.id === id)?.name || 'Tag'}</label><input id={`${row.id}-tag-${id}`} type="number" step="any" inputMode="decimal" className="app-input !w-20" value={row.tagValues[id] || ''} onChange={e => setRow(row, { tagValues: { ...row.tagValues, [id]: e.target.value } })} placeholder="Amount" /></div>)}
           <p className={`text-xs ${row.value !== '' && Math.abs(allocated - Number(row.value)) > 1e-9 ? 'text-amber-700' : 'text-secondary-500'}`} aria-live="polite">{allocated.toLocaleString()} of {row.value || '0'} allocated</p>
          </div>}
         </div>}
         {canCreateEvidence && !rowHasResult(state, row) ? <label className="flex items-center gap-2 text-xs text-secondary-500 cursor-pointer">
          <input type="checkbox" checked={included} onChange={e => e.target.checked ? setRow(row, { keepForEvidence: true }) : removeRow(row.id)} className="rounded border-gray-300 text-primary-600" />
          {canCreateClaim ? 'Include for evidence only' : 'Include for evidence'}
         </label> : included && <span className="flex items-center gap-1 text-xs text-primary-700"><Check className="w-3 h-3" /> Included</span>}
         {customCount > 0 && <span className="block text-xs text-amber-700">Custom scope</span>}
         <details className="border-t border-gray-100 pt-2">
          <summary className="cursor-pointer text-xs font-medium text-secondary-700">Edit details</summary>
          {canCreateEvidence && included && <div className="mt-3 mb-4"><MetricEvidence files={state.files} attachedIds={supportedFiles.map(file => file.id)} metricLabel={`${kpi.title}, scope ${scope}`} onSetAttached={(fileId, attached) => update(setLogFileRow(state, fileId, row.id, attached))} /></div>}
          <div className="mt-3"><LogDetailsFields {...fieldProps} id={row.id} value={details} onChange={setDetails} overrides={row.overrides} onReset={resetDetails} /></div>
          {customCount > 0 && <button type="button" onClick={() => setRow(row, { overrides: {} })} className="text-xs text-primary-700 hover:underline mt-3">Use master scope</button>}
          {included && <button type="button" onClick={() => update({ logRows: [...rows, { ...newLogRow(row.kpiId), overrides: { ...row.overrides } }] })} className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline mt-3"><Copy className="w-3 h-3" /> Add another scope</button>}
         </details>
        </div>
       </article>
      })}
     </div>
     {visibleCards.length === 0 && <p className="app-help py-4">{search ? 'No metrics match your search.' : canCreateEvidence ? 'No metrics yet. You can still save evidence.' : 'No metrics yet. Create a metric to record results.'}</p>}
     {missing.map(row => <div key={row.id} className="app-card p-3 mt-3 flex items-center justify-between gap-2"><p className="text-xs text-red-600">A selected metric is no longer available.</p><button type="button" onClick={() => removeRow(row.id)} className="app-btn app-btn-ghost app-btn-sm">Remove</button></div>)}
    </section>}
   </div>
  </div>
 )
}
