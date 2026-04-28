import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MetricTag } from '../../types'
import { apiService } from '../../services/api'
import TagChip from './TagChip'

interface EvidenceTagsListProps {
    tagIds?: string[] | null
    /** Hard cap for visible chips before showing "+N more" overflow. Defaults to 8. */
    visibleCap?: number
    size?: 'xs' | 'sm' | 'md'
    /** When true, clicking a chip navigates to that tag detail page. */
    clickable?: boolean
    className?: string
}

/**
 * Renders a horizontal list of tag chips for an evidence item.
 *
 * Caps visible chips at `visibleCap` (default 8) and shows a "+N more" trailing chip
 * that expands inline to render the rest. Resolves tag names from the org tag list
 * (cached by apiService).
 */
export default function EvidenceTagsList({
    tagIds,
    visibleCap = 8,
    size = 'xs',
    clickable = true,
    className = '',
}: EvidenceTagsListProps) {
    const [allTags, setAllTags] = useState<MetricTag[]>([])
    const [expanded, setExpanded] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        let active = true
        if (!tagIds || tagIds.length === 0) {
            setAllTags([])
            return
        }
        apiService.getMetricTags()
            .then(tags => { if (active) setAllTags(tags) })
            .catch(() => { if (active) setAllTags([]) })
        return () => { active = false }
    }, [(tagIds || []).join(',')])

    if (!tagIds || tagIds.length === 0) return null

    const tagById = new Map(allTags.map(t => [t.id, t]))
    const resolved = tagIds.map(id => tagById.get(id)).filter(Boolean) as MetricTag[]
    if (resolved.length === 0) return null

    const visible = expanded ? resolved : resolved.slice(0, visibleCap)
    const overflow = resolved.length - visible.length

    return (
        <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
            {visible.map(t => (
                <TagChip
                    key={t.id}
                    name={t.name}
                    size={size}
                    onClick={clickable ? () => navigate(`/tags/${t.id}`) : undefined}
                />
            ))}
            {overflow > 0 && !expanded && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpanded(true) }}
                    className="text-[11px] font-medium text-gray-500 hover:text-gray-700 px-1.5"
                >
                    +{overflow} more
                </button>
            )}
        </div>
    )
}
