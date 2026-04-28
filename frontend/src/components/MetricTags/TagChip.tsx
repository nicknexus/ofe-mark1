import React from 'react'
import { Tag as TagIcon, X } from 'lucide-react'

interface TagChipProps {
    name: string
    onRemove?: () => void
    onClick?: () => void
    selected?: boolean
    size?: 'xs' | 'sm' | 'md'
    className?: string
}

const sizeClasses: Record<NonNullable<TagChipProps['size']>, string> = {
    xs: 'text-[11px] px-2 py-0.5 gap-1',
    sm: 'text-xs px-2.5 py-1 gap-1.5',
    md: 'text-sm px-3 py-1.5 gap-1.5',
}

const iconSize: Record<NonNullable<TagChipProps['size']>, string> = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
}

export default function TagChip({ name, onRemove, onClick, selected, size = 'sm', className = '' }: TagChipProps) {
    const interactive = !!onClick
    const base = `inline-flex items-center rounded-full border font-medium transition-colors ${sizeClasses[size]}`
    const colors = selected
        ? 'bg-primary-100 border-primary-300 text-primary-800'
        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'

    const content = (
        <>
            <TagIcon className={`${iconSize[size]} ${selected ? 'text-primary-600' : 'text-gray-400'}`} />
            <span className="truncate max-w-[160px]">{name}</span>
            {onRemove && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove() }}
                    className={`${selected ? 'text-primary-500 hover:text-primary-700' : 'text-gray-400 hover:text-gray-600'} -mr-0.5`}
                    aria-label={`Remove tag ${name}`}
                >
                    <X className={iconSize[size]} />
                </button>
            )}
        </>
    )

    if (interactive) {
        return (
            <button type="button" onClick={onClick} className={`${base} ${colors} cursor-pointer ${className}`}>
                {content}
            </button>
        )
    }
    return <span className={`${base} ${colors} ${className}`}>{content}</span>
}
