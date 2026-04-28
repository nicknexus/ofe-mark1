import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag as TagIcon, Plus, Search, Trash2, Edit2, Check, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiService } from '../services/api'
import { MetricTag } from '../types'

export default function AllTagsPage() {
    const navigate = useNavigate()
    const [tags, setTags] = useState<MetricTag[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [showInput, setShowInput] = useState(false)
    const [newName, setNewName] = useState('')
    const [creating, setCreating] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    const load = async () => {
        try {
            setLoading(true)
            const data = await apiService.getMetricTags(true)
            setTags(data)
        } catch (e) {
            toast.error((e as Error).message || 'Failed to load tags')
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

    const saveEdit = async (id: string) => {
        if (!editName.trim()) return
        try {
            await apiService.updateMetricTag(id, { name: editName.trim() })
            setEditingId(null)
            await load()
        } catch (e) {
            toast.error((e as Error).message || 'Failed to update tag')
        }
    }

    const remove = async (tag: MetricTag) => {
        const used = (tag.metric_count ?? 0) + (tag.claim_count ?? 0)
        const msg = used > 0
            ? `Delete "${tag.name}"?\n\nIt's attached to ${tag.metric_count ?? 0} metric(s) and ${tag.claim_count ?? 0} claim(s). They will become untagged but keep all their data.`
            : `Delete "${tag.name}"?`
        if (!window.confirm(msg)) return
        try {
            await apiService.deleteMetricTag(tag.id)
            toast.success('Tag deleted')
            await load()
        } catch (e) {
            toast.error((e as Error).message || 'Failed to delete tag')
        }
    }

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return tags
        return tags.filter(t => t.name.toLowerCase().includes(q))
    }, [tags, search])

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to dashboard
                </button>

                <div className="bg-white rounded-2xl ring-1 ring-gray-900/[0.04] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-100/70 bg-gradient-to-b from-gray-50/50 to-transparent flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center flex-shrink-0">
                                <TagIcon className="w-5 h-5 text-primary-600" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-xl font-bold text-gray-900 truncate">All Metric Tags</h1>
                                <p className="text-xs text-gray-500 mt-0.5">{tags.length} tag{tags.length !== 1 ? 's' : ''} in your organization</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowInput(s => !s)}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            New tag
                        </button>
                    </div>

                    {showInput && (
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                            <input
                                autoFocus
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); create() }
                                    if (e.key === 'Escape') { setShowInput(false); setNewName('') }
                                }}
                                placeholder="Tag name (e.g. Grade 1, Q1 2025, Female)"
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-transparent"
                                disabled={creating}
                            />
                            <button onClick={create} disabled={creating || !newName.trim()} className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg disabled:opacity-50">{creating ? '...' : 'Add'}</button>
                            <button onClick={() => { setShowInput(false); setNewName('') }} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
                        </div>
                    )}

                    <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-2">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search tags..."
                            className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent outline-none"
                        />
                    </div>

                    {loading ? (
                        <div className="p-12 text-center text-sm text-gray-400">Loading...</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center">
                            <TagIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                            {tags.length === 0 ? (
                                <>
                                    <p className="text-sm font-medium text-gray-700">No tags yet</p>
                                    <p className="text-xs text-gray-500 mt-1">Create tags to break metrics into sub-groups</p>
                                </>
                            ) : (
                                <p className="text-sm text-gray-500">No tags match "{search}"</p>
                            )}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filtered.map(tag => (
                                <div key={tag.id} className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center flex-shrink-0">
                                            <TagIcon className="w-4 h-4 text-primary-600" />
                                        </div>
                                        {editingId === tag.id ? (
                                            <div className="flex items-center gap-2 flex-1">
                                                <input
                                                    autoFocus
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(tag.id); if (e.key === 'Escape') setEditingId(null) }}
                                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
                                                />
                                                <button onClick={() => saveEdit(tag.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                                                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4" /></button>
                                            </div>
                                        ) : (
                                            <Link to={`/tags/${tag.id}`} className="flex-1 min-w-0 hover:underline">
                                                <p className="text-sm font-semibold text-gray-900 truncate">{tag.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">{tag.metric_count ?? 0} metric{(tag.metric_count ?? 0) !== 1 ? 's' : ''} · {tag.claim_count ?? 0} claim{(tag.claim_count ?? 0) !== 1 ? 's' : ''}</p>
                                            </Link>
                                        )}
                                    </div>
                                    {editingId !== tag.id && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => { setEditingId(tag.id); setEditName(tag.name) }} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Rename"><Edit2 className="w-4 h-4" /></button>
                                            <button onClick={() => remove(tag)} className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
