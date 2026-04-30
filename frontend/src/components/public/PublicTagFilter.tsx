import React, { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Tag as TagIcon, ChevronDown, X } from 'lucide-react'
import type { PublicMetricTag } from '../../services/publicApi'

interface PublicTagFilterProps {
    tags: PublicMetricTag[]
    selectedTagIds: string[]
    onChange: (ids: string[]) => void
    /** When true the trigger keeps its full pill style; rendered inline with other public filter pills. */
    className?: string
    /** Optional prop to coordinate dropdown stacking with sibling pills. */
    onOpenChange?: (open: boolean) => void
    /** Customise the placeholder when nothing is selected. Defaults to "Tag". */
    placeholder?: string
}

/**
 * Multi-select tag filter pill. Mirrors the look of the existing initiative /
 * location pills on the public org and initiative pages so it slots into
 * those filter rows seamlessly.
 *
 * Selection model: empty array = no filter (show everything). Otherwise we
 * keep claims/evidence/stories whose tag membership intersects the selected
 * set (OR semantics — same as the private side).
 */
export default function PublicTagFilter({
    tags,
    selectedTagIds,
    onChange,
    className = '',
    onOpenChange,
    placeholder = 'Tag',
}: PublicTagFilterProps) {
    const [open, setOpen] = useState(false)
    const btnRef = useRef<HTMLButtonElement>(null)

    if (!tags || tags.length === 0) return null

    const setOpenAnnounced = (next: boolean) => {
        setOpen(next)
        onOpenChange?.(next)
    }

    const toggle = (id: string) => {
        onChange(
            selectedTagIds.includes(id)
                ? selectedTagIds.filter(x => x !== id)
                : [...selectedTagIds, id]
        )
    }

    const clear = () => onChange([])

    return (
        <>
            <button
                ref={btnRef}
                onClick={() => setOpenAnnounced(!open)}
                className={`flex items-center pl-0 pr-1.5 sm:pr-2.5 h-7 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-[11px] font-medium transition-all border border-gray-200 shadow-sm flex-shrink-0 ${className}`}
            >
                <div className="w-7 h-7 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                    <TagIcon className="w-3.5 h-3.5 text-gray-600" />
                </div>
                <span className={`ml-1 sm:ml-1.5 max-w-[60px] sm:max-w-[90px] md:max-w-[120px] truncate ${selectedTagIds.length > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {selectedTagIds.length > 0 ? `${selectedTagIds.length} tag${selectedTagIds.length === 1 ? '' : 's'}` : placeholder}
                </span>
                {selectedTagIds.length > 0 ? (
                    <X
                        className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-0.5 sm:ml-1"
                        onClick={(e) => { e.stopPropagation(); clear() }}
                    />
                ) : (
                    <ChevronDown className="w-3 h-3 text-gray-400 ml-0.5" />
                )}
            </button>

            {open && createPortal(
                <>
                    <div className="fixed inset-0 z-[9998]" onClick={() => setOpenAnnounced(false)} />
                    <div
                        className="fixed w-64 bg-white rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 z-[9999] py-1 max-h-72 overflow-y-auto"
                        style={(() => {
                            const rect = btnRef.current?.getBoundingClientRect()
                            if (!rect) return {}
                            return { top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 272)) }
                        })()}
                    >
                        {selectedTagIds.length > 0 && (
                            <button
                                onClick={clear}
                                className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-gray-50 border-b border-gray-100"
                            >
                                Clear tag filter
                            </button>
                        )}
                        {tags.map(t => {
                            const isSelected = selectedTagIds.includes(t.id)
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => toggle(t.id)}
                                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${isSelected ? 'bg-gray-50 font-medium' : 'hover:bg-gray-50'}`}
                                >
                                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-gray-900 border-2 border-gray-900' : 'border-2 border-gray-300 bg-white'}`}>
                                        {isSelected && (
                                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </div>
                                    <span className={`truncate block ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{t.name}</span>
                                </button>
                            )
                        })}
                    </div>
                </>,
                document.body
            )}
        </>
    )
}
