import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag as TagIcon, Plus, ArrowRight } from 'lucide-react'
import { MetricTag } from '../../types'
import { apiService } from '../../services/api'
import toast from 'react-hot-toast'

interface TagsWidgetProps {
    /**
     * Whether to show a compact mobile-friendly variant. The widget itself
     * works in both layouts; this just tweaks padding/sizing.
     */
    compact?: boolean
}

export default function TagsWidget({ compact }: TagsWidgetProps) {
    const [tags, setTags] = useState<MetricTag[]>([])
    const [loading, setLoading] = useState(true)
    const [creating, setCreating] = useState(false)
    const [showInput, setShowInput] = useState(false)
    const [newName, setNewName] = useState('')

    const load = async () => {
        try {
            setLoading(true)
            const data = await apiService.getMetricTags(true)
            setTags(data)
        } catch {
            setTags([])
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const create = async () => {
        const name = newName.trim()
        if (!name) return
        try {
            setCreating(true)
            await apiService.createMetricTag(name)
            setNewName('')
            setShowInput(false)
            await load()
        } catch (e) {
            toast.error((e as Error).message || 'Failed to create tag')
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className={`bg-white rounded-2xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] ring-1 ring-gray-900/[0.04] overflow-hidden flex flex-col ${compact ? '' : 'min-h-0'}`}>
            <div className="px-4 py-3 border-b border-gray-100/70 bg-gradient-to-b from-gray-50/50 to-transparent flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
                        <TagIcon className="w-3.5 h-3.5 text-primary-600" />
                    </div>
                    <h3 className="text-[14px] font-semibold text-gray-900 tracking-tight">Metric Tags</h3>
                </div>
                <div className="flex items-center gap-1.5">
                    <Link
                        to="/tags"
                        className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex items-center gap-1"
                    >
                        See all
                        <ArrowRight className="w-3 h-3" />
                    </Link>
                    <button
                        type="button"
                        onClick={() => setShowInput(s => !s)}
                        className="px-2 py-1 text-xs font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        New
                    </button>
                </div>
            </div>

            {showInput && (
                <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <input
                        autoFocus
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); create() }
                            if (e.key === 'Escape') { setShowInput(false); setNewName('') }
                        }}
                        placeholder="Tag name (e.g. Grade 1)"
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                        disabled={creating}
                    />
                    <button
                        type="button"
                        onClick={create}
                        disabled={creating || !newName.trim()}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50"
                    >
                        {creating ? '...' : 'Add'}
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
                {loading ? (
                    <div className="text-center py-6 text-sm text-gray-400">Loading...</div>
                ) : tags.length === 0 ? (
                    <div className="text-center py-6">
                        <TagIcon className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-500">No tags yet</p>
                        <p className="text-xs text-gray-400 mt-1">Create tags to break metrics into sub-groups</p>
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {tags.map(tag => (
                            <Link key={tag.id} to={`/tags/${tag.id}`} className="contents">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors cursor-pointer">
                                    <TagIcon className="w-3 h-3 text-gray-400" />
                                    <span className="truncate max-w-[140px]">{tag.name}</span>
                                    <span className="ml-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-white text-gray-500 border border-gray-200">
                                        {(tag.metric_count ?? 0)}m / {(tag.claim_count ?? 0)}c
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
