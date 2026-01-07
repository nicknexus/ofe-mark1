import React, { useState, useEffect, useRef } from 'react'
import { 
    Plus, 
    FileText, 
    Camera, 
    MessageSquare, 
    DollarSign,
    Upload,
    X,
    Check,
    ChevronRight,
    ChevronLeft,
    MapPin,
    Calendar,
    Eye
} from 'lucide-react'
import { apiService } from '../../services/api'
import { Evidence, Location, KPI } from '../../types'
import { formatDate, getEvidenceTypeInfo, getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import EvidencePreviewModal from '../EvidencePreviewModal'
import toast from 'react-hot-toast'

interface MobileEvidenceTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function MobileEvidenceTab({ initiativeId, onRefresh }: MobileEvidenceTabProps) {
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(true)
    const [showUploadFlow, setShowUploadFlow] = useState(false)
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    useEffect(() => {
        loadEvidence()
    }, [initiativeId])

    const loadEvidence = async () => {
        try {
            setLoading(true)
            const data = await apiService.getEvidence(initiativeId)
            setEvidence(data || [])
        } catch (error) {
            console.error('Error loading evidence:', error)
            toast.error('Failed to load evidence')
        } finally {
            setLoading(false)
        }
    }

    const handleViewEvidence = (ev: Evidence) => {
        setSelectedEvidence(ev)
        setIsPreviewOpen(true)
    }

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual', icon: Camera },
        { value: 'documentation', label: 'Document', icon: FileText },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare },
        { value: 'financials', label: 'Financial', icon: DollarSign }
    ]

    if (showUploadFlow) {
        return (
            <MobileEvidenceUploadFlow
                initiativeId={initiativeId}
                onClose={() => setShowUploadFlow(false)}
                onSuccess={() => {
                    setShowUploadFlow(false)
                    loadEvidence()
                    onRefresh?.()
                }}
            />
        )
    }

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Evidence</h1>
                    <p className="text-sm text-gray-500">{evidence.length} items</p>
                </div>
                <button
                    onClick={() => setShowUploadFlow(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-evidence-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-evidence-500/25 active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    Add
                </button>
            </div>

            {/* Evidence List */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-evidence-500"></div>
                </div>
            ) : evidence.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                    <div className="w-16 h-16 bg-evidence-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-evidence-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Evidence Yet</h3>
                    <p className="text-gray-500 text-sm px-6 mb-6">
                        Add photos, documents, or recordings to support your impact claims.
                    </p>
                    <button
                        onClick={() => setShowUploadFlow(true)}
                        className="px-6 py-3 bg-evidence-500 text-white rounded-xl font-medium text-sm"
                    >
                        Add Evidence
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {evidence.map((ev) => {
                        const typeInfo = getEvidenceTypeInfo(ev.type)
                        const bgColor = typeInfo.color.split(' ')[0]
                        const TypeIcon = evidenceTypes.find(t => t.value === ev.type)?.icon || FileText
                        const isImage = ev.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i)

                        return (
                            <button
                                key={ev.id}
                                onClick={() => handleViewEvidence(ev)}
                                className="bg-white rounded-xl border border-gray-100 overflow-hidden text-left active:scale-[0.98] transition-transform"
                            >
                                {/* Preview */}
                                <div className={`aspect-square ${bgColor} flex items-center justify-center relative overflow-hidden`}>
                                    {isImage && ev.file_url ? (
                                        <img
                                            src={ev.file_url}
                                            alt={ev.title || ''}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none'
                                            }}
                                        />
                                    ) : (
                                        <TypeIcon className="w-10 h-10 text-gray-400" />
                                    )}
                                    <div className="absolute top-2 right-2">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-medium ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>
                                </div>
                                {/* Info */}
                                <div className="p-3">
                                    <h3 className="font-medium text-gray-800 text-sm truncate">
                                        {ev.title || 'Untitled'}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {formatDate(ev.date_represented)}
                                    </p>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Evidence Preview Modal */}
            {isPreviewOpen && selectedEvidence && (
                <EvidencePreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => {
                        setIsPreviewOpen(false)
                        setSelectedEvidence(null)
                    }}
                    evidence={selectedEvidence}
                    onEdit={() => {}}
                    onDelete={async () => {
                        if (!selectedEvidence?.id) return
                        try {
                            await apiService.deleteEvidence(selectedEvidence.id)
                            toast.success('Evidence deleted')
                            setIsPreviewOpen(false)
                            setSelectedEvidence(null)
                            loadEvidence()
                        } catch (error) {
                            toast.error('Failed to delete')
                        }
                    }}
                />
            )}
        </div>
    )
}

