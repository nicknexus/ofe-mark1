import React from 'react'
import { Tag as TagIcon } from 'lucide-react'

/**
 * Centralised public-side tag chip styling. Update the helpers in this file
 * to change every public chip in the app at once. Today they're neutral
 * grayscale; switch the `BASE_*` and `SELECTED_*` constants to swap to a
 * branded look without touching individual pages.
 */

interface PublicTagChipProps {
    name: string
    selected?: boolean
    onClick?: (e?: React.MouseEvent) => void
    /** Defaults to `sm`. */
    size?: 'xs' | 'sm' | 'md'
    /** Render with no icon. Useful for very tight spaces. */
    iconless?: boolean
    className?: string
    title?: string
}

// All visual tokens live here so future re-skins are a one-file change.
const BASE_BG = 'bg-gray-100'
const BASE_BORDER = 'border-gray-200'
const BASE_TEXT = 'text-gray-700'
const BASE_ICON = 'text-gray-400'
const HOVER = 'hover:bg-gray-200/80 hover:border-gray-300'

const SELECTED_BG = 'bg-gray-900'
const SELECTED_BORDER = 'border-gray-900'
const SELECTED_TEXT = 'text-white'
const SELECTED_ICON = 'text-white/80'

const sizeClasses: Record<NonNullable<PublicTagChipProps['size']>, string> = {
    xs: 'text-[11px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-1.5',
}

const iconSize: Record<NonNullable<PublicTagChipProps['size']>, string> = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
}

export default function PublicTagChip({
    name,
    selected = false,
    onClick,
    size = 'sm',
    iconless = false,
    className = '',
    title,
}: PublicTagChipProps) {
    const interactive = !!onClick
    const base = `inline-flex items-center rounded-full border font-medium transition-colors whitespace-nowrap ${sizeClasses[size]}`
    const palette = selected
        ? `${SELECTED_BG} ${SELECTED_BORDER} ${SELECTED_TEXT}`
        : `${BASE_BG} ${BASE_BORDER} ${BASE_TEXT} ${interactive ? HOVER : ''}`

    const content = (
        <>
            {!iconless && (
                <TagIcon className={`${iconSize[size]} ${selected ? SELECTED_ICON : BASE_ICON}`} />
            )}
            <span className="truncate max-w-[180px]">{name}</span>
        </>
    )

    if (interactive) {
        return (
            <button
                type="button"
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onClick?.(e)
                }}
                className={`${base} ${palette} cursor-pointer ${className}`}
                title={title ?? name}
            >
                {content}
            </button>
        )
    }
    return (
        <span className={`${base} ${palette} ${className}`} title={title ?? name}>
            {content}
        </span>
    )
}
