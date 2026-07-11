import React, { useMemo, useState } from 'react'
import { Camera, FileText, MessageSquare, DollarSign, Link2, Paperclip } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from '../ModalFrame'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { BeneficiaryGroup, CreateEvidenceForm, Evidence, KPI, Location, MetricTag, TimelineClaim } from '../../types'
import { formatDate } from '../../utils'
import FileDropList from '../upload/FileDropList'
import { useFileUploads } from '../upload/useFileUploads'

const EVIDENCE_TYPES = [
 { value: 'visual_proof', label: 'Photo / Video', icon: Camera },
 { value: 'documentation', label: 'Document', icon: FileText },
 { value: 'testimony', label: 'Testimony', icon: MessageSquare },
 { value: 'financials', label: 'Financials', icon: DollarSign },
] as const

interface AddEvidenceToClaimDialogProps {
 claim: TimelineClaim
 kpi: KPI | undefined
 initiativeId: string
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 onClose: () => void
 onCreated: () => void
}

/**
 * Quick evidence upload for one specific claim: drop files, name it, done.
 * The evidence's scope (metric, location, dates, tag, beneficiary groups)
 * is copied from the claim, so it connects automatically — nothing to
 * configure.
 */
export default function AddEvidenceToClaimDialog({
 claim,
 kpi,
 initiativeId,
 locations,
 tags,
 beneficiaryGroups,
 onClose,
 onCreated,
}: AddEvidenceToClaimDialogProps) {
 const { files, addFiles, removeFile, releasePreviews } = useFileUploads()
 const [title, setTitle] = useState('')
 const [type, setType] = useState<Evidence['type']>('visual_proof')
 const [submitting, setSubmitting] = useState(false)
 const [error, setError] = useState<string | null>(null)

 const claimSummary = useMemo(() => {
 const locationName = claim.location_id
 ? locations.find(l => l.id === claim.location_id)?.name
 : undefined
 const date = claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented)
 return [locationName, date].filter(Boolean).join(' · ')
 }, [claim, locations])

 const scopeParts = useMemo(() => {
 const parts: string[] = []
 const locationName = claim.location_id ? locations.find(l => l.id === claim.location_id)?.name : undefined
 if (locationName) parts.push(locationName)
 parts.push(claim.date_range_start && claim.date_range_end
 ? `${formatDate(claim.date_range_start)} – ${formatDate(claim.date_range_end)}`
 : formatDate(claim.date_represented))
 if (claim.tag_id) {
 const tagName = tags.find(t => t.id === claim.tag_id)?.name
 if (tagName) parts.push(`tag "${tagName}"`)
 }
 if ((claim.beneficiary_group_ids || []).length > 0) {
 const names = (claim.beneficiary_group_ids || [])
 .map(id => beneficiaryGroups.find(g => g.id === id)?.name)
 .filter(Boolean)
 if (names.length > 0) parts.push(names.length > 2 ? `${names.length} groups` : names.join(', '))
 }
 return parts
 }, [claim, locations, tags, beneficiaryGroups])

 const validate = (): string | null => {
 if (files.length === 0) return 'Add at least one file'
 if (files.some(f => f.status === 'uploading')) return 'Wait for uploads to finish'
 if (files.some(f => f.status === 'error')) return 'Remove or retry failed uploads'
 if (!title.trim()) return 'Give the evidence a short title'
 return null
 }

 const handleSubmit = async () => {
 const validationError = validate()
 if (validationError) {
 setError(validationError)
 return
 }
 setSubmitting(true)
 setError(null)
 try {
 const fileUrls = files.filter(f => f.url).map(f => f.url!)
 const fileSizes = files.filter(f => f.url).map(f => f.uploadedSize ?? 0)
 const payload: CreateEvidenceForm = {
 title: title.trim(),
 type,
 // Scope copied 1:1 from the claim so the auto-matcher's gates pass.
 date_represented: claim.date_represented,
 date_range_start: claim.date_range_start,
 date_range_end: claim.date_range_end,
 initiative_id: initiativeId,
 location_ids: claim.location_id ? [claim.location_id] : [],
 kpi_ids: [claim.kpi_id],
 kpi_update_ids: claim.id ? [claim.id] : undefined,
 tag_ids: claim.tag_id ? [claim.tag_id] : [],
 beneficiary_group_ids: claim.beneficiary_group_ids || [],
 file_url: fileUrls[0],
 file_urls: fileUrls,
 file_sizes: fileSizes,
 }
 await apiService.createEvidence(payload)
 notify.success('Evidence uploaded and connected to the claim')
 releasePreviews()
 onCreated()
 onClose()
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to upload evidence')
 } finally {
 setSubmitting(false)
 }
 }

 return (
 <ModalFrame size="sm">
 <ModalHeader
 icon={Paperclip}
 title="Add evidence to this claim"
 subtitle={`${claim.value} ${kpi?.title || 'Unknown metric'}${claimSummary ? ` · ${claimSummary}` : ''}`}
 onClose={onClose}
 />
 <ModalBody>
 <div className="space-y-4">
 <FileDropList files={files} onAddFiles={addFiles} onRemoveFile={removeFile} compact />

 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1.5">Title</label>
 <input
 type="text"
 value={title}
 onChange={(e) => { setTitle(e.target.value); setError(null) }}
 placeholder={`e.g. Photos — ${kpi?.title || 'this claim'}`}
 className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 <div>
 <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
 <div className="grid grid-cols-4 gap-2">
 {EVIDENCE_TYPES.map(option => (
 <button
 key={option.value}
 type="button"
 onClick={() => setType(option.value)}
 className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl border text-center transition-colors ${type === option.value
 ? 'border-primary-500 bg-primary-50'
 : 'border-gray-200 bg-white hover:bg-gray-50'
 }`}
 >
 <option.icon className={`w-4 h-4 ${type === option.value ? 'text-primary-700' : 'text-gray-500'}`} />
 <span className="text-[10px] font-medium text-gray-700 leading-tight">{option.label}</span>
 </button>
 ))}
 </div>
 </div>

 {/* Auto-scope explainer */}
 <div className="flex items-start gap-2 rounded-xl border border-impact-200 bg-impact-50/50 px-3 py-2.5">
 <Link2 className="w-4 h-4 text-impact-500 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-gray-700">
 Scope is copied from the claim ({scopeParts.join(' · ')}) so this evidence
 connects to it automatically.
 </p>
 </div>

 {error && <p className="text-xs text-red-600">{error}</p>}
 </div>
 </ModalBody>
 <ModalFooter>
 <button onClick={onClose} className="app-btn app-btn-secondary app-btn-sm" disabled={submitting}>
 Cancel
 </button>
 <button onClick={handleSubmit} className="app-btn app-btn-primary app-btn-sm" disabled={submitting}>
 {submitting ? 'Uploading…' : 'Upload & connect'}
 </button>
 </ModalFooter>
 </ModalFrame>
 )
}