// Mobile Evidence Upload Flow - Step by step wizard
interface UploadFlowProps {
    initiativeId: string
    onClose: () => void
    onSuccess: () => void
}

function MobileEvidenceUploadFlow({ initiativeId, onClose, onSuccess }: UploadFlowProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [kpis, setKPIs] = useState<KPI[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Form state
    const [formData, setFormData] = useState({
        type: 'visual_proof',
        title: '',
        description: '',
        file: null as File | null,
        fileUrl: '',
        datePickerValue: {} as { singleDate?: string; startDate?: string; endDate?: string },
        selectedLocationIds: [] as string[],
        selectedKpiIds: [] as string[]
    })

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Photo/Video', icon: Camera, description: 'Visual evidence' },
        { value: 'documentation', label: 'Document', icon: FileText, description: 'Reports, forms' },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare, description: 'Quotes, feedback' },
        { value: 'financials', label: 'Financial', icon: DollarSign, description: 'Receipts, invoices' }
    ]

    useEffect(() => {
        // Load locations and KPIs
        Promise.all([
            apiService.getLocations(initiativeId),
            apiService.getKPIs(initiativeId)
        ]).then(([locs, kpiData]) => {
            setLocations(locs || [])
            setKPIs(kpiData || [])
        })
    }, [initiativeId])

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setFormData(prev => ({
                ...prev,
                file,
                title: prev.title || file.name.replace(/\.[^/.]+$/, '')
            }))
        }
    }

    const handleSubmit = async () => {
        if (!formData.title) {
            toast.error('Please enter a title')
            return
        }
        if (!formData.file && !formData.fileUrl) {
            toast.error('Please select a file or enter a URL')
            return
        }
        if (formData.selectedLocationIds.length === 0) {
            toast.error('Please select at least one location')
            return
        }
        if (formData.selectedKpiIds.length === 0) {
            toast.error('Please select at least one metric')
            return
        }

        setLoading(true)
        try {
            let fileUrl = formData.fileUrl

            // Upload file if selected
            if (formData.file) {
                const uploadResult = await apiService.uploadFile(formData.file)
                fileUrl = uploadResult.file_url
            }

            // Prepare data
            const submitData: any = {
                title: formData.title,
                description: formData.description,
                type: formData.type,
                file_url: fileUrl,
                initiative_id: initiativeId,
                kpi_ids: formData.selectedKpiIds,
                location_ids: formData.selectedLocationIds
            }

            // Handle dates
            if (formData.datePickerValue.singleDate) {
                submitData.date_represented = formData.datePickerValue.singleDate
            } else if (formData.datePickerValue.startDate && formData.datePickerValue.endDate) {
                submitData.date_range_start = formData.datePickerValue.startDate
                submitData.date_range_end = formData.datePickerValue.endDate
                submitData.date_represented = formData.datePickerValue.startDate
            } else {
                submitData.date_represented = getLocalDateString(new Date())
            }

            await apiService.createEvidence(submitData)
            toast.success('Evidence added!')
            onSuccess()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add evidence'
            toast.error(message)
        } finally {
            setLoading(false)
        }
    }

    const canProceed = () => {
        switch (step) {
            case 1: return !!formData.type
            case 2: return formData.file !== null || formData.fileUrl !== ''
            case 3: return !!formData.title
            case 4: return formData.selectedLocationIds.length > 0
            case 5: return formData.selectedKpiIds.length > 0
            default: return false
        }
    }

    const totalSteps = 5

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <button onClick={onClose} className="p-2 -ml-2">
                    <X className="w-5 h-5 text-gray-500" />
                </button>
                <span className="font-semibold text-gray-800">Add Evidence</span>
                <span className="text-sm text-gray-500">{step}/{totalSteps}</span>
            </div>

            {/* Progress */}
            <div className="px-4 pt-3">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-evidence-500 transition-all duration-300"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {/* Step 1: Type */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Evidence Type</h2>
                            <p className="text-gray-500 text-sm mt-1">What kind of evidence?</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {evidenceTypes.map((type) => {
                                const Icon = type.icon
                                const isSelected = formData.type === type.value
                                return (
                                    <button
                                        key={type.value}
                                        onClick={() => setFormData(prev => ({ ...prev, type: type.value }))}
                                        className={`p-4 rounded-2xl border-2 transition-all ${
                                            isSelected 
                                                ? 'border-evidence-500 bg-evidence-50' 
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <Icon className={`w-8 h-8 mx-auto mb-2 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                        <div className={`font-semibold text-sm ${isSelected ? 'text-evidence-600' : 'text-gray-700'}`}>
                                            {type.label}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Step 2: Upload */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Upload File</h2>
                            <p className="text-gray-500 text-sm mt-1">Select a file or paste a link</p>
                        </div>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            className="hidden"
                        />

                        {formData.file ? (
                            <div className="bg-evidence-50 border-2 border-evidence-300 rounded-2xl p-4 text-center">
                                <FileText className="w-12 h-12 text-evidence-500 mx-auto mb-2" />
                                <p className="font-medium text-gray-800 truncate">{formData.file.name}</p>
                                <p className="text-sm text-gray-500">
                                    {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                                <button
                                    onClick={() => setFormData(prev => ({ ...prev, file: null }))}
                                    className="mt-3 text-sm text-red-600 font-medium"
                                >
                                    Remove
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:border-evidence-400 transition-colors"
                            >
                                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                                <p className="font-medium text-gray-700">Tap to select file</p>
                                <p className="text-sm text-gray-500 mt-1">Images, PDFs, documents</p>
                            </button>
                        )}

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-white px-4 text-sm text-gray-500">or</span>
                            </div>
                        </div>

                        <input
                            type="url"
                            value={formData.fileUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, fileUrl: e.target.value }))}
                            placeholder="Paste a link (https://...)"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                        />
                    </div>
                )}

                {/* Step 3: Details */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Details</h2>
                            <p className="text-gray-500 text-sm mt-1">Title and date</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g., Training photos"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Description (optional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="What does this evidence show?"
                                rows={3}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                <Calendar className="w-4 h-4 inline mr-1" />
                                Date
                            </label>
                            <DateRangePicker
                                value={formData.datePickerValue}
                                onChange={(value) => setFormData(prev => ({ ...prev, datePickerValue: value }))}
                                placeholder="Select date"
                            />
                        </div>
                    </div>
                )}

                {/* Step 4: Location */}
                {step === 4 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Location</h2>
                            <p className="text-gray-500 text-sm mt-1">Where was this captured?</p>
                        </div>

                        {locations.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl">
                                <MapPin className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No locations available</p>
                                <p className="text-gray-400 text-xs mt-1">Add locations in the Locations tab</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {locations.map((location) => {
                                    const isSelected = formData.selectedLocationIds.includes(location.id!)
                                    return (
                                        <button
                                            key={location.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedLocationIds: isSelected
                                                        ? prev.selectedLocationIds.filter(id => id !== location.id)
                                                        : [...prev.selectedLocationIds, location.id!]
                                                }))
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                isSelected 
                                                    ? 'border-evidence-500 bg-evidence-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <MapPin className={`w-5 h-5 ${isSelected ? 'text-evidence-500' : 'text-gray-400'}`} />
                                                    <div>
                                                        <div className="font-medium text-gray-800">{location.name}</div>
                                                        {location.description && (
                                                            <div className="text-xs text-gray-500">{location.description}</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-5 h-5 text-evidence-500" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 5: Metrics */}
                {step === 5 && (
                    <div className="space-y-4">
                        <div className="text-center mb-6">
                            <h2 className="text-xl font-bold text-gray-900">Link to Metrics</h2>
                            <p className="text-gray-500 text-sm mt-1">What does this support?</p>
                        </div>

                        {kpis.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-2xl">
                                <FileText className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                                <p className="text-gray-500 text-sm">No metrics available</p>
                                <p className="text-gray-400 text-xs mt-1">Create metrics on desktop</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {kpis.map((kpi) => {
                                    const isSelected = formData.selectedKpiIds.includes(kpi.id!)
                                    return (
                                        <button
                                            key={kpi.id}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    selectedKpiIds: isSelected
                                                        ? prev.selectedKpiIds.filter(id => id !== kpi.id)
                                                        : [...prev.selectedKpiIds, kpi.id!]
                                                }))
                                            }}
                                            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                                                isSelected 
                                                    ? 'border-evidence-500 bg-evidence-50' 
                                                    : 'border-gray-200'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="font-medium text-gray-800">{kpi.title}</div>
                                                    {kpi.description && (
                                                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{kpi.description}</div>
                                                    )}
                                                </div>
                                                {isSelected && (
                                                    <Check className="w-5 h-5 text-evidence-500" />
                                                )}
                                            </div>
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 safe-area-pb">
                <div className="flex gap-3">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(s => s - 1)}
                            className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium text-sm flex items-center gap-2"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            Back
                        </button>
                    )}
                    <button
                        onClick={() => {
                            if (step < totalSteps) {
                                setStep(s => s + 1)
                            } else {
                                handleSubmit()
                            }
                        }}
                        disabled={!canProceed() || loading}
                        className="flex-1 py-3 bg-evidence-500 text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Uploading...
                            </>
                        ) : step < totalSteps ? (
                            <>
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                Add Evidence
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}

