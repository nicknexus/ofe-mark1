import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Tag as TagIcon, Loader2 } from 'lucide-react'
import { MetricTag } from '../../types'
import { apiService } from '../../services/api'
import TagChip from './TagChip'
import toast from 'react-hot-toast'

interface TagPickerProps {
    /**
     * Picker mode:
     *   'multi'         - select any number of tags from org (used when editing a metric).
     *   'single'        - select at most one tag (used when adding/editing an impact claim).
     *   'multi-grouped' - select multiple tags grouped by metric (evidence). Tags shown
     *                     are scoped to the union of `groups[].tagIds`. Same tag id across
     *                     groups is rendered once per group; selecting any toggles a single
     *                     entry in selectedIds.
     */
    mode: 'multi' | 'single' | 'multi-grouped'
    /**
     * For 'single' mode, this restricts the selectable set to the parent metric's
     * tags. Pass undefined or [] in 'multi' to allow choosing any org tag.
     */
    allowedTagIds?: string[] | null
    /**
     * For 'multi-grouped' mode, the metric -> tag mapping to render as sections.
     */
    groups?: { metricId: string; metricTitle: string; tagIds: string[] }[]
    /**
     * Selected tag IDs. For 'single' mode, length 0 or 1.
     */
    selectedIds: string[]
    onChange: (ids: string[]) => void
    /**
     * Disable creating new tags from this picker. Defaults to false (allowed in
     * 'multi' mode for metrics; disallowed makes sense in 'single' mode for claims
     * because claims must use a tag already attached to the parent metric).
     */
    canCreate?: boolean
    label?: string
    helperText?: string
}

export default function TagPicker({
    mode,
    allowedTagIds,
    groups,
    selectedIds,
    onChange,
    canCreate,
    label,
    helperText,
}: TagPickerProps) {
    const [allTags, setAllTags] = useState<MetricTag[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState('')
    const [showCreateInput, setShowCreateInput] = useState(false)

    const allowCreate = canCreate ?? (mode === 'multi')

    useEffect(() => {
        let active = true
        setLoading(true)
        apiService.getMetricTags()
            .then(tags => { if (active) setAllTags(tags) })
            .catch(() => { if (active) setAllTags([]) })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])

    const visibleTags = useMemo(() => {
        if (mode === 'single' && Array.isArray(allowedTagIds)) {
            const allow = new Set(allowedTagIds)
            return allTags.filter(t => allow.has(t.id))
        }
        return allTags
    }, [allTags, allowedTagIds, mode])

    const toggle = (tagId: string) => {
        if (mode === 'single') {
            if (selectedIds.includes(tagId)) {
                onChange([])
            } else {
                onChange([tagId])
            }
            return
        }
        if (selectedIds.includes(tagId)) {
            onChange(selectedIds.filter(id => id !== tagId))
        } else {
            onChange([...selectedIds, tagId])
        }
    }

    const handleCreate = async () => {
        const name = newName.trim()
        if (!name) return
        try {
            setCreating(true)
            const tag = await apiService.createMetricTag(name)
            setAllTags(prev => prev.some(t => t.id === tag.id) ? prev : [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))
            if (mode === 'single') {
                onChange([tag.id])
            } else if (!selectedIds.includes(tag.id)) {
                onChange([...selectedIds, tag.id])
            }
            setNewName('')
            setShowCreateInput(false)
        } catch (e) {
            toast.error((e as Error).message || 'Failed to create tag')
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="space-y-2">
            {label && (
                <label className="block text-sm font-semibold text-gray-900">
                    <TagIcon className="w-4 h-4 inline mr-1.5 text-primary-600" />
                    {label}
                </label>
            )}
            {helperText && <p className="text-xs text-gray-500">{helperText}</p>}

            {loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading tags...
                </div>
            ) : mode === 'multi-grouped' ? (
                (() => {
                    const tagById = new Map(allTags.map(t => [t.id, t]))
                    const populatedGroups = (groups || []).filter(g => g.tagIds.length > 0)
                    if (populatedGroups.length === 0) {
                        return (
                            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                                <p className="text-sm text-gray-500">None of the selected metrics have tags. You can skip this step.</p>
                            </div>
                        )
                    }
                    return (
                        <div className="space-y-3">
                            {populatedGroups.map(group => (
                                <div key={group.metricId} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 truncate">{group.metricTitle}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {group.tagIds.map(tid => {
                                            const tag = tagById.get(tid)
                                            if (!tag) return null
                                            const selected = selectedIds.includes(tid)
                                            return (
                                                <TagChip
                                                    key={tid}
                                                    name={tag.name}
                                                    selected={selected}
                                                    onClick={() => toggle(tid)}
                                                    size="sm"
                                                />
                                            )
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                })()
            ) : visibleTags.length === 0 ? (
                <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                    <p className="text-sm text-gray-500">
                        {mode === 'single' && Array.isArray(allowedTagIds)
                            ? 'No tags on this metric yet. Add tags when editing the metric.'
                            : 'No tags yet. Create your first tag below.'}
                    </p>
                </div>
            ) : (
                <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
                    {visibleTags.map(tag => {
                        const selected = selectedIds.includes(tag.id)
                        return (
                            <TagChip
                                key={tag.id}
                                name={tag.name}
                                selected={selected}
                                onClick={() => toggle(tag.id)}
                                size="sm"
                            />
                        )
                    })}
                </div>
            )}

            {allowCreate && (
                <div>
                    {showCreateInput ? (
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); handleCreate() }
                                    if (e.key === 'Escape') { setShowCreateInput(false); setNewName('') }
                                }}
                                placeholder="New tag name (e.g. Grade 1)"
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                                autoFocus
                                disabled={creating}
                            />
                            <button
                                type="button"
                                onClick={handleCreate}
                                disabled={creating || !newName.trim()}
                                className="px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50"
                            >
                                {creating ? '...' : 'Add'}
                            </button>
                            <button
                                type="button"
                                onClick={() => { setShowCreateInput(false); setNewName('') }}
                                className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-800"
                            >
                                Cancel
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowCreateInput(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-full transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Tag
                        </button>
                    )}
                </div>
            )}
        </div>
    )
}
