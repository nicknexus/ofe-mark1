import React from 'react'
import { FileText, Film, Plus, X } from 'lucide-react'
import type { WizardFile } from './wizardTypes'

interface Props {
 files: WizardFile[]
 attachedIds: string[]
 metricLabel: string
 onSetAttached: (fileId: string, attached: boolean) => void
}

/** Removing a tile only detaches it from this scope; it stays in the library. */
export default function MetricEvidence({ files, attachedIds, metricLabel, onSetAttached }: Props) {
 return <div className="space-y-2">
  <p className="text-xs font-medium text-secondary-700" aria-live="polite">Evidence · {attachedIds.length} attached</p>
  {files.length === 0 ? <p className="app-help">Uploaded files will appear here.</p> : <div className="grid grid-cols-2 gap-2">
   {files.map(file => {
    const attached = attachedIds.includes(file.id)
    const Icon = /\.(mp4|mov|webm)$/i.test(file.name) ? Film : FileText
    return <div key={file.id} className={`relative min-w-0 rounded-lg border overflow-hidden ${attached ? 'border-primary-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}>
     <div className={`aspect-[4/3] bg-gray-100 flex items-center justify-center ${attached ? '' : 'opacity-40'}`}>
      {file.previewUrl ? <img src={file.previewUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-7 h-7 text-secondary-400" />}
     </div>
     <button type="button" onClick={() => onSetAttached(file.id, !attached)}
      className="absolute top-1 right-1 app-btn app-btn-secondary app-btn-icon !w-7 !h-7"
      aria-label={`${attached ? 'Remove' : 'Restore'} ${file.name} ${attached ? 'from' : 'to'} ${metricLabel}`}
      title={attached ? 'Remove from this scope' : 'Restore to this scope'}>
      {attached ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
     </button>
     <div className="px-2 py-1.5">
      <p className="text-[11px] font-medium text-secondary-700 truncate" title={file.name}>{file.name}</p>
      <p className={`text-[11px] ${file.status === 'error' ? 'text-red-600' : 'text-secondary-500'}`}>
       {!attached ? 'Not attached' : file.status === 'uploading' ? 'Uploading…' : file.status === 'error' ? 'Upload failed' : 'Attached'}
      </p>
     </div>
    </div>
   })}
  </div>}
 </div>
}
