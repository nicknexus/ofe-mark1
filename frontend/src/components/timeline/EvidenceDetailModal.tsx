import React, { useMemo, useState } from 'react'
import { FileText, ExternalLink, Edit, Trash2, Clock, Check, X } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalFieldGrid, ModalField } from '../ModalFrame'
import { Badge } from '../ui'
import { EvidenceTypeLabel } from './EvidenceTypeCounts'
import {
 BeneficiaryGroup,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineContributor,
 TimelineEvidence,
} from '../../types'
import { formatDate } from '../../utils'
import { previewMatchingClaims } from '../../utils/timeline'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']
const isImageFile = (f: { file_url?: string; file_name?: string; file_type?: string }) => {
 if ((f.file_type || '').toLowerCase().startsWith('image/')) return true
 const ext = (s?: string) => {
 if (!s) return ''
 const path = s.split('?')[0]
 const dot = path.lastIndexOf('.')
 return dot >= 0 ? path.slice(dot + 1).toLowerCase() : ''
 }
 return IMAGE_EXTENSIONS.includes(ext(f.file_name)) || IMAGE_EXTENSIONS.includes(ext(f.file_url))
}

interface EvidenceDetailModalProps {
 evidence: TimelineEvidence
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 contributors: Record<string, TimelineContributor>
 connectedClaims: TimelineClaim[]
 /** Every claim in the initiative — used to preview what pending evidence would connect to. */
 allClaims?: TimelineClaim[]
 /** Owner/admin: shows Approve / Reject on pending evidence and Mark-as-pending on approved. */
 canReview?: boolean
 /** Approve pending evidence, or flip approved evidence back to pending. */
 onSetApproval?: (status: 'approved' | 'pending') => void
 onClose: () => void
 onOpenClaim: (claim: TimelineClaim) => void
 onEdit?: () => void
 onDelete?: () => void
}

/**
 * Simplified evidence detail: a real preview up top, then only the markers
 * that matter — type, when, where, who, tags/groups — and the claims this
 * evidence supports.
 */
