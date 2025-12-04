import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, Calendar, Link as LinkIcon, FileText, Camera, DollarSign, MessageSquare, File, MapPin, Plus, ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'
import { CreateEvidenceForm, KPI, KPIWithEvidence, Location } from '../types'
import { apiService } from '../services/api'
import { formatDate, getLocalDateString } from '../utils'
import LocationModal from './LocationModal'
import DateRangePicker from './DateRangePicker'
import toast from 'react-hot-toast'

interface AddEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateEvidenceForm) => Promise<void>
    availableKPIs: (KPI | KPIWithEvidence)[]
    initiativeId: string
    preSelectedKPIId?: string
    editData?: any // Optional prop for editing existing evidence
}

export default function AddEvidenceModal({
    isOpen,
    onClose,
    onSubmit,
    availableKPIs,
    initiativeId,
    preSelectedKPIId,
    editData
}: AddEvidenceModalProps) {
    const [formData, setFormData] = useState<CreateEvidenceForm>({
        title: editData?.title || '',
        description: editData?.description || '',
        type: editData?.type || 'visual_proof',
        date_represented: editData?.date_represented || getLocalDateString(new Date()),
        date_range_start: editData?.date_range_start,
        date_range_end: editData?.date_range_end,
        file_url: editData?.file_url,
        kpi_ids: editData?.kpi_ids || (preSelectedKPIId ? [preSelectedKPIId] : []),
        initiative_id: initiativeId
    })
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [loading, setLoading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    // State for showing matching impact claims
    const [matchingDataPoints, setMatchingDataPoints] = useState<any[]>([])
    const [isFetchingMatches, setIsFetchingMatches] = useState(false)
    const [kpiDataSummaries, setKpiDataSummaries] = useState<any[]>([])
    const [selectedUpdateIds, setSelectedUpdateIds] = useState<string[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocationId, setSelectedLocationId] = useState<string>('')
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
    const [hasChangedDataPoints, setHasChangedDataPoints] = useState(false)
    const [hasChangedKPIs, setHasChangedKPIs] = useState(false)
    const [initialKpiIds, setInitialKpiIds] = useState<string[]>([])
    const [isInitialFetch, setIsInitialFetch] = useState(true)
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 5

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera, description: 'Photos, videos, screenshots' },
        { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
        { value: 'testimony', label: 'Testemonies', icon: MessageSquare, description: 'Quotes, feedback, stories' },
        { value: 'financials', label: 'Financials', icon: DollarSign, description: 'Receipts, invoices, budgets' }
    ] as const

    // Ensure pre-selected KPI is checked when modal opens
    useEffect(() => {
        if (isOpen && preSelectedKPIId && !editData) {
            // Ensure pre-selected KPI is in the formData
            if (!formData.kpi_ids?.includes(preSelectedKPIId)) {
                setFormData(prev => ({
                    ...prev,
                    kpi_ids: [...(prev.kpi_ids || []), preSelectedKPIId]
                }))
            }
        }
    }, [isOpen, preSelectedKPIId, editData])

    // Reset step when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            if (editData) {
                setCurrentStep(1) // Start at step 1 for editing
            } else {
                setCurrentStep(1) // Start at step 1 for new evidence
            }
        }
    }, [isOpen, editData])

    // Update form data when editData changes or modal opens
    useEffect(() => {
        if (editData && isOpen) {
            // Load full evidence details to ensure we have kpi_ids
            const loadEvidenceData = async () => {
                try {
                    const fullEvidence = await apiService.getEvidenceItem(editData.id!)
                    // Transform evidence_kpis array into kpi_ids array
                    let kpiIds: string[] = []
                    if (fullEvidence.kpi_ids && Array.isArray(fullEvidence.kpi_ids)) {
                        kpiIds = fullEvidence.kpi_ids
                    } else if ((fullEvidence as any).evidence_kpis && Array.isArray((fullEvidence as any).evidence_kpis)) {
                        kpiIds = (fullEvidence as any).evidence_kpis.map((link: any) => link.kpi_id).filter(Boolean)
                    } else {
                        kpiIds = editData.kpi_ids || []
                    }

                    setFormData({
                        title: fullEvidence.title || editData.title || '',
                        description: fullEvidence.description || editData.description || '',
                        type: fullEvidence.type || editData.type || 'visual_proof',
                        date_represented: fullEvidence.date_represented || editData.date_represented || getLocalDateString(new Date()),
                        date_range_start: fullEvidence.date_range_start || editData.date_range_start,
                        date_range_end: fullEvidence.date_range_end || editData.date_range_end,
                        file_url: fullEvidence.file_url || editData.file_url,
                        kpi_ids: kpiIds,
                        initiative_id: initiativeId
                    })
                    const initialDateValue = (fullEvidence.date_range_start && fullEvidence.date_range_end)
                        ? { startDate: fullEvidence.date_range_start, endDate: fullEvidence.date_range_end }
                        : (fullEvidence.date_represented || editData.date_represented)
                            ? { singleDate: fullEvidence.date_represented || editData.date_represented }
                            : {}
                    setDatePickerValue(initialDateValue)
                    setSelectedLocationId(fullEvidence.location_id || editData.location_id || '')

                    // Store initial KPI IDs to track changes
                    setInitialKpiIds(kpiIds)
                    setHasChangedKPIs(false)

                    // Load existing linked impact claims when editing
                    const dataPoints = await apiService.getDataPointsForEvidence(editData.id)
                    setSelectedUpdateIds(dataPoints.map((dp: any) => dp.id))
                    setHasChangedDataPoints(false)
                } catch (error) {
                    console.error('Error loading evidence data:', error)
                    // Fallback to editData if API call fails
                    const kpiIds = editData.kpi_ids || []
                    setFormData({
                        title: editData.title || '',
                        description: editData.description || '',
                        type: editData.type || 'visual_proof',
                        date_represented: editData.date_represented || getLocalDateString(new Date()),
                        date_range_start: editData.date_range_start,
                        date_range_end: editData.date_range_end,
                        file_url: editData.file_url,
                        kpi_ids: kpiIds,
                        initiative_id: initiativeId
                    })
                    const initialDateValue = (editData.date_range_start && editData.date_range_end)
                        ? { startDate: editData.date_range_start, endDate: editData.date_range_end }
                        : editData.date_represented
                            ? { singleDate: editData.date_represented }
                            : {}
                    setDatePickerValue(initialDateValue)
                    setSelectedLocationId(editData.location_id || '')
                    setInitialKpiIds(kpiIds)
                    setHasChangedKPIs(false)
                    setSelectedUpdateIds([])
                    setHasChangedDataPoints(false)
                }
            }

            loadEvidenceData()
        } else {
            // Reset for new evidence
            setSelectedUpdateIds([])
            setHasChangedDataPoints(false)
            setInitialKpiIds([])
            setHasChangedKPIs(false)
            setDatePickerValue({})
            setIsInitialFetch(true) // Reset to initial fetch state for new evidence
        }
    }, [editData?.id, initiativeId, isOpen])

    // Load locations when modal opens
    useEffect(() => {
        if (isOpen && initiativeId) {
            apiService
                .getLocations(initiativeId)
                .then((locs) => setLocations(locs || []))
                .catch(() => setLocations([]))
        }
    }, [isOpen, initiativeId])

    // Debounced effect to fetch matching impact claims
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (formData.kpi_ids && formData.kpi_ids.length > 0) {
                if (datePickerValue.startDate && datePickerValue.endDate) {
                    fetchMatchingImpactClaims()
                } else if (datePickerValue.singleDate) {
                    fetchMatchingImpactClaims()
                } else {
                    setMatchingDataPoints([])
                }
            } else {
                setMatchingDataPoints([])
            }
        }, 300) // 300ms debounce

        return () => clearTimeout(timeoutId)
    }, [datePickerValue, formData.kpi_ids, selectedLocationId])

    const fetchMatchingImpactClaims = async () => {
        if (isFetchingMatches) return // Prevent concurrent calls

        try {
            setIsFetchingMatches(true)

            // For each selected KPI, get their updates and filter by date overlap and location
            const kpiSummaries = []
            for (const kpiId of formData.kpi_ids || []) {
                const updates = await apiService.getKPIUpdates(kpiId)
                const matchingUpdates = updates.filter(update => {
                    // Filter by location if one is selected
                    if (selectedLocationId && update.location_id !== selectedLocationId) {
                        return false
                    }

                    const updateDate = update.date_represented
                    const updateStart = update.date_range_start
                    const updateEnd = update.date_range_end

                    if (datePickerValue.startDate && datePickerValue.endDate) {
                        // Evidence is a date range
                        const evidenceStart = datePickerValue.startDate
                        const evidenceEnd = datePickerValue.endDate

                        // Check if evidence range overlaps with update
                        if (updateStart && updateEnd) {
                            // Both are ranges - check overlap
                            return evidenceStart <= updateEnd && evidenceEnd >= updateStart
                        } else {
                            // Update is single date - check if it's within evidence range
                            return updateDate >= evidenceStart && updateDate <= evidenceEnd
                        }
                    } else if (datePickerValue.singleDate) {
                        // Evidence is a single date
                        const evidenceDate = datePickerValue.singleDate

                        // Check if evidence date matches or overlaps with update
                        if (updateStart && updateEnd) {
                            // Update is a range - check if evidence date falls within it
                            return evidenceDate >= updateStart && evidenceDate <= updateEnd
                        } else {
                            // Both are single dates - check for exact match
                            return evidenceDate === updateDate
                        }
                    }
                    return false
                })

                if (matchingUpdates.length > 0) {
                    // Find KPI info
                    const kpi = availableKPIs.find(k => k.id === kpiId)
                    if (kpi) {
                        // Calculate total for this KPI
                        const total = matchingUpdates.reduce((sum, update) => sum + update.value, 0)

                        // Add KPI info and location name to each update
                        const updatesWithKPI = matchingUpdates.map(update => {
                            const location = update.location_id ? locations.find(loc => loc.id === update.location_id) : null
                            return {
                            ...update,
                            kpi_title: kpi.title,
                                kpi_unit: kpi.unit_of_measurement,
                                location_name: location?.name
                            }
                        })

                        kpiSummaries.push({
                            kpi,
                            total,
                            updates: updatesWithKPI
                        })
                    }
                }
            }

            setKpiDataSummaries(kpiSummaries)
            // Keep the old format for backward compatibility if needed
            const allDataPoints = kpiSummaries.flatMap(summary => summary.updates)
            setMatchingDataPoints(allDataPoints)
            // Auto-select all matching impact claims (date and location match)
            if (!editData) {
                setSelectedUpdateIds(allDataPoints.map((dp: any) => dp.id))
                setIsInitialFetch(false)
            } else {
                // When editing, preserve existing selections and filter out claims that no longer match
                setSelectedUpdateIds(prev => {
                    const newMatchingIds = new Set(allDataPoints.map((dp: any) => dp.id))
                    // Keep only the IDs that are still in the matching set
                    return prev.filter(id => newMatchingIds.has(id))
                })
            }
        } catch (error) {
            console.error('Error fetching matching impact claims:', error)
        } finally {
            setIsFetchingMatches(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setUploadProgress('')

        try {
            let finalFileUrl = formData.file_url
            const fileUrls: string[] = []

            // If user selected files, upload all of them
            if (selectedFiles.length > 0) {
                setUploadProgress(`Uploading ${selectedFiles.length} file${selectedFiles.length > 1 ? 's' : ''}...`)
                for (let i = 0; i < selectedFiles.length; i++) {
                    setUploadProgress(`Uploading file ${i + 1} of ${selectedFiles.length}...`)
                    const uploadResult = await apiService.uploadFile(selectedFiles[i])
                    fileUrls.push(uploadResult.file_url)
                    // Keep first file URL for backward compatibility
                    if (i === 0) {
                        finalFileUrl = uploadResult.file_url
                    }
                }
                setUploadProgress('Files uploaded successfully!')
            }

            // Create evidence record with the real file URL(s)
            let submitData: any = {
                ...formData,
                file_url: finalFileUrl,
                file_urls: fileUrls.length > 0 ? fileUrls : undefined
            }

            // Handle date range logic
            if (datePickerValue.singleDate) {
                // Single date selected
                submitData.date_represented = datePickerValue.singleDate
                submitData.date_range_start = undefined
                submitData.date_range_end = undefined
            } else if (datePickerValue.startDate && datePickerValue.endDate) {
                // Date range selected
                submitData.date_range_start = datePickerValue.startDate
                submitData.date_range_end = datePickerValue.endDate
                submitData.date_represented = datePickerValue.startDate
            } else {
                throw new Error('Please select a date')
            }

            // Include selected impact claims for precise linking
            // Only include kpi_update_ids if it's a new evidence or if editing and user has changed selection
            if (!editData || hasChangedDataPoints) {
                submitData.kpi_update_ids = selectedUpdateIds
            }

            // Only include kpi_ids if it's a new evidence or if editing and user has changed KPI selection
            if (!editData || hasChangedKPIs) {
                submitData.kpi_ids = formData.kpi_ids
            }

            submitData.location_id = selectedLocationId || undefined

            setUploadProgress(editData ? 'Updating evidence record...' : 'Creating evidence record...')
            await onSubmit(submitData)

            // Reset form only if creating (not editing)
            if (!editData) {
                setFormData({
                    title: '',
                    description: '',
                    type: 'visual_proof',
                    date_represented: getLocalDateString(new Date()),
                    kpi_ids: preSelectedKPIId ? [preSelectedKPIId] : [],
                    initiative_id: initiativeId
                })
                setSelectedFiles([])
                setDatePickerValue({})
            }
            setUploadProgress('')
            onClose()
        } catch (error) {
            console.error('Error creating evidence:', error)
            setUploadProgress(`Error: ${error instanceof Error ? error.message : 'Failed to create evidence'}`)
        } finally {
            setLoading(false)
        }
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleKPISelection = (kpiId: string) => {
        setFormData(prev => {
            const newKpiIds = (prev.kpi_ids || []).includes(kpiId)
                ? (prev.kpi_ids || []).filter(id => id !== kpiId)
                : [...(prev.kpi_ids || []), kpiId]

            // Check if KPI selection has changed from initial state
            if (editData) {
                const sortedNew = [...newKpiIds].sort()
                const sortedInitial = [...initialKpiIds].sort()
                const hasChanged = JSON.stringify(sortedNew) !== JSON.stringify(sortedInitial)
                setHasChangedKPIs(hasChanged)
            }

            return {
                ...prev,
                kpi_ids: newKpiIds
            }
        })
    }

    const handleFileSelect = (files: FileList | File[]) => {
        const fileArray = Array.from(files)
        setSelectedFiles(prev => [...prev, ...fileArray])
        // Auto-populate title if empty
        if (!formData.title && fileArray.length > 0) {
            setFormData(prev => ({
                ...prev,
                title: fileArray[0].name.replace(/\.[^/.]+$/, "") // Remove file extension
            }))
        }
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)

        const files = e.dataTransfer.files
        if (files.length > 0) {
            handleFileSelect(files)
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            handleFileSelect(files)
        }
    }

    const triggerFileSelect = () => {
        fileInputRef.current?.click()
    }

    const removeFile = (index?: number) => {
        if (index !== undefined) {
            setSelectedFiles(prev => prev.filter((_, i) => i !== index))
        } else {
            setSelectedFiles([])
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    const canProceedToNextStep = () => {
        switch (currentStep) {
            case 1:
                return !!formData.type
            case 2:
                return !!(datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate))
            case 3:
                return !!(formData.kpi_ids && formData.kpi_ids.length > 0)
            case 4:
                return true // Impact claims step is optional
            case 5:
                return !!formData.title && (selectedFiles.length > 0 || !!formData.file_url)
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
        { number: 1, title: 'Evidence Type' },
        { number: 2, title: 'Date & Location' },
        { number: 3, title: 'Metrics' },
        { number: 4, title: 'Impact Claims' },
        { number: 5, title: 'Details & Upload' }
    ]

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white/70 backdrop-blur-2xl rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-white/60 transform transition-all duration-200 ease-out animate-slide-up-fast flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-impact-200/40 bg-gradient-to-r from-impact-100/50 to-impact-50/30 backdrop-blur-xl">
                    <div className="flex items-center space-x-3 flex-1">
                        <div className="w-11 h-11 rounded-xl bg-impact-500/15 backdrop-blur-sm flex items-center justify-center border border-impact-300/30">
                            <FileText className="w-6 h-6 text-impact-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-800">
                                {editData ? 'Edit Evidence' : 'Upload Evidence'}
                            </h2>
                            <p className="text-sm text-gray-500 mt-0.5">
                                {editData ? 'Update your evidence information' : 'Add supporting evidence for your impact claims'}
                            </p>
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
                <div className="px-6 py-4 border-b border-impact-100/40 bg-white/30 backdrop-blur-xl">
                    <div className="flex items-center justify-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex flex-col items-center">
                                    <div className={`flex items-center justify-center w-10 h-10 rounded-xl border-2 transition-all duration-200 ${
                                        currentStep > step.number
                                            ? 'bg-impact-500 border-impact-500 text-white shadow-lg shadow-impact-500/30'
                                            : currentStep === step.number
                                            ? 'bg-impact-500 border-impact-500 text-white ring-4 ring-impact-200/50 shadow-lg shadow-impact-500/30'
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
                                        currentStep > step.number ? 'bg-impact-500' : 'bg-gray-200/60'
                                    }`} style={{ maxWidth: '120px' }} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={(e) => { e.preventDefault(); if (currentStep === totalSteps) handleSubmit(e); }} className="flex-1 overflow-y-auto">
                    <div className="p-8 min-h-[400px]">
                        {/* Step 1: Evidence Type */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-fade-in">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Select Evidence Type</h3>
                                    <p className="text-gray-600">Choose the type of evidence you're uploading</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                            {evidenceTypes.map(({ value, label, icon: Icon, description }) => (
                                <label
                                    key={value}
                                            className={`relative flex flex-col items-center p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                                                formData.type === value
                                                    ? 'border-primary-500 bg-primary-50 shadow-lg scale-[1.02]'
                                                    : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50 hover:shadow-md'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name="type"
                                        value={value}
                                        checked={formData.type === value}
                                        onChange={handleInputChange}
                                        className="sr-only"
                                    />
                                            <Icon className={`w-12 h-12 mb-3 ${formData.type === value ? 'text-primary-500' : 'text-gray-400'}`} />
                                            <div className="font-semibold text-gray-900 mb-1">{label}</div>
                                            <div className="text-xs text-gray-500 text-center">{description}</div>
                                </label>
                            ))}
                        </div>
                    </div>
                        )}

                        {/* Step 2: Date & Location */}
                        {currentStep === 2 && (
                            <div className="space-y-8 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">When & Where</h3>
                                    <p className="text-gray-600">Select the date and location for this evidence</p>
                                </div>
                                
                                <div className="space-y-6">
                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-3">
                                            <Calendar className="w-5 h-5 inline mr-2 text-primary-500" />
                                            Date this evidence represents <span className="text-red-500">*</span>
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
                                            <MapPin className="w-5 h-5 inline mr-2 text-primary-500" />
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
                                            <button
                                                type="button"
                                                onClick={() => setIsLocationModalOpen(true)}
                                                className="px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2 transition-colors"
                                                title="Add new location"
                                            >
                                                <Plus className="w-5 h-5" />
                                                <span>New</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Metrics */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Link to Metrics</h3>
                                    <p className="text-gray-600">Select which metrics this evidence supports</p>
                                </div>
                                
                        {availableKPIs.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                        <p className="text-gray-500">No metrics available. Create metrics first.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-600">
                                                {formData.kpi_ids?.length || 0} of {availableKPIs.length} selected
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allKpiIds = availableKPIs.map(kpi => kpi.id!).filter(Boolean)
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        kpi_ids: allKpiIds
                                                    }))
                                                    if (editData) {
                                                        const sortedNew = [...allKpiIds].sort()
                                                        const sortedInitial = [...initialKpiIds].sort()
                                                        const hasChanged = JSON.stringify(sortedNew) !== JSON.stringify(sortedInitial)
                                                        setHasChangedKPIs(hasChanged)
                                                    }
                                                }}
                                                className="text-sm px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 font-medium transition-colors"
                                            >
                                                Select All
                                            </button>
                                        </div>
                                        <div className="space-y-2 max-h-96 overflow-y-auto border border-gray-200 rounded-xl p-4 bg-gray-50">
                                {[...availableKPIs].sort((a, b) => {
                                    const aIsPreSelected = preSelectedKPIId === a.id
                                    const bIsPreSelected = preSelectedKPIId === b.id
                                    if (aIsPreSelected && !bIsPreSelected) return -1
                                    if (!aIsPreSelected && bIsPreSelected) return 1
                                    return 0
                                }).map((kpi) => {
                                    const isPreSelected = preSelectedKPIId === kpi.id
                                    const isChecked = formData.kpi_ids?.includes(kpi.id!) || false
                                    const isDisabled = isPreSelected && availableKPIs.length === 1
                                    return (
                                    <label
                                        key={kpi.id}
                                                        className={`flex items-center p-4 rounded-lg border-2 transition-all ${
                                                            isDisabled 
                                                                ? 'cursor-not-allowed opacity-60 bg-white border-gray-200' 
                                                                : isChecked
                                                                ? 'bg-primary-50 border-primary-300 cursor-pointer hover:bg-primary-100'
                                                                : 'bg-white border-gray-200 hover:border-primary-300 cursor-pointer hover:bg-gray-50'
                                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                                checked={isChecked || isPreSelected}
                                                onChange={() => !isDisabled && handleKPISelection(kpi.id!)}
                                                disabled={isDisabled}
                                                            className="mr-4 w-5 h-5 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                                        />
                                        <div className="flex-1">
                                                            <div className="flex items-center space-x-3">
                                                                <div className="font-semibold text-gray-900">{kpi.title}</div>
                                                    {isPreSelected && (
                                                                    <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                                                            Pre-selected
                                                        </span>
                                                    )}
                                                {'total_updates' in kpi && kpi.total_updates > 0 && (
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 bg-primary-500 text-white text-xs font-bold rounded-full">
                                                        {kpi.total_updates > 99 ? '99+' : kpi.total_updates}
                                                    </span>
                                                )}
                                            </div>
                                                            {kpi.description && (
                                                                <div className="text-sm text-gray-600 mt-1">{kpi.description}</div>
                                                            )}
                                        </div>
                                    </label>
                                    )
                                })}
                                        </div>
                            </div>
                        )}
                    </div>
                        )}

                        {/* Step 4: Impact Claims */}
                        {currentStep === 4 && (
                            <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Impact Claims</h3>
                                    <p className="text-gray-600">
                                        Review and confirm the impact claims this evidence supports
                                        {selectedLocationId && ` at ${locations.find(loc => loc.id === selectedLocationId)?.name || 'selected location'}`}
                                    </p>
                    </div>

                                {kpiDataSummaries.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                        <p className="text-gray-500">
                                            {formData.kpi_ids && formData.kpi_ids.length > 0
                                                ? 'No matching impact claims found for the selected date and location.'
                                                : 'Select metrics in the previous step to see impact claims.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(() => {
                                            // Calculate average coverage percentage for selected claims
                                            const selectedClaims = kpiDataSummaries.flatMap((s: any) => 
                                                s.updates.filter((u: any) => selectedUpdateIds.includes(u.id))
                                            )
                                            let totalCoverage = 0
                                            let claimsWithCoverage = 0
                                            selectedClaims.forEach((claim: any) => {
                                                if (claim.date_range_start && claim.date_range_end) {
                                                    const claimStart = new Date(claim.date_range_start)
                                                    const claimEnd = new Date(claim.date_range_end)
                                                    const claimDays = Math.ceil((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                    
                                                    if (datePickerValue.startDate && datePickerValue.endDate) {
                                                        const evidenceStart = new Date(datePickerValue.startDate)
                                                        const evidenceEnd = new Date(datePickerValue.endDate)
                                                        const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
                                                        const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))
                                                        
                                                        if (overlapEnd >= overlapStart) {
                                                            const coveredDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                            totalCoverage += Math.round((coveredDays / claimDays) * 100)
                                                            claimsWithCoverage++
                                                        }
                                                    } else if (datePickerValue.singleDate) {
                                                        const evidenceDate = new Date(datePickerValue.singleDate)
                                                        if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                                                            totalCoverage += Math.round((1 / claimDays) * 100)
                                                            claimsWithCoverage++
                                                        }
                                                    }
                                                } else {
                                                    totalCoverage += 100
                                                    claimsWithCoverage++
                                                }
                                            })
                                            const avgCoverage = claimsWithCoverage > 0 ? Math.round(totalCoverage / claimsWithCoverage) : 0
                                            
                                            return (
                                                <div className="mb-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                                                    <p className="text-sm text-blue-800 mb-2">
                                                        Based on the dates provided, this evidence is going to cover {avgCoverage}% of the following impact claims
                                                    </p>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-medium text-blue-900">
                                                            Selected {selectedUpdateIds.length} impact claim{selectedUpdateIds.length !== 1 ? 's' : ''}
                                                        </span>
                                                        <div className="space-x-2">
                                                            <button
                                                                type="button"
                                                                className="text-sm px-4 py-2 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-blue-700 font-medium transition-colors"
                                                                onClick={() => {
                                                                    setSelectedUpdateIds(kpiDataSummaries.flatMap((s: any) => s.updates.map((u: any) => u.id)))
                                                                    if (editData) setHasChangedDataPoints(true)
                                                                }}
                                                            >
                                                                Select All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="text-sm px-4 py-2 bg-white hover:bg-blue-100 border border-blue-300 rounded-lg text-blue-700 font-medium transition-colors"
                                                                onClick={() => {
                                                                    setSelectedUpdateIds([])
                                                                    if (editData) setHasChangedDataPoints(true)
                                                                }}
                                                            >
                                                                Clear
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })()}
                                        {kpiDataSummaries.map((kpiSummary: any) => {
                                const updatesWithCoverage = kpiSummary.updates.map((dataPoint: any) => {
                                    let coveragePercentage = 100
                                    let coverageText = ''

                                    if (dataPoint.date_range_start && dataPoint.date_range_end) {
                                        const claimStart = new Date(dataPoint.date_range_start)
                                        const claimEnd = new Date(dataPoint.date_range_end)
                                        const claimDays = Math.ceil((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

                                        if (datePickerValue.startDate && datePickerValue.endDate) {
                                            const evidenceStart = new Date(datePickerValue.startDate)
                                            const evidenceEnd = new Date(datePickerValue.endDate)
                                            const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
                                            const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))
                                            
                                            if (overlapEnd >= overlapStart) {
                                                const coveredDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                coveragePercentage = Math.round((coveredDays / claimDays) * 100)
                                                coverageText = `${coveragePercentage}%`
                                            } else {
                                                coveragePercentage = 0
                                                coverageText = '0%'
                                            }
                                        } else if (datePickerValue.singleDate) {
                                            const evidenceDate = new Date(datePickerValue.singleDate)
                                            if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                                                coveragePercentage = Math.round((1 / claimDays) * 100)
                                                coverageText = `${coveragePercentage}%`
                                            } else {
                                                coveragePercentage = 0
                                                coverageText = '0%'
                                            }
                                        }
                                    }

                                    return {
                                        ...dataPoint,
                                        coveragePercentage,
                                                    coverageText
                                    }
                                })

                                return (
                                                <div key={kpiSummary.kpi.id} className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5">
                                                    <h5 className="text-lg font-semibold text-blue-900 mb-2">
                                        📈 {kpiSummary.kpi.title}
                                    </h5>
                                                    <p className="text-base font-semibold text-blue-800 mb-4">
                                        Total: {kpiSummary.total} {kpiSummary.kpi.unit_of_measurement}
                                    </p>
                                                    <div className="space-y-3 max-h-96 overflow-y-auto">
                                        {updatesWithCoverage.map((dataPoint: any, index: number) => {
                                            const checked = selectedUpdateIds.includes(dataPoint.id)
                                            const hasPartialCoverage = dataPoint.coveragePercentage > 0 && dataPoint.coveragePercentage < 100
                                            const hasNoCoverage = dataPoint.coveragePercentage === 0
                                            
                                            return (
                                                                <div key={`${dataPoint.id}-${index}`} className={`bg-white rounded-lg border-2 ${
                                                                    hasPartialCoverage ? 'border-blue-300' : 
                                                                    hasNoCoverage ? 'border-red-300' : 
                                                                    'border-gray-200'
                                                                }`}>
                                                                    <label className="flex items-start justify-between p-4 cursor-pointer hover:bg-gray-50 rounded-lg">
                                                                        <div className="flex items-start space-x-4 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setSelectedUpdateIds(prev => checked ? prev.filter(id => id !== dataPoint.id) : [...prev, dataPoint.id])
                                                                if (editData) setHasChangedDataPoints(true)
                                                            }}
                                                                                className="mt-1 w-5 h-5 text-primary-500 rounded border-gray-300 focus:ring-primary-500"
                                                        />
                                                            <div className="flex-1 min-w-0">
                                                                                <div className="flex items-center space-x-3 mb-2">
                                                                                    <span className="font-semibold text-gray-900 text-lg">
                                                            {dataPoint.value} {dataPoint.kpi_unit}
                                                        </span>
                                                                    {dataPoint.coverageText && (
                                                                                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                                                            dataPoint.coveragePercentage === 100 ? 'bg-primary-100 text-primary-700' :
                                                                                            dataPoint.coveragePercentage > 0 ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-red-100 text-red-700'
                                                                        }`}>
                                                                            {dataPoint.coverageText}
                                                                        </span>
                                                                    )}
                                                    </div>
                                                                                <div className="text-sm text-gray-600 mb-1">
                                                        {dataPoint.date_range_start && dataPoint.date_range_end ? (
                                                            <>Date Range: {formatDate(dataPoint.date_range_start)} - {formatDate(dataPoint.date_range_end)}</>
                                                        ) : (
                                                            <>Date: {formatDate(dataPoint.date_represented)}</>
                                                        )}
                                                                </div>
                                                                                {dataPoint.location_name && (
                                                                                    <div className="text-sm text-gray-600 flex items-center mt-1">
                                                                                        <MapPin className="w-4 h-4 mr-1 text-primary-500" />
                                                                                        {dataPoint.location_name}
                                                                                    </div>
                                                                                )}
                                                                {hasNoCoverage && (
                                                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                                                                        <p className="text-red-800 font-medium">
                                                                            This evidence date range doesn't overlap with this impact claim.
                                                                        </p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                </label>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                                )
                            })}
                                    </div>
                                )}
                        </div>
                    )}

                        {/* Step 5: Title, Description & Upload */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="text-center mb-6">
                                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">Details & Upload</h3>
                                    <p className="text-gray-600">Add title, description, and upload your file</p>
                    </div>

                                <div className="space-y-6">
                                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                                        <p className="text-xs text-blue-800 leading-relaxed mb-2">
                                            <strong>Evidence Type:</strong> {evidenceTypes.find(et => et.value === formData.type)?.label}
                                        </p>
                                        <p className="text-xs text-blue-800 leading-relaxed">
                                            <strong>Note:</strong> When creating AI reports, the AI will analyze these sections to generate comprehensive impact narratives.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            Evidence Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="title"
                                            value={formData.title}
                                            onChange={handleInputChange}
                                            className="input-field text-base py-3"
                                            placeholder="e.g., Training Session Photos, Completion Certificates"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">Description</label>
                                        <textarea
                                            name="description"
                                            value={formData.description}
                                            onChange={handleInputChange}
                                            className="input-field resize-none text-base py-3"
                                            rows={4}
                                            placeholder="Describe what this evidence shows and how it supports your impact claims..."
                                        />
                                    </div>

                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            <Upload className="w-5 h-5 inline mr-2 text-primary-500" />
                            File or Link
                        </label>

                        <div
                                            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                                                isDragOver
                                ? 'border-primary-500 bg-primary-50'
                                : selectedFiles.length > 0 || formData.file_url
                                                        ? 'border-primary-400 bg-primary-50'
                                                        : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={triggerFileSelect}
                        >
                            {selectedFiles.length > 0 ? (
                                                <div className="space-y-3">
                                                    <File className="w-12 h-12 text-primary-500 mx-auto" />
                                                    <p className="text-base font-semibold text-primary-800">
                                                        {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                                                    </p>
                                                    <div className="space-y-2 max-h-40 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                                                        {selectedFiles.map((file, index) => (
                                                            <div key={index} className="flex items-center justify-between bg-white rounded p-2 text-sm">
                                                                <span className="text-gray-700 truncate flex-1">{file.name}</span>
                                                                <span className="text-gray-500 ml-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        removeFile(index)
                                                                    }}
                                                                    className="ml-2 text-red-600 hover:text-red-800"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeFile()
                                        }}
                                                        className="text-sm text-red-600 hover:text-red-800 underline mt-2"
                                    >
                                        Remove all files
                                    </button>
                                </div>
                            ) : formData.file_url ? (
                                                <div className="space-y-3">
                                                    <File className="w-12 h-12 text-blue-600 mx-auto" />
                                                    <p className="text-base font-semibold text-blue-800">Current file attached</p>
                                                    <p className="text-sm text-blue-600">
                                        {formData.file_url.split('/').pop() || 'Existing file'}
                                    </p>
                                                    <p className="text-sm text-gray-500 mt-2">
                                        Click to replace with a new file
                                    </p>
                                </div>
                            ) : (
                                                <div className="space-y-3">
                                                    <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                                                    <p className="text-base text-gray-700">
                                                        <span className="font-semibold">Click to browse</span> or drag files here
                                                    </p>
                                                    <p className="text-sm text-gray-500">
                                        Images, PDFs, documents, videos (multiple files supported)
                                    </p>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileInputChange}
                            className="hidden"
                            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                            multiple
                        />

                                        <div className="mt-4">
                            <input
                                type="url"
                                name="file_url"
                                value={formData.file_url || ''}
                                onChange={handleInputChange}
                                                className="input-field text-base py-3"
                                placeholder="Or paste a link to online evidence (https://...)"
                            />
                        </div>
                    </div>
                    </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Navigation Footer */}
                <div className="border-t border-impact-100/40 p-6 bg-white/30 backdrop-blur-xl">
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

                        <div className="flex items-center space-x-3 relative z-10">
                        {uploadProgress && (
                                <div className="px-4 py-2 text-sm text-impact-700 bg-impact-50/80 backdrop-blur-sm rounded-xl border border-impact-200/60">
                                {uploadProgress}
                            </div>
                        )}
                            {currentStep < totalSteps ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={!canProceedToNextStep()}
                                    className="flex items-center space-x-2 px-6 py-3 bg-impact-500 text-white rounded-xl hover:bg-impact-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-impact-500/30 hover:shadow-xl hover:shadow-impact-500/40 relative z-10"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading || !formData.title}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleSubmit(e)
                                    }}
                                    className="flex items-center space-x-2 px-6 py-3 bg-impact-500 text-white rounded-xl hover:bg-impact-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-lg shadow-impact-500/30 hover:shadow-xl hover:shadow-impact-500/40 relative z-10"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{editData ? 'Update Evidence' : 'Add Evidence'}</span>
                                            <Check className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                        )}
                    </div>
                    </div>
                </div>

                {/* Location Creation Modal */}
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
            </div>
        </div>
    )
} 