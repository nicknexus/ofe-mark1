import React, { useRef, useState, useCallback } from 'react'
import { Upload, X, File as FileIcon, Loader2, Check, AlertCircle, Link as LinkIcon } from 'lucide-react'
import { FileItem } from '../types'

interface UploadStepProps {
    files: FileItem[]
    onAddFiles: (files: File[]) => void
    onRemoveFile: (fileId: string) => void
    onAddLink?: (url: string) => void
}

const ACCEPT = 'image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx'

export default function UploadStep({ files, onAddFiles, onRemoveFile, onAddLink }: UploadStepProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [linkInput, setLinkInput] = useState('')
    const [linkError, setLinkError] = useState('')

    const handleAddLink = useCallback(() => {
        const url = linkInput.trim()
        if (!url) return
        try {
            new URL(url)
        } catch {
            setLinkError('Please enter a valid URL (e.g. https://example.com)')
            return
        }
        onAddLink?.(url)
        setLinkInput('')
        setLinkError('')
    }, [linkInput, onAddLink])

    const handleSelect = useCallback((fl: FileList | File[]) => {
        const arr = Array.from(fl)
        if (arr.length) onAddFiles(arr)
    }, [onAddFiles])

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files?.length) handleSelect(e.dataTransfer.files)
    }
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }

    return (
        <div className="h-full flex flex-col min-h-0">
            <div className="max-w-3xl w-full mx-auto py-6 px-4 flex flex-col gap-5 flex-1 min-h-0">
                <div className="text-center flex-shrink-0">
                    <h3 className="text-xl font-semibold text-gray-900">Upload your files</h3>
                    <p className="text-sm text-gray-500 mt-1.5">
                        Add everything first. You'll organize them into evidence groups in the next step.
                    </p>
                </div>

                <div
                    onClick={() => inputRef.current?.click()}
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    className={`border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all flex-shrink-0 ${
                        files.length > 0 ? 'p-6' : 'p-10'
                    } ${
                        isDragOver
                            ? 'border-evidence-500 bg-evidence-50/60 scale-[1.01]'
                            : 'border-gray-300 hover:border-evidence-400 hover:bg-gray-50/60'
                    }`}
                >
                    <div className={`mx-auto rounded-2xl bg-evidence-500/10 border border-evidence-300/40 flex items-center justify-center ${
                        files.length > 0 ? 'w-10 h-10 mb-2' : 'w-14 h-14 mb-4'
                    }`}>
                        <Upload className={files.length > 0 ? 'w-5 h-5 text-evidence-600' : 'w-7 h-7 text-evidence-600'} />
                    </div>
                    <p className="text-base font-semibold text-gray-800">
                        Drag & drop files, or <span className="text-evidence-600">browse</span>
                    </p>
                    {files.length === 0 && (
                        <p className="text-xs text-gray-500 mt-1.5">
                            Images, videos, PDFs, documents — upload as many as you need
                        </p>
                    )}
                    <input
                        ref={inputRef}
                        type="file"
                        multiple
                        accept={ACCEPT}
                        className="hidden"
                        onChange={e => e.target.files && handleSelect(e.target.files)}
                    />
                </div>

                {/* Add link section */}
                {onAddLink && (
                    <div className="flex-shrink-0">
                        <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="text-xs text-gray-400 font-medium">or add a link</span>
                            <div className="flex-1 border-t border-gray-200" />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="url"
                                    value={linkInput}
                                    onChange={e => { setLinkInput(e.target.value); setLinkError('') }}
                                    onKeyDown={e => e.key === 'Enter' && handleAddLink()}
                                    placeholder="https://example.com/report.pdf"
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-evidence-400 focus:border-transparent"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleAddLink}
                                disabled={!linkInput.trim()}
                                className="px-4 py-2 text-sm font-medium bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                            >
                                Add
                            </button>
                        </div>
                        {linkError && <p className="text-xs text-red-500 mt-1">{linkError}</p>}
                    </div>
                )}

                {files.length > 0 && (
                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex items-center justify-between flex-shrink-0">
                            <h4 className="text-sm font-semibold text-gray-700">
                                {files.length} item{files.length === 1 ? '' : 's'} added
                            </h4>
                            {files.some(f => !f.isLink && f.status === 'uploading') && (
                                <span className="inline-flex items-center gap-1.5 text-xs text-evidence-600">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Uploading in background…
                                </span>
                            )}
                        </div>
                        <div className="space-y-1.5 overflow-y-auto pr-1 flex-1 min-h-0">
                            {files.map(f => (
                                <div key={f.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${f.isLink ? 'bg-blue-100' : 'bg-evidence-100'}`}>
                                        {f.isLink
                                            ? <LinkIcon className="w-4 h-4 text-blue-600" />
                                            : <FileIcon className="w-4 h-4 text-evidence-600" />
                                        }
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-800 truncate">
                                            {f.isLink ? f.linkUrl : f.file.name}
                                        </p>
                                        {!f.isLink && (
                                            <p className="text-xs text-gray-500">
                                                {(f.file.size / 1024 / 1024).toFixed(2)} MB
                                                {f.status === 'uploading' && ` · ${f.progress}%`}
                                                {f.status === 'error' && ` · ${f.error || 'Upload failed'}`}
                                            </p>
                                        )}
                                        {f.isLink && <p className="text-xs text-gray-400">External link</p>}
                                    </div>
                                    {f.status === 'done' && <Check className="w-4 h-4 text-green-600 flex-shrink-0" />}
                                    {f.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                    {!f.isLink && f.status === 'uploading' && <Loader2 className="w-4 h-4 text-evidence-500 animate-spin flex-shrink-0" />}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRemoveFile(f.id) }}
                                        className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                        aria-label="Remove"
                                    >
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
