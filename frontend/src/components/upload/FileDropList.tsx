import React, { useRef } from 'react'
import { FileText, UploadCloud, X, RefreshCw } from 'lucide-react'
import { WizardFile } from './wizardTypes'

interface FileDropListProps {
 files: WizardFile[]
 onAddFiles: (files: File[]) => void
 onRemoveFile: (fileId: string) => void
 /** Tighter padding for dialogs. */
 compact?: boolean
}

/** Drop zone + uploading file tiles, shared by the wizard and quick-add dialogs. */
export default function FileDropList({ files, onAddFiles, onRemoveFile, compact = false }: FileDropListProps) {
 const fileInputRef = useRef<HTMLInputElement>(null)

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault()
 const dropped = Array.from(e.dataTransfer.files || [])
 if (dropped.length > 0) onAddFiles(dropped)
 }

 return (
 <div>
 <div
 onDrop={handleDrop}
 onDragOver={(e) => e.preventDefault()}
 onClick={() => fileInputRef.current?.click()}
 className={`border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-2xl text-center cursor-pointer transition-colors bg-white ${compact ? 'p-5' : 'p-8'}`}
 >
 <UploadCloud className={`text-gray-300 mx-auto mb-2 ${compact ? 'w-7 h-7' : 'w-9 h-9'}`} />
 <p className="text-sm font-medium text-gray-700">Drop files here, or click to browse</p>
 <p className="text-xs text-gray-400 mt-1">Photos, documents, receipts, recordings — as many as you need</p>
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={(e) => {
 const picked = Array.from(e.target.files || [])
 if (picked.length > 0) onAddFiles(picked)
 e.target.value = ''
 }}
 />
 </div>

 {files.length > 0 && (
 <div className="space-y-1.5 mt-2">
 {files.map(file => (
 <div key={file.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-gray-100 bg-white">
 {file.previewUrl ? (
 <img src={file.previewUrl} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 flex-shrink-0" />
 ) : (
 <div className="p-2 rounded-lg bg-gray-100 flex-shrink-0">
 <FileText className="w-4 h-4 text-gray-500" />
 </div>
 )}
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-gray-800 truncate">{file.name}</p>
 <p className={`text-[11px] ${file.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
 {file.status === 'uploading' && (
 <span className="inline-flex items-center gap-1">
 <RefreshCw className="w-3 h-3 animate-spin" /> Uploading…
 </span>
 )}
 {file.status === 'done' && `${(file.size / 1024 / 1024).toFixed(1)} MB · uploaded ✓`}
 {file.status === 'error' && (file.error || 'Upload failed')}
 </p>
 </div>
 <button
 type="button"
 onClick={() => onRemoveFile(file.id)}
 className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
 title="Remove"
 >
 <X className="w-3.5 h-3.5" />
 </button>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}
