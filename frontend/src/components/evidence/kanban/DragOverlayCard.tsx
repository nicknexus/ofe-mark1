import React from 'react'
import { File as FileIcon, Image as ImageIcon, Film, FileText, Files } from 'lucide-react'
import { FileItem } from '../types'

interface DragOverlayCardProps {
 primary: FileItem
 count: number
}

function fileIcon(file: File) {
 if (file.type.startsWith('image/')) return ImageIcon
 if (file.type.startsWith('video/')) return Film
 if (file.type.includes('pdf')) return FileText
 return FileIcon
}

export default function DragOverlayCard({ primary, count }: DragOverlayCardProps) {
 const Icon = fileIcon(primary.file)
 const isImage = primary.file.type.startsWith('image/')

 return (
 <div className="relative w-64 pointer-events-none select-none">
 {/* Stack layers behind for visual depth when count > 1 */}
 {count > 1 && (
 <>
 <div className="absolute inset-0 bg-white border border-gray-200 rounded-lg translate-x-1.5 translate-y-1.5 shadow" />
 <div className="absolute inset-0 bg-white border border-gray-200 rounded-lg translate-x-0.5 translate-y-0.5 shadow" />
 </>
 )}
 <div className="relative flex items-center gap-2 p-2 rounded-lg border-2 border-evidence-500 bg-white shadow-xl">
 <div className="w-9 h-9 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
 {isImage && primary.previewUrl ? (
 <img src={primary.previewUrl} alt="" className="w-full h-full object-cover" />
 ) : (
 <Icon className="w-4 h-4 text-gray-500" />
 )}
 </div>
 <div className="min-w-0 flex-1">
 <p className="text-xs font-medium text-gray-800 truncate">{primary.file.name}</p>
 {count > 1 ? (
 <p className="inline-flex items-center gap-1 text-xs font-semibold text-evidence-600">
 <Files className="w-2.5 h-2.5" />
 Moving {count} files
 </p>
 ) : (
 <p className="text-xs text-gray-500">{(primary.file.size / 1024 / 1024).toFixed(1)} MB</p>
 )}
 </div>
 </div>
 </div>
 )
}
