import React, { useState, useEffect } from 'react'
import { Plus, Users, Edit, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react'
import { apiService } from '../services/api'
import { BeneficiaryGroup } from '../types'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'

interface BeneficiaryManagerProps {
    initiativeId: string
    onRefresh?: () => void
}

interface CreateGroupModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: any) => Promise<void>
    editData?: BeneficiaryGroup | null
}

function CreateGroupModal({ isOpen, onClose, onSubmit, editData }: CreateGroupModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        criteria: {} as Record<string, any>
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (editData) {
            setFormData({
                name: editData.name || '',
                description: editData.description || '',
                criteria: editData.criteria || {}
            })
        } else {
            setFormData({ name: '', description: '', criteria: {} })
        }
    }, [editData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            await onSubmit(formData)
            setFormData({ name: '', description: '', criteria: {} })
            onClose()
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl max-w-md w-full">
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
                            disabled={loading || !formData.name}
                        >
                            {loading ? 'Saving...' : editData ? 'Update Group' : 'Create Group'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default function BeneficiaryManager({ initiativeId, onRefresh }: BeneficiaryManagerProps) {
    const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
    const [loading, setLoading] = useState(true)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [editingGroup, setEditingGroup] = useState<BeneficiaryGroup | null>(null)
    const [deleteConfirmGroup, setDeleteConfirmGroup] = useState<BeneficiaryGroup | null>(null)
    const [expandedGroups, setExpandedGroups] = useState<string[]>([])
    const [groupDataPoints, setGroupDataPoints] = useState<Record<string, any[]>>({})
    const [dataPointCounts, setDataPointCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        loadGroups()
    }, [initiativeId])

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
        <div className="card p-4 sm:p-6 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                    Beneficiary Groups ({groups.length})
                </h3>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="btn-secondary flex items-center space-x-2 text-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Add Group</span>
                    <span className="sm:hidden">Add</span>
                </button>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-8">
                    <Users className="w-8 h-8 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-sm sm:text-base">
                        No beneficiary groups yet
                    </p>
                    <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="btn-primary mt-4 text-sm"
                    >
                        Create First Group
                    </button>
                </div>
            ) : (
                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                    {groups.map(group => {
                        const isExpanded = expandedGroups.includes(group.id!)
                        const dataPoints = groupDataPoints[group.id!] || []

                        return (
                            <div key={group.id} className="border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all">
                                <div className="p-4">
                                    <div className="flex items-start justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => toggleGroupExpansion(group.id!)}
                                                    className="text-gray-400 hover:text-gray-600"
                                                >
                                                    {isExpanded ? (
                                                        <ChevronDown className="w-4 h-4" />
                                                    ) : (
                                                        <ChevronRight className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <h4 className="text-sm font-medium text-gray-900 truncate">
                                                    {group.name}
                                                </h4>
                                                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                                                    {dataPointCounts[group.id!] || 0} data points
                                                </span>
                                            </div>
                                            {group.description && (
                                                <p className="text-xs text-gray-600 mt-1 ml-6 line-clamp-2">
                                                    {group.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                                            <button
                                                className="text-gray-400 hover:text-gray-600"
                                                onClick={() => setEditingGroup(group)}
                                                title="Edit Group"
                                            >
                                                <Edit className="w-3 h-3" />
                                            </button>
                                            <button
                                                className="text-gray-400 hover:text-red-600"
                                                onClick={() => setDeleteConfirmGroup(group)}
                                                title="Delete Group"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Expanded Data Points */}
                                {isExpanded && (
                                    <div className="border-t border-gray-100 p-4 bg-gray-50">
                                        {dataPoints.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-2">
                                                No data points linked yet
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
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
                                                        <div key={kpiId} className="bg-white rounded-lg border border-gray-200 p-3">
                                                            <div className="text-xs font-medium text-gray-800 mb-2 flex items-center">
                                                                <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                                                                {kpiData.title}
                                                            </div>
                                                            <div className="space-y-2 pl-4">
                                                                {kpiData.dataPoints.map((dataPoint: any) => (
                                                                    <div key={dataPoint.id} className="flex items-center justify-between text-xs py-1">
                                                                        <span className="font-medium text-blue-600">
                                                                            {dataPoint.value} {kpiData.unit}
                                                                        </span>
                                                                        <span className="text-gray-500 text-[10px]">
                                                                            {dataPoint.date_range_start && dataPoint.date_range_end ? (
                                                                                <>Range: {formatDate(dataPoint.date_range_start)} - {formatDate(dataPoint.date_range_end)}</>
                                                                            ) : (
                                                                                <>{formatDate(dataPoint.date_represented)}</>
                                                                            )}
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
                    })}
                </div>
            )}

            {/* Create Modal */}
            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSubmit={handleCreateGroup}
            />

            {/* Edit Modal */}
            <CreateGroupModal
                isOpen={!!editingGroup}
                onClose={() => setEditingGroup(null)}
                onSubmit={handleEditGroup}
                editData={editingGroup}
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
