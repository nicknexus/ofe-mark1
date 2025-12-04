import React, { useState, useEffect } from 'react'
import { X, Users, Save } from 'lucide-react'
import { apiService } from '../services/api'
import { BeneficiaryGroup } from '../types'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'

interface EditDataPointBeneficiariesModalProps {
    isOpen: boolean
    onClose: () => void
    dataPoint: any
    onRefresh?: () => void
}

export default function EditDataPointBeneficiariesModal({
    isOpen,
    onClose,
    dataPoint,
    onRefresh
}: EditDataPointBeneficiariesModalProps) {
    const [allGroups, setAllGroups] = useState<BeneficiaryGroup[]>([])
    const [linkedGroupIds, setLinkedGroupIds] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (isOpen && dataPoint) {
            loadData()
        }
    }, [isOpen, dataPoint])

    const loadData = async () => {
        try {
            setLoading(true)
            const [groups, linkedGroups] = await Promise.all([
                apiService.getBeneficiaryGroups(),
                apiService.getBeneficiaryGroupsForUpdate(dataPoint.id)
            ])
            setAllGroups(groups || [])
            setLinkedGroupIds(((linkedGroups as any[]) || []).map((g: any) => g.id))
        } catch (error) {
            console.error('Error loading data:', error)
            toast.error('Failed to load beneficiary groups')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        try {
            setSaving(true)
            await apiService.replaceKPIUpdateBeneficiaries(dataPoint.id, linkedGroupIds)
            toast.success('Beneficiary links updated successfully!')
            onRefresh?.()
            onClose()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update links'
            toast.error(message)
        } finally {
            setSaving(false)
        }
    }

    const toggleGroup = (groupId: string) => {
        setLinkedGroupIds(prev =>
            prev.includes(groupId)
                ? prev.filter(id => id !== groupId)
                : [...prev, groupId]
        )
    }

    if (!isOpen || !dataPoint) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)]">
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Edit Beneficiary Links
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {dataPoint.value} {dataPoint.kpi?.unit_of_measurement || ''} • {' '}
                            {dataPoint.date_range_start && dataPoint.date_range_end ? (
                                <>Range: {formatDate(dataPoint.date_range_start)} - {formatDate(dataPoint.date_range_end)}</>
                            ) : (
                                <>{formatDate(dataPoint.date_represented)}</>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                        </div>
                    ) : allGroups.length === 0 ? (
                        <div className="text-center py-8">
                            <Users className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">No beneficiary groups available</p>
                            <p className="text-xs text-gray-500 mt-1">Create some groups first</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-sm text-gray-700 mb-4">
                                Select which beneficiary groups this impact claim serves:
                            </p>

                            <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                {allGroups.map(group => {
                                    const isLinked = linkedGroupIds.includes(group.id!)
                                    return (
                                        <label
                                            key={group.id}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <div className="flex items-center space-x-3">
                                                <input
                                                    type="checkbox"
                                                    checked={isLinked}
                                                    onChange={() => toggleGroup(group.id!)}
                                                    className="h-4 w-4"
                                                />
                                                <div>
                                                    <div className="font-medium text-gray-900">{group.name}</div>
                                                    {group.description && (
                                                        <div className="text-sm text-gray-500">{group.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </label>
                                    )
                                })}
                            </div>

                            <div className="text-xs text-gray-500 mt-3">
                                Selected: {linkedGroupIds.length} group{linkedGroupIds.length !== 1 ? 's' : ''}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex space-x-3 p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="btn-secondary flex-1"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn-primary flex-1 flex items-center justify-center space-x-2"
                        disabled={saving || loading}
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </div>
        </div>
    )
}

