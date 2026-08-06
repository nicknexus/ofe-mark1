import React from 'react'
import { Tag as TagIcon } from 'lucide-react'
import type { PublicMetricTag } from '../../services/publicApi'
import FilterPill from '../shared/FilterPill'

interface PublicTagFilterProps {
    tags: PublicMetricTag[]
    selectedTagIds: string[]
    onChange: (ids: string[]) => void
    /** Coordinate dropdown stacking with sibling pills. */
    onOpenChange?: (open: boolean) => void
    /** Customise the placeholder when nothing is selected. Defaults to "Tag". */
    placeholder?: string
    className?: string
    /** @deprecated Ignored — active state uses the shared primary pill fill. */
    activeColor?: string
}

/**
 * Multi-select tag filter. Same modern pill language as the private Logs /
 * Metrics filter bars (flat icon, primary fill when active).
 */
export default function PublicTagFilter({
    tags,
    selectedTagIds,
    onChange,
    onOpenChange,
    placeholder = 'Tag',
    className = '',
}: PublicTagFilterProps) {
    if (!tags || tags.length === 0) return null

    return (
        <div className={`flex-shrink-0 ${className}`}>
            <FilterPill
                icon={TagIcon}
                label={placeholder}
                pluralLabel="tags"
                options={tags.map(t => ({
                    id: t.id,
                    name: t.name,
                    color: t.color || undefined,
                }))}
                selected={selectedTagIds}
                onChange={onChange}
                emptyText="No tags"
                onOpenChange={onOpenChange}
            />
        </div>
    )
}
