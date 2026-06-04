import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Tag as TagIcon, Plus, Search, Trash2, Edit2, Check, X, GripVertical } from 'lucide-react'
import { notify } from '../lib/notify'
import {
 DndContext,
 closestCenter,
 KeyboardSensor,
 PointerSensor,
 useSensor,
 useSensors,
 DragEndEvent,
} from '@dnd-kit/core'
import {
 arrayMove,
 SortableContext,
 sortableKeyboardCoordinates,
 useSortable,
 verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { apiService } from '../services/api'
import { MetricTag } from '../types'
import ConfirmDialog from '../components/ConfirmDialog'
import { PageHeader, SectionLoader, EmptyState } from '../components/ui'
import { useTeam } from '../context/TeamContext'

interface SortableTagRowProps {
 tag: MetricTag
 isEditing: boolean
 editName: string
 onEditNameChange: (v: string) => void
 onStartEdit?: () => void
 onSaveEdit: () => void
 onCancelEdit: () => void
 onDelete?: () => void
 dragDisabled: boolean
}

function SortableTagRow({
 tag,
 isEditing,
 editName,
 onEditNameChange,
 onStartEdit,
 onSaveEdit,
 onCancelEdit,
 onDelete,
 dragDisabled,
}: SortableTagRowProps) {
 const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
 id: tag.id,
 disabled: dragDisabled,
 })

 const style: React.CSSProperties = {
 transform: CSS.Transform.toString(transform),
 transition,
 opacity: isDragging ? 0.5 : 1,
 }

 return (
 <div
 ref={setNodeRef}
 style={style}
 className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group bg-white"
 >
 <div className="flex items-center gap-3 flex-1 min-w-0">
 {/* Drag handle. Disabled while a search filter is active. */}
 <button
 type="button"
 {...attributes}
 {...listeners}
 disabled={dragDisabled}
 className={`p-1 -ml-1 text-gray-500 hover:text-gray-800 transition-colors ${
 dragDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
 }`}
 title={dragDisabled ? 'Clear search to reorder' : 'Drag to reorder'}
 aria-label="Drag to reorder"
 >
 <GripVertical className="w-4 h-4" strokeWidth={2.5} />
 </button>
 <div className="w-8 h-8 rounded-lg bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center flex-shrink-0">
 <TagIcon className="w-4 h-4 text-primary-600" />
 </div>
 {isEditing ? (
 <div className="flex items-center gap-2 flex-1">
 <input
 autoFocus
 value={editName}
 onChange={(e) => onEditNameChange(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === 'Enter') onSaveEdit()
 if (e.key === 'Escape') onCancelEdit()
 }}
 className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
 />
 <button onClick={onSaveEdit} className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg">
 <Check className="w-4 h-4" />
 </button>
 <button onClick={onCancelEdit} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg">
 <X className="w-4 h-4" />
 </button>
 </div>
 ) : (
 <Link to={`/tags/${tag.id}`} className="flex-1 min-w-0 hover:underline">
 <p className="text-sm font-semibold text-gray-900 truncate">{tag.name}</p>
 <p className="text-xs text-gray-500 mt-0.5">
 {tag.metric_count ?? 0} metric{(tag.metric_count ?? 0) !== 1 ? 's' : ''} ·{' '}
 {tag.claim_count ?? 0} claim{(tag.claim_count ?? 0) !== 1 ? 's' : ''}
 </p>
 </Link>
 )}
 </div>
 {!isEditing && (onStartEdit || onDelete) && (
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
 {onStartEdit && (
 <button
 onClick={onStartEdit}
 className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
 title="Rename"
 >
 <Edit2 className="w-4 h-4" />
 </button>
 )}
 {onDelete && (
 <button
 onClick={onDelete}
 className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
 title="Delete"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 )}
 </div>
 )
}

