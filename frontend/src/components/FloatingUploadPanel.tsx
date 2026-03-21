import React, { useEffect } from 'react'
import { X, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Upload, XCircle } from 'lucide-react'
import { useUploadManager, UploadItem } from '../context/UploadContext'

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0)} ${sizes[i]}`
}

function UploadRow({ item, onDismiss, onCancel }: { item: UploadItem; onDismiss: () => void; onCancel: () => void }) {
    const isActive = item.status === 'uploading'
    const isDone = item.status === 'complete'
    const isFailed = item.status === 'error'

    return (
        <div className="px-4 py-3 border-b border-gray-100 last:border-b-0">
            <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                    {isDone && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                    {isFailed && <AlertCircle className="w-5 h-5 text-red-500" />}
                    {item.status === 'cancelled' && <XCircle className="w-5 h-5 text-gray-400" />}
                    {isActive && (
                        <div className="w-5 h-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{item.fileName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500">
                            {isActive
                                ? `${formatBytes(item.loaded)} / ${formatBytes(item.fileSize)}`
                                : isDone
                                ? formatBytes(item.fileSize)
                                : item.error || 'Cancelled'
                            }
                        </span>
                        {isActive && (
                            <span className="text-xs font-semibold text-blue-600">{item.progress}%</span>
                        )}
                    </div>
                </div>
                <div className="flex-shrink-0">
                    {isActive ? (
                        <button
                            onClick={onCancel}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Cancel upload"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    ) : (
                        <button
                            onClick={onDismiss}
                            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Dismiss"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>
            </div>
            {isActive && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${item.progress}%` }}
                    />
                </div>
            )}
        </div>
    )
}

export default function FloatingUploadPanel() {
    const { uploads, dismissUpload, dismissAll, cancelUpload, isMinimized, setIsMinimized } = useUploadManager()

    // Warn user before leaving page if uploads are active
    useEffect(() => {
        const hasActive = uploads.some(u => u.status === 'uploading')
        if (!hasActive) return

        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [uploads])

    if (uploads.length === 0) return null

    const activeCount = uploads.filter(u => u.status === 'uploading').length
    const completedCount = uploads.filter(u => u.status === 'complete').length
    const totalCount = uploads.length

    const headerText = activeCount > 0
        ? `Uploading ${activeCount} file${activeCount > 1 ? 's' : ''}...`
        : completedCount === totalCount
        ? `${completedCount} upload${completedCount > 1 ? 's' : ''} complete`
        : `${totalCount} upload${totalCount > 1 ? 's' : ''}`

    return (
        <div className="fixed bottom-4 right-4 z-[100] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-slide-up-fast">
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer select-none"
                onClick={() => setIsMinimized(!isMinimized)}
            >
                <div className="flex items-center gap-2.5">
                    <Upload className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-700">{headerText}</span>
                </div>
                <div className="flex items-center gap-1">
                    {activeCount === 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                dismissAll()
                            }}
                            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                            title="Dismiss all"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation()
                            setIsMinimized(!isMinimized)
                        }}
                        className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        {isMinimized
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                    </button>
                </div>
            </div>

            {/* Warning */}
            {!isMinimized && activeCount > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                    <p className="text-xs text-amber-700 font-medium">
                        Do not leave or refresh the page until upload has completed.
                    </p>
                </div>
            )}

            {/* Upload list */}
            {!isMinimized && (
                <div className="max-h-64 overflow-y-auto">
                    {uploads.map(item => (
                        <UploadRow
                            key={item.id}
                            item={item}
                            onDismiss={() => dismissUpload(item.id)}
                            onCancel={() => cancelUpload(item.id)}
                        />
                    ))}
                </div>
            )}

            {/* Minimized progress bar */}
            {isMinimized && activeCount > 0 && (
                <div className="px-4 py-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
                            style={{
                                width: `${Math.round(
                                    uploads
                                        .filter(u => u.status === 'uploading')
                                        .reduce((sum, u) => sum + u.progress, 0) /
                                    activeCount
                                )}%`
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}
