import React, { useState, useEffect, useRef } from 'react'
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
    const formContentRef = useRef<HTMLFormElement>(null)

    // Reset step when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1)
        }
    }, [isOpen])

    // Scroll to top when step changes
    useEffect(() => {
        if (formContentRef.current) {
            formContentRef.current.scrollTop = 0
        }
    }, [currentStep])

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

            // Validate label is required
            if (!formData.label || !formData.label.trim()) {
                throw new Error('Label or Title is required')
            }

            // Validate location is required
            if (!selectedLocationId || !selectedLocationId.trim()) {
                throw new Error('Location is required')
            }

            await onSubmit({
                ...submitData,
                beneficiary_group_ids: selectedGroupIds,
                location_id: selectedLocationId
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
                return !!(datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate)) && !!selectedLocationId
            case 3:
                return !!formData.label?.trim() // Label is required
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
        <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white/70 backdrop-blur-2xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-white/60 transform transition-all duration-200 ease-out animate-slide-up-fast flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-primary-200/40 bg-gradient-to-r from-primary-100/50 to-primary-50/30 backdrop-blur-xl">
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-primary-500/15 backdrop-blur-sm flex items-center justify-center border border-primary-300/30">
                            <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">
                                {editData ? 'Edit Impact Claim' : 'Add Impact Claim'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">{kpiTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white/60 transition-all duration-200 ml-4"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Steps Indicator */}
                <div className="px-6 py-4 border-b border-primary-100/40 bg-white/30 backdrop-blur-xl">
                    <div className="flex items-center justify-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex flex-col items-center">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-200 ${
                                        currentStep > step.number
                                            ? 'bg-primary-500 border-primary-500 text-white shadow-lg shadow-primary-500/30'
                                            : currentStep === step.number
                                            ? 'bg-primary-500 border-primary-500 text-white ring-4 ring-primary-200/50 shadow-lg shadow-primary-500/30'
                                            : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-400'
                                    }`}>
                                        {currentStep > step.number ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <span className="text-sm font-semibold">{step.number}</span>
                                        )}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <div className={`text-xs font-medium whitespace-nowrap ${
                                            currentStep >= step.number ? 'text-gray-700' : 'text-gray-400'
                                        }`}>
                                            {step.title}
                                        </div>
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 mx-4 rounded-full transition-all duration-200 ${
                                        currentStep > step.number ? 'bg-primary-500' : 'bg-gray-200/60'
                                    }`} style={{ maxWidth: '120px' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <form ref={formContentRef} onSubmit={(e) => { e.preventDefault(); if (currentStep === totalSteps) handleSubmit(e); }} className="flex-1 overflow-y-auto">
                    <div className="p-8 min-h-[400px]">
                        {/* Step 1: Value */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">{kpiTitle}</h3>
                                    <p className="text-gray-600">Enter the measurable value for this impact claim</p>
                                </div>
                                
                                <div className="bg-gray-50 rounded-xl p-8 border-2 border-gray-200">
                                    <div className="relative">
                                        <input
                                            type="number"
                                            name="value"
                                            value={formData.value}
                                            onChange={handleInputChange}
                                            onFocus={handleValueFocus}
                                            onBlur={handleValueBlur}
                                            className="input-field text-3xl font-semibold text-center py-6 transition-all duration-150 hover:border-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            placeholder="0"
                                            required
                                            min="0"
                                            step={metricType === 'percentage' ? '0.01' : '1'}
                                            max={metricType === 'percentage' ? '100' : undefined}
                                            style={{ paddingRight: '140px' }}
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center gap-3 pr-4">
                                            <span className="text-gray-600 text-lg font-medium pointer-events-none">
                                                {metricType === 'percentage' ? '%' : unitOfMeasurement}
                                            </span>
                                            <div className="flex flex-col pointer-events-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const step = metricType === 'percentage' ? 0.01 : 1
                                                        const max = metricType === 'percentage' ? 100 : undefined
                                                        const newValue = Math.min((formData.value || 0) + step, max || Infinity)
                                                        setFormData(prev => ({ ...prev, value: newValue }))
                                                    }}
                                                    className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded-t transition-colors border border-gray-300 border-b-0"
                                                    tabIndex={-1}
                                                >
                                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const step = metricType === 'percentage' ? 0.01 : 1
                                                        const newValue = Math.max((formData.value || 0) - step, 0)
                                                        setFormData(prev => ({ ...prev, value: newValue }))
                                                    }}
                                                    className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded-b transition-colors border border-gray-300"
                                                    tabIndex={-1}
                                                >
                                                    <svg className="w-3 h-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
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
                                            Location <span className="text-red-500">*</span>
                                        </label>
                                        <div className="flex gap-3">
                                            <select
                                                value={selectedLocationId}
                                                onChange={(e) => setSelectedLocationId(e.target.value)}
                                                className="input-field flex-1 text-base py-3"
                                                required
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
                                    <p className="text-gray-600">Provide a Title and Description for this Impact Claim</p>
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
                                            Label or Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="label"
                                            value={formData.label}
                                            onChange={handleInputChange}
                                            className="input-field text-base py-3"
                                            placeholder="e.g., Week 2 Update, Follow-up Training Day"
                                            required
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
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            An Impact Claim records impact by location and date. Evidence is automatically linked when it overlaps in date and location.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Navigation Footer */}
                <div className="border-t border-primary-100/40 p-6 bg-white/30 backdrop-blur-xl">
                    <div className="flex items-center justify-between">
                        <button
                            type="button"
                            onClick={currentStep === 1 ? onClose : handleBack}
                            className="flex items-center space-x-2 px-5 py-3 text-gray-600 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-xl hover:bg-white/70 font-medium transition-all duration-200"
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
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    onClick={handleSubmit}
                                    disabled={loading || formData.value === 0}
                                    className="flex items-center space-x-2 px-6 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40"
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