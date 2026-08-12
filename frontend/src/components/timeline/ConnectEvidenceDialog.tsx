import React, { useMemo, useState } from 'react'
import { Link2, AlertTriangle, CalendarRange, MapPin, Tag as TagIcon, Users, BarChart3, Search, Check, Camera, FileText, MessageSquare, DollarSign, Paperclip } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from '../ModalFrame'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import {
 BeneficiaryGroup,
 ConnectEvidenceResult,
 ConnectPlanChange,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineEvidence,
} from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import { getEvidenceImageUrl } from '../../utils/timeline'
import { EVIDENCE_TYPE_ORDER, EvidenceTypeKey, countEvidenceTypes } from './EvidenceTypeCounts'

const TYPE_ICONS = {
 visual_proof: Camera,
 documentation: FileText,
 testimony: MessageSquare,
 financials: DollarSign,
} as const

interface ConnectEvidenceDialogProps {
 claims: TimelineClaim[]
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 /** Evidence-first mode: the evidence is fixed, the user picks a claim. */
 evidence?: TimelineEvidence
 /** Claim-first mode: the claim is fixed, the user picks from these evidence records. */
 evidenceOptions?: TimelineEvidence[]
 /** Fixes the claim (used by claim-first mode and drag-drop). */
 preselectedClaimId?: string
 onClose: () => void
 onConnected: () => void
 /** Stacking override so it can sit above an already-open claim detail modal. */
 zIndexClass?: string
}

/**
 * Two-phase connect flow, usable from either side of the relationship:
 * evidence-first (pick the claim it supports) or claim-first (pick an
 * unconnected evidence record). Either way: dry-run the connect, review the
 * re-scope plan (and any links that would be pruned), then confirm. Safe
 * connects complete without the review step.
 */