export default function AllTagsPage() {
 const navigate = useNavigate()
 const { canEditTags, canDelete } = useTeam()
 const [tags, setTags] = useState<MetricTag[]>([])
 const [loading, setLoading] = useState(true)
 const [search, setSearch] = useState('')
 const [showInput, setShowInput] = useState(false)
 const [newName, setNewName] = useState('')
 const [creating, setCreating] = useState(false)
 const [editingId, setEditingId] = useState<string | null>(null)
 const [editName, setEditName] = useState('')
 const [deleteConfirm, setDeleteConfirm] = useState<{ tag: MetricTag; message: string } | null>(null)

 const sensors = useSensors(
 useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
 useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
 )

 const load = async () => {
 try {
 setLoading(true)
 const data = await apiService.getMetricTags(true)
 setTags(data)
 } catch (e) {
 notify.error((e as Error).message || 'Failed to load tags')
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
 notify.error((e as Error).message || 'Failed to create tag')
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
 notify.error((e as Error).message || 'Failed to update tag')
 }
 }

 const requestRemove = (tag: MetricTag) => {
 const used = (tag.metric_count ?? 0) + (tag.claim_count ?? 0)
 const msg = used > 0
 ? `Delete "${tag.name}"?\n\nIt's attached to ${tag.metric_count ?? 0} metric(s) and ${tag.claim_count ?? 0} claim(s). They will become untagged but keep all their data.`
 : `Delete "${tag.name}"?`
 setDeleteConfirm({ tag, message: msg })
 }

 const remove = async () => {
 if (!deleteConfirm) return
 try {
 await apiService.deleteMetricTag(deleteConfirm.tag.id)
 setDeleteConfirm(null)
 notify.success('Tag deleted')
 await load()
 } catch (e) {
 notify.error((e as Error).message || 'Failed to delete tag')
 }
 }

 const filtered = useMemo(() => {
 const q = search.trim().toLowerCase()
 if (!q) return tags
 return tags.filter(t => t.name.toLowerCase().includes(q))
 }, [tags, search])

 // Drag is disabled while a search filter is active — reordering a filtered
 // subset would shuffle the underlying list in confusing ways.
 const dragDisabled = search.trim().length > 0 || !canEditTags

 const handleDragEnd = async (event: DragEndEvent) => {
 if (!canEditTags) return
 const { active, over } = event
 if (!over || active.id === over.id) return

 const oldIndex = tags.findIndex(t => t.id === active.id)
 const newIndex = tags.findIndex(t => t.id === over.id)
 if (oldIndex < 0 || newIndex < 0) return

 const reordered = arrayMove(tags, oldIndex, newIndex)
 const previous = tags

 // Optimistic update
 setTags(reordered)

 try {
 const order = reordered.map((t, i) => ({ id: t.id, display_order: i + 1 }))
 await apiService.updateMetricTagsOrder(order)
 } catch (e) {
 setTags(previous)
 notify.error((e as Error).message || 'Failed to reorder tags')
 }
 }

 return (
 <div className="min-h-screen app-canvas pt-24 pb-12 px-4 sm:px-6">
 <div className="max-w-5xl mx-auto">
 <PageHeader
 title="All Metric Tags"
 subtitle={`${tags.length} tag${tags.length !== 1 ? 's' : ''} · drag the handles to reorder`}
 backTo="/"
 icon={TagIcon}
 actions={canEditTags ? (
 <button type="button" onClick={() => setShowInput(s => !s)} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 New tag
 </button>
 ) : undefined}
 />

 <div className="app-card overflow-hidden">
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
 className="app-input flex-1"
 disabled={creating}
 />
 <button onClick={create} disabled={creating || !newName.trim()} className="app-btn app-btn-primary app-btn-sm">{creating ? '...' : 'Add'}</button>
 <button onClick={() => { setShowInput(false); setNewName('') }} className="app-btn app-btn-ghost app-btn-sm">Cancel</button>
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
 <SectionLoader />
 ) : filtered.length === 0 ? (
 <EmptyState
 icon={TagIcon}
 title={tags.length === 0 ? 'No tags yet' : `No tags match "${search}"`}
 description={tags.length === 0 ? 'Create tags to break metrics into sub-groups' : undefined}
 />
 ) : (
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragEnd={handleDragEnd}
 // Lock vertical motion to the list so dragged rows
 // don't visually escape into the header/footer.
 modifiers={[restrictToVerticalAxis, restrictToParentElement]}
 >
 <SortableContext
 items={filtered.map(t => t.id)}
 strategy={verticalListSortingStrategy}
 >
 <div className="divide-y divide-gray-100">
 {filtered.map(tag => (
 <SortableTagRow
 key={tag.id}
 tag={tag}
 isEditing={editingId === tag.id}
 editName={editName}
 onEditNameChange={setEditName}
 onStartEdit={canEditTags ? () => { setEditingId(tag.id); setEditName(tag.name) } : undefined}
 onSaveEdit={() => saveEdit(tag.id)}
 onCancelEdit={() => setEditingId(null)}
 onDelete={canDelete ? () => requestRemove(tag) : undefined}
 dragDisabled={dragDisabled}
 />
 ))}
 </div>
 </SortableContext>
 </DndContext>
 )}
 </div>
 </div>
 {deleteConfirm && (
 <ConfirmDialog
 title="Delete tag"
 message={deleteConfirm.message}
 confirmLabel="Delete tag"
 tone="danger"
 onConfirm={remove}
 onCancel={() => setDeleteConfirm(null)}
 />
 )}
 </div>
 )
}
