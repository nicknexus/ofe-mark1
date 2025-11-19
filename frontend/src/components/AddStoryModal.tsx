import React, { useState, useEffect, useRef } from 'react'
import { X, Upload, Calendar, MapPin, Users, Camera, Video, Mic, Image } from 'lucide-react'
import { CreateStoryForm, Story, Location, BeneficiaryGroup } from '../types'
import { apiService } from '../services/api'
import { getLocalDateString } from '../utils'
import DateRangePicker from './DateRangePicker'
import toast from 'react-hot-toast'

interface AddStoryModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: () => Promise<void>
    initiativeId: string
    editData?: Story | null
}

export default function AddStoryModal({
    isOpen,
    onClose,
    onSubmit,
    initiativeId,
    editData
}: AddStoryModalProps) {
    const [formData, setFormData] = useState<CreateStoryForm>({
        title: '',
        description: '',
        media_url: '',
        media_type: 'photo',
        date_represented: getLocalDateString(new Date()),
        location_id: '',
        beneficiary_group_ids: [],
        initiative_id: initiativeId
    })
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [loading, setLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [selectedBeneficiaryGroupIds, setSelectedBeneficiaryGroupIds] = useState<string[]>([])

    const mediaTypes = [
        { value: 'photo', label: 'Photo', icon: Camera },
        { value: 'video', label: 'Video', icon: Video },
        { value: 'recording', label: 'Recording', icon: Mic }
    ] as const

    // Load locations and beneficiary groups
    useEffect(() => {
        if (initiativeId) {
            Promise.all([
                apiService.getLocations(initiativeId),
                apiService.getBeneficiaryGroups(initiativeId)
            ]).then(([locs, groups]) => {
                setLocations(locs || [])
                setBeneficiaryGroups(groups || [])
            })
        }
    }, [initiativeId])

    // Initialize form data when editing
    useEffect(() => {
        if (editData) {
            setFormData({
                title: editData.title || '',
                description: editData.description || '',
                media_url: editData.media_url || '',
                media_type: editData.media_type || 'photo',
                date_represented: editData.date_represented || getLocalDateString(new Date()),
                location_id: editData.location_id || '',
                beneficiary_group_ids: editData.beneficiary_group_ids || [],
                initiative_id: initiativeId
            })
            setDatePickerValue({ singleDate: editData.date_represented })
            setSelectedBeneficiaryGroupIds(editData.beneficiary_group_ids || [])
        } else {
            // Reset for new story
            setFormData({
                title: '',
                description: '',
                media_url: '',
                media_type: 'photo',
                date_represented: getLocalDateString(new Date()),
                location_id: '',
                beneficiary_group_ids: [],
                initiative_id: initiativeId
            })
            setDatePickerValue({})
            setSelectedBeneficiaryGroupIds([])
            setSelectedFile(null)
            setUploadProgress('')
        }
    }, [editData, initiativeId, isOpen])

    // Update date_represented when datePickerValue changes
    useEffect(() => {
        if (datePickerValue.singleDate) {
            setFormData(prev => ({ ...prev, date_represented: datePickerValue.singleDate! }))
        } else if (datePickerValue.startDate) {
            setFormData(prev => ({ ...prev, date_represented: datePickerValue.startDate! }))
        }
    }, [datePickerValue])

    const handleFileSelect = async (file: File) => {
        setSelectedFile(file)
        setUploadProgress('Uploading...')

        try {
            const uploadResult = await apiService.uploadFile(file)
            setFormData(prev => ({ ...prev, media_url: uploadResult.file_url }))
            setUploadProgress('Upload complete!')
        } catch (error) {
            console.error('Upload error:', error)
            toast.error('Failed to upload file')
            setUploadProgress('')
            setSelectedFile(null)
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) {
            handleFileSelect(file)
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            handleFileSelect(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.title.trim()) {
            toast.error('Please enter a title')
            return
        }
        if (!formData.date_represented) {
            toast.error('Please select a date')
            return
        }

        setLoading(true)
        try {
            const submitData = {
                ...formData,
                media_url: formData.media_url?.trim() || undefined, // Convert empty string to undefined
                beneficiary_group_ids: selectedBeneficiaryGroupIds
            }

            if (editData?.id) {
                await apiService.updateStory(editData.id, submitData)
                toast.success('Story updated successfully!')
            } else {
                await apiService.createStory(submitData)
                toast.success('Story created successfully!')
            }
            // Wait for stories to reload before closing modal
            await onSubmit()
            onClose()
        } catch (error: any) {
            const message = error instanceof Error ? error.message : 'Failed to save story'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {editData ? 'Edit Story' : 'Add Story'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Title *
                        </label>
                        <input
                            type="text"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter story title"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={4}
                            placeholder="Tell the story of this impact..."
                        />
                    </div>

                    {/* Media Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Media Type *
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {mediaTypes.map((type) => {
                                const Icon = type.icon
                                const isSelected = formData.media_type === type.value
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, media_type: type.value }))}
                                        className={`p-4 border-2 rounded-lg transition-colors ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                                        <div className={`text-sm font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                                            {type.label}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {formData.media_type === 'photo' ? 'Photo' : formData.media_type === 'video' ? 'Video' : 'Recording'} (Optional)
                        </label>
                        <div
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                                isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                            }`}
                        >
                            {formData.media_url ? (
                                <div className="space-y-2">
                                    {formData.media_type === 'photo' ? (
                                        <img src={formData.media_url} alt="Preview" className="w-full max-h-32 mx-auto rounded-lg object-cover" style={{ aspectRatio: '3/4', maxHeight: '150px' }} />
                                    ) : formData.media_type === 'video' ? (
                                        <video src={formData.media_url} className="w-full max-h-32 mx-auto rounded-lg object-cover" controls style={{ aspectRatio: '3/4', maxHeight: '150px' }} />
                                    ) : (
                                        <div className="w-full bg-gray-100 rounded-lg flex items-center justify-center" style={{ aspectRatio: '3/4', maxHeight: '150px' }}>
                                            <Mic className="w-6 h-6 text-gray-400" />
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-600">{uploadProgress || 'File uploaded'}</p>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFormData(prev => ({ ...prev, media_url: '' }))
                                            setSelectedFile(null)
                                            setUploadProgress('')
                                        }}
                                        className="text-xs text-red-600 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="bg-gradient-to-br from-green-100 to-green-200 rounded-lg flex items-center justify-center" style={{ aspectRatio: '3/4', maxHeight: '150px', minHeight: '120px' }}>
                                    <div className="text-center p-4">
                                        <div className="w-8 h-8 bg-green-300 rounded-full mx-auto mb-2 flex items-center justify-center">
                                            {formData.media_type === 'photo' ? (
                                                <Image className="w-4 h-4 text-green-600" />
                                            ) : formData.media_type === 'video' ? (
                                                <Video className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <Mic className="w-4 h-4 text-green-600" />
                                            )}
                                        </div>
                                        <p className="text-xs font-medium text-green-700 mb-1">No Media</p>
                                        <Upload className="w-6 h-6 text-green-600 mx-auto mb-2" />
                                        <p className="text-xs text-green-600 mb-2">
                                            Drag and drop or click to browse
                                        </p>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            onChange={handleFileInputChange}
                                            accept={formData.media_type === 'photo' ? 'image/*' : formData.media_type === 'video' ? 'video/*' : 'audio/*'}
                                            className="hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-medium transition-colors"
                                        >
                                            Browse Files
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Date *
                        </label>
                        <DateRangePicker
                            value={datePickerValue}
                            onChange={setDatePickerValue}
                            placeholder="Select date"
                        />
                    </div>

                    {/* Location */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Location (Optional)
                        </label>
                        <select
                            value={formData.location_id || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, location_id: e.target.value || undefined }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">No location</option>
                            {locations.map((location) => (
                                <option key={location.id} value={location.id}>
                                    {location.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Beneficiary Groups */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Beneficiary Groups (Optional)
                        </label>
                        <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
                            {beneficiaryGroups.length === 0 ? (
                                <p className="text-sm text-gray-500">No beneficiary groups available</p>
                            ) : (
                                <div className="space-y-2">
                                    {beneficiaryGroups.map((group) => (
                                        <label
                                            key={group.id}
                                            className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedBeneficiaryGroupIds.includes(group.id!)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setSelectedBeneficiaryGroupIds([...selectedBeneficiaryGroupIds, group.id!])
                                                    } else {
                                                        setSelectedBeneficiaryGroupIds(selectedBeneficiaryGroupIds.filter(id => id !== group.id))
                                                    }
                                                }}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{group.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : editData ? 'Update Story' : 'Create Story'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

