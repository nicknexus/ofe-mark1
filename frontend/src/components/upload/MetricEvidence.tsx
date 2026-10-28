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
 return <div className="space-y-1.5">
  <p className="text-xs font-medium text-secondary-700" aria-live="polite">Evidence · {attachedIds.length} attached</p>
  {files.length === 0 ? <p className="app-help">Uploaded files will appear here.</p> : <div className="space-y-1">
   {files.map(file => {
    const attached = attachedIds.includes(file.id)
    const Icon = /\.(mp4|mov|webm)$/i.test(file.name) ? Film : FileText
    return <div key={file.id} className={`flex items-center gap-2 min-w-0 rounded-md border px-1.5 py-1 ${attached ? 'border-gray-200 bg-white' : 'border-dashed border-gray-300 bg-gray-50'}`}>
     <div className={`w-6 h-6 rounded bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0 ${attached ? '' : 'opacity-40'}`}>
      {file.previewUrl ? <img src={file.previewUrl} alt="" className="w-full h-full object-cover" /> : <Icon className="w-3.5 h-3.5 text-secondary-400" />}
     </div>
     <p className={`flex-1 min-w-0 text-[11px] font-medium truncate ${attached ? 'text-secondary-700' : 'text-secondary-400'}`} title={file.name}>{file.name}</p>
     {(file.status === 'uploading' || file.status === 'error') && <span className={`text-[10px] flex-shrink-0 ${file.status === 'error' ? 'text-red-600' : 'text-secondary-500'}`}>{file.status === 'error' ? 'Failed' : 'Uploading…'}</span>}
     <button type="button" onClick={() => onSetAttached(file.id, !attached)}
      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-gray-700 hover:bg-gray-100"
      aria-label={`${attached ? 'Remove' : 'Restore'} ${file.name} ${attached ? 'from' : 'to'} ${metricLabel}`}
      title={attached ? 'Remove from this scope' : 'Restore to this scope'}>
      {attached ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
     </button>
    </div>
   })}
  </div>}
 </div>
}
