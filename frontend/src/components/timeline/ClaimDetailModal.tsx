import React, { useMemo, useState } from 'react'
import { Camera, FileText, MessageSquare, DollarSign, Paperclip, Link2, Unlink, Pencil, Trash2, X } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalFieldGrid, ModalField } from '../ModalFrame'
import { Badge } from '../ui'
import { getStatusStyle } from './statusStyles'
import {
 BeneficiaryGroup,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineContributor,
 TimelineEvidence,
} from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import { getEvidenceImageUrl } from '../../utils/timeline'
import { EVIDENCE_TYPE_ORDER, EvidenceTypeKey, countEvidenceTypes, EVIDENCE_TYPE_STYLE } from './EvidenceTypeCounts'

const TYPE_ICONS = {
 visual_proof: Camera,
 documentation: FileText,
 testimony: MessageSquare,
 financials: DollarSign,
} as const

interface ClaimDetailModalProps {
 claim: TimelineClaim
 kpi: KPI | undefined
 evidence: TimelineEvidence[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 contributors: Record<string, TimelineContributor>
 onClose: () => void
 onOpenEvidence: (evidence: TimelineEvidence) => void
 /** Edit this claim (value, label, date, location, tag, groups). */
 onEdit?: () => void
 /** Quick-upload new evidence scoped to this claim. */
 onAddEvidence?: () => void
 /** Attach an existing unconnected evidence record. */
 onConnectExisting?: () => void
 /** Delete this impact claim. */
 onDelete?: () => void
}

/**
 * Simplified claim detail: the result and its key markers up top, then
 * every piece of connected evidence as preview cards with a type filter.
 */
export default function ClaimDetailModal({
 claim,
 kpi,
 evidence,
 locations,
 tags,
 beneficiaryGroups,
 contributors,
 onClose,
 onOpenEvidence,
 onEdit,
 onAddEvidence,
 onConnectExisting,
 onDelete,
}: ClaimDetailModalProps) {
 const [typeFilter, setTypeFilter] = useState<EvidenceTypeKey | null>(null)
 const status = getStatusStyle(evidence.length > 0 ? 'connected' : 'not_connected')
 const StatusIcon = status.icon

 const locationName = claim.location_id
 ? locations.find(l => l.id === claim.location_id)?.name || '—'
 : '—'
 const tagName = claim.tag_id ? tags.find(t => t.id === claim.tag_id)?.name : undefined
 const groupNames = (claim.beneficiary_group_ids || [])
 .map(id => beneficiaryGroups.find(g => g.id === id)?.name)
 .filter(Boolean) as string[]
 const contributor = claim.user_id ? contributors[claim.user_id] : undefined
 const activityDate = claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented)

 const typeCounts = useMemo(() => countEvidenceTypes(evidence), [evidence])
 const visibleEvidence = typeFilter ? evidence.filter(ev => ev.type === typeFilter) : evidence
 const isPct = kpi?.metric_type === 'percentage'

