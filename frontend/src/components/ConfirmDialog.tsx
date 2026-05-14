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
            backdropClassName="bg-gray-900/35 backdrop-blur-sm"
            panelClassName="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-modal"
        >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-50 text-red-600' : 'bg-primary-50 text-primary-700'}`}>
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <h2 className="text-base font-semibold text-foreground truncate">{title}</h2>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="px-5 py-4">
                    <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{message}</p>
                </div>
                <div className="px-5 py-4 bg-gray-50/70 border-t border-gray-100 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-white rounded-xl transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${danger ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-primary-500 hover:bg-primary-600 text-gray-800'}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
        </ModalFrame>
    )
}
