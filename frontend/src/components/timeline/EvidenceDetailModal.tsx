import React, { useMemo, useState } from 'react'
import { Camera, FileText, MessageSquare, DollarSign, ExternalLink, Edit, Trash2 } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter, ModalFieldGrid, ModalField } from '../ModalFrame'
import { Badge } from '../ui'
import { ImpactClaimBadge } from './ImpactClaimGlyph'
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

const TYPE_ICONS = {
 visual_proof: Camera,
 documentation: FileText,
 testimony: MessageSquare,
 financials: DollarSign,
} as const

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
 onClose,
 onOpenClaim,
 onEdit,
 onDelete,
}: EvidenceDetailModalProps) {
 const typeInfo = getEvidenceTypeInfo(evidence.type)
 const TypeIcon = TYPE_ICONS[evidence.type] || FileText
 const kpiById = useMemo(() => new Map(kpis.map(k => [k.id, k])), [kpis])

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
 <ModalFrame size="md">
 <ModalHeader
 icon={TypeIcon}
 title={evidence.title || 'Untitled Evidence'}
 subtitle={typeInfo.label}
 onClose={onClose}
 />
 <ModalBody>
 <div className="space-y-5">
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
 <ModalField label="When">{activityDate}</ModalField>
 <ModalField label="Where">{locationNames.length > 0 ? locationNames.join(', ') : '—'}</ModalField>
 <ModalField label="Uploaded by">{contributor?.name || contributor?.email || '—'}</ModalField>
 <ModalField label="Status">
 <Badge tone={connectedClaims.length > 0 ? 'impact' : 'danger'}>
 {connectedClaims.length > 0 ? 'Connected' : 'Not connected'}
 </Badge>
 </ModalField>
 {tagNames.length > 0 && <ModalField label="Tags">{tagNames.join(', ')}</ModalField>}
 {groupNames.length > 0 && <ModalField label="Beneficiary groups">{groupNames.join(', ')}</ModalField>}
 </ModalFieldGrid>

 {/* Supported claims */}
 <div>
 <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
 Supports {connectedClaims.length} claim{connectedClaims.length === 1 ? '' : 's'}
 </p>
 {connectedClaims.length === 0 ? (
 <p className="text-xs text-gray-400">
 Not connected to any claim yet — connect it from the Timeline's Connections view.
 </p>
 ) : (
 <div className="space-y-1.5">
 {connectedClaims.map(claim => (
 <button
 key={claim.id}
 onClick={() => onOpenClaim(claim)}
 className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 transition-colors text-left"
 >
 <ImpactClaimBadge className="w-7 h-7" textClassName="text-[10px]" />
 <span className="text-xs text-gray-800 truncate">
 <span className="font-semibold mr-1">{claim.value}</span>
 {kpiById.get(claim.kpi_id)?.title || 'Unknown metric'}
 </span>
 <span className="text-[11px] text-gray-400 ml-auto flex-shrink-0">{formatDate(claim.date_represented)}</span>
 </button>
 ))}
 </div>
 )}
 </div>
 </div>
 </ModalBody>
 {(onEdit || onDelete) && (
 <ModalFooter>
 {onDelete && (
 <button onClick={onDelete} className="app-btn app-btn-ghost app-btn-sm text-red-600 hover:bg-red-50">
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 )}
 <div className="flex-1" />
 {onEdit && (
 <button onClick={onEdit} className="app-btn app-btn-secondary app-btn-sm">
 <Edit className="w-4 h-4" />
 Edit
 </button>
 )}
 </ModalFooter>
 )}
 </ModalFrame>
 )
}
