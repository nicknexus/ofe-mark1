import React, { useState, useEffect } from 'react'
import { X, Calendar, Hash, MapPin, FileText, Users, Plus } from 'lucide-react'
import { CreateKPIUpdateForm, BeneficiaryGroup, Location } from '../types'
import { apiService } from '../services/api'
import LocationModal from './LocationModal'
import toast from 'react-hot-toast'

interface AddKPIUpdateModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateKPIUpdateForm) => Promise<void>
    kpiTitle: string
    kpiId: string
    metricType: 'number' | 'percentage'
    unitOfMeasurement: string
    initiativeId?: string
    editData?: any // Optional prop for editing existing KPI update
}

export default function AddKPIUpdateModal({
    isOpen,
    onClose,
    onSubmit,
    kpiTitle,
    kpiId,
    metricType,
    unitOfMeasurement,
    initiativeId,
    editData
}: AddKPIUpdateModalProps) {
    const [formData, setFormData] = useState<CreateKPIUpdateForm>({
        value: 0,
        date_represented: new Date().toISOString().split('T')[0],
        date_range_start: undefined,
        date_range_end: undefined,
        note: '',
        label: ''
    })
    const [isDateRange, setIsDateRange] = useState(false)
    const [loading, setLoading] = useState(false)
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocationId, setSelectedLocationId] = useState<string>('')
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)

    // Load data when modal opens
    useEffect(() => {
        if (isOpen) {
            // Load beneficiary groups
            apiService
                .getBeneficiaryGroups(initiativeId)
                .then((groups) => setBeneficiaryGroups(groups || []))
                .catch(() => setBeneficiaryGroups([]))

            // Load locations
            if (initiativeId) {
                apiService
                    .getLocations(initiativeId)
                    .then((locs) => setLocations(locs || []))
                    .catch(() => setLocations([]))
            }

            // If editing, load existing data
            if (editData) {
                setFormData({
                    value: editData.value || 0,
                    date_represented: editData.date_represented || new Date().toISOString().split('T')[0],
                    date_range_start: editData.date_range_start,
                    date_range_end: editData.date_range_end,
                    note: editData.note || '',
                    label: editData.label || ''
                })
                setIsDateRange(!!(editData.date_range_start && editData.date_range_end))
                setSelectedLocationId(editData.location_id || '')

                // Load beneficiary groups for this update
                if (editData.id) {
                    apiService
                        .getBeneficiaryGroupsForUpdate(editData.id)
                        .then((groups: any) => {
                            const groupArray = Array.isArray(groups) ? groups : []
                            setSelectedGroupIds(groupArray.map((g: any) => g.id))
                        })
                        .catch(() => setSelectedGroupIds([]))
                }
            } else {
                // Reset form for new update
                setFormData({
                    value: 0,
                    date_represented: new Date().toISOString().split('T')[0],
                    date_range_start: undefined,
                    date_range_end: undefined,
                    note: '',
                    label: ''
                })
                setIsDateRange(false)
                setSelectedGroupIds([])
                setSelectedLocationId('')
            }
        }
    }, [isOpen, initiativeId, editData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Prepare form data based on date mode
            const submitData = { ...formData }
            if (isDateRange) {
                // For date ranges, keep both range fields and set date_represented to start date
                submitData.date_represented = formData.date_range_start || formData.date_represented
                // Ensure both range fields are included
                if (!submitData.date_range_start || !submitData.date_range_end) {
                    throw new Error('Both start and end dates are required for date ranges')
                }
            } else {
                // For single dates, clear range fields
                submitData.date_range_start = undefined
                submitData.date_range_end = undefined
            }

            await onSubmit({
                ...submitData,
                beneficiary_group_ids: selectedGroupIds,
                location_id: selectedLocationId || undefined
            })
            // Only reset if creating new (not editing)
            if (!editData) {
                setFormData({
                    value: 0,
                    date_represented: new Date().toISOString().split('T')[0],
                    date_range_start: undefined,
                    date_range_end: undefined,
                    note: '',
                    label: ''
                })
                setIsDateRange(false)
                setSelectedGroupIds([])
                setSelectedLocationId('')
            }
            onClose()
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: name === 'value' ? parseFloat(value) || 0 : value
        }))
    }

    const handleValueFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        // Clear the field if it contains 0
        if (formData.value === 0) {
            setFormData(prev => ({ ...prev, value: '' as any }))
        }
    }

    const handleValueBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        // If field is empty on blur, set it back to 0
        if (e.target.value === '' || isNaN(parseFloat(e.target.value))) {
            setFormData(prev => ({ ...prev, value: 0 }))
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-200 ease-out animate-slide-up-fast">
                <div className="overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editData ? 'Edit Data Update' : 'Add Data Update'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">{kpiTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Value Input */}
                    <div>
                        <label className="label">
                            <Hash className="w-4 h-4 inline mr-2" />
                            Value <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                name="value"
                                value={formData.value}
                                onChange={handleInputChange}
                                onFocus={handleValueFocus}
                                onBlur={handleValueBlur}
                                className="input-field pr-16 transition-all duration-150 hover:border-gray-400"
                                placeholder="Enter the value"
                                required
                                min="0"
                                step={metricType === 'percentage' ? '0.01' : '1'}
                                max={metricType === 'percentage' ? '100' : undefined}
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="text-gray-500 text-sm">
                                    {metricType === 'percentage' ? '%' : unitOfMeasurement}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Date Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="label">
                                <Calendar className="w-4 h-4 inline mr-2" />
                                Date
                            </label>
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isDateRange) {
                                            setIsDateRange(false)
                                            setFormData(prev => ({
                                                ...prev,
                                                date_represented: new Date().toISOString().split('T')[0]
                                            }))
                                        }
                                    }}
                                    className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${!isDateRange
                                        ? 'bg-white text-gray-900 shadow-sm font-medium'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Single Date
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isDateRange) {
                                            setIsDateRange(true)
                                            setFormData(prev => ({
                                                ...prev,
                                                date_range_start: '',
                                                date_range_end: ''
                                            }))
                                        }
                                    }}
                                    className={`px-3 py-1 text-xs rounded-md transition-all duration-200 ${isDateRange
                                        ? 'bg-white text-gray-900 shadow-sm font-medium'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                >
                                    Date Range
                                </button>
                            </div>
                        </div>

                        {!isDateRange ? (
                            <input
                                type="date"
                                name="date_represented"
                                value={formData.date_represented}
                                onChange={handleInputChange}
                                className="input-field transition-all duration-150 hover:border-gray-400"
                                required
                            />
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">From</label>
                                    <input
                                        type="date"
                                        name="date_range_start"
                                        value={formData.date_range_start || ''}
                                        onChange={handleInputChange}
                                        className="input-field transition-all duration-150 hover:border-gray-400"
                                        required={isDateRange}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-600 mb-1">To</label>
                                    <input
                                        type="date"
                                        name="date_range_end"
                                        value={formData.date_range_end || ''}
                                        onChange={handleInputChange}
                                        className="input-field transition-all duration-150 hover:border-gray-400"
                                        required={isDateRange}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Label */}
                    <div>
                        <label className="label">
                            <FileText className="w-4 h-4 inline mr-2" />
                            Label or Title
                        </label>
                        <input
                            type="text"
                            name="label"
                            value={formData.label}
                            onChange={handleInputChange}
                            className="input-field"
                            placeholder="e.g., Week 2 Update, Follow-up Training Day"
                        />
                    </div>

                    {/* Note */}
                    <div>
                        <label className="label">Notes</label>
                        <textarea
                            name="note"
                            value={formData.note}
                            onChange={handleInputChange}
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Any additional context or explanation for this update..."
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <label className="label">
                            <MapPin className="w-4 h-4 inline mr-2" />
                            Location (optional)
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={selectedLocationId}
                                onChange={(e) => setSelectedLocationId(e.target.value)}
                                className="input-field flex-1"
                            >
                                <option value="">Select a location...</option>
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
                                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-1"
                                    title="Add new location"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Beneficiary Groups */}
                    <div>
                        <label className="label">
                            <Users className="w-4 h-4 inline mr-2" />
                            Beneficiary Groups (optional)
                        </label>
                        {beneficiaryGroups.length === 0 ? (
                            <p className="text-xs text-gray-500">No groups yet. You can add them later.</p>
                        ) : (
                            <div className="space-y-1 max-h-28 overflow-y-auto border border-gray-200 rounded-lg p-2">
                                {beneficiaryGroups.map(group => {
                                    const checked = selectedGroupIds.includes(group.id!)
                                    return (
                                        <label key={group.id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    onChange={() => setSelectedGroupIds(prev => checked ? prev.filter(id => id !== group.id) : [...prev, group.id!])}
                                                />
                                                <span className="text-sm text-gray-800">{group.name}</span>
                                            </div>
                                            {group.description && <span className="text-xs text-gray-500 truncate max-w-[180px]">{group.description}</span>}
                                        </label>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150 hover:shadow-md disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-primary-700 border border-transparent rounded-lg hover:from-primary-700 hover:to-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-lg transform hover:scale-[1.02]"
                            disabled={loading || formData.value === 0}
                        >
                            {loading ? (editData ? 'Updating...' : 'Adding...') : (editData ? 'Update' : 'Add Update')}
                        </button>
                    </div>
                </form>
                </div>

                {/* Location Creation Modal */}
                {initiativeId && (
                    <LocationModal
                        isOpen={isLocationModalOpen}
                        onClose={() => setIsLocationModalOpen(false)}
                        onSubmit={async (locationData) => {
                            try {
                                const newLocation = await apiService.createLocation(locationData)
                                setLocations([...locations, newLocation])
                                setSelectedLocationId(newLocation.id!)
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