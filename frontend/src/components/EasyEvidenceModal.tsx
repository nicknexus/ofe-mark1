import React, { useState, useRef, useEffect } from 'react'
import { X, Upload, File, Loader2, Check, Camera, FileText, MessageSquare, DollarSign, Calendar, MapPin, AlertCircle, ChevronDown } from 'lucide-react'
import { CreateEvidenceForm, Location } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import toast from 'react-hot-toast'

interface EasyEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateEvidenceForm) => Promise<void>
    impactClaim: any // The selected impact claim
    kpi: any // The KPI this claim belongs to
    initiativeId: string
}

interface FileWithType {
    file: File
    type: 'visual_proof' | 'documentation' | 'testimony' | 'financials'
    title: string
    description: string
}

export default function EasyEvidenceModal({
    isOpen,
    onClose,
    onSubmit,
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
    const [evidenceTypeModalOpen, setEvidenceTypeModalOpen] = useState(false)
    const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        if (isOpen && impactClaim?.location_id) {
            loadLocation()
        } else {
            setLocation(null)
        }
    }, [isOpen, impactClaim?.location_id])

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
        setSelectedFiles(prev => prev.filter((_, i) => i !== index))
    }

    const openEvidenceTypeModal = (index: number) => {
        setEditingFileIndex(index)
        setEvidenceTypeModalOpen(true)
    }

    const selectEvidenceType = (type: 'visual_proof' | 'documentation' | 'testimony' | 'financials') => {
        if (editingFileIndex !== null) {
            setSelectedFiles(prev => prev.map((item, i) => i === editingFileIndex ? { ...item, type } : item))
        }
        setEvidenceTypeModalOpen(false)
        setEditingFileIndex(null)
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

        try {
            // Create evidence for each file
            for (let i = 0; i < selectedFiles.length; i++) {
                const fileWithType = selectedFiles[i]
                setUploadProgress(`Processing ${i + 1} of ${selectedFiles.length}...`)

                // Upload file
                setUploadProgress(`Uploading file ${i + 1} of ${selectedFiles.length}...`)
                const uploadResult = await apiService.uploadFile(fileWithType.file)

                setUploadProgress(`Creating evidence ${i + 1} of ${selectedFiles.length}...`)

                // Create evidence data - auto-fill from impact claim
                const evidenceData: CreateEvidenceForm = {
                    title: fileWithType.title.trim(),
                    description: fileWithType.description.trim(),
                    type: fileWithType.type,
                    // Use impact claim's date
                    date_represented: impactClaim.date_range_end || impactClaim.date_represented,
                    date_range_start: impactClaim.date_range_start,
                    date_range_end: impactClaim.date_range_end,
                    // Use impact claim's location if available
                    location_id: impactClaim.location_id,
                    // Link to the KPI
                    kpi_ids: [kpi.id],
                    // Link to the specific impact claim
                    kpi_update_ids: [impactClaim.id],
                    initiative_id: initiativeId,
                    file_url: uploadResult.file_url
                }

                await onSubmit(evidenceData)
            }

            const count = selectedFiles.length
            
            // Reset form
            setSelectedFiles([])
            setUploadProgress('')

            toast.success(`Successfully added ${count} evidence ${count === 1 ? 'item' : 'items'}!`)
            onClose()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
        } finally {
            setLoading(false)
            setUploadProgress('')
        }
    }

    const hasFiles = selectedFiles.length > 0

    return (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-md flex items-center justify-center p-4 z-[80]">
            <div className={`bg-white/95 backdrop-blur-xl border border-white/60 rounded-3xl w-full ${hasFiles ? 'max-w-6xl' : 'max-w-2xl'} shadow-[0_25px_60px_-15px_rgba(0,0,0,0.2)] max-h-[90vh] overflow-hidden flex flex-col transition-all duration-300`}>
                {/* Header - Evidence grey with green accent */}
                <div className="flex items-center justify-between p-5 bg-gradient-to-r from-evidence-500 to-evidence-600 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                            <Upload className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Add Evidence for Claim</h2>
                            <p className="text-sm text-white/80">
                                Upload evidence to verify this impact claim
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Impact Claim Summary - Green accent bar */}
                <div className="px-5 py-4 bg-gradient-to-r from-primary-50 to-primary-100/50 border-b border-primary-200/40 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-primary-500"></div>
                        <span className="text-xs font-semibold text-primary-700 uppercase tracking-wide">
                            Supporting this Impact Claim
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold text-primary-700">
                                    {impactClaim.value?.toLocaleString()} {kpi.unit_of_measurement}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-primary-500" />
                                    <span>{getDateDisplay()}</span>
                                </div>
                                {impactClaim.location_id && (
                                    <div className="flex items-center gap-1.5">
                                        <MapPin className="w-3.5 h-3.5 text-primary-500" />
                                        {loadingLocation ? (
                                            <span className="text-gray-400">Loading...</span>
                                        ) : location ? (
                                            <span>{location.name}</span>
                                        ) : (
                                            <span className="text-gray-400">Location not found</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 rounded-lg shadow-lg shadow-primary-500/25">
                            <Check className="w-3.5 h-3.5 text-white" />
                            <span className="text-xs font-semibold text-white">Auto-linked</span>
                        </div>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
                    {hasFiles ? (
                        <div className="flex flex-1 min-h-0">
                            {/* Left Column - Upload Area */}
                            <div className="w-1/2 border-r border-gray-100 overflow-y-auto">
                                <div className="p-5 space-y-4">
                                    {/* Disclaimer Banner - Green styling */}
                                    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
                                            <AlertCircle className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-primary-800 mb-1">
                                                Upload all evidence you have
                                            </p>
                                            <p className="text-xs text-primary-700">
                                                To sufficiently support this claim, upload all relevant evidence files. You can assign different evidence types to each file.
                                            </p>
                                        </div>
                                    </div>

                                    {/* File Upload */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Upload Files <span className="text-gray-400 font-normal">(photos, documents, etc.)</span>
                                        </label>
                                        <div
                                            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
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
                                            <Upload className="w-8 h-8 mx-auto text-evidence-500 mb-2" />
                                            <p className="text-sm text-gray-600">
                                                Drag & drop files here, or <span className="text-evidence-600 font-medium">browse</span>
                                            </p>
                                            <p className="text-xs text-gray-400 mt-1">
                                                Images, PDFs, and documents supported
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - File Cards */}
                            <div className="w-1/2 overflow-y-auto bg-gray-50/30">
                                <div className="p-5">
                                    <div className="text-sm font-semibold text-gray-700 mb-4 sticky top-0 bg-gray-50/30 pb-2 border-b border-gray-200 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-lg bg-evidence-500 flex items-center justify-center">
                                            <FileText className="w-3.5 h-3.5 text-white" />
                                        </div>
                                        Configure Evidence ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
                                    </div>
                                    <div className="space-y-4">
                                        {selectedFiles.map((fileWithType, index) => {
                                            const Icon = evidenceTypes.find(t => t.value === fileWithType.type)?.icon || FileText
                                            return (
                                                <div
                                                    key={index}
                                                    className="bg-white rounded-lg p-3 border border-gray-200 space-y-2.5 shadow-sm"
                                                >
                                                    {/* File Info Header */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <File className="w-3 h-3 text-evidence-500 flex-shrink-0" />
                                                            <span className="text-xs font-medium text-gray-700 truncate">{fileWithType.file.name}</span>
                                                            <span className="text-[10px] text-gray-400 flex-shrink-0">
                                                                ({(fileWithType.file.size / 1024).toFixed(1)} KB)
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFile(index)}
                                                            className="p-0.5 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                                                        >
                                                            <X className="w-3 h-3 text-gray-400" />
                                                        </button>
                                                    </div>

                                                    {/* Evidence Type Selection */}
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                                            Type <span className="text-red-400">*</span>
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEvidenceTypeModal(index)}
                                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg hover:border-evidence-400 hover:bg-evidence-50/50 transition-all duration-200 flex items-center justify-between bg-white"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="w-3.5 h-3.5 text-evidence-500" />
                                                                <span className="text-gray-700">{evidenceTypes.find(t => t.value === fileWithType.type)?.label}</span>
                                                            </div>
                                                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                        </button>
                                                    </div>

                                                    {/* Title */}
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                                            Title <span className="text-red-400">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={fileWithType.title}
                                                            onChange={(e) => updateFileTitle(index, e.target.value)}
                                                            placeholder="e.g., Receipt for meal distribution"
                                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-evidence-500/20 focus:border-evidence-500 transition-all duration-200"
                                                            required
                                                        />
                                                    </div>

                                                    {/* Description */}
                                                    <div>
                                                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                                                            Description <span className="text-gray-400 font-normal">(optional)</span>
                                                        </label>
                                                        <textarea
                                                            value={fileWithType.description}
                                                            onChange={(e) => updateFileDescription(index, e.target.value)}
                                                            placeholder="Describe what this evidence shows..."
                                                            rows={1.5}
                                                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-1 focus:ring-evidence-500/20 focus:border-evidence-500 transition-all duration-200 resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-5 space-y-4 overflow-y-auto">
                            {/* Disclaimer Banner - Green styling */}
                            <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/25">
                                    <AlertCircle className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-primary-800 mb-1">
                                        Upload all evidence you have
                                    </p>
                                    <p className="text-xs text-primary-700">
                                        To sufficiently support this claim, upload all relevant evidence files. You can assign different evidence types to each file.
                                    </p>
                                </div>
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Upload Files <span className="text-gray-400 font-normal">(photos, documents, etc.)</span>
                                </label>
                                <div
                                    className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 cursor-pointer ${
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
                                    <Upload className="w-8 h-8 mx-auto text-evidence-500 mb-2" />
                                    <p className="text-sm text-gray-600">
                                        Drag & drop files here, or <span className="text-evidence-600 font-medium">browse</span>
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Images, PDFs, and documents supported
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer */}
                <div className="flex items-center justify-between p-5 border-t border-gray-100/60 bg-gray-50/50 flex-shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 font-medium transition-all duration-200"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading || selectedFiles.length === 0 || selectedFiles.some(f => !f.title.trim())}
                        className="flex items-center gap-2 px-6 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-evidence-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{uploadProgress || 'Adding...'}</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Add {selectedFiles.length > 0 ? `${selectedFiles.length} ` : ''}Evidence</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Evidence Type Selection Modal */}
            {evidenceTypeModalOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-[90]" onClick={() => { setEvidenceTypeModalOpen(false); setEditingFileIndex(null) }}>
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        {/* Modal Header - Evidence grey */}
                        <div className="p-4 bg-evidence-500 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-white">Select Evidence Type</h3>
                            <button
                                onClick={() => { setEvidenceTypeModalOpen(false); setEditingFileIndex(null) }}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-white" />
                            </button>
                        </div>
                        <div className="p-4 space-y-2">
                            {evidenceTypes.map((type) => {
                                const TypeIcon = type.icon
                                const isSelected = editingFileIndex !== null && selectedFiles[editingFileIndex]?.type === type.value
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => selectEvidenceType(type.value)}
                                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                                            isSelected
                                                ? 'border-evidence-500 bg-evidence-50'
                                                : 'border-gray-200 hover:border-evidence-400 hover:bg-evidence-50/50'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${isSelected ? 'bg-evidence-500 shadow-lg shadow-evidence-500/25' : 'bg-gray-100'}`}>
                                                <TypeIcon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                                            </div>
                                            <div className="flex-1">
                                                <div className={`text-sm font-semibold ${isSelected ? 'text-evidence-700' : 'text-gray-900'}`}>
                                                    {type.label}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-0.5">{type.description}</div>
                                            </div>
                                            {isSelected && (
                                                <Check className="w-5 h-5 text-evidence-600" />
                                            )}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
