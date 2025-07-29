import React, { useState, useRef } from 'react'
import { X, Upload, Calendar, Link as LinkIcon, FileText, Camera, DollarSign, MessageSquare, File } from 'lucide-react'
import { CreateEvidenceForm, KPI } from '../types'
import { apiService } from '../services/api'

interface AddEvidenceModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: CreateEvidenceForm) => Promise<void>
    availableKPIs: KPI[]
    initiativeId: string
    preSelectedKPIId?: string
}

export default function AddEvidenceModal({
    isOpen,
    onClose,
    onSubmit,
    availableKPIs,
    initiativeId,
    preSelectedKPIId
}: AddEvidenceModalProps) {
    const [formData, setFormData] = useState<CreateEvidenceForm>({
        title: '',
        description: '',
        type: 'visual_proof',
        date_represented: new Date().toISOString().split('T')[0],
        kpi_ids: preSelectedKPIId ? [preSelectedKPIId] : [],
        initiative_id: initiativeId
    })
    const [isDateRange, setIsDateRange] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedFile, setSelectedFile] = useState<File | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [uploadProgress, setUploadProgress] = useState('')
    const fileInputRef = useRef<HTMLInputElement>(null)

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Proof', icon: Camera, description: 'Photos, videos, screenshots' },
        { value: 'documentation', label: 'Documentation', icon: FileText, description: 'Reports, forms, certificates' },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare, description: 'Quotes, feedback, stories' },
        { value: 'financials', label: 'Financials', icon: DollarSign, description: 'Receipts, invoices, budgets' }
    ] as const

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
            const submitData = {
                ...formData,
                file_url: finalFileUrl
            }

            setUploadProgress('Creating evidence record...')
            await onSubmit(submitData)

            // Reset form
            setFormData({
                title: '',
                description: '',
                type: 'visual_proof',
                date_represented: new Date().toISOString().split('T')[0],
                kpi_ids: preSelectedKPIId ? [preSelectedKPIId] : [],
                initiative_id: initiativeId
            })
            setSelectedFile(null)
            setIsDateRange(false)
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
        setFormData(prev => ({
            ...prev,
            kpi_ids: prev.kpi_ids.includes(kpiId)
                ? prev.kpi_ids.filter(id => id !== kpiId)
                : [...prev.kpi_ids, kpiId]
        }))
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Upload Evidence</h2>
                        <p className="text-sm text-gray-600 mt-1">Add proof to support your impact claims</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1"
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
                                    className={`relative flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${formData.type === value
                                        ? 'border-primary-500 bg-primary-50'
                                        : 'border-gray-200 hover:border-gray-300'
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
                                : selectedFile
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

                    {/* Date Selection */}
                    <div>
                        <label className="label">
                            <Calendar className="w-4 h-4 inline mr-2" />
                            Date this evidence represents <span className="text-red-500">*</span>
                        </label>

                        <div className="space-y-3">
                            <div className="flex items-center space-x-4">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={!isDateRange}
                                        onChange={() => setIsDateRange(false)}
                                        className="mr-2"
                                    />
                                    <span className="text-sm">Single Date</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        checked={isDateRange}
                                        onChange={() => setIsDateRange(true)}
                                        className="mr-2"
                                    />
                                    <span className="text-sm">Date Range</span>
                                </label>
                            </div>

                            {!isDateRange ? (
                                <input
                                    type="date"
                                    name="date_represented"
                                    value={formData.date_represented}
                                    onChange={handleInputChange}
                                    className="input-field"
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
                                            className="input-field"
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
                                            className="input-field"
                                            required={isDateRange}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* KPI Selection */}
                    <div>
                        <label className="label mb-3">
                            Link to KPIs <span className="text-red-500">*</span>
                        </label>
                        <p className="text-sm text-gray-600 mb-3">
                            Select which KPIs this evidence supports
                        </p>
                        {availableKPIs.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">No KPIs available. Create KPIs first.</p>
                        ) : (
                            <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3">
                                {availableKPIs.map((kpi) => (
                                    <label
                                        key={kpi.id}
                                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.kpi_ids.includes(kpi.id!)}
                                            onChange={() => handleKPISelection(kpi.id!)}
                                            className="mr-3"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-gray-900">{kpi.title}</div>
                                            <div className="text-sm text-gray-500">{kpi.description}</div>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        )}
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
                                    className="btn-secondary flex-1"
                                    disabled={loading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary flex-1"
                                    disabled={loading || !formData.title || formData.kpi_ids.length === 0}
                                >
                                    {loading ? 'Processing...' : 'Add Evidence'}
                                </button>
                            </>
                        )}
                    </div>
                </form>
            </div>
        </div>
    )
} 