import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FileText, UploadCloud, X, RefreshCw, ChevronDown, Check } from 'lucide-react'
import { Evidence } from '../../types'
import { WizardFile, EVIDENCE_TYPE_LABELS } from './wizardTypes'
import { EVIDENCE_TYPE_ORDER, EVIDENCE_TYPE_STYLE } from '../timeline/EvidenceTypeCounts'

/** Per-file type toggles — canonical order + colours from EVIDENCE_TYPE_STYLE. */
const FILE_TYPES = EVIDENCE_TYPE_ORDER.map(value => ({
 value,
 label: EVIDENCE_TYPE_STYLE[value].shortLabel,
 icon: EVIDENCE_TYPE_STYLE[value].icon,
 color: EVIDENCE_TYPE_STYLE[value].text,
}))
const TYPE_META = (t: Evidence['type']) => FILE_TYPES.find(ft => ft.value === t) || FILE_TYPES[1]

interface FileDropListProps {
 files: WizardFile[]
 onAddFiles: (files: File[]) => void
 onRemoveFile: (fileId: string) => void
 onRetryFile?: (fileId: string) => void
 /** Tighter padding for dialogs. */
 compact?: boolean
 /** Show the per-file evidence-type picker (create flow only). */
 showTypePicker?: boolean
 onSetFileType?: (fileId: string, type: Evidence['type']) => void
 /** Bulk-apply a type to every file (the "set all" bar). */
 onSetAllTypes?: (type: Evidence['type']) => void
}

/** Drop zone + uploading file tiles, shared by the wizard and quick-add dialogs. */
export default function FileDropList({ files, onAddFiles, onRemoveFile, onRetryFile, compact = false, showTypePicker = false, onSetFileType, onSetAllTypes }: FileDropListProps) {
 const fileInputRef = useRef<HTMLInputElement>(null)
 // Per-row type dropdown, positioned via portal so it never clips inside the
 // scrollable modal body.
 const [menu, setMenu] = useState<{ fileId: string; top: number; left: number } | null>(null)

 const handleDrop = (e: React.DragEvent) => {
  e.preventDefault()
  const dropped = Array.from(e.dataTransfer.files || [])
  if (dropped.length > 0) onAddFiles(dropped)
 }

 const openMenu = (fileId: string, e: React.MouseEvent<HTMLButtonElement>) => {
  const r = e.currentTarget.getBoundingClientRect()
  setMenu({ fileId, top: r.bottom + 6, left: Math.max(8, r.right - 176) })
 }

 // The tile: thumbnail/icon, name + status, an optional type box, remove.
 const fileTile = (file: WizardFile, withTypeBox: boolean) => {
  const activeType = file.type || 'documentation'
  const meta = TYPE_META(activeType)
  return (
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
      {file.status === 'done' && (file.existing ? 'Already attached' : `${(file.size / 1024 / 1024).toFixed(1)} MB · uploaded ✓`)}
      {file.status === 'error' && (file.error || 'Upload failed')}
     </p>
    </div>
    {withTypeBox && file.status !== 'error' && (
     <button
      type="button"
      onClick={(e) => (menu?.fileId === file.id ? setMenu(null) : openMenu(file.id, e))}
      title={`Type: ${meta.label} — click to change`}
      className={`inline-flex items-center gap-1 h-8 pl-2 pr-1.5 rounded-lg border transition-colors flex-shrink-0 ${menu?.fileId === file.id ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
     >
      <meta.icon className={`w-4 h-4 ${meta.color}`} />
      <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${menu?.fileId === file.id ? 'rotate-180' : ''}`} />
     </button>
    )}
    {file.status === 'error' && onRetryFile && file.raw && (
     <button
      type="button"
      onClick={() => onRetryFile(file.id)}
      className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition-colors flex-shrink-0"
      title="Retry upload"
     >
      <RefreshCw className="w-3.5 h-3.5" />
     </button>
    )}
    <button
     type="button"
     onClick={() => onRemoveFile(file.id)}
     className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
     title="Remove"
    >
     <X className="w-3.5 h-3.5" />
    </button>
   </div>
  )
 }

 // Grouped-by-type view (create flow): one section per type that has files.
 const grouped = FILE_TYPES
  .map(t => ({ ...t, items: files.filter(f => (f.type || 'documentation') === t.value) }))
  .filter(g => g.items.length > 0)

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
    <p className="text-xs text-gray-400 mt-1">Photos, documents, receipts, recordings — up to 5 GB each</p>
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

   {/* Create flow: "set all" bar + files grouped into type sections. */}
   {showTypePicker && files.length > 0 ? (
    <>
     <div className="flex items-center gap-1.5 flex-wrap mt-3 mb-2.5">
      <span className="text-[11px] font-medium text-gray-500 mr-0.5">Set all to</span>
      {FILE_TYPES.map(t => (
       <button
        key={t.value}
        type="button"
        onClick={() => onSetAllTypes?.(t.value)}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full border border-gray-200 bg-white text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-primary-300 transition-colors"
       >
        <t.icon className={`w-3.5 h-3.5 flex-shrink-0 ${t.color}`} />
        {t.label}
       </button>
      ))}
     </div>

     <div className="space-y-3">
      {grouped.map(g => (
       <div key={g.value}>
        <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
         <g.icon className={`w-3.5 h-3.5 flex-shrink-0 ${g.color}`} />
         <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{EVIDENCE_TYPE_LABELS[g.value]}</span>
         <span className="text-[11px] text-gray-400 tabular-nums">· {g.items.length}</span>
        </div>
        <div className="space-y-1.5">
         {g.items.map(file => fileTile(file, true))}
        </div>
       </div>
      ))}
     </div>
    </>
   ) : (
    files.length > 0 && (
     <div className="space-y-1.5 mt-2">
      {files.map(file => fileTile(file, false))}
     </div>
    )
   )}

   {/* Per-row type dropdown (portal, so it escapes the scroll container). */}
   {menu && createPortal(
    <>
     <div className="fixed inset-0 z-[9998]" onClick={() => setMenu(null)} />
     <div
      className="fixed z-[9999] w-44 app-card p-1 shadow-card-lg"
      style={{ top: menu.top, left: menu.left }}
     >
      {FILE_TYPES.map(t => {
       const current = files.find(f => f.id === menu.fileId)?.type || 'documentation'
       const active = current === t.value
       return (
        <button
         key={t.value}
         type="button"
         onClick={() => { onSetFileType?.(menu.fileId, t.value); setMenu(null) }}
         className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
        >
         <t.icon className={`w-4 h-4 flex-shrink-0 ${t.color}`} />
         <span className="text-sm text-gray-700 flex-1">{t.label}</span>
         {active && <Check className="w-3.5 h-3.5 text-primary-600" />}
        </button>
       )
      })}
     </div>
    </>,
    document.body
   )}
  </div>
 )
}