export default function ConnectEvidenceDialog({
 claims,
 kpis,
 locations,
 tags,
 beneficiaryGroups,
 evidence,
 evidenceOptions,
 preselectedClaimId,
 onClose,
 onConnected,
 zIndexClass,
}: ConnectEvidenceDialogProps) {
 const claimFirst = !evidence
 const [selectedClaimId, setSelectedClaimId] = useState<string | null>(preselectedClaimId || null)
 const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(evidence?.id || null)
 const [search, setSearch] = useState('')
 const [typeFilter, setTypeFilter] = useState<EvidenceTypeKey | null>(null)
 const [dryRun, setDryRun] = useState<ConnectEvidenceResult | null>(null)
 const [error, setError] = useState<string | null>(null)
 const [submitting, setSubmitting] = useState(false)

 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])
 const locationById = useMemo(() => new Map(locations.map(l => [l.id, l.name])), [locations])
 const tagById = useMemo(() => new Map(tags.map(t => [t.id, t.name])), [tags])
 const groupById = useMemo(() => new Map(beneficiaryGroups.map(g => [g.id, g.name])), [beneficiaryGroups])

 const selectedEvidence = evidence || (evidenceOptions || []).find(ev => ev.id === selectedEvidenceId) || null
 const selectedClaim = selectedClaimId ? claims.find(c => c.id === selectedClaimId) : null
 const selectedKpiTitle = selectedClaim ? kpiById.get(selectedClaim.kpi_id)?.title || 'Unknown metric' : ''

 const candidateClaims = useMemo(() => {
 const q = search.trim().toLowerCase()
 return claims.filter(c => {
 if (!q) return true
 const kpiTitle = kpiById.get(c.kpi_id)?.title || ''
 return `${c.value} ${kpiTitle} ${c.label || ''}`.toLowerCase().includes(q)
 })
 }, [claims, search, kpiById])

 const typeCounts = useMemo(() => countEvidenceTypes(evidenceOptions || []), [evidenceOptions])

 const candidateEvidence = useMemo(() => {
 const q = search.trim().toLowerCase()
 return (evidenceOptions || []).filter(ev => {
 if (typeFilter && ev.type !== typeFilter) return false
 if (!q) return true
 return `${ev.title || ''} ${ev.description || ''}`.toLowerCase().includes(q)
 })
 }, [evidenceOptions, search, typeFilter])

 const describeChange = (change: ConnectPlanChange): { icon: typeof Link2; text: string } => {
 switch (change.kind) {
 case 'link_metric':
 return { icon: BarChart3, text: `Link this evidence to the metric "${change.kpi_title}"` }
 case 'add_location':
 return { icon: MapPin, text: `Add the location "${locationById.get(change.location_id) || 'Unknown'}" to this evidence` }
 case 'extend_dates':
 return {
 icon: CalendarRange,
 text: `Extend the evidence date range to ${formatDate(change.date_range_start)} – ${formatDate(change.date_range_end)} so it overlaps the claim`,
 }
 case 'add_tag':
 return { icon: TagIcon, text: `Tag this evidence with "${tagById.get(change.tag_id) || 'Unknown tag'}"` }
 case 'add_beneficiary_groups':
 return {
 icon: Users,
 text: `Scope this evidence to ${change.group_ids.map(id => `"${groupById.get(id) || 'Unknown group'}"`).join(', ')}`,
 }
 }
 }

 const attempt = async (confirm: boolean) => {
 if (!selectedClaimId || !selectedEvidence?.id) return
 setSubmitting(true)
 setError(null)
 try {
 const result = await apiService.connectEvidenceToClaim(selectedEvidence.id, selectedClaimId, confirm)
 if (result.connected) {
 notify.success('Evidence connected')
 onConnected()
 onClose()
 } else if (result.requires_confirmation) {
 setDryRun(result)
 } else {
 setError(result.conflict || 'Connection could not be established')
 }
 } catch (err: any) {
 setError(err?.message || 'Failed to connect evidence')
 } finally {
 setSubmitting(false)
 }
 }

 const headerSubtitle = claimFirst
 ? `${selectedClaim?.value ?? ''} ${selectedKpiTitle}`.trim() || 'Choose evidence to connect'
 : (evidence?.title || 'Untitled Evidence')

 const canAttempt = !!selectedClaimId && !!selectedEvidence

 return (
 <ModalFrame
 size="md"
 zIndexClass={zIndexClass}
 paddingClassName="p-0 md:p-4"
 panelClassName="bg-white w-full h-full max-h-[100dvh] overflow-hidden flex flex-col rounded-none border-0 shadow-none md:rounded-xl md:border md:border-gray-200 md:shadow-app-modal md:h-auto md:max-h-[90vh] md:max-w-2xl"
 >
 <ModalHeader
 icon={Link2}
 title={claimFirst ? 'Connect existing evidence' : 'Connect evidence to a claim'}
 subtitle={headerSubtitle}
 onClose={onClose}
 />
 <ModalBody>
 {!dryRun ? (
 <div className="space-y-3">
 <p className="text-sm text-gray-600">
 {claimFirst
 ? 'Pick an unconnected evidence record to attach to this claim. Its scope will be aligned so the connection holds.'
 : 'Choose the impact claim this evidence supports. The evidence\'s scope (metric, location, dates, tags, groups) will be aligned so the connection holds.'}
 </p>

 <div className="relative">
 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder={claimFirst ? 'Search evidence...' : 'Search claims...'}
 className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 {/* Filter by evidence type */}
 {claimFirst && (evidenceOptions?.length ?? 0) > 0 && (
 <div className="flex flex-wrap items-center gap-1.5">
 <button
 type="button"
 onClick={() => setTypeFilter(null)}
 className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${typeFilter === null
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
 }`}
 >
 All
 </button>
 {EVIDENCE_TYPE_ORDER.map(type => {
 const count = typeCounts[type]
 if (count === 0) return null
 const Icon = TYPE_ICONS[type] || FileText
 const active = typeFilter === type
 return (
 <button
 key={type}
 type="button"
 onClick={() => setTypeFilter(active ? null : type)}
 className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${active
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
 }`}
 title={getEvidenceTypeInfo(type).label}
 >
 <Icon className="w-3.5 h-3.5" />
 {count}
 </button>
 )
 })}
 </div>
 )}

 <div className={claimFirst
 ? 'max-h-[55vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-1.5 pr-1'
 : 'max-h-[55vh] overflow-y-auto space-y-1.5 pr-1'}>
 {claimFirst ? (
 candidateEvidence.length === 0 ? (
 <p className="text-xs text-gray-500 px-1 py-4 text-center sm:col-span-2">
 {evidenceOptions && evidenceOptions.length > 0
 ? 'No evidence matches your search'
 : 'No unconnected evidence available — everything is already connected'}
 </p>
 ) : candidateEvidence.map(ev => {
 const typeInfo = getEvidenceTypeInfo(ev.type)
 const TypeIcon = TYPE_ICONS[ev.type] || FileText
 const iconBg = typeInfo.color.split(' ')[0]
 const thumbnailUrl = getEvidenceImageUrl(ev)
 const fileCount = ev.files?.length || (ev.file_url ? 1 : 0)
 const isSelected = selectedEvidenceId === ev.id
 return (
 <button
 key={ev.id}
 onClick={() => setSelectedEvidenceId(ev.id!)}
 className={`w-full flex items-center gap-2.5 text-left p-2 rounded-lg border transition-colors ${isSelected
 ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
 : 'border-gray-100 bg-white hover:bg-gray-50'
 }`}
 >
 {/* Preview: image thumbnail, or the evidence-type tile */}
 {thumbnailUrl ? (
 <img
 src={thumbnailUrl}
 alt=""
 className="w-9 h-9 rounded-md object-cover bg-gray-100 flex-shrink-0"
 loading="lazy"
 />
 ) : (
 <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${iconBg}`}>
 <TypeIcon className="w-4 h-4" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
 <p className="text-[11px] text-gray-500 truncate mt-0.5 inline-flex items-center gap-1">
 <span className="truncate">{typeInfo.label} · {formatDate(ev.date_represented)}</span>
 {fileCount > 0 && (
 <span className="inline-flex items-center gap-0.5 flex-shrink-0">
 <Paperclip className="w-3 h-3" />
 {fileCount}
 </span>
 )}
 </p>
 </div>
 <span className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-primary-500 border-primary-500' : 'border-gray-300 bg-white'}`}>
 {isSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
 </span>
 </button>
 )
 })
 ) : (
 candidateClaims.length === 0 ? (
 <p className="text-xs text-gray-500 px-1 py-4 text-center">No claims match your search</p>
 ) : candidateClaims.map(c => {
 const kpiTitle = kpiById.get(c.kpi_id)?.title || 'Unknown metric'
 const locationName = c.location_id ? locationById.get(c.location_id) : undefined
 const isSelected = selectedClaimId === c.id
 return (
 <button
 key={c.id}
 onClick={() => setSelectedClaimId(c.id!)}
 className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${isSelected
 ? 'border-primary-500 bg-primary-50'
 : 'border-gray-100 bg-white hover:bg-gray-50'
 }`}
 >
 <p className="text-sm text-gray-800">
 <span className="font-semibold mr-1.5">{c.value}</span>
 {kpiTitle}
 </p>
 <p className="text-xs text-gray-500 mt-0.5">
 {[locationName, formatDate(c.date_represented)].filter(Boolean).join(' · ')}
 </p>
 </button>
 )
 })
 )}
 </div>

 {error && (
 <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
 <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-red-600">{error}</p>
 </div>
 )}
 </div>
 ) : (
 <div className="space-y-3">
 <p className="text-sm text-gray-600">
 Connecting <span className="font-medium text-gray-800">{selectedEvidence?.title || 'this evidence'}</span> to{' '}
 <span className="font-medium text-gray-800">{selectedClaim?.value} {selectedKpiTitle}</span> requires
 re-scoping the evidence:
 </p>

 <div className="space-y-1.5">
 {dryRun.changes.map((change, i) => {
 const { icon: Icon, text } = describeChange(change)
 return (
 <div key={i} className="flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
 <Icon className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-gray-700">{text}</p>
 </div>
 )
 })}
 </div>

 {dryRun.will_disconnect.length > 0 && (
 <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 space-y-1">
 <div className="flex items-center gap-2">
 <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
 <p className="text-xs font-medium text-amber-700">
 This will disconnect the evidence from {dryRun.will_disconnect.length} other claim{dryRun.will_disconnect.length === 1 ? '' : 's'}:
 </p>
 </div>
 <ul className="text-xs text-amber-700 list-disc pl-9">
 {dryRun.will_disconnect.map(item => (
 <li key={item.kpi_update_id}>{item.value} {item.kpi_title}</li>
 ))}
 </ul>
 </div>
 )}

 {error && (
 <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2.5">
 <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-red-600">{error}</p>
 </div>
 )}
 </div>
 )}
 </ModalBody>
 <ModalFooter>
 <button onClick={onClose} className="app-btn app-btn-secondary app-btn-sm" disabled={submitting}>
 Cancel
 </button>
 {!dryRun ? (
 <button
 onClick={() => attempt(false)}
 className="app-btn app-btn-primary app-btn-sm"
 disabled={!canAttempt || submitting}
 >
 {submitting ? 'Connecting…' : 'Connect'}
 </button>
 ) : (
 <button
 onClick={() => attempt(true)}
 className="app-btn app-btn-primary app-btn-sm"
 disabled={submitting}
 >
 {submitting ? 'Connecting…' : 'Confirm & connect'}
 </button>
 )}
 </ModalFooter>
 </ModalFrame>
 )
}
