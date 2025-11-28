import React, { useState, useEffect } from 'react'
import { X, Calendar, Hash, MapPin, FileText, Users, Plus, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { CreateKPIUpdateForm, BeneficiaryGroup, Location } from '../types'
import { apiService } from '../services/api'
import LocationModal from './LocationModal'
import DateRangePicker from './DateRangePicker'
import { getLocalDateString } from '../utils'
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
        date_represented: getLocalDateString(new Date()),
        date_range_start: undefined,
        date_range_end: undefined,
        note: '',
        label: ''
    })
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [loading, setLoading] = useState(false)
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocationId, setSelectedLocationId] = useState<string>('')
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 3

    // Reset step when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1)
        }
    }, [isOpen])

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
                const initialDateValue = editData.date_range_start && editData.date_range_end
                    ? { startDate: editData.date_range_start, endDate: editData.date_range_end }
                    : editData.date_represented
                        ? { singleDate: editData.date_represented }
                        : {}
                
                setFormData({
                    value: editData.value || 0,
                    date_represented: editData.date_represented || getLocalDateString(new Date()),
                    date_range_start: editData.date_range_start,
                    date_range_end: editData.date_range_end,
                    note: editData.note || '',
                    label: editData.label || ''
                })
                setDatePickerValue(initialDateValue)
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
                    date_represented: getLocalDateString(new Date()),
                    date_range_start: undefined,
                    date_range_end: undefined,
                    note: '',
                    label: ''
                })
                setDatePickerValue({})
                setSelectedGroupIds([])
                setSelectedLocationId('')
            }
        }
    }, [isOpen, initiativeId, editData])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Validate dates aren't in the future
            const today = getLocalDateString(new Date())
            
            // Prepare form data based on date picker value
            const submitData = { ...formData }
            
            if (datePickerValue.singleDate) {
                // Single date selected
                if (datePickerValue.singleDate > today) {
                    throw new Error('Date cannot be in the future')
                }
                submitData.date_represented = datePickerValue.singleDate
                submitData.date_range_start = undefined
                submitData.date_range_end = undefined
            } else if (datePickerValue.startDate && datePickerValue.endDate) {
                // Date range selected
                if (datePickerValue.startDate > today) {
                    throw new Error('Start date cannot be in the future')
                }
                if (datePickerValue.endDate > today) {
                    throw new Error('End date cannot be in the future')
                }
                submitData.date_range_start = datePickerValue.startDate
                submitData.date_range_end = datePickerValue.endDate
                submitData.date_represented = datePickerValue.startDate
            } else {
                throw new Error('Please select a date')
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
                    date_represented: getLocalDateString(new Date()),
                    date_range_start: undefined,
                    date_range_end: undefined,
                    note: '',
                    label: ''
                })
                setDatePickerValue({})
                setSelectedGroupIds([])
                setSelectedLocationId('')
            }
            onClose()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save update'
            toast.error(message)
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

    const canProceedToNextStep = () => {
        switch (currentStep) {
            case 1:
                return formData.value > 0
            case 2:
                return !!(datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate))
            case 3:
                return true // Title and description are optional
            default:
                return false
        }
    }

    const handleNext = () => {
        if (canProceedToNextStep() && currentStep < totalSteps) {
            setCurrentStep(currentStep + 1)
        }
    }

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1)
        }
    }

    const steps = [
        { number: 1, title: 'Value' },
        { number: 2, title: 'Date & Location' },
        { number: 3, title: 'Details' }
    ]

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-200 ease-out animate-slide-up-fast flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
                    <div className="flex-1">
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editData ? 'Edit Impact Claim' : 'Add Impact Claim'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">{kpiTitle}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150 ml-4"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Steps Indicator */}
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex flex-col items-center">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
                                        currentStep > step.number
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : currentStep === step.number
                                            ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100'
                                            : 'bg-white border-gray-300 text-gray-400'
                                    }`}>
                                        {currentStep > step.number ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <span className="text-sm font-semibold">{step.number}</span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <div className={`text-xs font-medium whitespace-nowrap ${
                                            currentStep >= step.number ? 'text-gray-900' : 'text-gray-400'
                                        }`}>
                                            {step.title}
                                        </div>
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-4 transition-all duration-200 ${
                                        currentStep > step.number ? 'bg-blue-600' : 'bg-gray-300'
                                    }`} style={{ maxWidth: '120px' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={(e) => { e.preventDefault(); if (currentStep === totalSteps) handleSubmit(e); }} className="flex-1 overflow-y-auto">
                    <div className="p-8 min-h-[400px]">
                        {/* Step 1: Value */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Enter the Value</h3>
                                    <p className="text-gray-600">What is the measurement for this impact claim?</p>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl p-8 border-2 border-gray-200">
                                    <label className="block text-sm font-semibold text-gray-900 mb-4">
                                        <Hash className="w-5 h-5 inline mr-2 text-blue-600" />
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
                                            className="input-field text-3xl font-semibold text-center pr-20 py-6 transition-all duration-150 hover:border-gray-400"
                                            placeholder="0"
                                            required
                                            min="0"
                                            step={metricType === 'percentage' ? '0.01' : '1'}
                                            max={metricType === 'percentage' ? '100' : undefined}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-6 pointer-events-none">
                                            <span className="text-gray-600 text-lg font-medium">
                                                {metricType === 'percentage' ? '%' : unitOfMeasurement}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-4 text-center">
                                        {metricType === 'percentage' 
                                            ? 'Enter a value between 0 and 100'
                                            : `Enter the ${unitOfMeasurement.toLowerCase()} value`}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Date & Location */}
                        {currentStep === 2 && (
                            <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">When & Where</h3>
                                    <p className="text-gray-600">Select the date and location for this impact claim</p>
                                </div>
                                
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <Calendar className="w-5 h-5 inline mr-2 text-blue-600" />
                                            Date <span className="text-red-500">*</span>
                                        </label>
                                        <DateRangePicker
                                            value={datePickerValue}
                                            onChange={(value) => {
                                                setDatePickerValue(value)
                                                if (value.singleDate) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        date_represented: value.singleDate!,
                                                        date_range_start: undefined,
                                                        date_range_end: undefined
                                                    }))
                                                } else if (value.startDate && value.endDate) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        date_range_start: value.startDate!,
                                                        date_range_end: value.endDate!,
                                                        date_represented: value.startDate!
                                                    }))
                                                }
                                            }}
                                            maxDate={getLocalDateString(new Date())}
                                            placeholder="Select date or range"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <MapPin className="w-5 h-5 inline mr-2 text-blue-600" />
                                            Location (optional)
                                        </label>
                                        <div className="flex gap-3">
                                            <select
                                                value={selectedLocationId}
                                                onChange={(e) => setSelectedLocationId(e.target.value)}
                                                className="input-field flex-1 text-base py-3"
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
                                                    className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors"
                                                    title="Add new location"
                                                >
                                                    <Plus className="w-5 h-5" />
                                                    <span>New</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <Users className="w-5 h-5 inline mr-2 text-blue-600" />
                                            Beneficiary Groups (optional)
                                        </label>
                                        {beneficiaryGroups.length === 0 ? (
                                            <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                                                <p className="text-sm text-gray-500">No groups yet. You can add them later.</p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                                                {beneficiaryGroups.map(group => {
                                                    const checked = selectedGroupIds.includes(group.id!)
                                                    return (
                                                        <label key={group.id} className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all cursor-pointer ${
                                                            checked 
                                                                ? 'bg-blue-50 border-blue-300' 
                                                                : 'bg-white border-gray-200 hover:border-blue-200'
                                                        }`}>
                                                            <div className="flex items-center space-x-3">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    onChange={() => setSelectedGroupIds(prev => checked ? prev.filter(id => id !== group.id) : [...prev, group.id!])}
                                                                    className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                                                />
                                                                <span className="text-sm font-medium text-gray-900">{group.name}</span>
                                                            </div>
                                                            {group.description && (
                                                                <span className="text-xs text-gray-600 truncate max-w-xs">{group.description}</span>
                                                            )}
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Title & Description */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Add Details</h3>
                                    <p className="text-gray-600">Provide a title and description for this impact claim</p>
                                </div>
                                
                                <div className="space-y-6">
                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            <strong>Note:</strong> When creating AI reports, the AI will analyze these sections to generate comprehensive impact narratives.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <FileText className="w-5 h-5 inline mr-2 text-blue-600" />
                                            Label or Title (optional)
                                        </label>
                                        <input
                                            type="text"
                                            name="label"
                                            value={formData.label}
                                            onChange={handleInputChange}
                                            className="input-field text-base py-3"
                                            placeholder="e.g., Week 2 Update, Follow-up Training Day"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <FileText className="w-5 h-5 inline mr-2 text-blue-600" />
                                            Notes (optional)
                                        </label>
                                        <textarea
                                            name="note"
                                            value={formData.note}
                                            onChange={handleInputChange}
                                            className="input-field resize-none text-base py-3"
                                            rows={5}
                                            placeholder="Any additional context or explanation for this update..."
                                        />
                                    </div>

                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mt-6">
                                        <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 About Impact Claims</h4>
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            An impact claim represents a specific measurement of your work. You can set a date range (e.g., 3 days) 
                                            to represent work that spans multiple days. Evidence you upload may cover only part of this range, 
                                            and the system will show how many days your evidence covers (e.g., "Evidence covers 1 of 3 days").
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Navigation Footer */}
                <div className="border-t border-gray-200 p-6 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={currentStep === 1 ? onClose : handleBack}
                            className="flex items-center space-x-2 px-6 py-3 text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                            {currentStep === 1 ? (
                                <>
                                    <X className="w-5 h-5" />
                                    <span>Cancel</span>
                                </>
                            ) : (
                                <>
                                    <ChevronLeft className="w-5 h-5" />
                                    <span>Back</span>
                                </>
                            )}
                        </button>

                        <div className="flex items-center space-x-3">
                            {currentStep < totalSteps ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={!canProceedToNextStep()}
                                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm hover:shadow-md"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    onClick={handleSubmit}
                                    disabled={loading || formData.value === 0}
                                    className="flex items-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors shadow-sm hover:shadow-md"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>{editData ? 'Updating...' : 'Adding...'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{editData ? 'Update Impact Claim' : 'Add Impact Claim'}</span>
                                            <Check className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
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