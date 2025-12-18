import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, File, Loader2, Check, Camera, FileText, MessageSquare, DollarSign, Calendar, MapPin, AlertCircle, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { CreateEvidenceForm, Location } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'

interface EasyEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateEvidenceForm) => Promise<void>
    onBatchComplete?: () => Promise<void> // Called once after all evidence is created
    impactClaim: any // The selected impact claim
    kpi: any // The KPI this claim belongs to
    initiativeId: string
}

interface FileWithType {
    file: File
    type: 'visual_proof' | 'documentation' | 'testimony' | 'financials'
    title: string
    description: string
    previewUrl?: string
}

export default function EasyEvidenceModal({
    isOpen,
    onClose,
    onSubmit,
    onBatchComplete,
    impactClaim,
    kpi,
    initiativeId
}: EasyEvidenceModalProps) {
    const [selectedFiles, setSelectedFiles] = useState<FileWithType[]>([])
    const [isDragOver, setIsDragOver] = useState(false)
    const [loading, setLoading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const [location, setLocation] = useState<Location | null>(null)
    const [loadingLocation, setLoadingLocation] = useState(false)
    const [currentStep, setCurrentStep] = useState(1)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen && impactClaim?.location_id) {
            loadLocation()
        } else {
            setLocation(null)
        }
    }, [isOpen, impactClaim?.location_id])

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) {
            setCurrentStep(1)
        }
    }, [isOpen])

    // Generate preview URLs for image files
    useEffect(() => {
        selectedFiles.forEach((fileWithType, index) => {
            if (!fileWithType.previewUrl && isImageFile(fileWithType.file)) {
                const url = URL.createObjectURL(fileWithType.file)
                setSelectedFiles(prev => prev.map((item, i) => 
                    i === index ? { ...item, previewUrl: url } : item
                ))
            }
        })

        // Cleanup URLs on unmount
        return () => {
            selectedFiles.forEach(fileWithType => {
                if (fileWithType.previewUrl) {
                    URL.revokeObjectURL(fileWithType.previewUrl)
                }
            })
        }
    }, [selectedFiles.length])

    const loadLocation = async () => {
        if (!impactClaim?.location_id) return
        try {
            setLoadingLocation(true)
            const loc = await apiService.getLocation(impactClaim.location_id)
            setLocation(loc)
        } catch (error) {
            console.error('Failed to load location:', error)
            setLocation(null)
        } finally {
            setLoadingLocation(false)
        }
    }

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Proof', icon: Camera, description: 'Photos, videos, screenshots' },
        { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
        { value: 'testimony', label: 'Testimonies', icon: MessageSquare, description: 'Quotes, feedback, stories' },
        { value: 'financials', label: 'Financials', icon: DollarSign, description: 'Receipts, invoices, budgets' }
    ] as const

    const isImageFile = (file: File) => {
        return file.type.startsWith('image/')
    }

    if (!isOpen) return null

    if (!impactClaim || typeof impactClaim === 'string') {
        console.error('EasyEvidenceModal: impactClaim is invalid', { impactClaim, type: typeof impactClaim })
        return null
    }

    // Get date display from impact claim
    const getDateDisplay = () => {
        if (impactClaim.date_range_start && impactClaim.date_range_end) {
            return `${formatDate(impactClaim.date_range_start)} - ${formatDate(impactClaim.date_range_end)}`
        }
        return formatDate(impactClaim.date_represented)
    }

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map(file => ({
                file,
                type: 'visual_proof' as const,
                title: file.name.replace(/\.[^/.]+$/, ''),
                description: ''
            }))
            setSelectedFiles(prev => [...prev, ...newFiles])
        }
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).map(file => ({
                file,
                type: 'visual_proof' as const,
                title: file.name.replace(/\.[^/.]+$/, ''),
                description: ''
            }))
            setSelectedFiles(prev => [...prev, ...newFiles])
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

    const removeFile = (index: number) => {
        const fileToRemove = selectedFiles[index]
        if (fileToRemove.previewUrl) {
            URL.revokeObjectURL(fileToRemove.previewUrl)
        }
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const updateFileType = (index: number, type: 'visual_proof' | 'documentation' | 'testimony' | 'financials') => {
        setSelectedFiles(prev => prev.map((item, i) => i === index ? { ...item, type } : item))
    }

    const updateFileTitle = (index: number, title: string) => {
        setSelectedFiles(prev => prev.map((item, i) => i === index ? { ...item, title } : item))
    }

    const updateFileDescription = (index: number, description: string) => {
        setSelectedFiles(prev => prev.map((item, i) => i === index ? { ...item, description } : item))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        
        if (selectedFiles.length === 0) {
            toast.error('Please upload at least one file')
            return
        }

        // Validate all files have titles
        const invalidFiles = selectedFiles.filter(f => !f.title.trim())
        if (invalidFiles.length > 0) {
            toast.error('Please enter a title for all files')
            return
        }

        setLoading(true)
        const totalFiles = selectedFiles.length

        try {
            // Step 1: Upload all files first
            setUploadProgress(`Uploading ${totalFiles} file${totalFiles > 1 ? 's' : ''}...`)
            const uploadResults: { file: typeof selectedFiles[0], result: { file_url: string, size: number } }[] = []
            
            for (let i = 0; i < totalFiles; i++) {
                const fileWithType = selectedFiles[i]
                setUploadProgress(`Uploading file ${i + 1} of ${totalFiles}...`)
                const uploadResult = await apiService.uploadFile(fileWithType.file)
                uploadResults.push({ file: fileWithType, result: uploadResult })
            }

            // Step 2: Create all evidence records (without triggering parent refresh)
            setUploadProgress(`Creating ${totalFiles} evidence record${totalFiles > 1 ? 's' : ''}...`)
            
            for (let i = 0; i < uploadResults.length; i++) {
                const { file: fileWithType, result: uploadResult } = uploadResults[i]
                setUploadProgress(`Creating evidence ${i + 1} of ${totalFiles}...`)

                // Create evidence data - auto-fill from impact claim
                const evidenceData: CreateEvidenceForm = {
                    title: fileWithType.title.trim(),
                    description: fileWithType.description.trim(),
                    type: fileWithType.type,
                    // Use impact claim's date
                    date_represented: impactClaim.date_range_end || impactClaim.date_represented,
                    date_range_start: impactClaim.date_range_start,
                    date_range_end: impactClaim.date_range_end,
                    // Use impact claim's location if available (as array for multi-location support)
                    location_ids: impactClaim.location_id ? [impactClaim.location_id] : undefined,
                    // Link to the KPI
                    kpi_ids: [kpi.id],
                    // Link to the specific impact claim
                    kpi_update_ids: [impactClaim.id],
                    initiative_id: initiativeId,
                    file_url: uploadResult.file_url,
                    // Pass file URLs and sizes as arrays for proper storage tracking
                    file_urls: [uploadResult.file_url],
                    file_sizes: [uploadResult.size]
                }

                // Create evidence directly via API (don't trigger parent refresh)
                await apiService.createEvidence(evidenceData)
            }

            // Step 3: Trigger single refresh after all evidence is created
            setUploadProgress('Refreshing...')
            if (onBatchComplete) {
                await onBatchComplete()
            }

            // Reset form
            setSelectedFiles([])
            setUploadProgress('')
            setCurrentStep(1)

            toast.success(`Successfully added ${totalFiles} evidence ${totalFiles === 1 ? 'item' : 'items'}!`)
            onClose()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
        } finally {
            setLoading(false)
            setUploadProgress('')
        }
    }

    const canProceedToStep2 = selectedFiles.length > 0
    const canSubmit = selectedFiles.length > 0 && selectedFiles.every(f => f.title.trim())

    const steps = [
        { number: 1, title: 'Upload Files' },
        { number: 2, title: 'Configure Details' }
    ]

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-0 md:p-4 z-[80]">
            <div className="bg-white md:bg-white/95 md:backdrop-blur-xl md:border md:border-white/60 md:rounded-3xl w-full h-full md:w-full md:max-w-4xl md:h-auto md:min-h-[75vh] md:max-h-[95vh] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] overflow-hidden flex flex-col transition-all duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-5 bg-gradient-to-r from-evidence-500 to-evidence-600 flex-shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 flex-shrink-0">
                            <Upload className="w-4 h-4 md:w-5 md:h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base md:text-lg font-bold text-white">Add Evidence</h2>
                            <p className="text-xs md:text-sm text-white/80 truncate">
                                Upload evidence for this claim
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors flex-shrink-0"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Impact Claim Summary */}
                <div className="px-4 md:px-5 py-4 md:py-5 bg-gradient-to-r from-primary-50 to-primary-100/50 border-b border-primary-200/40 flex-shrink-0">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-primary-500"></div>
                                <span className="text-xs md:text-sm font-semibold text-primary-600 uppercase tracking-wide">
                                    Supporting
                                </span>
                            </div>
                            <span className="text-xl md:text-2xl font-bold text-primary-700">
                                {impactClaim.value?.toLocaleString()} {kpi.unit_of_measurement}
                            </span>
                            <div className="flex flex-wrap items-center gap-3 md:gap-4 text-xs md:text-sm text-gray-600">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-500" />
                                    <span>{getDateDisplay()}</span>
                                </div>
                                {impactClaim.location_id && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-500" />
                                        {loadingLocation ? (
                                            <span className="text-gray-400">...</span>
                                        ) : location ? (
                                            <span>{location.name}</span>
                                        ) : (
                                            <span className="text-gray-400">—</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 rounded-lg shadow-sm">
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span className="text-xs font-semibold text-white">Auto-linked</span>
                        </div>
                    </div>
                </div>

                {/* Progress Steps */}
                <div className="px-5 py-5 border-b border-gray-100 bg-white/50 flex-shrink-0">
                    <div className="flex items-center justify-center">
                        {steps.map((step, index) => (
                            <React.Fragment key={step.number}>
                                <div className="flex items-center gap-2">
                                    <div className={`flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-all duration-200 ${
                                        currentStep > step.number
                                            ? 'bg-evidence-500 border-evidence-500 text-white shadow-sm'
                                            : currentStep === step.number
                                            ? 'bg-evidence-500 border-evidence-500 text-white ring-2 ring-evidence-200/50 shadow-sm'
                                            : 'bg-white border-gray-200 text-gray-400'
                                    }`}>
                                        {currentStep > step.number ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <span className="text-sm font-semibold">{step.number}</span>
                                        )}
                                    </div>
                                    <span className={`text-base font-medium whitespace-nowrap ${
                                        currentStep >= step.number ? 'text-gray-700' : 'text-gray-400'
                                    }`}>
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className={`w-20 h-0.5 mx-5 rounded-full transition-all duration-200 ${
                                        currentStep > step.number ? 'bg-evidence-500' : 'bg-gray-200'
                                    }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {currentStep === 1 ? (
                        /* Step 1: Upload Files */
                        <div className="p-5">
                            <div className="max-w-xl mx-auto space-y-4">
                                {/* Info Banner */}
                                <div className="bg-primary-50 border border-primary-200 rounded-xl p-3 flex items-start gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
                                        <AlertCircle className="w-3.5 h-3.5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-primary-800 mb-0.5">
                                            Upload all evidence you have
                                        </p>
                                        <p className="text-xs text-primary-700">
                                            Upload all relevant files. You can configure each in the next step.
                                        </p>
                                    </div>
                                </div>

                                {/* Upload Area */}
                                <div
                                    className={`border-2 border-dashed rounded-xl p-5 text-center transition-all duration-200 cursor-pointer ${
                                        isDragOver
                                            ? 'border-evidence-500 bg-evidence-50/50'
                                            : 'border-gray-200 hover:border-evidence-400 hover:bg-evidence-50/30'
                                    }`}
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileSelect}
                                        multiple
                                        className="hidden"
                                        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                                    />
                                    <Upload className="w-10 h-10 mx-auto text-evidence-500 mb-2" />
                                    <p className="text-sm text-gray-700 font-medium mb-0.5">
                                        Drag & drop files here, or <span className="text-evidence-600">browse</span>
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        Images, PDFs, and documents supported
                                    </p>
                                </div>

                                {/* File List */}
                                {selectedFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold text-gray-700">
                                                Uploaded Files ({selectedFiles.length})
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedFiles([])}
                                                className="text-xs text-red-500 hover:text-red-700"
                                            >
                                                Remove all
                                            </button>
                                        </div>
                                        <div className="space-y-1.5">
                                            {selectedFiles.map((fileWithType, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-200"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                        <div className="w-7 h-7 rounded-lg bg-evidence-100 flex items-center justify-center flex-shrink-0">
                                                            {isImageFile(fileWithType.file) ? (
                                                                <Camera className="w-3.5 h-3.5 text-evidence-500" />
                                                            ) : (
                                                                <FileText className="w-3.5 h-3.5 text-evidence-500" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                                {fileWithType.file.name}
                                                            </p>
                                                            <p className="text-xs text-gray-500">
                                                                {(fileWithType.file.size / 1024).toFixed(1)} KB
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeFile(index)}
                                                        className="p-1 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0"
                                                    >
                                                        <X className="w-3.5 h-3.5 text-gray-400" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Step 2: Configure Details */
                        <div className="p-5 space-y-4">
                                {selectedFiles.map((fileWithType, index) => {
                                    const TypeIcon = evidenceTypes.find(t => t.value === fileWithType.type)?.icon || FileText
                                    return (
                                        <div
                                            key={index}
                                            className="flex gap-5 p-4 bg-white rounded-xl border border-gray-200 shadow-sm"
                                        >
                                            {/* Left: Preview */}
                                            <div className="w-40 flex-shrink-0">
                                                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                                                    {fileWithType.previewUrl ? (
                                                        <img
                                                            src={fileWithType.previewUrl}
                                                            alt={fileWithType.file.name}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                                            <FileText className="w-10 h-10 mb-2" />
                                                            <span className="text-xs text-center px-2">
                                                                {fileWithType.file.name.split('.').pop()?.toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-2 truncate text-center">
                                                    {fileWithType.file.name}
                                                </p>
                                            </div>

                                            {/* Right: Form Fields */}
                                            <div className="flex-1 space-y-3">
                                                {/* Evidence Type */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                                        Evidence Type <span className="text-red-400">*</span>
                                                    </label>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {evidenceTypes.map((type) => {
                                                            const Icon = type.icon
                                                            const isSelected = fileWithType.type === type.value
                                                            return (
                                                                <button
                                                                    key={type.value}
                                                                    type="button"
                                                                    onClick={() => updateFileType(index, type.value)}
                                                                    className={`p-2 rounded-lg border-2 transition-all duration-200 flex flex-col items-center gap-1 ${
                                                                        isSelected
                                                                            ? 'border-evidence-500 bg-evidence-50'
                                                                            : 'border-gray-200 hover:border-evidence-300 hover:bg-gray-50'
                                                                    }`}
                                                                >
                                                                    <Icon className={`w-4 h-4 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                                                    <span className={`text-[10px] font-medium ${isSelected ? 'text-evidence-700' : 'text-gray-600'}`}>
                                                                        {type.label}
                                                                    </span>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                {/* Title */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                                        Title <span className="text-red-400">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={fileWithType.title}
                                                        onChange={(e) => updateFileTitle(index, e.target.value)}
                                                        placeholder="e.g., Receipt for meal distribution"
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-evidence-500/20 focus:border-evidence-500 transition-all duration-200"
                                                        required
                                                    />
                                                </div>

                                                {/* Description */}
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                                                        Description <span className="text-gray-400 font-normal">(optional)</span>
                                                    </label>
                                                    <textarea
                                                        value={fileWithType.description}
                                                        onChange={(e) => updateFileDescription(index, e.target.value)}
                                                        placeholder="Describe what this evidence shows..."
                                                        rows={2}
                                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-evidence-500/20 focus:border-evidence-500 transition-all duration-200 resize-none"
                                                    />
                                                </div>
                                            </div>

                                            {/* Remove Button */}
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="p-1.5 h-fit hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                                            >
                                                <X className="w-4 h-4 text-gray-400" />
                                            </button>
                                        </div>
                                    )
                                })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t border-gray-100/60 bg-gray-50/50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={currentStep === 1 ? onClose : () => setCurrentStep(1)}
                        className="flex items-center gap-2 px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200"
                        disabled={loading}
                    >
                        {currentStep === 1 ? (
                            'Cancel'
                        ) : (
                            <>
                                <ChevronLeft className="w-4 h-4" />
                                Back
                            </>
                        )}
                    </button>

                    {loading && (
                        <div className="px-4 py-2 text-sm text-evidence-700 bg-evidence-50 rounded-xl border border-evidence-200">
                            {uploadProgress}
                        </div>
                    )}

                    {currentStep === 1 ? (
                        <button
                            type="button"
                            onClick={() => setCurrentStep(2)}
                            disabled={!canProceedToStep2}
                            className="flex items-center gap-2 px-6 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !canSubmit}
                            className="flex items-center gap-2 px-6 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Adding...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Add {selectedFiles.length} Evidence</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