 return (
 <ModalFrame
 size="md"
 panelClassName="bg-white rounded-xl border-2 border-claim-300 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-app-modal flex flex-col"
 >
 {/* Claim-branded header */}
 <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-claim-50 via-claim-50 to-claim-100/90 border-b border-claim-200">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-claim-700 mb-1.5">
 Impact Claim
 </p>
 <div className="flex items-baseline gap-2 flex-wrap">
 <span className="text-2xl font-bold text-claim-700 tabular-nums leading-none">
 {claim.value}{isPct ? '%' : ''}
 </span>
 {!isPct && kpi?.unit_of_measurement && (
 <span className="text-sm font-semibold text-claim-600 leading-none">
 {kpi.unit_of_measurement}
 </span>
 )}
 </div>
 </div>
 <button
 type="button"
 onClick={onClose}
 aria-label="Close"
 className="app-btn-icon flex-shrink-0 rounded-lg text-claim-700/70 hover:bg-claim-100 hover:text-claim-800 transition-colors flex items-center justify-center"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>
 <ModalBody>
 <div className="space-y-5">
 {/* Key properties */}
 <ModalFieldGrid>
 <ModalField label="Metric">{kpi?.title || '—'}</ModalField>
 {claim.label && <ModalField label="Title">{claim.label}</ModalField>}
 <ModalField label="When">{activityDate}</ModalField>
 <ModalField label="Where">{locationName}</ModalField>
 <ModalField label="Recorded by">{contributor?.name || contributor?.email || '—'}</ModalField>
 <ModalField label="Status">
 <Badge tone={status.tone}>
 <StatusIcon className="w-3.5 h-3.5" />
 {evidence.length > 0 ? 'Connected' : 'Missing evidence'}
 </Badge>
 </ModalField>
 {tagName && <ModalField label="Tag">{tagName}</ModalField>}
 {groupNames.length > 0 && <ModalField label="Beneficiary groups">{groupNames.join(', ')}</ModalField>}
 {claim.note && <ModalField label="Note" className="col-span-2">{claim.note}</ModalField>}
 </ModalFieldGrid>

 {/* Evidence */}
 <div>
 <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
 <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
 Evidence ({evidence.length})
 </p>
 {evidence.length > 0 && (
 <div className="flex items-center gap-1.5">
 <button
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
 const Icon = TYPE_ICONS[type]
 const active = typeFilter === type
 return (
 <button
 key={type}
 onClick={() => setTypeFilter(active ? null : type)}
 className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${active
 ? EVIDENCE_TYPE_STYLE[type].chip
 : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
 }`}
 title={getEvidenceTypeInfo(type).label}
 >
 <Icon className={`w-3.5 h-3.5 ${active ? '' : EVIDENCE_TYPE_STYLE[type].text}`} />
 {count}
 </button>
 )
 })}
 </div>
 )}
 </div>

 {evidence.length === 0 ? (
 <div className="flex items-center gap-2 rounded-xl border border-dashed border-red-200 bg-red-50/40 px-4 py-3">
 <Unlink className="w-4 h-4 text-red-500 flex-shrink-0" />
 <p className="text-xs text-red-600">No evidence connected to this claim yet.</p>
 </div>
 ) : (
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
 {visibleEvidence.map(ev => {
 const typeInfo = getEvidenceTypeInfo(ev.type)
 const Icon = TYPE_ICONS[ev.type] || FileText
 const thumbnailUrl = getEvidenceImageUrl(ev)
 return (
 <button
 key={ev.id}
 onClick={() => onOpenEvidence(ev)}
 className="text-left rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-colors overflow-hidden"
 >
 {thumbnailUrl ? (
 <img src={thumbnailUrl} alt="" className="w-full h-24 object-cover bg-gray-100" loading="lazy" />
 ) : (
 <div className={`w-full h-24 flex items-center justify-center ${typeInfo.color}`}>
 <Icon className="w-6 h-6 opacity-60" />
 </div>
 )}
 <div className="p-2.5">
 <p className="text-xs font-medium text-gray-800 truncate">{ev.title || 'Untitled Evidence'}</p>
 <p className="text-[11px] text-gray-500 truncate mt-0.5">
 {typeInfo.label} · {formatDate(ev.date_represented)}
 </p>
 </div>
 </button>
 )
 })}
 </div>
 )}
 </div>
 </div>
 </ModalBody>
 {(onEdit || onAddEvidence || onConnectExisting || onDelete) && (
 <ModalFooter>
 {onEdit && (
 <button onClick={onEdit} className="app-btn app-btn-ghost app-btn-sm">
 <Pencil className="w-4 h-4" />
 Edit claim
 </button>
 )}
 {onDelete && (
 <button onClick={onDelete} className="app-btn app-btn-ghost app-btn-sm text-red-600 hover:bg-red-50">
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 )}
 <div className="flex-1" />
 {onConnectExisting && (
 <button onClick={onConnectExisting} className="app-btn app-btn-secondary app-btn-sm">
 <Link2 className="w-4 h-4" />
 Connect existing evidence
 </button>
 )}
 {onAddEvidence && (
 <button onClick={onAddEvidence} className="app-btn app-btn-primary app-btn-sm">
 <Paperclip className="w-4 h-4" />
 Add evidence
 </button>
 )}
 </ModalFooter>
 )}
 </ModalFrame>
 )
}