export default function EvidenceDetailModal({
 evidence,
 kpis,
 locations,
 tags,
 beneficiaryGroups,
 contributors,
 connectedClaims,
 allClaims,
 canReview,
 onSetApproval,
 onClose,
 onOpenClaim,
 onEdit,
 onDelete,
}: EvidenceDetailModalProps) {
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])
 const isPending = evidence.approval_status === 'pending'

 // What the auto-matcher will connect on approval (client-side mirror of the
 // server gates — same preview the upload wizard shows).
 const willConnectClaims = useMemo(() => {
 if (!isPending || !allClaims?.length) return []
 return previewMatchingClaims(allClaims, {
 kpiIds: evidence.kpi_ids || [],
 locationIds: evidence.location_ids || (evidence.location_id ? [evidence.location_id] : []),
 tagIds: evidence.tag_ids || [],
 beneficiaryGroupIds: evidence.beneficiary_group_ids || [],
 dateStart: evidence.date_range_start || evidence.date_represented || '',
 dateEnd: evidence.date_range_end || evidence.date_range_start || evidence.date_represented || '',
 })
 }, [isPending, allClaims, evidence])

 const allFiles = useMemo(() => {
 const files: Array<{ file_url: string; file_name?: string; file_type?: string }> = []
 if (evidence.file_url) files.push({ file_url: evidence.file_url, file_type: evidence.file_type })
 for (const f of evidence.files || []) {
 if (f.file_url && !files.some(existing => existing.file_url === f.file_url)) files.push(f)
 }
 return files
 }, [evidence])
 const imageFiles = allFiles.filter(isImageFile)
 const otherFiles = allFiles.filter(f => !isImageFile(f))
 const [activeImage, setActiveImage] = useState(0)

 const locationNames = (evidence.location_ids || (evidence.location_id ? [evidence.location_id] : []))
 .map(id => locations.find(l => l.id === id)?.name)
 .filter(Boolean) as string[]
 const tagNames = (evidence.tag_ids || []).map(id => tags.find(t => t.id === id)?.name).filter(Boolean) as string[]
 const groupNames = (evidence.beneficiary_group_ids || [])
 .map(id => beneficiaryGroups.find(g => g.id === id)?.name)
 .filter(Boolean) as string[]
 const contributor = evidence.user_id ? contributors[evidence.user_id] : undefined
 const activityDate = evidence.date_range_start && evidence.date_range_end
 ? `${formatDate(evidence.date_range_start)} – ${formatDate(evidence.date_range_end)}`
 : formatDate(evidence.date_represented)

 return (
 <ModalFrame
 size="md"
 panelClassName="bg-white rounded-xl border-2 border-primary-300 w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-app-modal flex flex-col"
 >
 {/* Evidence-branded header */}
 <div className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-primary-50 via-primary-50 to-primary-100/90 border-b border-primary-200">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-primary-800 mb-1.5">
 Evidence
 </p>
 <p className="text-xl font-bold text-primary-900 leading-snug truncate">
 {evidence.title || 'Untitled Evidence'}
 </p>
 </div>
 <button
 type="button"
 onClick={onClose}
 aria-label="Close"
 className="app-btn-icon flex-shrink-0 rounded-lg text-primary-800/70 hover:bg-primary-100 hover:text-primary-900 transition-colors flex items-center justify-center"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>
 <ModalBody>
 <div className="space-y-5">
 {/* Review gate banner */}
 {isPending && (
 <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3">
 <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
 <div className="min-w-0">
 <p className="text-sm font-semibold text-amber-800">Awaiting admin approval</p>
 <p className="text-xs text-amber-700 mt-0.5">
 This evidence is saved but doesn't connect to claims or count in any totals until an admin approves it.
 </p>
 </div>
 </div>
 )}

 {/* Preview */}
 {imageFiles.length > 0 && (
 <div>
 <img
 src={imageFiles[Math.min(activeImage, imageFiles.length - 1)].file_url}
 alt={evidence.title || ''}
 className="w-full max-h-80 object-contain rounded-2xl bg-gray-50 border border-gray-100"
 />
 {imageFiles.length > 1 && (
 <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
 {imageFiles.map((file, i) => (
 <button
 key={file.file_url}
 onClick={() => setActiveImage(i)}
 className={`w-14 h-14 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-colors ${i === activeImage ? 'border-primary-500' : 'border-transparent hover:border-gray-200'}`}
 >
 <img src={file.file_url} alt="" className="w-full h-full object-cover" loading="lazy" />
 </button>
 ))}
 </div>
 )}
 </div>
 )}

 {/* Non-image files */}
 {otherFiles.length > 0 && (
 <div className="space-y-1.5">
 {otherFiles.map(file => (
 <a
 key={file.file_url}
 href={file.file_url}
 target="_blank"
 rel="noreferrer"
 className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors"
 >
 <div className="p-1.5 rounded-lg bg-gray-100 flex-shrink-0">
 <FileText className="w-3.5 h-3.5 text-gray-500" />
 </div>
 <span className="text-xs font-medium text-gray-800 truncate flex-1">
 {file.file_name || file.file_url.split('/').pop()?.split('?')[0] || 'File'}
 </span>
 <ExternalLink className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
 </a>
 ))}
 </div>
 )}

 {evidence.description && (
 <p className="text-sm text-gray-600 leading-relaxed">{evidence.description}</p>
 )}

 {/* Key properties */}
 <ModalFieldGrid>
 <ModalField label="Type">
 <EvidenceTypeLabel type={evidence.type} className="text-sm text-gray-700" />
 </ModalField>
 <ModalField label="When">{activityDate}</ModalField>
 <ModalField label="Where">{locationNames.length > 0 ? locationNames.join(', ') : '—'}</ModalField>
 <ModalField label="Uploaded by">{contributor?.name || contributor?.email || '—'}</ModalField>
 <ModalField label="Status">
 <Badge tone={isPending ? 'warning' : connectedClaims.length > 0 ? 'impact' : 'danger'}>
 {isPending ? 'Needs approval' : connectedClaims.length > 0 ? 'Connected' : 'Not connected'}
 </Badge>
 </ModalField>
 {tagNames.length > 0 && <ModalField label="Tags">{tagNames.join(', ')}</ModalField>}
 {groupNames.length > 0 && <ModalField label="Beneficiary groups">{groupNames.join(', ')}</ModalField>}
 </ModalFieldGrid>

 {/* Supported claims — for pending evidence this becomes the
 "will connect to" preview so reviewers see the blast radius */}
 {isPending ? (
 <div>
 <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
 Will connect to {willConnectClaims.length} claim{willConnectClaims.length === 1 ? '' : 's'} on approval
 </p>
 {willConnectClaims.length === 0 ? (
 <p className="text-xs text-gray-400">
 No existing claims match this evidence's scope — it will start unconnected and link automatically when a matching claim is added.
 </p>
 ) : (
 <div className="space-y-1.5">
 {willConnectClaims.slice(0, 8).map(claim => {
 const kpi = kpiById.get(claim.kpi_id)
 const isPct = kpi?.metric_type === 'percentage'
 return (
 <div
 key={claim.id}
 className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-claim-200 bg-claim-50/60 text-left"
 >
 <span className="text-lg font-bold text-claim-700 tabular-nums leading-none flex-shrink-0">
 {claim.value}{isPct ? '%' : ''}
 </span>
 <span className="text-xs text-gray-700 truncate min-w-0">
 {kpi?.title || 'Unknown metric'}
 </span>
 <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatDate(claim.date_represented)}</span>
 </div>
 )
 })}
 {willConnectClaims.length > 8 && (
 <p className="text-xs text-gray-400 pl-1">…and {willConnectClaims.length - 8} more</p>
 )}
 </div>
 )}
 </div>
 ) : (
 <div>
 <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
 Supports {connectedClaims.length} claim{connectedClaims.length === 1 ? '' : 's'}
 </p>
 {connectedClaims.length === 0 ? (
 <p className="text-xs text-gray-400">
 Not connected to any claim yet — connect it from the Logs tab's Connections view.
 </p>
 ) : (
 <div className="space-y-1.5">
 {connectedClaims.map(claim => {
 const kpi = kpiById.get(claim.kpi_id)
 const isPct = kpi?.metric_type === 'percentage'
 return (
 <button
 key={claim.id}
 onClick={() => onOpenClaim(claim)}
 className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-claim-200 bg-claim-50/50 hover:bg-claim-50 transition-colors text-left"
 >
 <span className="text-lg font-bold text-claim-700 tabular-nums leading-none flex-shrink-0">
 {claim.value}{isPct ? '%' : ''}
 </span>
 <span className="text-xs text-gray-700 truncate min-w-0">
 {kpi?.title || 'Unknown metric'}
 </span>
 <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatDate(claim.date_represented)}</span>
 </button>
 )
 })}
 </div>
 )}
 </div>
 )}
 </div>
 </ModalBody>
 {(onEdit || onDelete || (canReview && onSetApproval)) && (
 <ModalFooter>
 {isPending && canReview && onSetApproval ? (
 <>
 {onDelete && (
 <button onClick={onDelete} className="app-btn app-btn-ghost app-btn-sm text-red-600 hover:bg-red-50">
 <Trash2 className="w-4 h-4" />
 Reject &amp; delete
 </button>
 )}
 <div className="flex-1" />
 {onEdit && (
 <button onClick={onEdit} className="app-btn app-btn-secondary app-btn-sm">
 <Edit className="w-4 h-4" />
 Edit
 </button>
 )}
 <button onClick={() => onSetApproval('approved')} className="app-btn app-btn-primary app-btn-sm">
 <Check className="w-4 h-4" />
 Approve
 </button>
 </>
 ) : (
 <>
 {onDelete && (
 <button onClick={onDelete} className="app-btn app-btn-ghost app-btn-sm text-red-600 hover:bg-red-50">
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 )}
 {!isPending && canReview && onSetApproval && (
 <button
 onClick={() => onSetApproval('pending')}
 className="app-btn app-btn-ghost app-btn-sm text-amber-700 hover:bg-amber-50"
 title="Send back to the approval queue — disconnects it and removes it from all totals until re-approved"
 >
 <Clock className="w-4 h-4" />
 Mark as pending
 </button>
 )}
 <div className="flex-1" />
 {onEdit && (
 <button onClick={onEdit} className="app-btn app-btn-secondary app-btn-sm">
 <Edit className="w-4 h-4" />
 Edit
 </button>
 )}
 </>
 )}
 </ModalFooter>
 )}
 </ModalFrame>
 )
}
