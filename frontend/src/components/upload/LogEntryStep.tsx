import React, { useState } from 'react'
import { BarChart3, Check, ChevronDown, Copy, FileText, Paperclip, Search, Settings2, X } from 'lucide-react'
import type { BeneficiaryGroup, Evidence, KPI, Location, MetricTag, TimelineClaim } from '../../types'
import type { DateRangePickerHandle } from '../DateRangePicker'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { InlineAlert } from '../ui'
import FileDropList from './FileDropList'
import LogDetailsFields from './LogDetailsFields'
import MetricEvidence from './MetricEvidence'
import { evidenceMetricError, fileRows, LogDetails, LogMetricRow, logDates, logFieldIssues, newLogRow, removeLogRow, rowDetails, rowHasResult, setLogFileRow, setLogRowResult, sharedLogDetails } from './logDraft'
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
 /** Set after a failed continue: missing fields turn red and clear as they are fixed. */
 showErrors?: boolean
}

/** One workspace with per-metric details and per-file assignments on demand. */
export default function LogEntryStep({ state, update, kpis, locations, tags, beneficiaryGroups, canCreateClaim, canCreateEvidence, lockedMetricId, evidenceForClaim, onAddFiles, onRemoveFile, onRetryFile, onSetFileType, onSetAllTypes, onCreateMetric, onCreateLocation, onCreateTag, showErrors }: LogEntryStepProps) {
 const [search, setSearch] = useState('')
 const issues = showErrors ? logFieldIssues(state) : undefined
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
 const cards = metrics.flatMap((kpi, kpiIndex) => {
  const selected = rows.filter(row => row.kpiId === kpi.id)
  return (selected.length ? selected : [newLogRow(kpi.id!, `metric-${kpi.id}`)]).map((row, index) => ({ row, kpi, kpiIndex, scope: index + 1, key: index ? row.id : `metric-${kpi.id}` }))
 })
 const [openKeys, setOpenKeys] = useState<string[]>([])
 const toggleDetails = (key: string) => setOpenKeys(keys => keys.includes(key) ? keys.filter(k => k !== key) : [...keys, key])
 const renderDetails = (row: LogMetricRow, kpi: KPI, scope: number) => {
  const included = rows.some(r => r.id === row.id)
  const customCount = Object.keys(row.overrides).length
  const supportedFiles = included ? state.files.filter(file => fileRows(state, file).some(r => r.id === row.id)) : []
  const setDetails = (patch: Partial<LogDetails>) => setRow(row, { overrides: { ...row.overrides, ...patch } })
  const resetDetails = (keys: Array<keyof LogDetails>) => {
   const overrides = { ...row.overrides }
   keys.forEach(key => delete overrides[key])
   setRow(row, { overrides })
  }
  return <div className="mt-3 pt-3 border-t border-gray-100 space-y-4 animate-fade-in">
   <LogDetailsFields {...fieldProps} id={row.id} value={rowDetails(state, row)} onChange={setDetails} overrides={row.overrides} onReset={resetDetails} errors={issues?.rows[row.id]} />
   {canCreateEvidence && included && <div className="border-t border-gray-100 pt-3"><MetricEvidence files={state.files} attachedIds={supportedFiles.map(file => file.id)} metricLabel={`${kpi.title}, scope ${scope}`} onSetAttached={(fileId, attached) => update(setLogFileRow(state, fileId, row.id, attached))} /></div>}
   {(customCount > 0 || included) && <div className="flex flex-wrap gap-2">
    {customCount > 0 && <button type="button" onClick={() => setRow(row, { overrides: {} })} className="app-btn app-btn-ghost app-btn-sm">Use Master Scope</button>}
    {included && <button type="button" onClick={() => update({ logRows: [...rows, { ...newLogRow(row.kpiId), overrides: { ...row.overrides } }] })} className="app-btn app-btn-secondary app-btn-sm"><Copy className="w-3.5 h-3.5" /> Add another scope</button>}
   </div>}
  </div>
 }
 const missing = rows.filter(row => !kpis.some(kpi => kpi.id === row.kpiId))
 const visibleCards = cards.filter(({ kpi }) => kpi.title.toLowerCase().includes(search.trim().toLowerCase()))
 // Evidence-only members tag metrics instead of entering numbers; the tag is what lets evidence connect.
 const evidenceOnly = canCreateEvidence && !canCreateClaim && !evidenceForClaim
 const metricMissing = !!showErrors && evidenceOnly && !!evidenceMetricError(state, metrics.length)
 const noAccess = !canCreateEvidence ? 'evidence' : evidenceOnly ? 'claims' : null

 return (
  <div className="space-y-4">
  {noAccess && <InlineAlert tone="info">You don't have permission to add {noAccess}. Ask an account admin to give you access.</InlineAlert>}
  <div className={`grid items-start gap-4 ${canCreateEvidence ? 'lg:grid-cols-[320px_minmax(0,1fr)]' : ''}`}>
   {canCreateEvidence && <aside className="app-card p-4 min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto" aria-labelledby="log-files-heading">
    <div className="flex items-center justify-between gap-2 mb-3">
     <h2 id="log-files-heading" className="app-card-title flex items-center gap-2"><FileText className="w-4 h-4 text-evidence-600" /> Evidence <span className="app-chip">{state.files.length}</span></h2>
    </div>
    <FileDropList files={state.files} onAddFiles={onAddFiles} onRemoveFile={onRemoveFile} onRetryFile={onRetryFile} compact alwaysShowType onSetFileType={onSetFileType} onSetAllTypes={onSetAllTypes} onFileClick={evidenceForClaim ? undefined : toggleFile} expandedFileId={expandedFileId} renderFileDetails={!evidenceForClaim ? file => {
     const selected = fileRows(state, file)
     const open = expandedFileId === file.id
     const overrides = file.overrides || {}
     const custom = Object.keys(overrides).length > 0
     const setFile = (patch: Partial<typeof file>) => update({ files: state.files.map(f => f.id === file.id ? { ...f, ...patch } : f) })
     const setAssignment = (rowIds: string[] | undefined) => setFile({ rowIds })
     const resetScope = (keys: Array<keyof LogDetails>) => {
      const next = { ...overrides }
      keys.forEach(key => delete next[key])
      setFile({ overrides: next })
     }
     return <div className="border-t border-gray-100 pt-2">
      <button type="button" onClick={() => toggleFile(file.id)} aria-expanded={open} className="w-full flex items-center gap-2 text-[11px] rounded-md -mx-1 px-1 py-0.5 hover:bg-gray-50">
       <span className={`font-medium ${file.rowIds !== undefined && !selected.length ? 'text-amber-700' : 'text-gray-500'}`}>{file.rowIds === undefined ? 'All metrics' : selected.length ? `${selected.length} metric${selected.length === 1 ? '' : 's'}` : 'Unassigned'}</span>
       {custom && <span className="text-amber-700">Custom</span>}
       <span className={`ml-auto inline-flex items-center gap-1 font-medium ${issues?.files[file.id]?.length ? 'text-red-600' : open ? 'text-primary-700' : 'text-gray-500'}`}><Settings2 className="w-3 h-3" /> Details <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
      </button>
      {open && <div className="mt-3 space-y-4 animate-fade-in">
       <div className="space-y-2">
        <p className="text-xs font-semibold text-secondary-700">Supports</p>
        <label className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={file.rowIds === undefined} onChange={e => setAssignment(e.target.checked ? undefined : selected.map(r => r.id))} /><span>All included metrics</span></label>
        {rows.map(row => <label key={row.id} className="flex gap-2 text-xs text-secondary-700 items-start"><input type="checkbox" className="rounded border-gray-300 text-primary-600 mt-0.5" checked={selected.some(r => r.id === row.id)} onChange={e => update(setLogFileRow(state, file.id, row.id, e.target.checked))} /><span>{rowName(row)}</span></label>)}
        {rows.length === 0 && <p className="app-help">Enter a result or include a metric for evidence.</p>}
        <button type="button" className="text-xs text-secondary-500 hover:underline" onClick={() => setAssignment([])}>Leave unassigned</button>
       </div>
       <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-semibold text-secondary-700">Scope for this file</p>
        <LogDetailsFields {...fieldProps} id={`file-${file.id}`} value={{ ...sharedLogDetails(state), ...overrides }} onChange={patch => setFile({ overrides: { ...overrides, ...patch } })} overrides={overrides} onReset={resetScope} errors={issues?.files[file.id]} />
        {custom && <button type="button" onClick={() => setFile({ overrides: {} })} className="app-btn app-btn-ghost app-btn-sm">Use Master Scope</button>}
       </div>
      </div>}
     </div>
    } : undefined} />
    <p className="app-help mt-3">{evidenceForClaim ? 'Files support this result.' : state.files.some(file => file.rowIds !== undefined) ? 'Files use your custom assignments.' : 'Files support all included metrics.'}</p>
   </aside>}

   <div className="space-y-4 min-w-0">
    <section className="app-card p-4" aria-labelledby="log-context-heading">
     <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
      <h2 id="log-context-heading" className="app-card-title flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary-700" /> Master Scope</h2>
      <p className="app-help">{evidenceForClaim ? 'Date and scope come from the result.' : 'Applies to every metric unless you edit its details.'}</p>
     </div>
     <LogDetailsFields {...fieldProps} id="shared" value={sharedLogDetails(state)} onChange={update} locked={!!evidenceForClaim} onCreateLocation={onCreateLocation} onCreateTag={onCreateTag} errors={issues?.shared} />
    </section>

    {!evidenceForClaim && <section aria-labelledby="log-results-heading">
     <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
       <h2 id="log-results-heading" className="app-card-title flex items-center gap-2"><BarChart3 className="w-4 h-4 text-secondary-500" /> Metrics</h2>
       <span className={`app-chip ${rows.length ? 'app-chip-accent' : ''}`}>{rows.length} included</span>
       {canCreateClaim && metrics.length > 0 && <p className="app-help">Enter a number to include a metric.</p>}
       {evidenceOnly && metrics.length > 0 && <p className={`app-help ${metricMissing ? '!text-red-600 font-medium' : ''}`}>Pick at least one metric this evidence supports.</p>}
      </div>
      <div className="flex items-center gap-2">
       {(metrics.length > 6 || search) && <div className="relative"><Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-secondary-400" /><input aria-label="Search metrics" value={search} onChange={e => setSearch(e.target.value)} className="app-input !pl-8 !py-1.5 !w-44" placeholder="Find a metric" /></div>}
       {onCreateMetric && !lockedMetricId && <button type="button" onClick={onCreateMetric} className="app-btn app-btn-ghost app-btn-sm">+ New metric</button>}
      </div>
     </div>
     <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 items-start" role="region" aria-label="Program metrics">
      {visibleCards.map(({ row, kpi, kpiIndex, scope, key }) => {
       const included = rows.some(r => r.id === row.id)
       const hasResult = rowHasResult(state, row)
       const details = rowDetails(state, row)
       const customCount = Object.keys(row.overrides).length
       const supportedFiles = included ? state.files.filter(file => fileRows(state, file).some(r => r.id === row.id)) : []
       const allocated = details.tagIds.reduce((sum, id) => sum + (Number(row.tagValues[id]) || 0), 0)
       const unit = kpi.metric_type === 'percentage' ? '%' : kpi.unit_of_measurement
       const rowIssues = (included && issues?.rows[row.id]) || []
       const detailsBad = rowIssues.some(field => field !== 'amount')
       const compactFooter = canCreateEvidence && !hasResult && !evidenceOnly
       return <article key={key} className={`app-tile-static p-4 min-w-0 flex flex-col relative transition-colors ${rowIssues.length ? '!border-red-400 ring-2 ring-red-100' : included ? '!border-primary-600 shadow-md' : ''}`} aria-label={`${kpi.title}${scope > 1 ? `, scope ${scope}` : ''}`}>
        {included && <button type="button" onClick={() => removeRow(row.id)} className="absolute top-2.5 right-2.5 p-1 rounded-lg text-gray-300 hover:text-red-600 hover:bg-gray-100 transition-colors" aria-label={`Remove ${kpi.title}, scope ${scope}`} title="Remove from this log"><X className="w-3.5 h-3.5" /></button>}
        <div className="flex items-start gap-2 pr-7 mb-3 h-10 overflow-hidden">
         <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: getKPIColor(kpi.category, kpiIndex) }} />
         <div className="min-w-0">
          <h3 className={`text-sm font-medium text-gray-800 leading-snug ${scope > 1 ? 'line-clamp-1' : 'line-clamp-2'}`} title={kpi.title}>{kpi.title}</h3>
          {scope > 1 && <p className="text-[11px] text-gray-400 truncate" title={scopeSummary(row)}>Scope {scope} · {scopeSummary(row)}</p>}
         </div>
        </div>

        {canCreateClaim && <div className="mt-auto">
         <label htmlFor={`result-${row.id}`} className={`flex items-center gap-2 min-w-0 cursor-text rounded-xl border-2 px-3 h-14 transition-colors focus-within:border-primary-700 focus-within:ring-4 focus-within:ring-primary-100 ${rowIssues.includes('amount') ? 'border-red-400 bg-white' : hasResult ? 'border-primary-700 bg-white' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'}`}>
          <input id={`result-${row.id}`} aria-label={`${kpi.title}${scope > 1 ? ` scope ${scope}` : ''} result`} type="number" step="any" inputMode="decimal"
           className="min-w-0 flex-1 bg-transparent border-0 focus:ring-0 p-0 text-2xl font-semibold text-gray-900 tabular-nums placeholder:text-gray-300 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
           value={row.value} onChange={e => update(setLogRowResult(state, row, e.target.value))} placeholder="0" />
          {unit && <span className="text-sm text-gray-400 truncate max-w-[45%] shrink-0">{unit}</span>}
         </label>
         {included && details.tagIds.length > 1 && hasResult && <div className="mt-3 space-y-1.5">
          <p className="text-[11px] text-gray-500">Split across tags</p>
          {details.tagIds.map(id => <div key={id} className="flex items-center gap-2"><label htmlFor={`${row.id}-tag-${id}`} className="text-xs text-secondary-700 flex-1 truncate">{tags.find(t => t.id === id)?.name || 'Tag'}</label><input id={`${row.id}-tag-${id}`} type="number" step="any" inputMode="decimal" className="app-input !w-20 !py-1 !text-sm tabular-nums" value={row.tagValues[id] || ''} onChange={e => setRow(row, { tagValues: { ...row.tagValues, [id]: e.target.value } })} placeholder="0" /></div>)}
          <p className={`text-[11px] ${row.value !== '' && Math.abs(allocated - Number(row.value)) > 1e-9 ? 'text-amber-700' : 'text-gray-400'}`} aria-live="polite">{allocated.toLocaleString()} of {row.value || '0'} allocated</p>
         </div>}
        </div>}

        {evidenceOnly && <button type="button" aria-pressed={included} aria-label={`${kpi.title}${scope > 1 ? ` scope ${scope}` : ''}: this evidence supports it`} onClick={() => included ? removeRow(row.id) : setRow(row, { keepForEvidence: true })}
         className={`mt-auto flex items-center justify-center gap-2 rounded-xl border-2 h-14 text-sm font-medium transition-colors ${metricMissing ? 'border-red-400 bg-white text-gray-500' : included ? 'border-primary-700 bg-primary-50 text-primary-900' : 'border-gray-200 bg-gray-50/60 text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
         <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${included ? 'border-primary-700 bg-primary-700 text-white' : 'border-gray-300 bg-white'}`}>{included && <Check className="w-3 h-3" />}</span>
         {included ? 'Selected' : 'Select'}
        </button>}

        <div className={`flex items-center gap-2 pt-2.5 min-h-[2.75rem] border-t border-gray-100 text-[11px] ${canCreateClaim || evidenceOnly ? 'mt-3' : 'mt-auto'}`}>
         {evidenceOnly ? null : canCreateEvidence && !hasResult ? <button type="button" aria-pressed={included} onClick={() => included ? removeRow(row.id) : setRow(row, { keepForEvidence: true })}
          title={canCreateClaim ? 'Add evidence without claim' : 'Include for evidence'}
          className={`inline-flex items-center gap-1 min-w-0 rounded-full border px-2 py-1 font-medium whitespace-nowrap transition-colors ${included ? 'border-primary-600 bg-primary-50 text-primary-900' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
          {included && <Check className="w-3 h-3 flex-shrink-0" />}
          <span className="truncate">{canCreateClaim ? 'Add evidence without claim' : 'Include for evidence'}</span>
         </button> : included && <span className="flex items-center gap-1 font-medium text-primary-900"><Check className="w-3 h-3" /> Included</span>}
         {!compactFooter && included && canCreateEvidence && <span className={`flex items-center gap-0.5 ${supportedFiles.length ? 'text-evidence-600' : 'text-gray-400'}`} title={`${supportedFiles.length} file${supportedFiles.length === 1 ? '' : 's'} attached`}><Paperclip className="w-3 h-3" />{supportedFiles.length}</span>}
         {!compactFooter && customCount > 0 && <span className="text-amber-700">Custom</span>}
         <button type="button" onClick={() => toggleDetails(key)} aria-expanded={openKeys.includes(key)} aria-label={compactFooter ? `Details${customCount ? ', custom scope' : ''}` : undefined} title={compactFooter ? `Details${customCount ? ' (custom scope)' : ''}` : undefined}
          className={`ml-auto inline-flex items-center gap-1 font-medium rounded-md px-1.5 py-0.5 -mr-1.5 hover:bg-gray-100 transition-colors flex-shrink-0 ${detailsBad ? 'text-red-600' : openKeys.includes(key) ? 'text-primary-700' : compactFooter && customCount ? 'text-amber-700' : 'text-gray-500 hover:text-primary-700'}`}>
          <Settings2 className="w-3 h-3" />{!compactFooter && <> Details <ChevronDown className={`w-3 h-3 transition-transform ${openKeys.includes(key) ? 'rotate-180' : ''}`} /></>}
         </button>
        </div>
        {openKeys.includes(key) && renderDetails(row, kpi, scope)}
       </article>
      })}
     </div>
     {visibleCards.length === 0 && <p className="app-help py-4">{search ? 'No metrics match your search.' : canCreateEvidence ? 'No metrics yet. You can still save evidence.' : 'No metrics yet. Create a metric to record results.'}</p>}
     {missing.map(row => <div key={row.id} className="app-card p-3 mt-3 flex items-center justify-between gap-2"><p className="text-xs text-red-600">A selected metric is no longer available.</p><button type="button" onClick={() => removeRow(row.id)} className="app-btn app-btn-ghost app-btn-sm">Remove</button></div>)}
    </section>}
   </div>
  </div>
  </div>
 )
}
