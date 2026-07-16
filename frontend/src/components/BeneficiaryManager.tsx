import React, { useState, useEffect } from 'react'
import { Plus, Users, Edit, Trash2 } from 'lucide-react'
import { apiService } from '../services/api'
import { BeneficiaryGroup, Location } from '../types'
import { notify } from '../lib/notify'
import BeneficiaryGroupDetailsModal from './BeneficiaryGroupDetailsModal'
import UpgradeModal from './UpgradeModal'
import { SubscriptionService } from '../services/subscription'
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
import { CSS } from '@dnd-kit/utilities'
import { Button } from './ui/button'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from './ModalFrame'
import { useTeam } from '../context/TeamContext'

// Sortable Beneficiary Group Card Component - Simple app-card like StoriesTab
function SortableBeneficiaryGroupCard({
 group,
 locationNames,
 ageRange,
 dataPointCount,
 onClick,
 onEdit,
 onDelete,
 canEdit,
 canDelete,
}: {
 group: BeneficiaryGroup
 locationNames: string[]
 ageRange: string | null
 dataPointCount: number
 onClick: () => void
 onEdit: (e: React.MouseEvent) => void
 onDelete: (e: React.MouseEvent) => void
 canEdit: boolean
 canDelete: boolean
}) {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({ id: group.id! })

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 opacity: isDragging ? 0.5 : 1,
 }

 return (
 <div
 ref={setNodeRef}
 style={style}
 className="rounded-xl border border-gray-200/70 bg-white shadow-card overflow-hidden transition-all hover:shadow-card-hover cursor-pointer group relative min-w-0"
 onClick={onClick}
 >
 <div className="flex flex-col gap-2 py-3.5 px-3">
 <div className="flex items-start gap-2.5">
 <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
 <Users className="w-3.5 h-3.5 text-primary-600" />
 </div>
 <div className="min-w-0 flex-1">
 <h3 className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug">
 {group.name}
 </h3>
 </div>
 <div className="flex items-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5">
 {canEdit && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onEdit(e)
 }}
 className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
 title="Edit Group"
 >
 <Edit className="w-3 h-3" />
 </button>
 )}
 {canDelete && (
 <button
 onClick={(e) => {
 e.stopPropagation()
 onDelete(e)
 }}
 className="p-1 hover:bg-red-50 rounded-md text-gray-400 hover:text-red-600 transition-colors"
 title="Delete Group"
 >
 <Trash2 className="w-3 h-3" />
 </button>
 )}
 </div>
 </div>
 <div className="pl-9 space-y-1">
 <p className="text-[11px] text-gray-500 leading-snug">
 {[
 group.total_number != null && group.total_number !== undefined ? `${group.total_number.toLocaleString()} beneficiaries` : null,
 ageRange ? `Age ${ageRange}` : null,
 locationNames.length > 0 ? locationNames[0] + (locationNames.length > 1 ? ` +${locationNames.length - 1}` : '') : null,
 ].filter(Boolean).join(' · ') || '—'}
 </p>
 <p className="text-[11px] text-gray-500 leading-snug">
 {dataPointCount} {dataPointCount === 1 ? 'impact claim' : 'impact claims'}
 </p>
 </div>
 </div>
 </div>
 )
}

interface BeneficiaryManagerProps {
 initiativeId: string
 onRefresh?: () => void
 onStoryClick?: (storyId: string) => void
 onMetricClick?: (kpiId: string) => void
}

interface CreateGroupModalProps {
 isOpen: boolean
 onClose: () => void
 onSubmit: (data: any) => Promise<void>
 editData?: BeneficiaryGroup | null
 initiativeId: string
}

