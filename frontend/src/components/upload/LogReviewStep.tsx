import React, { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, FileText, Link2, Loader2, Paperclip, TrendingUp } from 'lucide-react'
import type { BeneficiaryGroup, KPI, Location, MetricTag, TimelineClaim, TimelineEvidence } from '../../types'
import { apiService } from '../../services/api'
import { formatDate } from '../../utils'
import { previewMatchingClaims, previewMatchingEvidence } from '../../utils/timeline'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { InlineAlert } from '../ui'
import { buildLogPlan, LogDetails, logDates, matchingLogClaimKeys, sharedLogDetails } from './logDraft'
import { EVIDENCE_TYPE_LABELS, WizardState } from './wizardTypes'

interface Props {
 state: WizardState
 initiativeId?: string
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 existingClaims: TimelineClaim[]
 existingEvidence: TimelineEvidence[]
 pinClaim?: TimelineClaim
 evidenceNeedsApproval?: boolean
}

export function LogScopeSummary({ state, locations, tags, beneficiaryGroups, className = '' }: Pick<Props, 'state' | 'locations' | 'tags' | 'beneficiaryGroups'> & { className?: string }) {
 const details = sharedLogDetails(state)
 const { start, end } = logDates(details)
 const items = [
  { label: 'Title', value: details.evidenceTitle.trim() },
  { label: 'Date', value: start ? (start === end ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`) : '' },
  { label: 'Location', value: details.locationIds.map(id => locations.find(l => l.id === id)?.name).filter(Boolean).join(', ') },
  { label: 'Tags', value: details.tagIds.map(id => tags.find(t => t.id === id)?.name).filter(Boolean).join(', ') },
  { label: 'Groups', value: details.beneficiaryGroupIds.map(id => beneficiaryGroups.find(g => g.id === id)?.name).filter(Boolean).join(', ') },
 ].filter(item => item.value)
 if (!items.length) return null
 return <div className={`app-card px-4 py-2.5 flex items-center gap-5 min-w-0 ${className}`} aria-label="Master Scope">
  <span className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500 leading-tight shrink-0">Master<br />Scope</span>
  <div className="flex flex-wrap gap-x-6 gap-y-1.5 min-w-0">
   {items.map(item => <div key={item.label} className="min-w-0">
    <p className="text-[11px] text-secondary-400 leading-tight">{item.label}</p>
    <p className="text-sm font-medium text-secondary-900 truncate max-w-[16rem]" title={item.value}>{item.value}</p>
   </div>)}
  </div>
 </div>
}

export default function LogReviewStep({ state, initiativeId, kpis, locations, tags, beneficiaryGroups, existingClaims, existingEvidence, pinClaim, evidenceNeedsApproval }: Props) {
 const plan = useMemo(() => buildLogPlan(state, initiativeId), [state, initiativeId])
 const name = (id: string) => kpis.find(k => k.id === id)?.title || 'Metric'
 const scopes = useMemo(() => [
  ...plan.claims.map(c => ({ kind: 'claim' as const, kpiIds: [c.kpiId], details: { ...c.details, tagIds: c.payload.tag_id ? [c.payload.tag_id] : [] } })),
  ...plan.evidence.map(e => ({ kind: 'evidence' as const, kpiIds: e.payload.kpi_ids || [], details: e.details })),
 ].map(scope => ({
  kind: scope.kind,
  input: { kpiIds: scope.kpiIds, locationIds: scope.details.locationIds, tagIds: scope.details.tagIds, beneficiaryGroupIds: scope.details.beneficiaryGroupIds, dateStart: logDates(scope.details).start, dateEnd: logDates(scope.details).end },
 })), [plan])
 const previewKey = JSON.stringify(scopes)
 const [server, setServer] = useState<{ key: string; claims: string[]; evidence: string[] } | null>(null)
 const [previewing, setPreviewing] = useState(false)
 const [previewFailed, setPreviewFailed] = useState(false)
 useEffect(() => {
  if (!initiativeId) return
  let cancelled = false
  setPreviewing(true)
  setPreviewFailed(false)
  const timer = window.setTimeout(async () => {
   const claimIds = new Set<string>()
   const evidenceIds = new Set<string>()
   try {
    // Cache duplicate scopes, and keep large logs from flooding the API.
    const cache = new Map<string, Awaited<ReturnType<typeof apiService.previewMatches>>>()
    for (const scope of scopes) {
     if (cancelled) return
     if (!scope.input.kpiIds.length) continue
     const key = JSON.stringify(scope.input)
     const result = cache.get(key) || await apiService.previewMatches(initiativeId, scope.input)
     cache.set(key, result)
     if (scope.kind === 'evidence') result.claims.forEach(c => claimIds.add(c.id))
     else result.evidence.forEach(e => evidenceIds.add(e.id))
    }
    if (!cancelled) setServer({ key: previewKey, claims: [...claimIds], evidence: [...evidenceIds] })
   } catch {
    if (!cancelled) setPreviewFailed(true)
   } finally {
    if (!cancelled) setPreviewing(false)
   }
  }, 200)
  return () => { cancelled = true; window.clearTimeout(timer) }
 }, [initiativeId, previewKey])
 const estimatedClaims = new Set(scopes.filter(s => s.kind === 'evidence').flatMap(s => previewMatchingClaims(existingClaims, s.input).map(c => c.id)))
 const estimatedEvidence = new Set(scopes.filter(s => s.kind === 'claim').flatMap(s => previewMatchingEvidence(existingEvidence, {
  kpiId: s.input.kpiIds[0], locationId: s.input.locationIds[0], tagId: s.input.tagIds[0] || null,
  beneficiaryGroupIds: s.input.beneficiaryGroupIds, dateStart: s.input.dateStart, dateEnd: s.input.dateEnd,
 }).map(e => e.id)))
 const fresh = server?.key === previewKey
 const existingResultCount = new Set([...(fresh ? server.claims : estimatedClaims), ...(pinClaim?.id ? [pinClaim.id] : [])]).size
 const existingEvidenceCount = fresh ? server.evidence.length : estimatedEvidence.size
 const connectionKeys = new Map(plan.evidence.map(e => [e.key, matchingLogClaimKeys(plan.claims, e)]))
 const connectedResults = new Set([...connectionKeys.values()].flat()).size
 const scopeText = (details: LogDetails, tagIds = details.tagIds) => {
  const { start, end } = logDates(details)
  return [
   start === end ? formatDate(start) : `${formatDate(start)} to ${formatDate(end)}`,
   details.locationIds.map(id => locations.find(l => l.id === id)?.name).filter(Boolean).join(', ') || 'Location not assigned',
   ...tagIds.map(id => tags.find(t => t.id === id)?.name),
   ...details.beneficiaryGroupIds.map(id => beneficiaryGroups.find(g => g.id === id)?.name),
  ].filter(Boolean).join(' · ')
 }
 const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
 const kpiColor = (id: string) => {
  const index = kpis.findIndex(k => k.id === id)
  return getKPIColor(kpis[index]?.category, Math.max(index, 0))
 }
 const claimByKey = new Map(plan.claims.map(c => [c.key, c]))
 const backedClaims = new Set([...connectionKeys.values()].flat())
 const unbacked = plan.claims.filter(c => !backedClaims.has(c.key))
 const unit = (id: string) => {
  const kpi = kpis.find(k => k.id === id)
  return kpi?.metric_type === 'percentage' ? '%' : kpi?.unit_of_measurement || ''
 }
 const column = 'app-card min-w-0 flex flex-col lg:h-[calc(100dvh-15rem)] lg:min-h-[420px]'
 const columnHead = 'px-5 pt-4 pb-3 border-b border-gray-100 shrink-0'
 const columnBody = 'flex-1 min-h-0 overflow-y-auto p-4 space-y-3'
 const empty = (text: string) => <p className="app-card-muted p-4 text-center text-xs text-secondary-500">{text}</p>

 return (
  <div className="grid items-start gap-4 lg:grid-cols-3">
   <section className={column} aria-labelledby="review-results">
    <div className={columnHead}>
     <h2 id="review-results" className="app-card-title flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary-700" /> Results <span className="app-chip">{plan.claims.length}</span></h2>
     <p className="app-help mt-0.5">Each one becomes a data point on its metric.</p>
    </div>
    <div className={columnBody}>
     {plan.claims.length === 0 && empty('No results in this log.')}
     {plan.claims.length > 0 && <div className="grid grid-cols-2 gap-2.5">{plan.claims.map(claim => {
      const backed = backedClaims.has(claim.key)
      const scope = [locations.find(l => l.id === claim.details.locationIds[0])?.name, tags.find(t => t.id === claim.payload.tag_id)?.name].filter(Boolean).join(' · ')
      return <div key={claim.key} className="app-tile-static p-3.5 min-w-0 flex flex-col">
       <div className="flex items-start gap-2 mb-2 h-9 overflow-hidden">
        <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: kpiColor(claim.kpiId) }} />
        <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={name(claim.kpiId)}>{name(claim.kpiId)}</p>
       </div>
       <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">+{claim.payload.value.toLocaleString()}</span>
        {unit(claim.kpiId) && <span className="text-xs text-gray-400 truncate">{unit(claim.kpiId)}</span>}
       </div>
       {scope && <p className="text-[11px] text-gray-400 truncate mt-1" title={scope}>{scope}</p>}
       <p className={`flex items-center gap-1 text-[11px] font-medium mt-2 pt-2 border-t border-gray-100 ${backed ? 'text-evidence-600' : 'text-amber-700'}`}>{backed ? <><Paperclip className="w-3 h-3" /> Has evidence</> : <><AlertTriangle className="w-3 h-3" /> No file</>}</p>
      </div>
     })}</div>}
    </div>
   </section>

   <section className={column} aria-labelledby="review-evidence">
    <div className={columnHead}>
     <h2 id="review-evidence" className="app-card-title flex items-center gap-2"><FileText className="w-4 h-4 text-evidence-600" /> Evidence <span className="app-chip">{plan.evidence.length}</span></h2>
     <p className="app-help mt-0.5">{plural(state.files.length, 'file')}, grouped by type and details.</p>
    </div>
    <div className={columnBody}>
     {plan.evidence.length === 0 && empty('No files in this log.')}
     {plan.evidence.map(item => <div key={item.key} className="app-tile-static p-4 min-w-0">
      <p className="text-sm font-semibold text-secondary-900">{item.payload.title || 'Untitled evidence'}</p>
      <p className="text-[11px] text-secondary-500 mt-0.5">{scopeText(item.details)}</p>
      <span className="app-chip app-chip-evidence mt-2">{EVIDENCE_TYPE_LABELS[item.payload.type]} · {plural(item.files.length, 'file')}</span>
      {item.payload.description && <p className="text-xs text-secondary-600 mt-2 whitespace-pre-wrap">{item.payload.description}</p>}
      <div className="flex flex-wrap gap-2 mt-3">{item.files.map(file => <div key={file.id} className="flex items-center gap-2 rounded-lg border border-gray-200/80 bg-gray-50/70 pr-2.5 max-w-full min-w-0" title={file.name}>
       {file.previewUrl ? <img src={file.previewUrl} alt="" className="w-8 h-8 rounded-l-lg object-cover shrink-0" /> : <span className="w-8 h-8 rounded-l-lg bg-gray-100 flex items-center justify-center shrink-0"><FileText className="w-3.5 h-3.5 text-secondary-400" /></span>}
       <span className="text-xs text-secondary-700 truncate">{file.name}</span>
      </div>)}</div>
     </div>)}
    </div>
   </section>

   <aside className={column} aria-labelledby="review-connections" aria-live="polite">
    <div className={columnHead}>
     <div className="flex items-center justify-between gap-2">
      <h2 id="review-connections" className="app-card-title flex items-center gap-2"><Link2 className="w-4 h-4 text-impact-600" /> Connections</h2>
      <span className={`app-chip ${previewing ? '' : fresh ? 'app-chip-impact' : ''}`}>{previewing ? <><Loader2 className="w-3 h-3 animate-spin" /> Checking</> : fresh ? 'Live' : 'Estimated'}</span>
     </div>
     <p className="app-help mt-0.5">Evidence links to results with the same metric, date, location and tags.</p>
    </div>
    <div className={columnBody}>
     {evidenceNeedsApproval && plan.evidence.length > 0 && <InlineAlert tone="warning">New evidence links up after an admin approves it.</InlineAlert>}

     <h3 className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500">Inside this log</h3>
     {plan.evidence.length === 0 ? <p className="text-xs text-secondary-500">No files, so nothing links inside this log.</p> : <ul className="space-y-2">
      {plan.evidence.map(item => {
       const linked = (connectionKeys.get(item.key) || []).map(key => claimByKey.get(key)).filter(Boolean) as typeof plan.claims
       return <li key={item.key} className="rounded-xl border border-gray-200/80 p-3">
        <p className="text-xs font-semibold text-secondary-800 flex items-center gap-1.5 min-w-0"><Paperclip className="w-3 h-3 text-evidence-600 shrink-0" /><span className="truncate">{EVIDENCE_TYPE_LABELS[item.payload.type]}</span><span className="text-secondary-400 font-normal shrink-0">· {plural(item.files.length, 'file')}</span></p>
        <p className="text-[11px] text-secondary-400 truncate mt-0.5" title={scopeText(item.details)}>{scopeText(item.details)}</p>
        {linked.length ? <ul className="mt-2 space-y-1">{linked.map(claim => <li key={claim.key} className="flex items-center gap-1.5 text-xs text-secondary-700 min-w-0">
         <ArrowRight className="w-3 h-3 text-impact-600 shrink-0" />
         <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: kpiColor(claim.kpiId) }} />
         <span className="truncate">{name(claim.kpiId)}</span>
         <span className="ml-auto tabular-nums font-semibold text-secondary-900">+{claim.payload.value.toLocaleString()}</span>
        </li>)}</ul> : <p className="text-xs text-secondary-500 mt-1.5">{item.payload.kpi_ids?.length ? `Supports ${item.payload.kpi_ids.map(name).join(', ')}. No new result to link.` : 'Not linked to a metric. Saved to the program for later.'}</p>}
       </li>
      })}
     </ul>}
     {unbacked.length > 0 && plan.evidence.length > 0 && <p className="text-xs text-amber-700">{plural(unbacked.length, 'result')} without a file: {[...new Set(unbacked.map(c => name(c.kpiId)))].join(', ')}.</p>}

     <h3 className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500 pt-2">With what's already in this program</h3>
     <div className="grid grid-cols-2 gap-2">
      <div className="rounded-xl bg-gray-50/80 border border-gray-200/70 p-3"><p className="text-xl font-semibold text-secondary-900 tabular-nums">{existingResultCount}</p><p className="text-[11px] text-secondary-500 leading-snug mt-0.5">existing result{existingResultCount === 1 ? '' : 's'} get your new files</p></div>
      <div className="rounded-xl bg-gray-50/80 border border-gray-200/70 p-3"><p className="text-xl font-semibold text-secondary-900 tabular-nums">{existingEvidenceCount}</p><p className="text-[11px] text-secondary-500 leading-snug mt-0.5">existing evidence record{existingEvidenceCount === 1 ? '' : 's'} back your new results</p></div>
     </div>
     {previewFailed && <p className="app-help">Live check is unavailable. Connections are checked again when you save.</p>}
    </div>
   </aside>
  </div>
 )
}
