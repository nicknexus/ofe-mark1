import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tag as TagIcon, Plus, ArrowRight, Lock } from 'lucide-react'
import { MetricTag } from '../../types'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import UpgradeModal from '../UpgradeModal'
import { SubscriptionService } from '../../services/subscription'

interface TagsWidgetProps {
 /**
 * Whether to show a compact mobile-friendly variant. The widget itself
 * works in both layouts; this just tweaks padding/sizing.
 */
 compact?: boolean
}

export default function TagsWidget({ compact }: TagsWidgetProps) {
 const { canAddTags } = useTeam()
 const [tags, setTags] = useState<MetricTag[]>([])
 const [loading, setLoading] = useState(true)
 const [creating, setCreating] = useState(false)
 const [showInput, setShowInput] = useState(false)
 const [newName, setNewName] = useState('')
 const [showUpgrade, setShowUpgrade] = useState(false)
 // Free plan: tags exist but are locked (read-only, greyed) until upgrade.
 const [tagsLocked, setTagsLocked] = useState(false)

 useEffect(() => {
 SubscriptionService.getFeatures()
 .then(f => setTagsLocked(!f.tags))
 .catch(() => { /* fail open — no lock if the lookup fails */ })
 }, [])

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
 } catch (e: any) {
 // Free plan can't use tags → show upgrade options instead of a toast.
 if (e?.code === 'FEATURE_NOT_IN_PLAN') {
 setShowInput(false)
 setShowUpgrade(true)
 } else {
 notify.error((e as Error).message || 'Failed to create tag')
 }
 } finally {
 setCreating(false)
 }
 }

 return (
 <>
 <div className={`app-card-interactive overflow-hidden flex flex-col ${compact ? '' : 'min-h-0 h-full'}`}>
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
 {canAddTags && (
 <button
 type="button"
 onClick={() => tagsLocked ? setShowUpgrade(true) : setShowInput(s => !s)}
 className={`px-2 py-1 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${tagsLocked ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-primary-700 bg-primary-50 hover:bg-primary-100'}`}
 >
 {tagsLocked ? <Lock className="w-3 h-3" /> : <Plus className="w-3.5 h-3.5" />}
 New
 </button>
 )}
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
 className="app-btn app-btn-primary app-btn-sm disabled:opacity-50"
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
 <>
 {tagsLocked && (
 <button
 type="button"
 onClick={() => setShowUpgrade(true)}
 className="w-full mb-2 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-1.5 hover:bg-amber-100 transition-colors"
 >
 <Lock className="w-3 h-3 flex-shrink-0" />
 Tags are locked on the Free plan — upgrade to use them
 </button>
 )}
 <div className={`grid grid-cols-2 gap-1.5 ${tagsLocked ? 'opacity-50' : ''}`}>
 {tags.slice(0, 4).map(tag => tagsLocked ? (
 <button
 key={tag.id}
 type="button"
 onClick={() => setShowUpgrade(true)}
 className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border bg-gray-50 border-gray-200 text-gray-500 min-w-0 cursor-not-allowed"
 >
 <Lock className="w-2.5 h-2.5 text-amber-400 flex-shrink-0" />
 <span className="truncate">{tag.name}</span>
 </button>
 ) : (
 <Link
 key={tag.id}
 to={`/tags/${tag.id}`}
 className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-gray-300 transition-colors min-w-0"
 >
 <TagIcon className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
 <span className="truncate">{tag.name}</span>
 <span className="ml-auto px-1 py-0.5 text-xs font-semibold rounded-full bg-white text-gray-500 border border-gray-200 flex-shrink-0">
 {(tag.metric_count ?? 0)}m/{(tag.claim_count ?? 0)}c
 </span>
 </Link>
 ))}
 </div>
 </>
 )}
 </div>
 </div>
 <UpgradeModal
 isOpen={showUpgrade}
 onClose={() => setShowUpgrade(false)}
 title="Tags are a paid feature"
 subtitle="Upgrade to Growth or Pro to organize metrics with themes and tags."
 />
 </>
 )
}
