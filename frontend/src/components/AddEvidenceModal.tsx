import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, Calendar, Link as LinkIcon, FileText, Camera, DollarSign, MessageSquare, File, MapPin, Plus, ChevronLeft, ChevronRight, Check, Loader2, Users } from 'lucide-react'
import { CreateEvidenceForm, KPI, KPIWithEvidence, Location, BeneficiaryGroup } from '../types'
import { apiService } from '../services/api'
import { formatDate, getLocalDateString } from '../utils'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import { useUploadManager } from '../context/UploadContext'
import LocationModal from './LocationModal'
import DateRangePicker from './DateRangePicker'
import TagPicker from './MetricTags/TagPicker'
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
    }>({ singleDate: editData ? undefined : getLocalDateString(new Date()) })
    const [loading, setLoading] = useState(false)
    const [selectedFiles, setSelectedFiles] = useState<File[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { queueUpload } = useUploadManager()

    // State for showing matching impact claims
    const [matchingDataPoints, setMatchingDataPoints] = useState<any[]>([])
    const [isFetchingMatches, setIsFetchingMatches] = useState(false)
    const [kpiDataSummaries, setKpiDataSummaries] = useState<any[]>([])
    const [selectedUpdateIds, setSelectedUpdateIds] = useState<string[]>([])
    const [locations, setLocations] = useState<Location[]>([])
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([])
    const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)
    const [hasChangedDataPoints, setHasChangedDataPoints] = useState(false)
    const [hasChangedKPIs, setHasChangedKPIs] = useState(false)
    const [initialKpiIds, setInitialKpiIds] = useState<string[]>([])
    const [isInitialFetch, setIsInitialFetch] = useState(true)
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [selectedBeneficiaryGroupIds, setSelectedBeneficiaryGroupIds] = useState<string[]>([])
    const [hasChangedBeneficiaryGroups, setHasChangedBeneficiaryGroups] = useState(false)
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
    const [hasChangedTags, setHasChangedTags] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const totalSteps = 5

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera, description: 'Photos, videos, screenshots' },
        { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
        { value: 'testimony', label: 'Testimonies', icon: MessageSquare, description: 'Quotes, feedback, stories' },
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
                    // Support both new location_ids array and legacy location_id
                    const locationIds = fullEvidence.location_ids || 
                        (fullEvidence.location_id ? [fullEvidence.location_id] : []) ||
                        editData.location_ids ||
                        (editData.location_id ? [editData.location_id] : [])
                    setSelectedLocationIds(locationIds)

                    // Load beneficiary group links
                    setSelectedBeneficiaryGroupIds(fullEvidence.beneficiary_group_ids || [])
                    setHasChangedBeneficiaryGroups(false)

                    setSelectedTagIds(fullEvidence.tag_ids || [])
                    setHasChangedTags(false)

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
                    setSelectedLocationIds(editData.location_ids || (editData.location_id ? [editData.location_id] : []))
                    setSelectedBeneficiaryGroupIds(editData.beneficiary_group_ids || [])
                    setHasChangedBeneficiaryGroups(false)
                    setSelectedTagIds(editData.tag_ids || [])
                    setHasChangedTags(false)
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
            setDatePickerValue({ singleDate: getLocalDateString(new Date()) })
            setIsInitialFetch(true)
            setSelectedBeneficiaryGroupIds([])
            setHasChangedBeneficiaryGroups(false)
            setSelectedTagIds([])
            setHasChangedTags(false)
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

    // Load beneficiary groups when modal opens
    useEffect(() => {
        if (isOpen && initiativeId) {
            apiService
                .getBeneficiaryGroups(initiativeId)
                .then((groups) => setBeneficiaryGroups(groups || []))
                .catch(() => setBeneficiaryGroups([]))
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
    }, [datePickerValue, formData.kpi_ids, selectedLocationIds, selectedBeneficiaryGroupIds])

    const fetchMatchingImpactClaims = async () => {
        if (isFetchingMatches) return // Prevent concurrent calls

        try {
            setIsFetchingMatches(true)

            // For each selected KPI, get their updates and filter by date overlap and location
            const kpiSummaries = []
            for (const kpiId of formData.kpi_ids || []) {
                const updates = await apiService.getKPIUpdates(kpiId)
                const matchingUpdates = updates.filter(update => {
                    // Filter by location if any are selected - show if claim matches ANY selected location
                    if (selectedLocationIds.length > 0 && !selectedLocationIds.includes(update.location_id || '')) {
                        return false
                    }

                    // Ben group scoping: both unscoped = match, both scoped with overlap = match, else no match
                    const claimGroupIds: string[] = (update as any).beneficiary_group_ids || []
                    const evGroupIds = selectedBeneficiaryGroupIds
                    const claimScoped = claimGroupIds.length > 0
                    const evScoped = evGroupIds.length > 0
                    if (claimScoped || evScoped) {
                        if (claimScoped !== evScoped) return false
                        if (!claimGroupIds.some(id => evGroupIds.includes(id))) return false
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
                        const total = aggregateKpiUpdates(matchingUpdates as any, kpi.metric_type)

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
            // Validate that a file is uploaded or URL is provided
            if (selectedFiles.length === 0 && !formData.file_url && (!editData || !editData.file_url)) {
                throw new Error('Please upload a file or provide a file URL')
            }

            // Build submit data (shared between immediate and background paths)
            let submitData: any = { ...formData }

            // Handle date range logic
            if (datePickerValue.singleDate) {
                submitData.date_represented = datePickerValue.singleDate
                submitData.date_range_start = undefined
                submitData.date_range_end = undefined
            } else if (datePickerValue.startDate && datePickerValue.endDate) {
                submitData.date_range_start = datePickerValue.startDate
                submitData.date_range_end = datePickerValue.endDate
                submitData.date_represented = datePickerValue.startDate
            } else {
                throw new Error('Please select a date')
            }

            if (selectedLocationIds.length === 0) {
                throw new Error('Please select at least one location')
            }

            if (!editData || hasChangedDataPoints) {
                submitData.kpi_update_ids = selectedUpdateIds
            }
            if (!editData || hasChangedKPIs) {
                submitData.kpi_ids = formData.kpi_ids
            }
            submitData.location_ids = selectedLocationIds
            if (!editData || hasChangedBeneficiaryGroups) {
                submitData.beneficiary_group_ids = selectedBeneficiaryGroupIds
            }
            if (!editData || hasChangedTags) {
                submitData.tag_ids = selectedTagIds
            }

            // If there are files to upload, queue them in background and close modal immediately
            if (selectedFiles.length > 0) {
                const filesToUpload = [...selectedFiles]
                const capturedSubmitData = { ...submitData }
                const capturedOnSubmit = onSubmit

                // Close modal immediately
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
                    setDatePickerValue({ singleDate: getLocalDateString(new Date()) })
                    setSelectedBeneficiaryGroupIds([])
                }
                setUploadProgress('')
                setLoading(false)
                onClose()

                // Track completed uploads; create evidence record once all are done
                const fileUrls: string[] = []
                const fileSizes: number[] = []
                let completedCount = 0

                filesToUpload.forEach((file, i) => {
                    queueUpload({
                        file,
                        onComplete: (result) => {
                            fileUrls[i] = result.file_url
                            fileSizes[i] = result.size
                            completedCount++

                            if (completedCount === filesToUpload.length) {
                                const finalData = {
                                    ...capturedSubmitData,
                                    file_url: fileUrls[0],
                                    file_urls: fileUrls,
                                    file_sizes: fileSizes
                                }
                                capturedOnSubmit(finalData).then(() => {
                                    toast.success('Evidence created successfully!')
                                }).catch(err => {
                                    toast.error(`Failed to create evidence: ${err instanceof Error ? err.message : 'Unknown error'}`)
                                })
                            }
                        },
                        onError: (error) => {
                            if (error.message !== 'Upload cancelled') {
                                toast.error(`Upload failed for ${file.name}`)
                            }
                        }
                    })
                })

                return
            }

            // No files to upload — just submit directly (URL-only or edit mode)
            submitData.file_url = formData.file_url
            setUploadProgress(editData ? 'Updating evidence record...' : 'Creating evidence record...')
            await onSubmit(submitData)

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
                setDatePickerValue({ singleDate: getLocalDateString(new Date()) })
                setSelectedBeneficiaryGroupIds([])
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
                return !!formData.type && !!(datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate)) && selectedLocationIds.length > 0
            case 2:
                return !!(formData.kpi_ids && formData.kpi_ids.length > 0)
            case 3:
                return true // Tags step is optional (can skip with no tags)
            case 4:
                return true // Beneficiaries optional
            case 5:
                return !!formData.title && (selectedFiles.length > 0 || !!formData.file_url || (editData && editData.file_url))
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
        { number: 1, title: 'Type & When' },
        { number: 2, title: 'Metrics' },
        { number: 3, title: 'Tags' },
        { number: 4, title: 'Beneficiaries' },
        { number: 5, title: 'Details & Upload' }
    ]

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-md flex items-center justify-center p-0 md:p-3 z-[60] animate-fade-in">
            <div className="bg-white md:bg-white/70 md:backdrop-blur-2xl md:rounded-2xl w-full h-full md:w-[70vw] md:max-w-[1200px] md:max-h-[97vh] md:h-[97vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] md:border md:border-white/60 transform transition-all duration-200 ease-out animate-slide-up-fast flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 md:px-6 py-2.5 md:py-3 border-b border-evidence-200/40 bg-gradient-to-r from-evidence-100/50 to-evidence-50/30 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-evidence-500/15 backdrop-blur-sm flex items-center justify-center border border-evidence-300/30 flex-shrink-0">
                            <FileText className="w-4 h-4 text-evidence-500" />
                        </div>
                        <h2 className="text-sm md:text-base font-semibold text-gray-800 truncate">
                            {editData ? 'Edit Evidence' : 'Upload Evidence'}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-white/60 transition-all duration-200 ml-2 md:ml-4 flex-shrink-0"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Progress Steps Indicator - Simplified on mobile */}
                <div className="px-4 md:px-6 py-2 md:py-3.5 border-b border-evidence-100/40 bg-white/30 backdrop-blur-xl flex-shrink-0">
                    {/* Mobile: Simple progress bar */}
                    <div className="md:hidden">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Step {currentStep} of {totalSteps}</span>
                            <span className="text-xs font-medium text-evidence-600">{steps[currentStep - 1]?.title}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                                className="bg-evidence-500 h-2 rounded-full transition-all duration-300" 
                                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                            />
                        </div>
                    </div>
                    {/* Desktop: Full step indicator */}
                    <div className="hidden md:flex items-center justify-center gap-1">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`flex items-center justify-center w-9 h-9 rounded-xl border-2 transition-all duration-200 ${
                                        currentStep > step.number
                                            ? 'bg-evidence-500 border-evidence-500 text-white shadow-md shadow-evidence-500/25'
                                            : currentStep === step.number
                                            ? 'bg-evidence-500 border-evidence-500 text-white ring-4 ring-evidence-200/50 shadow-md shadow-evidence-500/25'
                                            : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-400'
                                    }`}>
                                        {currentStep > step.number ? (
                                            <Check className="w-4.5 h-4.5" />
                                        ) : (
                                            <span className="text-sm font-semibold">{step.number}</span>
                                        )}
                                    </div>
                                    <div className={`text-sm font-medium whitespace-nowrap ${
                                        currentStep >= step.number ? 'text-gray-700' : 'text-gray-400'
                                    }`}>
                                        {step.title}
                                    </div>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`h-0.5 w-10 lg:w-16 mx-3 rounded-full transition-all duration-200 ${
                                        currentStep > step.number ? 'bg-evidence-500' : 'bg-gray-200/60'
                                    }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={(e) => { e.preventDefault(); if (currentStep === totalSteps) handleSubmit(e); }} className="flex-1 overflow-y-auto min-h-0">
                    <div className="px-4 md:px-6 py-4 md:py-5">
                        {/* Step 1: Type, Date & Location */}
                        {currentStep === 1 && (
                            <div className="space-y-4 animate-fade-in max-w-4xl mx-auto">
                                <div className="text-center mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Type, When & Where</h3>
                                    <p className="text-gray-500 text-xs">Pick the type, date, and location for this evidence</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-900 mb-2">
                                        <FileText className="w-4 h-4 inline mr-1.5 text-primary-500" />
                                        Evidence type <span className="text-red-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {evidenceTypes.map(({ value, label, icon: Icon, description }) => (
                                            <label
                                                key={value}
                                                className={`relative flex items-center gap-2 p-2.5 border-2 rounded-lg cursor-pointer transition-all duration-150 ${
                                                    formData.type === value
                                                        ? 'border-primary-500 bg-primary-50 shadow-sm'
                                                        : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
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
                                                <Icon className={`w-5 h-5 flex-shrink-0 ${formData.type === value ? 'text-primary-500' : 'text-gray-400'}`} />
                                                <div className="min-w-0">
                                                    <div className="text-xs font-semibold text-gray-900 truncate">{label}</div>
                                                    <div className="text-[10px] text-gray-500 truncate">{description}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                    <div>
                                        <label className="block text-sm font-semibold text-gray-900 mb-2">
                                            <Calendar className="w-4 h-4 inline mr-1.5 text-primary-500" />
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
                                        <label className="flex items-center justify-between text-sm font-semibold text-gray-900 mb-2">
                                            <span>
                                                <MapPin className="w-4 h-4 inline mr-1.5 text-primary-500" />
                                                Locations <span className="text-red-500">*</span>
                                                <span className="ml-2 text-xs font-normal text-gray-500">
                                                    ({selectedLocationIds.length})
                                                </span>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setIsLocationModalOpen(true)}
                                                className="px-2 py-1 border border-gray-300 rounded-md hover:bg-gray-50 text-[11px] font-medium text-gray-700 flex items-center gap-1 transition-colors"
                                                title="Add new location"
                                            >
                                                <Plus className="w-3 h-3" />
                                                <span>New</span>
                                            </button>
                                        </label>
                                        <div className="space-y-2">
                                            {locations.length === 0 ? (
                                                <div className="text-center py-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                                    <p className="text-gray-500 text-sm">No locations available.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsLocationModalOpen(true)}
                                                        className="mt-2 text-sm text-primary-500 hover:text-primary-600 font-medium"
                                                    >
                                                        Create your first location
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto p-1">
                                                    {locations.map((location) => {
                                                        const isChecked = selectedLocationIds.includes(location.id!)
                                                        return (
                                                            <label
                                                                key={location.id}
                                                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer ${
                                                                    isChecked
                                                                        ? 'bg-primary-50 border-primary-300'
                                                                        : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        setSelectedLocationIds(prev =>
                                                                            isChecked
                                                                                ? prev.filter(id => id !== location.id)
                                                                                : [...prev, location.id!]
                                                                        )
                                                                    }}
                                                                    className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500 flex-shrink-0"
                                                                />
                                                                <span className="text-base font-medium text-gray-800 truncate">{location.name}</span>
                                                            </label>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Metrics */}
                        {currentStep === 2 && (
                            <div className="space-y-3 animate-fade-in max-w-4xl mx-auto">
                                <div className="text-center mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Link to Metrics</h3>
                                    <p className="text-gray-500 text-xs">Select which metrics this evidence supports</p>
                                </div>
                                
                        {availableKPIs.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                        <p className="text-gray-500">No metrics available. Create metrics first.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">
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
                                                className="text-[11px] px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 font-medium transition-colors"
                                            >
                                                Select All
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto p-1">
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
                                                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-colors ${
                                                            isDisabled 
                                                                ? 'cursor-not-allowed opacity-60 bg-white border-gray-200' 
                                                                : isChecked
                                                                ? 'bg-primary-50 border-primary-300 cursor-pointer'
                                                                : 'bg-white border-gray-200 hover:border-primary-300 cursor-pointer hover:bg-gray-50'
                                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                                checked={isChecked || isPreSelected}
                                                onChange={() => !isDisabled && handleKPISelection(kpi.id!)}
                                                disabled={isDisabled}
                                                            className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500 flex-shrink-0"
                                        />
                                        <div className="flex-1 min-w-0 flex items-center gap-2">
                                            <span className="text-base font-medium text-gray-800 truncate">{kpi.title}</span>
                                                    {isPreSelected && (
                                                                    <span className="inline-flex items-center px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full flex-shrink-0">
                                                            Pre-selected
                                                        </span>
                                                    )}
                                                {'total_updates' in kpi && kpi.total_updates > 0 && (
                                                                    <span className="inline-flex items-center justify-center w-4 h-4 bg-primary-500 text-white text-[10px] font-bold rounded-full flex-shrink-0">
                                                        {kpi.total_updates > 99 ? '99+' : kpi.total_updates}
                                                    </span>
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

                        {/* Step 3: Tags (optional) */}
                        {currentStep === 3 && (
                            <div className="space-y-3 animate-fade-in max-w-3xl mx-auto">
                                <div className="text-center mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Tags</h3>
                                    <p className="text-gray-500 text-xs">Pick any tags to associate with this evidence. Optional.</p>
                                </div>

                                <TagPicker
                                    mode="multi-grouped"
                                    selectedIds={selectedTagIds}
                                    onChange={(ids) => {
                                        setSelectedTagIds(ids)
                                        if (editData) setHasChangedTags(true)
                                    }}
                                    groups={(() => {
                                        const selectedKpis = availableKPIs.filter(k => (formData.kpi_ids || []).includes(k.id!))
                                        return selectedKpis.map(k => ({
                                            metricId: k.id!,
                                            metricTitle: k.title,
                                            tagIds: ((k as any).tag_ids || []) as string[],
                                        }))
                                    })()}
                                    canCreate={false}
                                    helperText="Tags shown are pulled from the metrics you selected. You can skip this step."
                                />

                                {selectedTagIds.length > 0 && (() => {
                                    const groupedIds = new Set<string>()
                                    for (const k of availableKPIs) {
                                        if (!(formData.kpi_ids || []).includes(k.id!)) continue
                                        for (const tid of (((k as any).tag_ids || []) as string[])) groupedIds.add(tid)
                                    }
                                    const orphanIds = selectedTagIds.filter(id => !groupedIds.has(id))
                                    if (orphanIds.length === 0) return null
                                    return (
                                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                                            <p className="text-xs font-medium text-amber-800 mb-2">
                                                Other tags currently on this evidence (not on any selected metric):
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {orphanIds.map(tid => (
                                                    <button
                                                        key={tid}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedTagIds(prev => prev.filter(x => x !== tid))
                                                            if (editData) setHasChangedTags(true)
                                                        }}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-full border border-amber-300"
                                                        title="Click to remove"
                                                    >
                                                        Remove
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })()}
                            </div>
                        )}

                        {/* Step 4: Beneficiaries (optional) */}
                        {currentStep === 4 && (
                            <div className="space-y-3 animate-fade-in max-w-4xl mx-auto">
                                <div className="text-center mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Beneficiaries</h3>
                                    <p className="text-gray-500 text-xs">Optionally link this evidence to beneficiary groups</p>
                                </div>

                                {beneficiaryGroups.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                                        <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                        <p className="text-gray-500">No beneficiary groups found for this initiative.</p>
                                        <p className="text-sm text-gray-400 mt-1">You can add beneficiary groups from the Beneficiaries tab.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">
                                                {selectedBeneficiaryGroupIds.length} of {beneficiaryGroups.length} selected
                                            </span>
                                            <div className="flex gap-1.5">
                                                <button
                                                    type="button"
                                                    className="text-[11px] px-2 py-1 bg-white hover:bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-medium transition-colors"
                                                    onClick={() => {
                                                        setSelectedBeneficiaryGroupIds(beneficiaryGroups.map(g => g.id!))
                                                        if (editData) setHasChangedBeneficiaryGroups(true)
                                                    }}
                                                >
                                                    Select All
                                                </button>
                                                <button
                                                    type="button"
                                                    className="text-[11px] px-2 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-md text-gray-600 font-medium transition-colors"
                                                    onClick={() => {
                                                        setSelectedBeneficiaryGroupIds([])
                                                        if (editData) setHasChangedBeneficiaryGroups(true)
                                                    }}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-y-auto p-1">
                                            {beneficiaryGroups.map((group) => {
                                                const checked = selectedBeneficiaryGroupIds.includes(group.id!)
                                                return (
                                                    <label
                                                        key={group.id}
                                                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer ${
                                                            checked
                                                                ? 'bg-primary-50 border-primary-300'
                                                                : 'bg-white border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                setSelectedBeneficiaryGroupIds(prev =>
                                                                    checked ? prev.filter(id => id !== group.id) : [...prev, group.id!]
                                                                )
                                                                if (editData) setHasChangedBeneficiaryGroups(true)
                                                            }}
                                                            className="w-4 h-4 text-primary-500 rounded border-gray-300 focus:ring-primary-500 flex-shrink-0"
                                                        />
                                                        <span className="text-base font-medium text-gray-800 truncate">{group.name}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 5: Title, Description & Upload */}
                        {currentStep === 5 && (
                            <div className="space-y-4 animate-fade-in max-w-3xl mx-auto">
                                <div className="text-center mb-1">
                                    <h3 className="text-lg font-semibold text-gray-900">Details & Upload</h3>
                                    <p className="text-gray-500 text-xs">Add title, description, and upload your file</p>
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
                            File or Link <span className="text-red-400">*</span>
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
                            ) : formData.file_url && /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/.test(formData.file_url) ? (
                                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                                    <div className="relative w-full max-w-md mx-auto" style={{ paddingBottom: '56.25%' }}>
                                                        <iframe
                                                            src={`https://www.youtube.com/embed/${(formData.file_url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]}`}
                                                            title="YouTube video"
                                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                            allowFullScreen
                                                            className="absolute inset-0 w-full h-full rounded-lg"
                                                        />
                                                    </div>
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

                                        <div className="mt-4 space-y-3">
                            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200/60 rounded-xl">
                                <div className="w-9 h-9 bg-red-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                                    </svg>
                                </div>
                                <input
                                    type="url"
                                    name="file_url"
                                    value={formData.file_url || ''}
                                    onChange={handleInputChange}
                                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 placeholder-red-400/70 focus:ring-0 p-0"
                                    placeholder="Paste a YouTube link here"
                                />
                            </div>
                            <div className="relative flex items-center">
                                <div className="flex-1 border-t border-gray-200"></div>
                                <span className="px-3 text-xs text-gray-400 font-medium">or paste any link</span>
                                <div className="flex-1 border-t border-gray-200"></div>
                            </div>
                            <input
                                type="url"
                                name="file_url"
                                value={formData.file_url || ''}
                                onChange={handleInputChange}
                                className="input-field text-base py-3"
                                placeholder="Paste a link to online evidence (https://...)"
                            />
                        </div>
                    </div>
                    </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Navigation Footer */}
                <div className="border-t border-evidence-100/40 px-4 md:px-6 py-2.5 bg-white/30 backdrop-blur-xl flex-shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={currentStep === 1 ? onClose : handleBack}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 text-sm text-gray-600 bg-white/50 backdrop-blur-sm border border-gray-200/60 rounded-lg hover:bg-white/70 font-medium transition-all duration-200"
                        >
                            {currentStep === 1 ? (
                                <>
                                    <X className="w-4 h-4" />
                                    <span>Cancel</span>
                                </>
                            ) : (
                                <>
                                    <ChevronLeft className="w-4 h-4" />
                                    <span>Back</span>
                                </>
                            )}
                        </button>

                        <div className="flex items-center gap-2 relative z-10">
                            {uploadProgress && (
                                <div className="px-3 py-1 text-xs text-evidence-700 bg-evidence-50/80 backdrop-blur-sm rounded-lg border border-evidence-200/60">
                                    {uploadProgress}
                                </div>
                            )}
                            {currentStep < totalSteps ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={!canProceedToNextStep()}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-md shadow-evidence-500/30 hover:shadow-lg hover:shadow-evidence-500/40 relative z-10"
                                >
                                    <span>Next</span>
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            ) : (
                                <button
                                    type="submit"
                                    disabled={loading || !formData.title}
                                    onClick={(e) => {
                                        e.preventDefault()
                                        handleSubmit(e)
                                    }}
                                    className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-evidence-500 text-white rounded-lg hover:bg-evidence-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-all duration-200 shadow-md shadow-evidence-500/30 hover:shadow-lg hover:shadow-evidence-500/40 relative z-10"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>{editData ? 'Update Evidence' : 'Add Evidence'}</span>
                                            <Check className="w-4 h-4" />
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
                            // Auto-select the newly created location
                            setSelectedLocationIds(prev => [...prev, newLocation.id!])
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