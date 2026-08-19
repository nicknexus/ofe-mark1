import React, { useMemo } from 'react'
import { Link2, Unlink, TrendingUp, FileText, MapPin, CalendarRange, Tag as TagIcon, Users } from 'lucide-react'
import { BeneficiaryGroup, KPI, Location, MetricTag, TimelineClaim, TimelineEvidence } from '../../types'
import { formatDate } from '../../utils'
import { previewMatchingClaims, previewMatchingEvidence } from '../../utils/timeline'
import { WizardState, filledClaimEntries, includesClaim, includesEvidence, wizardDates, evidenceBuckets, EVIDENCE_TYPE_LABELS } from './wizardTypes'
import { EVIDENCE_TYPE_STYLE } from '../timeline/EvidenceTypeCounts'

interface WizardReviewStepProps {
 state: WizardState
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 existingClaims: TimelineClaim[]
 existingEvidence: TimelineEvidence[]
}

/**
 * Step 4 — review before saving, with a live preview of what the
 * auto-matcher will connect. The preview mirrors the server's gates
 * client-side, so a broad upload shows its blast radius ("connects to 23
 * claims") and a mis-scoped one shows zero *before* anything is saved.
 */
export default function WizardReviewStep({
 state,
 kpis,
 locations,
 tags,
 beneficiaryGroups,
 existingClaims,
 existingEvidence,
}: WizardReviewStepProps) {
 const claim = includesClaim(state.kind)
 const evidence = includesEvidence(state.kind)
 const evBuckets = evidence && !state.editing ? evidenceBuckets(state.files) : []
 const { start, end } = wizardDates(state)
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])

 // Claims to be created: per-metric entries in the "both" flow, or the
 // single claim-only record, normalised to one shape for rendering.
 const newClaims = state.kind === 'both'
 ? filledClaimEntries(state, kpis).map(([kpiId, entry]) => ({ kpiId, value: entry.value, label: entry.label, note: entry.note }))
 : claim && state.claimKpiId
 ? [{ kpiId: state.claimKpiId, value: state.claimValue, label: state.claimLabel, note: state.claimNote }]
 : []

 const dateLabel = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`
 const locationNames = state.locationIds
 .map(id => locations.find(l => l.id === id)?.name)
 .filter(Boolean) as string[]
 const tagNames = state.tagIds.map(id => tags.find(t => t.id === id)?.name).filter(Boolean) as string[]
 const groupNames = state.beneficiaryGroupIds
 .map(id => beneficiaryGroups.find(g => g.id === id)?.name)
 .filter(Boolean) as string[]

 // What will the auto-matcher connect?
 const matchedClaims = useMemo(() => {
 if (!evidence) return []
 const kpiIds = state.kind === 'both'
 ? filledClaimEntries(state, kpis).map(([kpiId]) => kpiId)
 : state.evidenceKpiIds
 return previewMatchingClaims(existingClaims, {
 kpiIds,
 locationIds: state.locationIds,
 tagIds: state.tagIds,
 beneficiaryGroupIds: state.beneficiaryGroupIds,
 dateStart: start,
 dateEnd: end,
 })
 }, [evidence, state, existingClaims, start, end])

 const matchedEvidence = useMemo(() => {
 if (state.kind !== 'claim' || !state.claimKpiId || state.locationIds.length === 0) return []
 return previewMatchingEvidence(existingEvidence, {
 kpiId: state.claimKpiId,
 locationId: state.locationIds[0],
 tagId: state.tagIds[0] || null,
 beneficiaryGroupIds: state.beneficiaryGroupIds,
 dateStart: start,
 dateEnd: end,
 })
 }, [state, existingEvidence, start, end])

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
 + (state.kind === 'both' ? newClaims.length : 0)

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
 {multi ? `${state.evidenceTitle} — ${EVIDENCE_TYPE_LABELS[bucket.type]}` : state.evidenceTitle}
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
 {locationNames.length > 0 && scopeRow(MapPin, locationNames.length > 2 ? `${locationNames.length} locations` : locationNames.join(', '))}
 {tagNames.length > 0 && scopeRow(TagIcon, tagNames.length > 2 ? `${tagNames.length} tags` : tagNames.join(', '))}
 {groupNames.length > 0 && scopeRow(Users, groupNames.length > 2 ? `${groupNames.length} groups` : groupNames.join(', '))}
 </div>

 {/* Connect preview — connected state uses the Connections-tab gradient */}
 <div className={`rounded-2xl border p-4 ${connectionCount > 0
 ? 'border-primary-300 bg-gradient-to-r from-claim-50 to-primary-50'
 : 'border-amber-200 bg-amber-50/50'
 }`}>
 <div className="flex items-center gap-2 mb-1">
 {connectionCount > 0
 ? <Link2 className="w-4 h-4 text-impact-500" />
 : <Unlink className="w-4 h-4 text-amber-600" />}
 <p className="text-sm font-semibold text-gray-800">
 {state.kind === 'both' && (
 matchedClaims.length > 0
 ? `${newClaims.length} claim${newClaims.length === 1 ? '' : 's'} and the evidence will be connected, plus ${matchedClaims.length} other matching claim${matchedClaims.length === 1 ? '' : 's'}`
 : `${newClaims.length} claim${newClaims.length === 1 ? '' : 's'} and the evidence will be connected to each other`
 )}
 {state.kind === 'evidence' && (
 matchedClaims.length > 0
 ? `Will connect to ${matchedClaims.length} existing claim${matchedClaims.length === 1 ? '' : 's'}`
 : 'No existing claims match this scope'
 )}
 {state.kind === 'claim' && (
 matchedEvidence.length > 0
 ? `Will connect to ${matchedEvidence.length} existing evidence record${matchedEvidence.length === 1 ? '' : 's'}`
 : 'No existing evidence matches this scope'
 )}
 </p>
 </div>

 {state.kind === 'evidence' && matchedClaims.length === 0 && (
 <p className="text-xs text-amber-700">
 It will appear as unconnected evidence in your Logs — you can connect it manually there, or it
 will link automatically when a matching claim is added.
 </p>
 )}
 {state.kind === 'claim' && matchedEvidence.length === 0 && (
 <p className="text-xs text-amber-700">
 The claim will show as missing evidence until matching evidence is uploaded.
 </p>
 )}

 {(state.kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) > 0 && (
 <ul className="mt-2 space-y-1">
 {state.kind !== 'claim'
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
 {(state.kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) > 6 && (
 <li className="text-xs text-gray-500 pl-2.5">
 …and {(state.kind !== 'claim' ? matchedClaims.length : matchedEvidence.length) - 6} more
 </li>
 )}
 </ul>
 )}
 </div>
 </div>
 )
}
