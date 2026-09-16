import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { X, ChevronLeft, ChevronRight, Upload as UploadIcon, Loader2 } from 'lucide-react'
import { useUploadManager } from '../../context/UploadContext'
import { useEvidenceUploadState } from './hooks/useEvidenceUploadState'
import { useInitiativeData } from './hooks/useInitiativeData'
import { validateGroup } from './utils/groupValidation'
import { composeGroupName } from './utils/composeGroupName'
import UploadStep from './steps/UploadStep'
import OrganizeStep from './steps/OrganizeStep'
import GroupEditorPopover from './kanban/GroupEditorPopover'
import FileEditPopover from './kanban/FileEditPopover'
import { apiService } from '../../services/api'
import { CreateEvidenceForm, MetricTag } from '../../types'
import { notify } from '../../lib/notify'

interface EvidenceUploadModalProps {
 isOpen: boolean
 onClose: () => void
 onCreated?: () => void | Promise<void>
 initiativeId: string
 preSelectedKPIId?: string
}

/**
 * Advanced evidence upload: drop many files, then organize them into
 * evidence records on a board. The guided single-record path lives in
 * `UploadWizard`; this is the bulk tool it hands off to.
 */
export default function EvidenceUploadModal({
 isOpen,
 onClose,
 onCreated,
 initiativeId,
 preSelectedKPIId,
}: EvidenceUploadModalProps) {
 const { queueUpload, dismissUpload } = useUploadManager()
 const { state, dispatch, filesByGroup } = useEvidenceUploadState(preSelectedKPIId)
 const { kpis, locations, beneficiaryGroups, reloadLocations } = useInitiativeData(initiativeId, isOpen)
 const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
 const [editingFileId, setEditingFileId] = useState<string | null>(null)
 const [allTags, setAllTags] = useState<MetricTag[]>([])
 const [submitting, setSubmitting] = useState(false)
 const [submitProgress, setSubmitProgress] = useState({ done: 0, total: 0 })

 // Load tags once for column-chip name composition.
 useEffect(() => {
 if (!isOpen) return
 apiService.getMetricTags().then(setAllTags).catch(() => setAllTags([]))
 }, [isOpen])

 // Generate object URLs for image previews (revoke on unmount).
 useEffect(() => {
 const urls: string[] = []
 state.files.forEach(f => {
 if (!f.isLink && !f.previewUrl && f.file.type.startsWith('image/')) {
 const url = URL.createObjectURL(f.file)
 urls.push(url)
 dispatch({ type: 'setFileStatus', fileId: f.id, patch: { previewUrl: url } })
 }
 })
 return () => { urls.forEach(URL.revokeObjectURL) }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [state.files.length])

 const handleAddFiles = useCallback((newFiles: File[]) => {
 const tasks = newFiles.map(file => {
 const uploadId = queueUpload({
 file,
 onComplete: (result) => {
 dispatch({
 type: 'setFileStatus',
 fileId: uploadId,
 patch: { status: 'done', progress: 100, uploadedUrl: result.file_url, uploadedSize: result.size },
 })
 // We track progress ourselves in the Kanban file tiles, so as
 // soon as a file finishes there's no reason to keep it in the
 // floating panel. Errors are intentionally left in place so
 // the user can see/retry them globally.
 dismissUpload(uploadId)
 },
 onError: (err) => {
 dispatch({
 type: 'setFileStatus',
 fileId: uploadId,
 patch: { status: 'error', error: err.message },
 })
 },
 })
 return { file, uploadId }
 })
 dispatch({ type: 'addFiles', files: tasks })
 }, [queueUpload, dispatch, dismissUpload])

 const uploadingCount = state.files.filter(f => f.status === 'uploading').length
 const errorCount = state.files.filter(f => f.status === 'error').length

 const handleSubmit = useCallback(async () => {
 const groupsToSubmit = state.groups
 .map(g => ({ group: g, files: state.files.filter(f => f.groupId === g.id) }))
 .filter(g => g.files.length > 0)

 if (groupsToSubmit.length === 0) {
 notify.error('No groups with files to submit')
 return
 }

 // Block if any files still uploading.
 const stillUploading = state.files.filter(f => !f.isLink && f.status === 'uploading')
 if (stillUploading.length > 0) {
 notify.error(`Wait for ${stillUploading.length} upload${stillUploading.length === 1 ? '' : 's'} to finish`)
 return
 }
 // Block if any files in submittable groups failed to upload.
 const failedFiles = groupsToSubmit.flatMap(gp => gp.files.filter(f => !f.isLink && (f.status === 'error' || !f.uploadedUrl)))
 if (failedFiles.length > 0) {
 notify.error(`${failedFiles.length} file${failedFiles.length === 1 ? '' : 's'} failed to upload. Remove or retry`)
 return
 }

 setSubmitting(true)
 setSubmitProgress({ done: 0, total: groupsToSubmit.length })

 const results = await Promise.allSettled(
 groupsToSubmit.map(async ({ group, files }) => {
 const file_urls = files.map(f => f.uploadedUrl!).filter(Boolean)
 const file_sizes = files.map(f => f.uploadedSize ?? 0)
 const payload: CreateEvidenceForm = {
 title: group.metadata.title,
 description: group.metadata.description,
 type: group.metadata.type,
 date_represented: group.metadata.date_represented || group.metadata.date_range_start || '',
 date_range_start: group.metadata.date_range_start,
 date_range_end: group.metadata.date_range_end,
 location_ids: group.metadata.location_ids,
 kpi_ids: group.metadata.kpi_ids,
 tag_ids: group.metadata.tag_ids,
 beneficiary_group_ids: group.metadata.beneficiary_group_ids,
 initiative_id: initiativeId,
 file_url: file_urls[0],
 file_urls,
 file_sizes,
 }
 await apiService.createEvidence(payload)
 setSubmitProgress(p => ({ ...p, done: p.done + 1 }))
 }),
 )

 const fulfilled = results.filter(r => r.status === 'fulfilled').length
 const rejected = results.length - fulfilled
 setSubmitting(false)

 if (rejected === 0) {
 notify.success(`Created ${fulfilled} evidence group${fulfilled === 1 ? '' : 's'}`)
 await onCreated?.()
 onClose()
 } else if (fulfilled > 0) {
 notify.error(`Created ${fulfilled} group${fulfilled === 1 ? '' : 's'}, ${rejected} failed. Check console`)
 results.forEach(r => r.status === 'rejected' && console.error('Evidence create failed:', r.reason))
 await onCreated?.()
 } else {
 notify.error('All evidence groups failed. Check console')
 results.forEach(r => r.status === 'rejected' && console.error('Evidence create failed:', r.reason))
 }
 }, [state.groups, state.files, initiativeId, onCreated, onClose])

 const readyGroups = useMemo(
 () => state.groups.filter(g => filesByGroup(g.id).length > 0 && validateGroup(g.metadata).ready),
 [state.groups, state.files, filesByGroup],
 )
 const nonEmptyGroups = useMemo(
 () => state.groups.filter(g => filesByGroup(g.id).length > 0),
 [state.groups, state.files, filesByGroup],
 )
 const allReady = nonEmptyGroups.length > 0 && readyGroups.length === nonEmptyGroups.length

 if (!isOpen) return null

 const canAdvanceFromUpload = state.files.length > 0

 return (
 <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center p-0 md:p-4 z-[70]">
 <div className="app-card-elevated w-full h-full md:w-[95vw] md:h-[92vh] md:max-w-[1500px] flex flex-col overflow-hidden md:rounded-xl">
 {/* Header */}
 <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200/80 bg-white flex-shrink-0">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
 <UploadIcon className="w-4 h-4 text-gray-700" />
 </div>
 <div>
 <h2 className="text-base font-semibold text-gray-900 leading-tight">Upload Evidence</h2>
 <p className="text-xs text-gray-500 mt-0.5">
 {state.step === 'upload' ? 'Step 1: Add your files' : 'Step 2: Organize into evidence groups'}
 </p>
 </div>
 </div>
 <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100 transition-colors" aria-label="Close">
 <X className="w-5 h-5 text-gray-500" />
 </button>
 </div>

 {/* Body */}
 <div className="flex-1 min-h-0 overflow-hidden">
 {state.step === 'upload' ? (
 <UploadStep
 files={state.files}
 onAddFiles={handleAddFiles}
 onRemoveFile={(id) => dispatch({ type: 'removeFile', fileId: id })}
 onAddLink={(url) => dispatch({ type: 'addLink', url })}
 />
 ) : (
 <OrganizeStep
 files={state.files}
 groups={state.groups}
 filesByGroup={filesByGroup}
 onToggleFileSelect={(id) => {
 const f = state.files.find(x => x.id === id)
 if (!f) return
 dispatch({ type: 'setFileSelected', fileId: id, selected: !f.selected })
 }}
 onSelectAllVisible={(selected, ids) => dispatch({ type: 'selectAll', ids, selected })}
 onClearSelection={() => dispatch({ type: 'clearSelection' })}
 onRemoveFile={(id) => dispatch({ type: 'removeFile', fileId: id })}
 onAddGroup={() => dispatch({ type: 'addGroup' })}
 onEditGroup={(id) => setEditingGroupId(id)}
 onDeleteGroup={(id) => dispatch({ type: 'removeGroup', groupId: id })}
 onMoveSelectedToGroup={(groupId) => {
 const ids = state.files.filter(f => f.selected).map(f => f.id)
 if (!ids.length) return
 dispatch({ type: 'moveFiles', fileIds: ids, targetGroupId: groupId })
 }}
 onMoveFilesToGroup={(ids, groupId) => {
 if (!ids.length) return
 dispatch({ type: 'moveFiles', fileIds: ids, targetGroupId: groupId })
 }}
 onEditFile={(id) => setEditingFileId(id)}
 onTitleChange={(groupId, title) => {
 const g = state.groups.find(x => x.id === groupId)
 if (!g) return
 dispatch({ type: 'updateGroupMetadata', groupId, patch: { title } })
 const nextName = title.trim()
 || composeGroupName({ ...g.metadata, title }, { locations, kpis, tags: allTags, beneficiaryGroups })
 || g.name
 if (nextName !== g.name) {
 dispatch({ type: 'renameGroup', groupId, name: nextName })
 }
 }}
 kpis={kpis}
 locations={locations}
 tags={allTags}
 beneficiaryGroups={beneficiaryGroups}
 />
 )}
 </div>

 {/* Footer */}
 <div className="px-6 py-3.5 border-t border-gray-100 bg-white flex items-center justify-between gap-3 flex-shrink-0">
 <button
 onClick={() => {
 if (state.step === 'organize') dispatch({ type: 'goToStep', step: 'upload' })
 else onClose()
 }}
 className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
 >
 {state.step === 'organize' ? (<><ChevronLeft className="w-4 h-4" /> Back</>) : (<><X className="w-4 h-4" /> Cancel</>)}
 </button>

 <div className="flex items-center gap-3">
 {state.step === 'organize' && (
 <div className="text-xs text-gray-600">
 {readyGroups.length}/{nonEmptyGroups.length} evidence group{nonEmptyGroups.length === 1 ? '' : 's'} ready
 {uploadingCount > 0 && (
 <span className="ml-2 inline-flex items-center gap-1 text-evidence-600">
 <Loader2 className="w-3 h-3 animate-spin" />
 {uploadingCount} uploading
 </span>
 )}
 {errorCount > 0 && (
 <span className="ml-2 text-red-600">{errorCount} failed</span>
 )}
 </div>
 )}
 {state.step === 'upload' ? (
 <button
 disabled={!canAdvanceFromUpload}
 onClick={() => dispatch({ type: 'goToStep', step: 'organize' })}
 className="flex items-center gap-1.5 px-5 py-2 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm shadow-evidence-500/25 transition-colors"
 >
 Next <ChevronRight className="w-4 h-4" />
 </button>
 ) : (
 <button
 disabled={!allReady || uploadingCount > 0 || submitting}
 onClick={handleSubmit}
 className="flex items-center gap-1.5 px-5 py-2 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-sm shadow-evidence-500/25 transition-colors"
 >
 {submitting ? (
 <>
 <Loader2 className="w-4 h-4 animate-spin" />
 Submitting {submitProgress.done}/{submitProgress.total}…
 </>
 ) : (
 <>Submit {nonEmptyGroups.length} evidence group{nonEmptyGroups.length === 1 ? '' : 's'}</>
 )}
 </button>
 )}
 </div>
 </div>
 </div>

 {editingGroupId && (() => {
 const g = state.groups.find(x => x.id === editingGroupId)
 if (!g) return null
 return (
 <GroupEditorPopover
 group={g}
 isOpen
 initiativeId={initiativeId}
 kpis={kpis}
 locations={locations}
 beneficiaryGroups={beneficiaryGroups}
 onClose={() => setEditingGroupId(null)}
 onSave={(metadata) => {
 dispatch({ type: 'updateGroupMetadata', groupId: g.id, patch: metadata })
 // Single source of truth: title drives the column label too.
 // Fall back to a composed name if user left title empty.
 const nextName = (metadata.title || '').trim()
 || composeGroupName(metadata, { locations, kpis, tags: allTags, beneficiaryGroups })
 || g.name
 if (nextName !== g.name) {
 dispatch({ type: 'renameGroup', groupId: g.id, name: nextName })
 }
 }}
 onLocationsChanged={reloadLocations}
 />
 )
 })()}

 {editingFileId && (() => {
 const f = state.files.find(x => x.id === editingFileId)
 if (!f) return null
 return (
 <FileEditPopover
 file={f}
 groups={state.groups}
 isOpen
 initiativeId={initiativeId}
 kpis={kpis}
 locations={locations}
 beneficiaryGroups={beneficiaryGroups}
 tags={allTags}
 onClose={() => setEditingFileId(null)}
 onSave={(effective, autoName) => {
 dispatch({ type: 'editFileMetadata', fileId: f.id, effective, autoName })
 }}
 onLocationsChanged={reloadLocations}
 />
 )
 })()}
 </div>
 )
}
