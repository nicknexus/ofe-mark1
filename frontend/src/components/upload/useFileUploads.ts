import { useCallback, useEffect, useRef, useState } from 'react'
import { apiService } from '../../services/api'
import { useUploadManager } from '../../context/UploadContext'
import { WizardFile } from './wizardTypes'

/**
 * Self-contained file-upload state for quick-add dialogs: queues each file
 * through the shared upload manager (direct-to-Supabase) and tracks tile
 * status. The full wizard keeps its own copy of this wiring inside
 * WizardState; this hook serves the smaller flows.
 */
export function useFileUploads() {
 const { queueUpload, cancelUpload } = useUploadManager()
 const [files, setFiles] = useState<WizardFile[]>([])
 const filesRef = useRef(files)
 filesRef.current = files
 const savedRef = useRef(false)
 const discardedRef = useRef(false)

 const addFiles = useCallback((picked: File[]) => {
 for (const file of picked) {
 const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
 const uploadId = queueUpload({
 file,
 onComplete: (result) => {
 setFiles(prev => prev.map(f => f.id === uploadId
 ? { ...f, status: 'done', progress: 100, url: result.file_url, uploadedSize: result.size }
 : f))
 },
 onError: (error) => {
 setFiles(prev => prev.map(f => f.id === uploadId
 ? { ...f, status: 'error', error: error.message }
 : f))
 },
 })
 setFiles(prev => [...prev, {
 id: uploadId,
 name: file.name,
 size: file.size,
 status: 'uploading',
 progress: 0,
 previewUrl,
 }])
 }
 }, [queueUpload])

 const removeFile = useCallback((fileId: string) => {
 const file = filesRef.current.find(f => f.id === fileId)
 if (file?.status === 'uploading') cancelUpload(fileId)
 if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
 if (file?.url) void apiService.deleteUploadedFile(file.url, file.uploadedSize)
 setFiles(prev => prev.filter(f => f.id !== fileId))
 }, [cancelUpload])

 const releasePreviews = useCallback(() => {
 filesRef.current.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 }, [])

 // Call once the uploads are attached to a saved record — stops the teardown
 // cleanup from deleting files that are now owned by real evidence.
 const markSaved = useCallback(() => { savedRef.current = true }, [])

 // Files hit storage on pick but only become "real" on save. Anything left
 // over when the flow is abandoned is an orphan — drop it (once).
 const discardOrphans = useCallback(() => {
 if (discardedRef.current || savedRef.current) return
 discardedRef.current = true
 for (const f of filesRef.current) {
 if (f.status === 'uploading') cancelUpload(f.id)
 if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
 if (f.url) void apiService.deleteUploadedFile(f.url, f.uploadedSize)
 }
 }, [cancelUpload])

 useEffect(() => () => discardOrphans(), [discardOrphans])

 return { files, addFiles, removeFile, releasePreviews, markSaved, discardOrphans }
}