function CreateGroupModal({ isOpen, onClose, onSubmit, editData, initiativeId }: CreateGroupModalProps) {
 const [formData, setFormData] = useState({
 name: '',
 description: '',
 criteria: {} as Record<string, any>,
 age_range_start: '' as string | number,
 age_range_end: '' as string | number,
 total_number: '' as string | number
 })
 const [loading, setLoading] = useState(false)

 useEffect(() => {
 if (editData) {
 setFormData({
 name: editData.name || '',
 description: editData.description || '',
 criteria: editData.criteria || {},
 age_range_start: editData.age_range_start ?? '',
 age_range_end: editData.age_range_end ?? '',
 total_number: editData.total_number ?? ''
 })
 } else {
 setFormData({ 
 name: '', 
 description: '', 
 criteria: {},
 age_range_start: '',
 age_range_end: '',
 total_number: ''
 })
 }
 }, [editData])

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 setLoading(true)
 try {
 const submitData = {
 ...formData,
 age_range_start: formData.age_range_start === '' ? null : Number(formData.age_range_start),
 age_range_end: formData.age_range_end === '' ? null : Number(formData.age_range_end),
 total_number: formData.total_number === '' ? null : Number(formData.total_number)
 }
 await onSubmit(submitData)
 setFormData({ 
 name: '', 
 description: '', 
 criteria: {},
 age_range_start: '',
 age_range_end: '',
 total_number: ''
 })
 onClose()
 } finally {
 setLoading(false)
 }
 }

 if (!isOpen) return null

 return (
 <ModalFrame size="sm" zIndexClass="z-[60]">
 <ModalHeader
 title={editData ? 'Edit Beneficiary Group' : 'Create Beneficiary Group'}
 onClose={onClose}
 icon={Users}
 />
 <form onSubmit={handleSubmit}>
 <ModalBody rail>
 <div className="space-y-4">
 <div>
 <label className="app-label">
 Group Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
 className="app-input"
 placeholder="e.g., Children 5-12, Women 18-35, Rural Community"
 required
 />
 </div>

 <div>
 <label className="app-label">Age Range (Optional)</label>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs text-gray-600 mb-1 block">Min Age</label>
 <input
 type="number"
 value={formData.age_range_start}
 onChange={(e) => setFormData(prev => ({ ...prev, age_range_start: e.target.value }))}
 className="app-input"
 placeholder="Min"
 min="0"
 />
 </div>
 <div>
 <label className="text-xs text-gray-600 mb-1 block">Max Age</label>
 <input
 type="number"
 value={formData.age_range_end}
 onChange={(e) => setFormData(prev => ({ ...prev, age_range_end: e.target.value }))}
 className="app-input"
 placeholder="Max"
 min={formData.age_range_start ? Number(formData.age_range_start) : 0}
 />
 </div>
 </div>
 {formData.age_range_start && formData.age_range_end &&
 Number(formData.age_range_end) < Number(formData.age_range_start) && (
 <p className="text-xs text-red-500 mt-1">Max age must be greater than or equal to min age</p>
 )}
 </div>

 <div>
 <label className="app-label">Total Number (Optional)</label>
 <input
 type="number"
 value={formData.total_number}
 onChange={(e) => setFormData(prev => ({ ...prev, total_number: e.target.value }))}
 className="app-input"
 placeholder="e.g., 150"
 min="0"
 />
 <p className="app-help">Total number of beneficiaries in this group</p>
 </div>

 <div>
 <label className="app-label">Description</label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
 className="app-input resize-none"
 rows={3}
 placeholder="Describe this beneficiary group..."
 />
 </div>
 </div>
 </ModalBody>
 <ModalFooter>
 <Button type="button" onClick={onClose} variant="secondary" disabled={loading}>
 Cancel
 </Button>
 <Button type="submit" disabled={loading || !formData.name}>
 {loading ? 'Saving...' : editData ? 'Update Group' : 'Create Group'}
 </Button>
 </ModalFooter>
 </form>
 </ModalFrame>
 )
}

