import React from 'react'
import { AlertTriangle, X } from 'lucide-react'
import ModalFrame from './ModalFrame'

interface ConfirmDialogProps {
 title: string
 message: string
 confirmLabel?: string
 cancelLabel?: string
 tone?: 'danger' | 'default'
 onConfirm: () => void
 onCancel: () => void
}

export default function ConfirmDialog({
 title,
 message,
 confirmLabel = 'Confirm',
 cancelLabel = 'Cancel',
 tone = 'default',
 onConfirm,
 onCancel,
}: ConfirmDialogProps) {
 const danger = tone === 'danger'

 return (
 <ModalFrame
 zIndexClass="z-[1000]"
 size="sm"
 >
 <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
 <div className="flex items-center gap-3 min-w-0">
 <div className={`app-icon-tile ${danger ? 'bg-red-50 text-red-600' : 'app-icon-tile-accent'}`}>
 <AlertTriangle className="w-5 h-5" />
 </div>
 <h2 className="app-card-title truncate">{title}</h2>
 </div>
 <button
 type="button"
 onClick={onCancel}
 className="app-btn app-btn-icon app-btn-ghost"
 aria-label="Close"
 >
 <X className="w-4 h-4" />
 </button>
 </div>
 <div className="px-5 py-4">
 <p className="text-sm text-secondary-500 whitespace-pre-line leading-relaxed">{message}</p>
 </div>
 <div className="px-5 py-4 bg-gray-50/70 border-t border-gray-100 flex justify-end gap-2">
 <button
 type="button"
 onClick={onCancel}
 className="app-btn app-btn-ghost"
 >
 {cancelLabel}
 </button>
 <button
 type="button"
 onClick={onConfirm}
 className={`app-btn ${danger ? 'app-btn-danger' : 'app-btn-primary'}`}
 >
 {confirmLabel}
 </button>
 </div>
 </ModalFrame>
 )
}
