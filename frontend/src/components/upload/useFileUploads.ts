import { useCallback, useRef, useState } from 'react'
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
 setFiles(prev => prev.filter(f => f.id !== fileId))
 }, [cancelUpload])

 const releasePreviews = useCallback(() => {
 filesRef.current.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 }, [])

 return { files, addFiles, removeFile, releasePreviews }
}