export default function BeneficiaryManager({ initiativeId, onRefresh, onStoryClick, onMetricClick }: BeneficiaryManagerProps) {
 const { canEditBeneficiaries } = useTeam()
 const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
 const [orderedGroups, setOrderedGroups] = useState<BeneficiaryGroup[]>([])
 const [loading, setLoading] = useState(true)
 const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
 const [editingGroup, setEditingGroup] = useState<BeneficiaryGroup | null>(null)
 const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<BeneficiaryGroup | null>(null)
 const [selectedGroup, setSelectedGroup] = useState<BeneficiaryGroup | null>(null)
 const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
 const [dataPointCounts, setDataPointCounts] = useState<Record<string, number>>({})
 const [derivedLocationIds, setDerivedLocationIds] = useState<Record<string, string[]>>({})
 const [locations, setLocations] = useState<Location[]>([])
 const [locationsMap, setLocationsMap] = useState<Record<string, Location>>({})
 const [showUpgrade, setShowUpgrade] = useState(false)
 // Free plan: existing groups stay visible but read-only (locked) until upgrade.
 const [groupsLocked, setGroupsLocked] = useState(false)

 useEffect(() => {
 SubscriptionService.getFeatures()
 .then(f => setGroupsLocked(!f.beneficiaryGroups))
 .catch(() => { /* fail open */ })
 }, [])

 // Initialize ordered groups from state, sorted by display_order
 useEffect(() => {
 const sorted = [...groups].sort((a, b) => {
 const orderA = a.display_order ?? 0
 const orderB = b.display_order ?? 0
 return orderA - orderB
 })
 setOrderedGroups(sorted)
 }, [groups])

 // Drag and drop sensors
 const sensors = useSensors(
 useSensor(PointerSensor, {
 activationConstraint: {
 distance: 8,
 },
 }),
 useSensor(KeyboardSensor, {
 coordinateGetter: sortableKeyboardCoordinates,
 })
 )

 // Handle drag end
 const handleDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event

 if (!over || active.id === over.id) return

 const oldIndex = orderedGroups.findIndex((group) => group.id === active.id)
 const newIndex = orderedGroups.findIndex((group) => group.id === over.id)

 if (oldIndex === -1 || newIndex === -1) return

 const newOrderedGroups = arrayMove(orderedGroups, oldIndex, newIndex)
 setOrderedGroups(newOrderedGroups)

 // Update display_order in backend
 if (initiativeId) {
 try {
 const order = newOrderedGroups.map((group, index) => ({
 id: group.id!,
 display_order: index,
 }))
 await apiService.updateBeneficiaryGroupOrder(order)
 } catch (error) {
 console.error('Failed to update beneficiary group order:', error)
 notify.error('Failed to save order')
 // Revert on error
 setOrderedGroups(orderedGroups)
 }
 }
 }

 useEffect(() => {
 loadGroups()
 loadLocations()
 }, [initiativeId])

 const loadLocations = async () => {
 try {
 const locs = await apiService.getLocations(initiativeId)
 setLocations(locs || [])
 // Create a map for quick lookup
 const map: Record<string, Location> = {}
 locs?.forEach(loc => {
 if (loc.id) map[loc.id] = loc
 })
 setLocationsMap(map)
 } catch (error) {
 console.error('Error loading locations:', error)
 }
 }

 const loadGroups = async () => {
 try {
 setLoading(true)
 const data = await apiService.getBeneficiaryGroups(initiativeId)
 const groups = data || []
 setGroups(groups)

 // Bulk load data point counts and derived locations for all groups
 if (groups.length > 0) {
 const groupIds = groups.map(g => g.id!).filter(Boolean)
 try {
 const [counts, derivedLocs] = await Promise.all([
 apiService.getBulkDataPointCounts(groupIds),
 apiService.getBulkDerivedLocations(groupIds)
 ])
 setDataPointCounts(counts as Record<string, number> || {})
 setDerivedLocationIds(derivedLocs || {})
 } catch (error) {
 console.error('Error loading group metadata:', error)
 }
 }
 } catch (error) {
 console.error('Error loading beneficiary groups:', error)
 notify.error('Failed to load beneficiary groups')
 } finally {
 setLoading(false)
 }
 }

 const handleCreateGroup = async (data: any) => {
 try {
 await apiService.createBeneficiaryGroup({
 ...data,
 initiative_id: initiativeId
 })
 notify.success('Beneficiary group created successfully!')
 loadGroups()
 onRefresh?.()
 } catch (error: any) {
 // Free plan can't use beneficiary groups → show upgrade options.
 if (error?.code === 'FEATURE_NOT_IN_PLAN') {
 setIsCreateModalOpen(false)
 setShowUpgrade(true)
 return
 }
 const message = error instanceof Error ? error.message : 'Failed to create group'
 notify.error(message)
 throw error
 }
 }

 const handleEditGroup = async (data: any) => {
 if (!editingGroup?.id) return
 try {
 await apiService.updateBeneficiaryGroup(editingGroup.id, data)
 notify.success('Beneficiary group updated successfully!')
 loadGroups()
 onRefresh?.()
 setEditingGroup(null)
 } catch (error: any) {
 if (error?.code === 'FEATURE_NOT_IN_PLAN') {
 setEditingGroup(null)
 setShowUpgrade(true)
 return
 }
 const message = error instanceof Error ? error.message : 'Failed to update group'
 notify.error(message)
 throw error
 }
 }

 const handleDeleteGroup = async (group: BeneficiaryGroup) => {
 if (!group.id) return
 try {
 await apiService.deleteBeneficiaryGroup(group.id)
 notify.success('Beneficiary group deleted successfully!')
 loadGroups()
 onRefresh?.()
 setDeleteConfirmGroup(null)
 } catch (error: any) {
 if (error?.code === 'FEATURE_NOT_IN_PLAN') {
 setDeleteConfirmGroup(null)
 setShowUpgrade(true)
 return
 }
 const message = error instanceof Error ? error.message : 'Failed to delete group'
 notify.error(message)
 }
 }

 const handleGroupClick = (group: BeneficiaryGroup) => {
 setSelectedGroup(group)
 setIsDetailsModalOpen(true)
 }

 if (loading) {
 return (
 <div className="app-card p-6">
 <div className="animate-pulse space-y-4">
 <div className="h-4 bg-gray-200 rounded w-1/4"></div>
 <div className="h-20 bg-gray-200 rounded"></div>
 </div>
 </div>
 )
 }

 return (
 <div className="h-full flex flex-col overflow-hidden space-y-4">
 {/* Header */}
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
 <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
 Beneficiary groups ({orderedGroups.length})
 </h3>
 {canEditBeneficiaries && (
 <button
 onClick={() => groupsLocked ? setShowUpgrade(true) : setIsCreateModalOpen(true)}
 className="app-btn app-btn-primary app-btn-sm shadow-sm w-full sm:w-auto"
 >
 <Plus className="w-4 h-4 flex-shrink-0" />
 <span>Add Group</span>
 </button>
 )}
 </div>

 {/* Free-plan lock banner: groups are preserved but read-only until upgrade */}
 {groupsLocked && groups.length > 0 && (
 <button
 type="button"
 onClick={() => setShowUpgrade(true)}
 className="flex items-center gap-2 w-full px-3 py-2 mb-1 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors flex-shrink-0"
 >
 <Users className="w-4 h-4 flex-shrink-0" />
 Beneficiary groups are locked on the Free plan — your data is saved and will unlock when you upgrade.
 </button>
 )}

 {groups.length === 0 ? (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
 <p className="text-gray-600 text-base mb-4">
 No beneficiary groups yet
 </p>
 {canEditBeneficiaries && (
 <Button
 onClick={() => groupsLocked ? setShowUpgrade(true) : setIsCreateModalOpen(true)}
 size="sm"
 >
 Create First Group
 </Button>
 )}
 </div>
 </div>
 ) : (
 <DndContext
 sensors={sensors}
 collisionDetection={closestCenter}
 onDragEnd={handleDragEnd}
 >
 <SortableContext
 items={orderedGroups.map(group => group.id!)}
 strategy={verticalListSortingStrategy}
 >
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 flex-1 overflow-y-auto pr-1 min-w-0 content-start">
 {orderedGroups.map(group => {
 const locIds = derivedLocationIds[group.id!] || []
 const locationNames = locIds
 .map(id => locationsMap[id]?.name)
 .filter(Boolean) as string[]
 const ageRange = group.age_range_start && group.age_range_end 
 ? `${group.age_range_start}-${group.age_range_end}`
 : group.age_range_start 
 ? `${group.age_range_start}+`
 : null

 return (
 <SortableBeneficiaryGroupCard
 key={group.id}
 group={group}
 locationNames={locationNames}
 ageRange={ageRange}
 dataPointCount={dataPointCounts[group.id!] || 0}
 onClick={() => handleGroupClick(group)}
 onEdit={(e) => {
 e.stopPropagation()
 setEditingGroup(group)
 }}
 onDelete={(e) => {
 e.stopPropagation()
 setDeleteConfirmGroup(group)
 }}
 canEdit={canEditBeneficiaries}
 canDelete={canEditBeneficiaries}
 />
 )
 })}
 </div>
 </SortableContext>
 </DndContext>
 )}

 {/* Create Modal */}
 <CreateGroupModal
 isOpen={isCreateModalOpen}
 onClose={() => setIsCreateModalOpen(false)}
 onSubmit={handleCreateGroup}
 initiativeId={initiativeId}
 />

 <UpgradeModal
 isOpen={showUpgrade}
 onClose={() => setShowUpgrade(false)}
 title="Beneficiary groups are a paid feature"
 subtitle="Upgrade to Growth or Pro to track beneficiary groups."
 />

 {/* Edit Modal */}
 <CreateGroupModal
 isOpen={!!editingGroup}
 onClose={() => setEditingGroup(null)}
 onSubmit={handleEditGroup}
 editData={editingGroup}
 initiativeId={initiativeId}
 />

 {/* Beneficiary Group Details Modal */}
 {selectedGroup && (
 <BeneficiaryGroupDetailsModal
 isOpen={isDetailsModalOpen}
 onClose={() => {
 setIsDetailsModalOpen(false)
 setSelectedGroup(null)
 }}
 beneficiaryGroup={selectedGroup}
 onEditClick={(group) => {
 setIsDetailsModalOpen(false)
 setSelectedGroup(null)
 setEditingGroup(group)
 }}
 onStoryClick={onStoryClick}
 onMetricClick={onMetricClick}
 initiativeId={initiativeId}
 groupLocations={
 selectedGroup?.id
 ? (derivedLocationIds[selectedGroup.id] || [])
 .map(id => locationsMap[id])
 .filter(Boolean)
 : []
 }
 />
 )}

 {/* Delete Confirmation */}
 {deleteConfirmGroup && (
 <ModalFrame zIndexClass="z-[60]" backdropClassName="bg-black/50" panelClassName="bg-white rounded-xl max-w-md w-full p-6">
 <div className="flex items-center space-x-3 mb-4">
 <div className="p-2 bg-red-100 rounded-lg">
 <Trash2 className="w-5 h-5 text-red-600" />
 </div>
 <div>
 <h3 className="text-lg font-semibold text-gray-900">Delete Beneficiary Group</h3>
 <p className="text-sm text-gray-600">This action cannot be undone</p>
 </div>
 </div>

 <p className="text-gray-700 mb-6">
 Are you sure you want to delete "<strong>{deleteConfirmGroup.name}</strong>"?
 </p>

 <div className="flex space-x-3">
 <Button
 onClick={() => setDeleteConfirmGroup(null)}
 variant="secondary"
 className="flex-1"
 >
 Cancel
 </Button>
 <button
 onClick={() => handleDeleteGroup(deleteConfirmGroup)}
 className="app-btn app-btn-danger flex-1"
 >
 Delete Group
 </button>
 </div>
 </ModalFrame>
 )}
 </div>
 )
}
