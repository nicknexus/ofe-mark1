import React from 'react'
import { Check, File as FileIcon, Image as ImageIcon, Film, FileText, Loader2, AlertCircle, MoreVertical, X } from 'lucide-react'
import { useDraggable } from '@dnd-kit/core'
import { FileItem } from '../types'
import { GroupPalette } from '../utils/groupPalette'

interface FileTileProps {
 file: FileItem
 onToggleSelect: () => void
 onEdit: () => void
 onRemove: () => void
 draggable?: boolean
 /** Number of files that will move together if a drag starts on this tile (when selected). */
 selectionDragCount?: number
 /** Library column only: bold colored frame + white interior; kanban tiles omit this. */
 palette?: GroupPalette
 /** Where this tile is rendered. The same file appears in both the
 * FileLibrary AND in its current GroupColumn — dnd-kit rejects duplicate
 * ids, so the draggable id is namespaced by origin and the file's real id
 * travels in the data payload. */
 dragOrigin?: 'library' | 'group'
}

function fileIcon(file: File) {
 if (file.type.startsWith('image/')) return ImageIcon
 if (file.type.startsWith('video/')) return Film
 if (file.type.includes('pdf')) return FileText
 return FileIcon
}

export default function FileTile({
 file,
 onToggleSelect,
 onEdit,
 onRemove,
 draggable = true,
 selectionDragCount,
 palette,
 dragOrigin = 'group',
}: FileTileProps) {
 const Icon = fileIcon(file.file)
 const isImage = file.file.type.startsWith('image/')

 const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
 id: `${dragOrigin}-${file.id}`,
 data: { fileId: file.id, origin: dragOrigin },
 disabled: !draggable,
 })

 const groupDragBadge = file.selected && selectionDragCount && selectionDragCount > 1
 ? selectionDragCount
 : null

 const baseClasses = palette
 ? (file.selected
 ? `bg-white border-[1.5px] ${palette.libraryFrameBorder} ring-2 ${palette.ring} shadow-sm`
 : `bg-white border-[1.5px] ${palette.libraryFrameBorder} hover:shadow-sm`)
 : (file.selected
 ? 'bg-white border border-gray-300 ring-2 ring-gray-300/30 shadow-sm'
 : 'bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm')

 return (
 <div
 ref={setNodeRef}
 className={`group relative flex items-center gap-2 p-2 rounded-lg transition-all min-w-0 max-w-full overflow-hidden ${baseClasses} ${isDragging ? 'opacity-40' : ''}`}
 >
 <button
 onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
 onPointerDown={(e) => e.stopPropagation()}
 className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
 file.selected
 ? 'bg-evidence-500 border-evidence-500 text-white'
 : 'bg-white border-gray-300 hover:border-evidence-400'
 }`}
 aria-label={file.selected ? 'Deselect' : 'Select'}
 >
 {file.selected && <Check className="w-3 h-3" />}
 </button>

 {/* Drag handle wraps the thumbnail + name + meta */}
 <div
 {...(draggable ? { ...listeners, ...attributes } : {})}
 className={`flex items-center gap-2 flex-1 min-w-0 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
 role={draggable ? 'button' : undefined}
 aria-label={draggable ? 'Drag file' : undefined}
 >
 <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0 overflow-hidden relative bg-gray-100">
 {isImage && file.previewUrl ? (
 <img src={file.previewUrl} alt="" className="w-full h-full object-cover" />
 ) : (
 <Icon className="w-4 h-4 text-gray-500" />
 )}
 {groupDragBadge && (
 <span className="absolute -top-1 -right-1 bg-evidence-500 text-white text-xs font-semibold rounded-full min-w-[1.25rem] h-5 px-0.5 flex items-center justify-center">
 {groupDragBadge}
 </span>
 )}
 </div>

 <div className="min-w-0 flex-1 overflow-hidden">
 <p className="text-xs font-medium text-gray-800 truncate" title={file.file.name}>{file.file.name}</p>
 <div className="flex items-center gap-1.5 text-xs text-gray-500">
 <span>{(file.file.size / 1024 / 1024).toFixed(1)} MB</span>
 {file.status === 'uploading' && (
 <span className="inline-flex items-center gap-0.5 text-evidence-600">
 <Loader2 className="w-2.5 h-2.5 animate-spin" />
 {file.progress}%
 </span>
 )}
 {file.status === 'error' && (
 <span className="inline-flex items-center gap-0.5 text-red-500">
 <AlertCircle className="w-2.5 h-2.5" />
 failed
 </span>
 )}
 </div>
 </div>
 </div>

 <button
 onClick={(e) => { e.stopPropagation(); onEdit() }}
 onPointerDown={(e) => e.stopPropagation()}
 className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
 title="Edit this file"
 >
 <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
 </button>
 <button
 onClick={(e) => { e.stopPropagation(); onRemove() }}
 onPointerDown={(e) => e.stopPropagation()}
 className="p-1 rounded hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
 title="Remove file"
 >
 <X className="w-3.5 h-3.5 text-gray-400" />
 </button>
 </div>
 )
}
