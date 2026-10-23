import React, { useEffect, useMemo, useState } from 'react'
import { FileText, Link2, Loader2, TrendingUp } from 'lucide-react'
import type { BeneficiaryGroup, KPI, Location, MetricTag, TimelineClaim, TimelineEvidence } from '../../types'
import { apiService } from '../../services/api'
import { formatDate } from '../../utils'
import { previewMatchingClaims, previewMatchingEvidence } from '../../utils/timeline'
import { buildLogPlan, LogDetails, logDates, matchingLogClaimKeys } from './logDraft'
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
 return (
  <div className="space-y-5">
   <div className="app-card-muted p-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-secondary-700">
    <span><strong>{plan.claims.length}</strong> result{plan.claims.length === 1 ? '' : 's'}</span>
    <span><strong>{state.files.length}</strong> file{state.files.length === 1 ? '' : 's'}</span>
    {plan.evidence.length > 0 && <span><strong>{plan.evidence.length}</strong> evidence record{plan.evidence.length === 1 ? '' : 's'}</span>}
   </div>
   {plan.claims.length > 0 && <section aria-labelledby="review-results">
    <h2 id="review-results" className="app-card-title mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Results to save</h2>
    <div className="space-y-2">{plan.claims.map(claim => <div key={claim.key} className="app-card p-4">
     <div className="flex flex-wrap justify-between gap-2"><p className="text-sm text-secondary-900"><strong className="text-lg tabular-nums mr-2">{claim.payload.value.toLocaleString()}</strong>{name(claim.kpiId)}</p><span className="app-chip">{claim.payload.tag_id ? tags.find(t => t.id === claim.payload.tag_id)?.name : 'No tag'}</span></div>
     {claim.payload.label && <p className="text-sm text-secondary-700 mt-1">{claim.payload.label}</p>}
     {claim.payload.note && <p className="text-xs text-secondary-500 mt-1 whitespace-pre-wrap">{claim.payload.note}</p>}
     <p className="app-help mt-2">{scopeText(claim.details, claim.payload.tag_id ? [claim.payload.tag_id] : [])}</p>
     <p className="text-xs text-primary-700 mt-2">{[...connectionKeys.values()].some(keys => keys.includes(claim.key)) ? 'Supporting files included' : 'No new evidence attached'}</p>
    </div>)}</div>
   </section>}
   {plan.evidence.length > 0 && <section aria-labelledby="review-evidence">
    <h2 id="review-evidence" className="app-card-title mb-1 flex items-center gap-2"><FileText className="w-4 h-4" /> Evidence to save</h2>
    <p className="app-help mb-3">Files are grouped by type, details and assignment. A shared file can support more than one record.</p>
    <div className="space-y-2">{plan.evidence.map(item => <div key={item.key} className="app-card p-4">
     <p className="text-sm font-semibold text-secondary-900">{item.payload.title}</p>
     <p className="app-help mt-1">{EVIDENCE_TYPE_LABELS[item.payload.type]} · {item.files.length} file{item.files.length === 1 ? '' : 's'}</p>
     <p className="text-xs text-primary-700 mt-2">{item.payload.kpi_ids?.length ? `Supports: ${item.payload.kpi_ids.map(name).join(', ')}` : 'Unassigned. Saved to the program for later.'}</p>
     {(connectionKeys.get(item.key)?.length || 0) > item.claimKeys.length && <p className="app-help mt-1">Also connects to other results in this log with matching metric, date, location, tags and groups.</p>}
     <p className="app-help mt-2">{scopeText(item.details)}</p>
     {item.payload.description && <p className="app-help mt-2 whitespace-pre-wrap">{item.payload.description}</p>}
     <ul className="text-xs text-secondary-500 mt-2 space-y-1">{item.files.map(file => <li key={file.id} className="break-words">{file.name}</li>)}</ul>
    </div>)}</div>
   </section>}
   <div className="app-card-muted p-4" aria-live="polite">
    <p className="text-sm font-medium text-secondary-700 flex items-center gap-2">{previewing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}{previewing ? 'Checking existing connections...' : 'Connections'}</p>
    <p className="app-help mt-2">{evidenceNeedsApproval && plan.evidence.length ? 'New evidence will connect after approval. ' : ''}{connectedResults} new result{connectedResults === 1 ? '' : 's'} supported by the files in this log.</p>
    <p className="app-help mt-1">{!fresh ? 'Estimated: ' : ''}{existingResultCount} existing result{existingResultCount === 1 ? '' : 's'} and {existingEvidenceCount} existing evidence record{existingEvidenceCount === 1 ? '' : 's'} match these details.</p>
    {previewFailed && <p className="app-help mt-1">Live preview is unavailable. Connections will be checked again when saved.</p>}
   </div>
  </div>
 )
}
