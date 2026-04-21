import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, ExternalLink } from 'lucide-react'

interface ContextDetailModalProps {
    open: boolean
    onClose: () => void
    typeBadge: 'Stat' | 'Statement' | 'Stage'
    brandColor: string
    value?: string
    title?: string
    description?: string
    source?: string
    sourceUrl?: string
    createdAt?: string
}

function formatAddedDate(iso?: string): string | null {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return `Added ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
}

export default function ContextDetailModal({
    open,
    onClose,
    typeBadge,
    brandColor,
    value,
    title,
    description,
    source,
    sourceUrl,
    createdAt,
}: ContextDetailModalProps) {
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        const prev = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            window.removeEventListener('keydown', onKey)
            document.body.style.overflow = prev
        }
    }, [open, onClose])

    if (!open) return null

    const dateLabel = formatAddedDate(createdAt)
    const srcTitle = (source || '').trim()
    const srcUrl = (sourceUrl || '').trim()
    const hasSource = !!srcTitle || !!srcUrl
    const srcLabel = srcTitle || (srcUrl ? 'Source' : '')

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fadeIn"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />

            {/* Panel */}
            <div
                className="relative bg-white rounded-3xl shadow-2xl border border-gray-100 max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Accent bar */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-1"
                    style={{ backgroundColor: brandColor }}
                />

                <div className="flex items-start justify-between px-6 md:px-8 pt-6 pl-7 md:pl-9">
                    <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider"
                        style={{ backgroundColor: `${brandColor}22`, color: brandColor }}
                    >
                        {typeBadge}
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 md:px-8 pb-6 pl-7 md:pl-9 pt-4 overflow-y-auto">
                    {value && value.trim() && (
                        <div
                            className="text-4xl md:text-5xl font-bold tracking-tight leading-none mb-3"
                            style={{ color: brandColor }}
                        >
                            {value}
                        </div>
                    )}
                    {title && title.trim() && (
                        <h2 className="text-xl md:text-2xl font-bold text-gray-900 mb-3 leading-snug">
                            {title}
                        </h2>
                    )}
                    {description && description.trim() && (
                        <p className="text-[15px] leading-relaxed text-gray-700 whitespace-pre-wrap">
                            {description}
                        </p>
                    )}
                </div>

                {(hasSource || dateLabel) && (
                    <div className="border-t border-gray-100 px-6 md:px-8 py-4 pl-7 md:pl-9 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-wider text-gray-400 font-medium bg-gray-50/50">
                        {hasSource && (
                            srcUrl ? (
                                <a
                                    href={srcUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 hover:underline transition-colors"
                                    style={{ color: brandColor }}
                                    title={srcUrl}
                                >
                                    {srcLabel}
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            ) : (
                                <span>{srcLabel}</span>
                            )
                        )}
                        {hasSource && dateLabel && <span className="text-gray-300">·</span>}
                        {dateLabel && <span>{dateLabel}</span>}
                    </div>
                )}
            </div>
        </div>,
        document.body
    )
}

export { formatAddedDate }
