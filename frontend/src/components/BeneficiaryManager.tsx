import React, { useState, useEffect } from 'react'
import { Plus, Users, Edit, Trash2, X, MapPin, AlertCircle, BarChart3 } from 'lucide-react'
import { apiService } from '../services/api'
import { BeneficiaryGroup, Location } from '../types'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'
import LocationModal from './LocationModal'
import BeneficiaryGroupDetailsModal from './BeneficiaryGroupDetailsModal'
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

// Sortable Beneficiary Group Card Component - Simple card like StoriesTab
function SortableBeneficiaryGroupCard({
    group,
    location,
    ageRange,
    dataPointCount,
    onClick,
    onEdit,
    onDelete,
}: {
    group: BeneficiaryGroup
    location: Location | null
    ageRange: string | null
    dataPointCount: number
    onClick: () => void
    onEdit: (e: React.MouseEvent) => void
    onDelete: (e: React.MouseEvent) => void
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
            className="bubble-card overflow-hidden transition-all hover:shadow-bubble-hover cursor-pointer group relative"
            onClick={onClick}
        >
            <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="icon-bubble-sm bg-blue-100 flex-shrink-0">
                            <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base font-semibold text-gray-900 mb-1 line-clamp-1">
                                {group.name}
                            </h3>
                            <div className="flex items-center space-x-3 text-xs text-gray-500">
                                {group.total_number !== null && group.total_number !== undefined && (
                                    <span>{group.total_number.toLocaleString()} beneficiaries</span>
                                )}
                                {ageRange && <span>Age: {ageRange}</span>}
                                {location && (
                                    <span className="flex items-center space-x-1">
                                        <MapPin className="w-3 h-3" />
                                        <span className="truncate max-w-[120px]">{location.name}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onEdit(e)
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Edit Group"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                onDelete(e)
                            }}
                            className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete Group"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="flex items-center space-x-4 pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-2">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                            {dataPointCount} {dataPointCount === 1 ? 'impact claim' : 'impact claims'}
                        </span>
                    </div>
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
        location_id: '',
        age_range_start: '' as string | number,
        age_range_end: '' as string | number,
        total_number: '' as string | number
    })
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingLocations, setLoadingLocations] = useState(true)
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)

    useEffect(() => {
        if (isOpen && initiativeId) {
            loadLocations()
        }
    }, [isOpen, initiativeId])

    const loadLocations = async () => {
        try {
            setLoadingLocations(true)
            const locs = await apiService.getLocations(initiativeId)
            setLocations(locs || [])
        } catch (error) {
            console.error('Error loading locations:', error)
            toast.error('Failed to load locations')
        } finally {
            setLoadingLocations(false)
        }
    }

    useEffect(() => {
        if (editData) {
            setFormData({
                name: editData.name || '',
                description: editData.description || '',
                criteria: editData.criteria || {},
                location_id: editData.location_id || '',
                age_range_start: editData.age_range_start ?? '',
                age_range_end: editData.age_range_end ?? '',
                total_number: editData.total_number ?? ''
            })
        } else {
            setFormData({ 
                name: '', 
                description: '', 
                criteria: {},
                location_id: '',
                age_range_start: '',
                age_range_end: '',
                total_number: ''
            })
        }
    }, [editData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.location_id) {
            toast.error('Please select a location')
            return
        }
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
                location_id: '',
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {editData ? 'Edit Beneficiary Group' : 'Create Beneficiary Group'}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="label">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="input-field"
                            placeholder="e.g., Children 5-12, Women 18-35, Rural Community"
                            required
                        />
                    </div>

                    <div>
                        <label className="label">
                            Location <span className="text-red-500">*</span>
                        </label>
                        {locations.length === 0 ? (
                            <div className="space-y-2">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start space-x-2">
                                    <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm text-yellow-800 font-medium mb-1">
                                            Location Required
                                        </p>
                                        <p className="text-xs text-yellow-700">
                                            You need to create at least one location before creating a beneficiary group. Locations help organize beneficiaries by geographic area.
                                        </p>
                                    </div>
                                </div>
                                {initiativeId && (
                                    <button
                                        type="button"
                                        onClick={() => setIsLocationModalOpen(true)}
                                        className="w-full px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center space-x-2"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span>Create Location</span>
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="flex gap-2">
                                <select
                                    value={formData.location_id}
                                    onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value }))}
                                    className="input-field flex-1"
                                    required
                                >
                                    <option value="">Select a location</option>
                                    {locations.map((location) => (
                                        <option key={location.id} value={location.id}>
                                            {location.name}
                                        </option>
                                    ))}
                                </select>
                                {initiativeId && (
                                    <button
                                        type="button"
                                        onClick={() => setIsLocationModalOpen(true)}
                                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-1 transition-colors"
                                        title="Add new location"
                                    >
                                        <Plus className="w-4 h-4" />
                                        <span className="hidden sm:inline">Add</span>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="label">Age Range (Optional)</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-gray-600 mb-1 block">Min Age</label>
                                <input
                                    type="number"
                                    value={formData.age_range_start}
                                    onChange={(e) => setFormData(prev => ({ ...prev, age_range_start: e.target.value }))}
                                    className="input-field"
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
                                    className="input-field"
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
                        <label className="label">Total Number (Optional)</label>
                        <input
                            type="number"
                            value={formData.total_number}
                            onChange={(e) => setFormData(prev => ({ ...prev, total_number: e.target.value }))}
                            className="input-field"
                            placeholder="e.g., 150"
                            min="0"
                        />
                        <p className="text-xs text-gray-500 mt-1">Total number of beneficiaries in this group</p>
                    </div>

                    <div>
                        <label className="label">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Describe this beneficiary group..."
                        />
                    </div>

                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary flex-1"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn-primary flex-1"
                            disabled={loading || !formData.name || !formData.location_id}
                        >
                            {loading ? 'Saving...' : editData ? 'Update Group' : 'Create Group'}
                        </button>
                    </div>
                </form>
                
                {/* Location Creation Modal */}
                {initiativeId && (
                    <LocationModal
                        isOpen={isLocationModalOpen}
                        onClose={() => setIsLocationModalOpen(false)}
                        onSubmit={async (locationData) => {
                            try {
                                const newLocation = await apiService.createLocation(locationData)
                                setLocations([...locations, newLocation])
                                setFormData(prev => ({ ...prev, location_id: newLocation.id! }))
                                setIsLocationModalOpen(false)
                                toast.success('Location created successfully!')
                            } catch (error) {
                                const message = error instanceof Error ? error.message : 'Failed to create location'
                                toast.error(message)
                                throw error
                            }
                        }}
                        initiativeId={initiativeId}
                    />
                )}
            </div>
        </div>
    )
}

export default function BeneficiaryManager({ initiativeId, onRefresh, onStoryClick, onMetricClick }: BeneficiaryManagerProps) {
    const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
    const [orderedGroups, setOrderedGroups] = useState<BeneficiaryGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<BeneficiaryGroup | null>(null)
    const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<BeneficiaryGroup | null>(null)
    const [selectedGroup, setSelectedGroup] = useState<BeneficiaryGroup | null>(null)
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
    const [dataPointCounts, setDataPointCounts] = useState<Record<string, number>>({})
    const [locations, setLocations] = useState<Location[]>([])
    const [locationsMap, setLocationsMap] = useState<Record<string, Location>>({})

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
                toast.error('Failed to save order')
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

            // Bulk load data point counts for all groups for better performance
            if (groups.length > 0) {
                const groupIds = groups.map(g => g.id!).filter(Boolean)
                try {
                    const counts = await apiService.getBulkDataPointCounts(groupIds)
                    setDataPointCounts(counts as Record<string, number> || {})
                } catch (error) {
                    console.error('Error loading data point counts:', error)
                    // Don't show error to user, just log it - counts will show as 0
                }
            }
        } catch (error) {
            console.error('Error loading beneficiary groups:', error)
            toast.error('Failed to load beneficiary groups')
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
            toast.success('Beneficiary group created successfully!')
            loadGroups()
            onRefresh?.()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create group'
            toast.error(message)
            throw error
        }
    }

    const handleEditGroup = async (data: any) => {
        if (!editingGroup?.id) return
        try {
            await apiService.updateBeneficiaryGroup(editingGroup.id, data)
            toast.success('Beneficiary group updated successfully!')
            loadGroups()
            onRefresh?.()
            setEditingGroup(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update group'
            toast.error(message)
            throw error
        }
    }

    const handleDeleteGroup = async (group: BeneficiaryGroup) => {
        if (!group.id) return
        try {
            await apiService.deleteBeneficiaryGroup(group.id)
            toast.success('Beneficiary group deleted successfully!')
            loadGroups()
            onRefresh?.()
            setDeleteConfirmGroup(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete group'
            toast.error(message)
        }
    }

    const handleGroupClick = (group: BeneficiaryGroup) => {
        setSelectedGroup(group)
        setIsDetailsModalOpen(true)
    }

    if (loading) {
        return (
            <div className="card p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    <div className="h-20 bg-gray-200 rounded"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col overflow-hidden px-3 pt-2 pb-2 space-y-1.5">
            {/* Header */}
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">
                    Beneficiary Groups ({orderedGroups.length})
                </h3>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors border border-blue-200"
                >
                    <Plus className="w-4 h-4" />
                    <span>Add Group</span>
                </button>
            </div>

            {groups.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 text-base mb-4">
                            No beneficiary groups yet
                        </p>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="btn-primary text-sm"
                        >
                            Create First Group
                        </button>
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 overflow-y-auto pr-2">
                            {orderedGroups.map(group => {
                                const location = group.location_id ? locationsMap[group.location_id] : null
                                const ageRange = group.age_range_start && group.age_range_end 
                                    ? `${group.age_range_start}-${group.age_range_end}`
                                    : group.age_range_start 
                                        ? `${group.age_range_start}+`
                                        : null

                                return (
                                    <SortableBeneficiaryGroupCard
                                        key={group.id}
                                        group={group}
                                        location={location}
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
                />
            )}

            {/* Delete Confirmation */}
            {deleteConfirmGroup && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
                    <div className="bg-white rounded-xl max-w-md w-full p-6">
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
                            <button
                                onClick={() => setDeleteConfirmGroup(null)}
                                className="btn-secondary flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeleteGroup(deleteConfirmGroup)}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                            >
                                Delete Group
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
