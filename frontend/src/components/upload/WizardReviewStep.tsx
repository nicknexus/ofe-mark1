import React, { useEffect, useMemo, useState } from 'react'
import { Link2, Unlink, TrendingUp, FileText, MapPin, CalendarRange, Tag as TagIcon, Users, Loader2, Clock, BarChart3 } from 'lucide-react'
import { BeneficiaryGroup, KPI, Location, MatchPreviewResult, MetricTag, TimelineClaim, TimelineEvidence } from '../../types'
import { formatDate } from '../../utils'
import { apiService } from '../../services/api'
import { previewMatchingClaims, previewMatchingEvidence } from '../../utils/timeline'
import { WizardState, wizardClaims, wizardHasClaims, wizardHasEvidence, wizardEvidenceMetricIds, wizardDates, evidenceBuckets, EVIDENCE_TYPE_LABELS } from './wizardTypes'
import { EVIDENCE_TYPE_STYLE } from '../timeline/EvidenceTypeCounts'

interface WizardReviewStepProps {
 state: WizardState
 /** Enables the server-side preview (the same gates the auto-matcher runs). */
 initiativeId?: string
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 existingClaims: TimelineClaim[]
 existingEvidence: TimelineEvidence[]
 /** Opened from a specific claim (Connections "Add evidence"). Always treat as connected. */
 pinClaim?: TimelineClaim
 evidenceNeedsApproval?: boolean
}

/**
 * Review before saving, with a live preview of what the auto-matcher will
 * connect. The client mirror of the gates renders instantly; the server's
 * verdict (the same code path that links on save) replaces it as soon as it
 * arrives, so what you see here is what you get after Save.
 */
