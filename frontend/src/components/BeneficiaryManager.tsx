import React, { useState, useEffect } from 'react'
import { Plus, Users, Edit, Trash2, X, ChevronDown, ChevronRight, MapPin, AlertCircle, GripVertical } from 'lucide-react'
import { apiService } from '../services/api'
import { BeneficiaryGroup, Location } from '../types'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'
import LocationModal from './LocationModal'
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

// Sortable Beneficiary Group Card Component
function SortableBeneficiaryGroupCard({
    group,
    isExpanded,
    dataPoints,
    location,
    ageRange,
    dataPointCount,
    onToggleExpansion,
    onEdit,
    onDelete,
}: {
    group: BeneficiaryGroup
    isExpanded: boolean
    dataPoints: any[]
    location: Location | null
    ageRange: string | null
    dataPointCount: number
    onToggleExpansion: () => void
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
            className={`bg-white/90 backdrop-blur-xl border-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden relative group ${
                isExpanded ? 'border-blue-400/60' : 'border-gray-200/60 hover:border-gray-300/60'
            }`}
        >
            {/* Drag Handle - Top Right Corner */}
            <div
                {...attributes}
                {...listeners}
                className="absolute top-1 right-1 cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ opacity: isDragging ? 1 : undefined }}
                onClick={(e) => e.stopPropagation()}
            >
                <GripVertical className="w-3 h-3 text-gray-400" />
            </div>
            {/* Card Content - Compact Horizontal Layout */}
            <div
                className="cursor-pointer flex flex-col"
                onClick={onToggleExpansion}
            >
                {/* Main Content Section - Horizontal */}
                <div className="flex min-h-0">
                    {/* Left Section - ~70% width */}
                    <div className="w-[70%] bg-gradient-to-br from-purple-50/50 to-pink-50/30 p-2 flex flex-row items-center gap-3">
                        {/* Group Name */}
                        <h3 className="text-lg font-bold text-gray-900 line-clamp-1 flex-1 pr-8">{group.name}</h3>
                        
                        {/* Total Number */}
                        {group.total_number !== null && group.total_number !== undefined ? (
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-extrabold text-gray-900 tracking-tight leading-none">
                                    {group.total_number.toLocaleString()}
                                </span>
                                <span className="text-xs font-medium text-gray-600">
                                    beneficiaries
                                </span>
                            </div>
                        ) : (
                            <div className="text-xs text-gray-400 font-medium">No count</div>
                        )}
                    </div>

                    {/* Right Section - ~30% width */}
                    <div className="w-[30%] bg-gradient-to-br from-orange-50/50 to-yellow-50/30 p-2 flex items-center justify-around border-l border-gray-200/50 text-center">
                        {/* Data Points */}
                        <div>
                            <div className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                Impact Claims
                            </div>
                            <div className="text-lg font-extrabold text-orange-700">
                                {dataPointCount}
                            </div>
                        </div>

                        {/* Location */}
                        {location && (
                            <div>
                                <div className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                    Location
                                </div>
                                <div className="text-xs font-bold text-gray-700 line-clamp-1" title={location.name}>
                                    {location.name}
                                </div>
                            </div>
                        )}

                        {/* Age Range */}
                        {ageRange && (
                            <div>
                                <div className="text-[8px] font-semibold text-gray-600 uppercase tracking-wide mb-0.5">
                                    Age
                                </div>
                                <div className="text-xs font-bold text-gray-700">
                                    {ageRange}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Section - Actions Bar */}
                <div className="px-2 py-1 bg-gradient-to-r from-gray-50 to-gray-100/50 border-t border-gray-200/50 flex items-center justify-between">
                    <div className="flex items-center space-x-1">
                        {isExpanded ? (
                            <ChevronDown className="w-3 h-3 text-gray-500" />
                        ) : (
                            <ChevronRight className="w-3 h-3 text-gray-500" />
                        )}
                        <span className="text-[10px] font-semibold text-gray-600">
                            {dataPoints.length > 0 ? `${dataPoints.length} linked` : 'No links'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={onEdit}
                            className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-700 transition-colors"
                            title="Edit Group"
                        >
                            <Edit className="w-3 h-3" />
                        </button>
                        <button
                            onClick={onDelete}
                            className="p-1 hover:bg-red-100 rounded text-gray-500 hover:text-red-600 transition-colors"
                            title="Delete Group"
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Expanded Data Points */}
            {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-3">
                    {dataPoints.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">
                            No impact claims linked yet
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {(() => {
                                // Group data points by KPI for better readability
                                const groupedByKPI = dataPoints.reduce((acc: any, dataPoint: any) => {
                                    const kpiId = dataPoint.kpi?.id || dataPoint.kpis?.id || 'unknown'
                                    const kpiTitle = dataPoint.kpi?.title || dataPoint.kpis?.title || 'Unknown KPI'
                                    const kpiUnit = dataPoint.kpi?.unit_of_measurement || dataPoint.kpis?.unit_of_measurement || ''

                                    if (!acc[kpiId]) {
                                        acc[kpiId] = {
                                            title: kpiTitle,
                                            unit: kpiUnit,
                                            dataPoints: []
                                        }
                                    }
                                    acc[kpiId].dataPoints.push(dataPoint)
                                    return acc
                                }, {})

                                return Object.entries(groupedByKPI).map(([kpiId, kpiData]: [string, any]) => (
                                    <div key={kpiId} className="bg-white rounded-lg border border-gray-200 p-2">
                                        <div className="text-xs font-medium text-gray-800 mb-1.5 flex items-center">
                                            <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5"></div>
                                            {kpiData.title}
                                        </div>
                                        <div className="space-y-1 pl-3">
                                            {kpiData.dataPoints.map((dataPoint: any) => (
                                                <div key={dataPoint.id} className="flex items-center justify-between text-xs py-0.5">
                                                    <span className="font-medium text-purple-600">
                                                        {dataPoint.value?.toLocaleString()} {kpiData.unit}
                                                    </span>
                                                    <span className="text-gray-500">
                                                        {dataPoint.date_represented ? formatDate(dataPoint.date_represented) : 'N/A'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            })()}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

interface BeneficiaryManagerProps {
    initiativeId: string
    onRefresh?: () => void
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

export default function BeneficiaryManager({ initiativeId, onRefresh }: BeneficiaryManagerProps) {
    const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
    const [orderedGroups, setOrderedGroups] = useState<BeneficiaryGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<BeneficiaryGroup | null>(null)
    const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<BeneficiaryGroup | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])
    const [groupDataPoints, setGroupDataPoints] = useState<Record<string, any[]>>({})
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

    const toggleGroupExpansion = async (groupId: string) => {
        if (expandedGroups.includes(groupId)) {
            setExpandedGroups(prev => prev.filter(id => id !== groupId))
        } else {
            setExpandedGroups(prev => [...prev, groupId])
            // Load data points for this group if not already loaded
            if (!groupDataPoints[groupId]) {
                try {
                    const dataPoints = await apiService.getKPIUpdatesForBeneficiaryGroup(groupId)
                    setGroupDataPoints(prev => ({ ...prev, [groupId]: (dataPoints as any[]) || [] }))
                } catch (error) {
                    console.error('Error loading data points for group:', error)
                }
            }
        }
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
                        <div className="space-y-2 flex-1 overflow-y-auto pr-2">
                            {orderedGroups.map(group => {
                                const isExpanded = expandedGroups.includes(group.id!)
                                const dataPoints = groupDataPoints[group.id!] || []
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
                                        isExpanded={isExpanded}
                                        dataPoints={dataPoints}
                                        location={location}
                                        ageRange={ageRange}
                                        dataPointCount={dataPointCounts[group.id!] || 0}
                                        onToggleExpansion={() => toggleGroupExpansion(group.id!)}
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
