import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, Calendar, Link as LinkIcon, FileText, Camera, DollarSign, MessageSquare, File, MapPin, Plus } from 'lucide-react'
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
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
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

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera, description: 'Photos, videos, screenshots' },
        { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare, description: 'Quotes, feedback, stories' },
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
    }, [datePickerValue, formData.kpi_ids])

    const fetchMatchingImpactClaims = async () => {
        if (isFetchingMatches) return // Prevent concurrent calls

        try {
            setIsFetchingMatches(true)

            // For each selected KPI, get their updates and filter by date overlap
            const kpiSummaries = []
            for (const kpiId of formData.kpi_ids || []) {
                const updates = await apiService.getKPIUpdates(kpiId)
                const matchingUpdates = updates.filter(update => {
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

                        // Add KPI info to each update
                        const updatesWithKPI = matchingUpdates.map(update => ({
                            ...update,
                            kpi_title: kpi.title,
                            kpi_unit: kpi.unit_of_measurement
                        }))

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
            // Auto-select all shown impact claims only on initial fetch (not when date range changes)
            if (!editData && isInitialFetch) {
                setSelectedUpdateIds(allDataPoints.map((dp: any) => dp.id))
                setIsInitialFetch(false)
            } else {
                // When date range changes, preserve existing selections and filter out claims that no longer match
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

            // If user selected a file, upload it first
            if (selectedFile) {
                setUploadProgress('Uploading file...')
                const uploadResult = await apiService.uploadFile(selectedFile)
                finalFileUrl = uploadResult.file_url
                setUploadProgress('File uploaded successfully!')
            }

            // Create evidence record with the real file URL
            let submitData: any = {
                ...formData,
                file_url: finalFileUrl
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
                setSelectedFile(null)
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

    const handleFileSelect = (file: File) => {
        setSelectedFile(file)
        // Auto-populate title if empty
        if (!formData.title) {
            setFormData(prev => ({
                ...prev,
                title: file.name.replace(/\.[^/.]+$/, "") // Remove file extension
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

        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            handleFileSelect(files[0])
        }
    }

    const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (files && files.length > 0) {
            handleFileSelect(files[0])
        }
    }

    const triggerFileSelect = () => {
        fileInputRef.current?.click()
    }

    const removeFile = () => {
        setSelectedFile(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl transform transition-all duration-200 ease-out animate-slide-up-fast">
                <div className="overflow-y-auto max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editData ? 'Edit Evidence' : 'Upload Evidence'}
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {editData ? 'Update your evidence information' : 'Add supporting evidence for your impact claims'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Evidence Type Selection */}
                    <div>
                        <label className="label mb-3">
                            Evidence Type <span className="text-red-500">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {evidenceTypes.map(({ value, label, icon: Icon, description }) => (
                                <label
                                    key={value}
                                    className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-all duration-200 ${formData.type === value
                                        ? 'border-primary-500 bg-primary-50 shadow-md scale-[1.02]'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm'
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
                                    <Icon className={`w-5 h-5 mr-3 ${formData.type === value ? 'text-primary-600' : 'text-gray-400'
                                        }`} />
                                    <div>
                                        <div className="font-medium text-gray-900">{label}</div>
                                        <div className="text-xs text-gray-500">{description}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* KPI Selection */}
                    <div>
                        <label className="label mb-3">
                            Link to Metrics <span className="text-red-500">*</span>
                        </label>
                        <p className="text-sm text-gray-600 mb-3">
                            Select which metrics this evidence supports
                        </p>
                        {availableKPIs.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No metrics available. Create metrics first.</p>
                        ) : (
                            <div className={`space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 ${preSelectedKPIId && availableKPIs.length === 1 ? 'bg-gray-50' : ''}`}>
                                {/* Sort metrics: pre-selected first, then others */}
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
                                            className={`flex items-center p-2 rounded ${isDisabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-gray-50 cursor-pointer'}`}
                                    >
                                        <input
                                            type="checkbox"
                                                checked={isChecked || isPreSelected}
                                                onChange={() => !isDisabled && handleKPISelection(kpi.id!)}
                                                disabled={isDisabled}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-2">
                                                <div className="font-medium text-gray-900">{kpi.title}</div>
                                                    {isPreSelected && (
                                                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                                                            Pre-selected
                                                        </span>
                                                    )}
                                                {'total_updates' in kpi && kpi.total_updates > 0 && (
                                                    <span className="inline-flex items-center justify-center w-4 h-4 bg-blue-500 text-white text-xs font-bold rounded-full flex-shrink-0">
                                                        {kpi.total_updates > 99 ? '99+' : kpi.total_updates}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-500">{kpi.description}</div>
                                        </div>
                                    </label>
                                    )
                                })}
                            </div>
                        )}
                    </div>

                    {/* Date Selection */}
                    <div>
                        <label className="label mb-2">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Date this evidence represents <span className="text-red-500">*</span>
                        </label>
                        <DateRangePicker
                            value={datePickerValue}
                            onChange={(value) => {
                                setDatePickerValue(value)
                                // Update formData for compatibility
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

                    {/* Matching Data Points (shown right after date selection) */}
                    {kpiDataSummaries.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-medium text-blue-900">
                                📊 Impact Claims {datePickerValue.startDate && datePickerValue.endDate ? 'in Selected Date Range' : 'on Selected Date'}
                            </h4>
                            <p className="text-xs text-blue-700 mb-3">
                                Your evidence will help prove these impact claims:
                            </p>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-gray-600">Selected {selectedUpdateIds.length} impact claim(s)</span>
                                <div className="space-x-2">
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                                        onClick={() => {
                                            setSelectedUpdateIds(kpiDataSummaries.flatMap((s: any) => s.updates.map((u: any) => u.id)))
                                            if (editData) setHasChangedDataPoints(true)
                                        }}
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
                                        onClick={() => {
                                            setSelectedUpdateIds([])
                                            if (editData) setHasChangedDataPoints(true)
                                        }}
                                    >
                                        Clear
                                    </button>
                                </div>
                            </div>
                            {kpiDataSummaries.map((kpiSummary: any) => {
                                // Calculate coverage for each impact claim
                                const updatesWithCoverage = kpiSummary.updates.map((dataPoint: any) => {
                                    let coveragePercentage = 100
                                    let coverageText = ''
                                    let canAutoAdjust = false
                                    let autoAdjustDates = null

                                    if (dataPoint.date_range_start && dataPoint.date_range_end) {
                                        // Impact claim has a date range
                                        const claimStart = new Date(dataPoint.date_range_start)
                                        const claimEnd = new Date(dataPoint.date_range_end)
                                        const claimDays = Math.ceil((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

                                        if (datePickerValue.startDate && datePickerValue.endDate) {
                                            // Evidence has a date range
                                            const evidenceStart = new Date(datePickerValue.startDate)
                                            const evidenceEnd = new Date(datePickerValue.endDate)
                                            const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
                                            const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))
                                            
                                            if (overlapEnd >= overlapStart) {
                                                const coveredDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                coveragePercentage = Math.round((coveredDays / claimDays) * 100)
                                                coverageText = `${coveragePercentage}%`
                                                
                                                // Can auto-adjust if coverage is less than 100%
                                                if (coveragePercentage < 100) {
                                                    canAutoAdjust = true
                                                    autoAdjustDates = {
                                                        startDate: dataPoint.date_range_start,
                                                        endDate: dataPoint.date_range_end
                                                    }
                                                }
                                            } else {
                                                coveragePercentage = 0
                                                coverageText = '0%'
                                                canAutoAdjust = true
                                                autoAdjustDates = {
                                                    startDate: dataPoint.date_range_start,
                                                    endDate: dataPoint.date_range_end
                                                }
                                            }
                                        } else if (datePickerValue.singleDate) {
                                            // Evidence is a single date
                                            const evidenceDate = new Date(datePickerValue.singleDate)
                                            if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                                                coveragePercentage = Math.round((1 / claimDays) * 100)
                                                coverageText = `${coveragePercentage}%`
                                                canAutoAdjust = true
                                                autoAdjustDates = {
                                                    startDate: dataPoint.date_range_start,
                                                    endDate: dataPoint.date_range_end
                                                }
                                            } else {
                                                coveragePercentage = 0
                                                coverageText = '0%'
                                                canAutoAdjust = true
                                                autoAdjustDates = {
                                                    startDate: dataPoint.date_range_start,
                                                    endDate: dataPoint.date_range_end
                                                }
                                            }
                                        }
                                    }

                                    return {
                                        ...dataPoint,
                                        coveragePercentage,
                                        coverageText,
                                        canAutoAdjust,
                                        autoAdjustDates
                                    }
                                })

                                return (
                                <div key={kpiSummary.kpi.id} className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-blue-900 mb-2">
                                        📈 {kpiSummary.kpi.title}
                                    </h5>
                                    <p className="text-sm font-semibold text-blue-800 mb-3">
                                        Total: {kpiSummary.total} {kpiSummary.kpi.unit_of_measurement}
                                    </p>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {updatesWithCoverage.map((dataPoint: any, index: number) => {
                                            const checked = selectedUpdateIds.includes(dataPoint.id)
                                            const hasPartialCoverage = dataPoint.coveragePercentage > 0 && dataPoint.coveragePercentage < 100
                                            const hasNoCoverage = dataPoint.coveragePercentage === 0
                                            
                                            return (
                                                <div key={`${dataPoint.id}-${index}`} className={`bg-white rounded-lg border ${hasPartialCoverage ? 'border-blue-200' : hasNoCoverage ? 'border-red-300 border-2' : 'border-gray-200'}`}>
                                                    <label className="flex items-start justify-between px-3 py-2 cursor-pointer hover:bg-gray-50">
                                                        <div className="flex items-start space-x-3 flex-1">
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setSelectedUpdateIds(prev => checked ? prev.filter(id => id !== dataPoint.id) : [...prev, dataPoint.id])
                                                                if (editData) setHasChangedDataPoints(true)
                                                            }}
                                                                className="h-4 w-4 mt-0.5"
                                                        />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center space-x-2 mb-1">
                                                        <span className="font-medium text-gray-900">
                                                            {dataPoint.value} {dataPoint.kpi_unit}
                                                        </span>
                                                                    {dataPoint.coverageText && (
                                                                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                                                                            dataPoint.coveragePercentage === 100 ? 'bg-green-100 text-green-700' :
                                                                            dataPoint.coveragePercentage > 0 ? 'bg-blue-100 text-blue-600' :
                                                                            'bg-red-100 text-red-700'
                                                                        }`}>
                                                                            {dataPoint.coverageText}
                                                                        </span>
                                                                    )}
                                                    </div>
                                                                <div className="text-xs text-gray-500">
                                                        {dataPoint.date_range_start && dataPoint.date_range_end ? (
                                                            <>Range: {formatDate(dataPoint.date_range_start)} - {formatDate(dataPoint.date_range_end)}</>
                                                        ) : (
                                                            <>{formatDate(dataPoint.date_represented)}</>
                                                        )}
                                                                </div>
                                                                {hasPartialCoverage && (
                                                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                                                        <p className="text-xs text-blue-700 flex-1">
                                                                            Only {dataPoint.coveragePercentage}% coverage
                                                                        </p>
                                                                        {dataPoint.canAutoAdjust && dataPoint.autoAdjustDates && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    // Preserve current selection before changing date range
                                                                                    const currentSelection = [...selectedUpdateIds]
                                                                                    
                                                                                    setDatePickerValue({
                                                                                        startDate: dataPoint.autoAdjustDates.startDate,
                                                                                        endDate: dataPoint.autoAdjustDates.endDate
                                                                                    })
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        date_range_start: dataPoint.autoAdjustDates.startDate,
                                                                                        date_range_end: dataPoint.autoAdjustDates.endDate,
                                                                                        date_represented: dataPoint.autoAdjustDates.startDate
                                                                                    }))
                                                                                    
                                                                                    // Mark that we're not on initial fetch anymore
                                                                                    setIsInitialFetch(false)
                                                                                    
                                                                                    // The useEffect will handle fetching new matches and preserving selection
                                                                                }}
                                                                                className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium transition-colors whitespace-nowrap"
                                                                            >
                                                                                Match 100%
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                {hasNoCoverage && (
                                                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                                                        <p className="text-red-800 font-medium mb-2">
                                                                            This evidence date range doesn't overlap with this impact claim.
                                                                        </p>
                                                                        {dataPoint.canAutoAdjust && dataPoint.autoAdjustDates && (
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation()
                                                                                    // Preserve current selection before changing date range
                                                                                    const currentSelection = [...selectedUpdateIds]
                                                                                    
                                                                                    setDatePickerValue({
                                                                                        startDate: dataPoint.autoAdjustDates.startDate,
                                                                                        endDate: dataPoint.autoAdjustDates.endDate
                                                                                    })
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        date_range_start: dataPoint.autoAdjustDates.startDate,
                                                                                        date_range_end: dataPoint.autoAdjustDates.endDate,
                                                                                        date_represented: dataPoint.autoAdjustDates.startDate
                                                                                    }))
                                                                                    
                                                                                    // Mark that we're not on initial fetch anymore
                                                                                    setIsInitialFetch(false)
                                                                                    
                                                                                    // The useEffect will handle fetching new matches and preserving selection
                                                                                }}
                                                                                className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium transition-colors"
                                                                            >
                                                                                Auto-adjust date range to match claim
                                                                            </button>
                                                                        )}
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
                            <button
                                type="button"
                                onClick={() => setIsLocationModalOpen(true)}
                                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-1"
                                title="Add new location"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Title and Description */}
                    <div className="grid grid-cols-1 gap-4">
                        <div>
                            <label className="label">
                                Evidence Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="e.g., Training Session Photos, Completion Certificates"
                                required
                            />
                        </div>

                        <div>
                            <label className="label">Description</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="input-field resize-none"
                                rows={3}
                                placeholder="Describe what this evidence shows and how it supports your impact claims..."
                            />
                        </div>
                    </div>

                    {/* File Upload */}
                    <div>
                        <label className="label">
                            <Upload className="w-4 h-4 inline mr-2" />
                            File or Link
                        </label>

                        {/* File Drop Zone */}
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${isDragOver
                                ? 'border-primary-500 bg-primary-50'
                                : selectedFile || formData.file_url
                                    ? 'border-green-300 bg-green-50'
                                    : 'border-gray-300 hover:border-gray-400'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={triggerFileSelect}
                        >
                            {selectedFile ? (
                                <div className="space-y-2">
                                    <File className="w-8 h-8 text-green-600 mx-auto" />
                                    <p className="text-sm font-medium text-green-800">{selectedFile.name}</p>
                                    <p className="text-xs text-green-600">
                                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            removeFile()
                                        }}
                                        className="text-xs text-red-600 hover:text-red-800 underline"
                                    >
                                        Remove file
                                    </button>
                                </div>
                            ) : formData.file_url ? (
                                <div className="space-y-2">
                                    <File className="w-8 h-8 text-blue-600 mx-auto" />
                                    <p className="text-sm font-medium text-blue-800">Current file attached</p>
                                    <p className="text-xs text-blue-600">
                                        {formData.file_url.split('/').pop() || 'Existing file'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Click to replace with a new file
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                                    <p className="text-sm text-gray-600">
                                        <span className="font-medium">Click to browse</span> or drag files here
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Images, PDFs, documents, videos
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Hidden File Input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileInputChange}
                            className="hidden"
                            accept="image/*,video/*,.pdf,.doc,.docx,.txt,.csv,.xlsx"
                        />

                        {/* URL Input */}
                        <div className="mt-3">
                            <input
                                type="url"
                                name="file_url"
                                value={formData.file_url || ''}
                                onChange={handleInputChange}
                                className="input-field"
                                placeholder="Or paste a link to online evidence (https://...)"
                            />
                        </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 About Evidence</h4>
                        <p className="text-xs text-blue-800 leading-relaxed">
                            Evidence validates your impact claims. If your evidence covers only part of an impact claim's date range, 
                            the system will show partial coverage (e.g., "Evidence covers 2 of 5 days"). This helps track how well 
                            your evidence supports each claim.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        {uploadProgress && (
                            <div className="flex-1 flex items-center justify-center px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded-lg">
                                {uploadProgress}
                            </div>
                        )}
                        {!uploadProgress && (
                            <>
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
                                    disabled={loading || !formData.title || (!selectedFile && !formData.file_url)}
                                >
                                    {loading ? 'Processing...' : (editData ? 'Update Evidence' : 'Add Evidence')}
                                </button>
                            </>
                        )}
                    </div>
                </form>
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