export default function WizardReviewStep({
 state,
 initiativeId,
 kpis,
 locations,
 tags,
 beneficiaryGroups,
 existingClaims,
 existingEvidence,
 pinClaim,
 evidenceNeedsApproval = false,
}: WizardReviewStepProps) {
 const claim = wizardHasClaims(state)
 const evidence = wizardHasEvidence(state)
 const kind = claim && evidence ? 'both' : claim ? 'claim' : 'evidence'
 const evBuckets = evidence && !state.editing ? evidenceBuckets(state.files) : []
 const { start, end } = wizardDates(state)
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])

 // Claims to be created: per-metric entries in the "both" flow, or the
 // single claim-only record, normalised to one shape for rendering.
 const newClaims = wizardClaims(state)

 const dateLabel = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
 const locationNames = state.locationIds
 .map(id => locations.find(l => l.id === id)?.name)
 .filter(Boolean) as string[]
 const tagNames = state.tagIds.map(id => tags.find(t => t.id === id)?.name).filter(Boolean) as string[]
 const groupNames = state.beneficiaryGroupIds
 .map(id => beneficiaryGroups.find(g => g.id === id)?.name)
 .filter(Boolean) as string[]

 // What will the auto-matcher connect? Client mirror first (instant) …
 const localClaims = useMemo(() => {
 if (!evidence) return []
 const kpiIds = wizardEvidenceMetricIds(state)
 return previewMatchingClaims(existingClaims, {
 kpiIds,
 locationIds: state.locationIds,
 tagIds: state.tagIds,
 beneficiaryGroupIds: state.beneficiaryGroupIds,
 dateStart: start,
 dateEnd: end,
 })
 }, [evidence, state, existingClaims, start, end])

 const localEvidence = useMemo(() => {
 if (!claim || state.locationIds.length === 0) return []
 const matched = newClaims.flatMap(c => previewMatchingEvidence(existingEvidence, {
 kpiId: c.kpiId,
 locationId: state.locationIds[0],
 tagId: state.tagIds[0] || null,
 beneficiaryGroupIds: state.beneficiaryGroupIds,
 dateStart: start,
 dateEnd: end,
 }))
 return [...new Map(matched.map(e => [e.id, e])).values()]
 }, [state, existingEvidence, start, end])

 const previewKpiIds = evidence ? wizardEvidenceMetricIds(state) : newClaims.map(c => c.kpiId)
 const previewKey = JSON.stringify([previewKpiIds, state.locationIds, state.tagIds, state.beneficiaryGroupIds, start, end])
 const [server, setServer] = useState<{ key: string; result: MatchPreviewResult } | null>(null)
 const [previewing, setPreviewing] = useState(false)
 useEffect(() => {
 if (!initiativeId || state.editing || previewKpiIds.length === 0 || !start) return
 let cancelled = false
 setPreviewing(true)
 const t = window.setTimeout(async () => {
 try {
 const result = await apiService.previewMatches(initiativeId, {
 kpiIds: previewKpiIds,
 locationIds: state.locationIds,
 tagIds: state.tagIds,
 beneficiaryGroupIds: state.beneficiaryGroupIds,
 dateStart: start,
 dateEnd: end !== start ? end : null,
 })
 if (!cancelled) setServer({ key: previewKey, result })
 } catch {
 // Fall back to the client mirror silently.
 } finally {
 if (!cancelled) setPreviewing(false)
 }
 }, 250)
 return () => { cancelled = true; window.clearTimeout(t) }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [initiativeId, previewKey, state.editing])

 const serverFresh = server?.key === previewKey
 const matchedClaimsRaw = serverFresh
 ? server!.result.claims.map(c => ({ id: c.id, kpi_id: c.kpi_id, value: c.value, date_represented: c.date_represented || '' }))
 : localClaims.map(c => ({ id: c.id, kpi_id: c.kpi_id, value: c.value, date_represented: c.date_represented }))
 const pinRow = pinClaim?.id
   ? {
     id: pinClaim.id,
     kpi_id: pinClaim.kpi_id,
     value: pinClaim.value,
     date_represented: pinClaim.date_represented || '',
   }
   : null
 const matchedClaims = pinRow && !matchedClaimsRaw.some(c => c.id === pinRow.id)
   ? [pinRow, ...matchedClaimsRaw]
   : matchedClaimsRaw
 const matchedEvidence = serverFresh
 ? server!.result.evidence.map(e => ({ id: e.id, title: e.title, date_represented: e.date_represented || '' }))
 : localEvidence.map(e => ({ id: e.id, title: e.title, date_represented: e.date_represented }))

 const scopeRow = (icon: typeof MapPin, text: string) => {
 const Icon = icon
 return (
 <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
 <Icon className="w-3.5 h-3.5 text-gray-400" />
 {text}
 </span>
 )
 }

 const connectionCount = (evidence ? matchedClaims.length : matchedEvidence.length)
 + (kind === 'both' ? newClaims.length : 0)

 return (
 <div className="space-y-4 max-w-2xl">
 {/* What will be created — claims are teal, evidence is green */}
 <div className="space-y-2">
 {newClaims.map(c => (
 <div key={c.kpiId} className="rounded-2xl border border-claim-200 bg-claim-50/60 p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-xl bg-claim-100 flex-shrink-0">
 <TrendingUp className="w-4 h-4 text-claim-700" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium text-gray-800">
 <span className="text-base font-semibold mr-1.5">{c.value}</span>
 {kpiById.get(c.kpiId)?.title || 'Impact claim'}
 </p>
 {c.label && <p className="text-xs text-gray-500 truncate">{c.label}</p>}
 {c.note && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{c.note}</p>}
 </div>
 </div>
 </div>
 ))}
   {evidence && (state.editing ? (
 <div className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 rounded-xl bg-primary-100 flex-shrink-0">
 <FileText className="w-4 h-4 text-primary-800" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium text-gray-800 truncate">{state.evidenceTitle}</p>
 <p className="text-xs text-gray-500">
 {state.files.length} file{state.files.length === 1 ? '' : 's'}
 </p>
 </div>
 </div>
 </div>
 ) : (
 // One card per type bucket — this is exactly what will be created.
       evBuckets.map(bucket => {
 const multi = evBuckets.length > 1
 const TypeIcon = EVIDENCE_TYPE_STYLE[bucket.type].icon
 return (
 <div key={bucket.type} className="rounded-2xl border border-primary-200 bg-primary-50/50 p-4">
 <div className="flex items-center gap-3">
 <div className={`p-2 rounded-xl flex-shrink-0 ${EVIDENCE_TYPE_STYLE[bucket.type].iconBox}`}>
 <TypeIcon className="w-4 h-4" />
 </div>
 <div className="min-w-0">
 <p className="text-sm font-medium text-gray-800 truncate">
 {multi ? `${state.evidenceTitle} - ${EVIDENCE_TYPE_LABELS[bucket.type]}` : state.evidenceTitle}
 </p>
 <p className="text-xs text-gray-500">
 {EVIDENCE_TYPE_LABELS[bucket.type]} · {bucket.files.length} file{bucket.files.length === 1 ? '' : 's'}
 </p>
 </div>
 </div>
 </div>
 )
 })
 ))}
 </div>

 {/* Shared scope summary */}
 <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-1">
 {scopeRow(CalendarRange, dateLabel)}
 {evidence && scopeRow(BarChart3, wizardEvidenceMetricIds(state).map(id => kpiById.get(id)?.title).filter(Boolean).join(', ') || 'Metric can be assigned later')}
 {locationNames.length > 0 && scopeRow(MapPin, locationNames.length > 2 ? `${locationNames.length} locations` : locationNames.join(', '))}
 {evidence && locationNames.length === 0 && scopeRow(MapPin, 'Location can be added later')}
 {tagNames.length > 0 && scopeRow(TagIcon, tagNames.length > 2 ? `${tagNames.length} tags` : tagNames.join(', '))}
 {groupNames.length > 0 && scopeRow(Users, groupNames.length > 2 ? `${groupNames.length} groups` : groupNames.join(', '))}
 </div>

 {/* Connect preview — connected state uses the Connections-tab gradient */}
 <div className={`rounded-2xl border p-4 ${evidence && evidenceNeedsApproval ? 'border-amber-200 bg-amber-50' : connectionCount > 0
 ? 'border-primary-300 bg-gradient-to-r from-claim-50 to-primary-50'
 : 'border-gray-200 bg-gray-50'
 }`}>
 <div className="flex items-center gap-2 mb-1">
 {evidence && evidenceNeedsApproval ? <Clock className="w-4 h-4 text-amber-600" /> : previewing && !serverFresh
 ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
 : connectionCount > 0
 ? <Link2 className="w-4 h-4 text-impact-500" />
 : <Unlink className="w-4 h-4 text-gray-500" />}
 <p className="text-sm font-semibold text-gray-800">
 {evidence && evidenceNeedsApproval && 'Evidence will connect to matching results after approval.'}
 {!evidenceNeedsApproval && kind === 'both' && (
 matchedClaims.length > 0
 ? `${newClaims.length} result${newClaims.length === 1 ? '' : 's'} and the evidence will be connected, plus ${matchedClaims.length} other matching result${matchedClaims.length === 1 ? '' : 's'}`
 : `${newClaims.length} result${newClaims.length === 1 ? '' : 's'} and the evidence will be connected to each other`
 )}
 {!evidenceNeedsApproval && kind === 'evidence' && (
 pinClaim
 ? `Will connect to this result${matchedClaims.length > 1 ? ` and ${matchedClaims.length - 1} other matching result${matchedClaims.length === 2 ? '' : 's'}` : ''}`
 : matchedClaims.length > 0
 ? `Will connect to ${matchedClaims.length} existing result${matchedClaims.length === 1 ? '' : 's'}`
 : 'Your evidence will be saved to this program'
 )}
 {kind === 'claim' && (
 matchedEvidence.length > 0
 ? `Will connect to ${matchedEvidence.length} existing evidence record${matchedEvidence.length === 1 ? '' : 's'}`
 : 'Your results will be saved. Evidence can be added later.'
 )}
 </p>
 </div>

 {kind === 'evidence' && matchedClaims.length === 0 && !pinClaim && (
 <p className="text-xs text-gray-500">
 Find it in Logs after saving. Add metrics or other details later to connect it to relevant results.
 </p>
 )}
 {kind === 'claim' && matchedEvidence.length === 0 && (
 <p className="text-xs text-gray-500">
 Matching evidence can be uploaded or connected later.
 </p>
 )}

 {(kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) > 0 && (
 <ul className="mt-2 space-y-1">
 {kind !== 'claim'
 ? matchedClaims.slice(0, 6).map(c => (
 <li key={c.id} className="text-xs text-gray-700 flex items-center gap-1.5">
 <span className="w-1 h-1 rounded-full bg-impact-500 flex-shrink-0" />
 <span className="font-semibold">{c.value}</span>
 {kpiById.get(c.kpi_id)?.title || 'Unknown metric'}
 <span className="text-gray-400">· {formatDate(c.date_represented)}</span>
 </li>
 ))
 : matchedEvidence.slice(0, 6).map(ev => (
 <li key={ev.id} className="text-xs text-gray-700 flex items-center gap-1.5">
 <span className="w-1 h-1 rounded-full bg-impact-500 flex-shrink-0" />
 {ev.title || 'Untitled Evidence'}
 <span className="text-gray-400">· {formatDate(ev.date_represented)}</span>
 </li>
 ))}
 {(kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) > 6 && (
 <li className="text-xs text-gray-500 pl-2.5">
 …and {(kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) - 6} more
 </li>
 )}
 </ul>
 )}
 </div>
 </div>
 )
}
