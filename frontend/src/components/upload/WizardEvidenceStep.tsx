import React, { useRef } from 'react'
import { Camera, FileText, MessageSquare, DollarSign, UploadCloud, X, RefreshCw } from 'lucide-react'
import { WizardState } from './wizardTypes'

const EVIDENCE_TYPES = [
 { value: 'visual_proof', label: 'Photo / Video', description: 'Pictures or footage of the work', icon: Camera },
 { value: 'documentation', label: 'Document', description: 'Reports, lists, records', icon: FileText },
 { value: 'testimony', label: 'Testimony', description: 'Quotes and statements', icon: MessageSquare },
 { value: 'financials', label: 'Financials', description: 'Receipts and statements', icon: DollarSign },
] as const

interface WizardEvidenceStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 onAddFiles: (files: File[]) => void
 onRemoveFile: (fileId: string) => void
}

/**
 * Step — add the proof: drop the files, say what kind of evidence they are,
 * and give the record a recognisable title.
 */
export default function WizardEvidenceStep({ state, update, onAddFiles, onRemoveFile }: WizardEvidenceStepProps) {
 const fileInputRef = useRef<HTMLInputElement>(null)

 const handleDrop = (e: React.DragEvent) => {
 e.preventDefault()
 const files = Array.from(e.dataTransfer.files || [])
 if (files.length > 0) onAddFiles(files)
 }

 return (
 <div className="space-y-5 max-w-2xl">
 {/* 1 — files */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">1. Add your files</label>
 <div
 onDrop={handleDrop}
 onDragOver={(e) => e.preventDefault()}
 onClick={() => fileInputRef.current?.click()}
 className="border-2 border-dashed border-gray-200 hover:border-primary-400 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-white"
 >
 <UploadCloud className="w-9 h-9 text-gray-300 mx-auto mb-2" />
 <p className="text-sm font-medium text-gray-700">Drop files here, or click to browse</p>
 <p className="text-xs text-gray-400 mt-1">Photos, documents, receipts, recordings — as many as you need</p>
 <input
 ref={fileInputRef}
 type="file"
 multiple
 className="hidden"
 onChange={(e) => {
 const files = Array.from(e.target.files || [])
 if (files.length > 0) onAddFiles(files)
 e.target.value = ''
 }}
 />
 </div>

 {state.files.length > 0 && (
 <div className="space-y-1.5 mt-2">
 {state.files.map(file => (
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

 {/* 2 — what kind */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">2. What kind of evidence is this?</label>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
 {EVIDENCE_TYPES.map(type => (
 <button
 key={type.value}
 type="button"
 onClick={() => update({ evidenceType: type.value })}
 className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl border-2 text-center transition-colors ${state.evidenceType === type.value
 ? 'border-primary-500 bg-primary-50'
 : 'border-gray-200 bg-white hover:bg-gray-50'
 }`}
 >
 <type.icon className={`w-5 h-5 ${state.evidenceType === type.value ? 'text-primary-700' : 'text-gray-500'}`} />
 <span className="text-xs font-medium text-gray-700">{type.label}</span>
 <span className="text-[10px] text-gray-400 leading-tight">{type.description}</span>
 </button>
 ))}
 </div>
 </div>

 {/* 3 — name it */}
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">3. Give it a title</label>
 <input
 type="text"
 value={state.evidenceTitle}
 onChange={(e) => update({ evidenceTitle: e.target.value })}
 placeholder="e.g. Attendance sheet — July training"
 className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-1.5">
 Description <span className="text-gray-400 font-normal">(optional)</span>
 </label>
 <textarea
 value={state.evidenceDescription}
 onChange={(e) => update({ evidenceDescription: e.target.value })}
 rows={2}
 placeholder="What does this evidence show?"
 className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
 />
 </div>
 </div>
 )
}
