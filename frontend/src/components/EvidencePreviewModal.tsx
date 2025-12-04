import React, { useState, useEffect } from 'react'
import { X, Calendar, FileText, Camera, MessageSquare, DollarSign, ExternalLink, Download, Edit, BarChart3, MapPin, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { Evidence, Location } from '../types'
import { formatDate, getEvidenceTypeInfo } from '../utils'
import { apiService } from '../services/api'

interface EvidenceFile {
    id: string
    file_url: string
    file_name: string
    file_type: string
    display_order: number
}

interface EvidencePreviewModalProps {
    isOpen: boolean
    onClose: () => void
    evidence: Evidence | null
    onEdit?: (evidence: Evidence) => void
    onDelete?: (evidence: Evidence) => void
    onDataPointClick?: (dataPoint: any, kpi: any) => void
}

export default function EvidencePreviewModal({ isOpen, onClose, evidence, onEdit, onDelete, onDataPointClick }: EvidencePreviewModalProps) {
    const [linkedDataPoints, setLinkedDataPoints] = useState<any[]>([])
    const [loadingDataPoints, setLoadingDataPoints] = useState(false)
    const [location, setLocation] = useState<Location | null>(null)
    const [loadingLocation, setLoadingLocation] = useState(false)
    const [dataPointLocations, setDataPointLocations] = useState<Record<string, Location>>({})
    const [imageLoading, setImageLoading] = useState(true)
    const [evidenceFiles, setEvidenceFiles] = useState<EvidenceFile[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [currentFileIndex, setCurrentFileIndex] = useState(0)

    useEffect(() => {
        if (isOpen && evidence?.id) {
            setImageLoading(true)
            setCurrentFileIndex(0)
            loadLinkedDataPoints()
            loadEvidenceFiles()
            if (evidence.location_id) {
                loadLocation()
            } else {
                setLocation(null)
            }
        } else if (!isOpen) {
            // Reset loading states when modal closes
            setImageLoading(true)
            setEvidenceFiles([])
            setCurrentFileIndex(0)
        }
    }, [isOpen, evidence?.id, evidence?.location_id, evidence?.file_url])

    const loadEvidenceFiles = async () => {
        if (!evidence?.id) return
        try {
            setLoadingFiles(true)
            const files = await apiService.getEvidenceFiles(evidence.id)
            if (files && files.length > 0) {
                setEvidenceFiles(files)
            } else if (evidence.file_url) {
                // Fallback to single file
                setEvidenceFiles([{
                    id: evidence.id,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }])
            } else {
                setEvidenceFiles([])
            }
        } catch (error) {
            console.error('Failed to load evidence files:', error)
            // Fallback to single file from evidence
            if (evidence.file_url) {
                setEvidenceFiles([{
                    id: evidence.id,
                    file_url: evidence.file_url,
                    file_name: evidence.file_url.split('/').pop() || 'file',
                    file_type: evidence.file_type || 'unknown',
                    display_order: 0
                }])
            }
        } finally {
            setLoadingFiles(false)
        }
    }

    const handlePrevFile = () => {
        setCurrentFileIndex(prev => (prev > 0 ? prev - 1 : evidenceFiles.length - 1))
        setImageLoading(true)
    }

    const handleNextFile = () => {
        setCurrentFileIndex(prev => (prev < evidenceFiles.length - 1 ? prev + 1 : 0))
        setImageLoading(true)
    }

    const handleDownloadAll = async () => {
        for (const file of evidenceFiles) {
            const link = document.createElement('a')
            link.href = file.file_url
            link.download = file.file_name
            link.target = '_blank'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            // Small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 300))
        }
    }

    const loadLinkedDataPoints = async () => {
        if (!evidence?.id) return
        try {
            setLoadingDataPoints(true)
            const dataPoints = await apiService.getDataPointsForEvidence(evidence.id)
            setLinkedDataPoints(dataPoints || [])
            
            // Load locations for data points that have location_id
            const locationIds = dataPoints
                .filter((dp: any) => dp.location_id)
                .map((dp: any) => dp.location_id)
            
            if (locationIds.length > 0) {
                const locationPromises = locationIds.map((id: string) =>
                    apiService.getLocation(id).catch(() => null)
                )
                const locations = await Promise.all(locationPromises)
                const locationMap: Record<string, Location> = {}
                locationIds.forEach((id: string, index: number) => {
                    if (locations[index]) {
                        locationMap[id] = locations[index]
                    }
                })
                setDataPointLocations(locationMap)
            } else {
                setDataPointLocations({})
            }
        } catch (error) {
            console.error('Failed to load linked data points:', error)
            setLinkedDataPoints([])
            setDataPointLocations({})
        } finally {
            setLoadingDataPoints(false)
        }
    }

    const loadLocation = async () => {
        if (!evidence?.location_id) return
        try {
            setLoadingLocation(true)
            const loc = await apiService.getLocation(evidence.location_id)
            setLocation(loc)
        } catch (error) {
            console.error('Failed to load location:', error)
            setLocation(null)
        } finally {
            setLoadingLocation(false)
        }
    }

    if (!isOpen || !evidence) return null

    const getEvidenceIcon = (type: string) => {
        switch (type) {
            case 'visual_proof': return Camera
            case 'documentation': return FileText
            case 'testimony': return MessageSquare
            case 'financials': return DollarSign
            default: return FileText
        }
    }

    const typeInfo = getEvidenceTypeInfo(evidence.type)
    const IconComponent = getEvidenceIcon(evidence.type)

    const currentFile = evidenceFiles[currentFileIndex]

    const isImage = (fileUrl: string) => {
        return fileUrl && (
            fileUrl.includes('.jpg') ||
            fileUrl.includes('.jpeg') ||
            fileUrl.includes('.png') ||
            fileUrl.includes('.gif') ||
            fileUrl.includes('.webp')
        )
    }

    const isPDF = (fileUrl: string) => fileUrl && fileUrl.includes('.pdf')

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                            <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">{evidence.title}</h2>
                            <p className="text-sm text-gray-600 capitalize">{evidence.type.replace('_', ' ')}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(evidence)}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(evidence)
                                    onClose()
                                }}
                                className="flex items-center space-x-2 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
                    {/* Content Preview (Left side on desktop) */}
                    {evidenceFiles.length > 0 && (
                        <div className="flex-1 p-6 flex flex-col bg-gray-50 relative">
                            {/* File counter and navigation */}
                            {evidenceFiles.length > 1 && (
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        onClick={handlePrevFile}
                                        className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-gray-600" />
                                    </button>
                                    <div className="text-sm text-gray-600 font-medium">
                                        {currentFileIndex + 1} of {evidenceFiles.length} files
                                    </div>
                                    <button
                                        onClick={handleNextFile}
                                        className="p-2 bg-white rounded-full shadow-md hover:bg-gray-100 transition-colors"
                                    >
                                        <ChevronRight className="w-5 h-5 text-gray-600" />
                                    </button>
                                </div>
                            )}

                            {/* Current file preview */}
                            <div className="flex-1 flex items-center justify-center">
                                {loadingFiles ? (
                                    <div className="flex flex-col items-center space-y-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                                        <p className="text-sm text-gray-500">Loading files...</p>
                                    </div>
                                ) : currentFile && isImage(currentFile.file_url) ? (
                                    <div className="max-w-full max-h-full relative">
                                        {imageLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg z-10">
                                                <div className="flex flex-col items-center space-y-2">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500"></div>
                                                    <p className="text-xs text-gray-500">Loading image...</p>
                                                </div>
                                            </div>
                                        )}
                                        <img
                                            src={currentFile.file_url}
                                            alt={currentFile.file_name}
                                            className="max-w-full max-h-80 object-contain rounded-lg shadow-lg"
                                            onLoad={() => setImageLoading(false)}
                                            onError={() => setImageLoading(false)}
                                        />
                                        <p className="text-xs text-gray-500 text-center mt-2">{currentFile.file_name}</p>
                                    </div>
                                ) : currentFile && isPDF(currentFile.file_url) ? (
                                    <div className="w-full max-w-md">
                                        <div className="bg-white rounded-lg border-2 border-gray-200 shadow-lg p-6">
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="p-4 bg-red-50 rounded-full">
                                                    <FileText className="w-12 h-12 text-red-600" />
                                                </div>
                                                <div className="text-center">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">PDF Document</h3>
                                                    <p className="text-sm text-gray-500 mb-4">{currentFile.file_name}</p>
                                                </div>
                                                <div className="flex space-x-3 w-full">
                                                    <a
                                                        href={currentFile.file_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 btn-primary inline-flex items-center justify-center space-x-2"
                                                    >
                                                        <ExternalLink className="w-4 h-4" />
                                                        <span>View</span>
                                                    </a>
                                                    <a
                                                        href={currentFile.file_url}
                                                        download={currentFile.file_name}
                                                        className="flex-1 btn-secondary inline-flex items-center justify-center space-x-2"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        <span>Download</span>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : currentFile ? (
                                    <div className="text-center">
                                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-sm font-medium text-gray-700 mb-2">{currentFile.file_name}</p>
                                        <p className="text-gray-500 mb-4">Preview not available for this file type</p>
                                        <div className="flex space-x-3 justify-center">
                                            <a
                                                href={currentFile.file_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="btn-primary inline-flex items-center space-x-2"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                <span>View</span>
                                            </a>
                                            <a
                                                href={currentFile.file_url}
                                                download={currentFile.file_name}
                                                className="btn-secondary inline-flex items-center space-x-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                <span>Download</span>
                                            </a>
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            {/* Thumbnail strip for multiple files */}
                            {evidenceFiles.length > 1 && (
                                <div className="mt-4 flex justify-center space-x-2 overflow-x-auto py-2">
                                    {evidenceFiles.map((file, index) => (
                                        <button
                                            key={file.id}
                                            onClick={() => {
                                                setCurrentFileIndex(index)
                                                setImageLoading(true)
                                            }}
                                            className={`flex-shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                                                index === currentFileIndex 
                                                    ? 'border-primary-500 ring-2 ring-primary-200' 
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        >
                                            {isImage(file.file_url) ? (
                                                <img 
                                                    src={file.file_url} 
                                                    alt={file.file_name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                                                    <FileText className="w-6 h-6 text-gray-400" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Download All button */}
                            {evidenceFiles.length > 1 && (
                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={handleDownloadAll}
                                        className="btn-secondary inline-flex items-center space-x-2"
                                    >
                                        <Download className="w-4 h-4" />
                                        <span>Download All ({evidenceFiles.length} files)</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Details Panel (Right side on desktop) */}
                    <div className="w-full lg:w-96 p-6 border-t lg:border-t-0 lg:border-l border-gray-200 overflow-y-auto">
                        <div className="space-y-6">
                            {/* Description */}
                            {evidence.description && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
                                    <p className="text-sm text-gray-600">{evidence.description}</p>
                                </div>
                            )}

                            {/* Date Information */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Date</h3>
                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                    <Calendar className="w-4 h-4" />
                                    <span>
                                        {evidence.date_range_start && evidence.date_range_end ? (
                                            <>Range: {formatDate(evidence.date_range_start)} - {formatDate(evidence.date_range_end)}</>
                                        ) : (
                                            <>Date: {formatDate(evidence.date_represented)}</>
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Location */}
                            {evidence.location_id && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">Location</h3>
                                    {loadingLocation ? (
                                        <div className="text-center py-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mx-auto"></div>
                                        </div>
                                    ) : location ? (
                                        <div className="flex items-start space-x-2 text-sm text-gray-600">
                                            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                            <div className="space-y-1">
                                                <p className="font-medium text-gray-700">{location.name}</p>
                                                {location.description && (
                                                    <p className="text-xs text-gray-500">{location.description}</p>
                                                )}
                                                {location.latitude && location.longitude && (
                                                    <p className="text-xs text-gray-500">
                                                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-500">Location not found</p>
                                    )}
                                </div>
                            )}

                            {/* File Information */}
                            {evidenceFiles.length > 0 && (
                                <div>
                                    <h3 className="text-sm font-medium text-gray-700 mb-2">
                                        Files ({evidenceFiles.length})
                                    </h3>
                                    <div className="space-y-2">
                                        {evidenceFiles.map((file, index) => (
                                            <div key={file.id} className="flex items-center justify-between text-sm">
                                                <span className="text-gray-600 truncate flex-1 mr-2">
                                                    {index + 1}. {file.file_name}
                                                </span>
                                                <a
                                                    href={file.file_url}
                                                    download={file.file_name}
                                                    className="text-primary-500 hover:text-primary-700"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </div>
                                        ))}
                                        {evidenceFiles.length > 1 && (
                                            <button
                                                onClick={handleDownloadAll}
                                                className="w-full mt-2 btn-secondary text-xs inline-flex items-center justify-center space-x-1"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>Download All</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Metadata */}
                            <div>
                                <h3 className="text-sm font-medium text-gray-700 mb-2">Details</h3>
                                <div className="space-y-1 text-sm text-gray-600">
                                    <p>Type: <span className="capitalize">{evidence.type.replace('_', ' ')}</span></p>
                                    {evidence.created_at && (
                                        <p>Uploaded: {formatDate(evidence.created_at.split('T')[0])}</p>
                                    )}
                                </div>
                            </div>

                            {/* Linked Impact Claims */}
                            <div>
                                <div className="flex items-center space-x-2 mb-3">
                                    <BarChart3 className="w-4 h-4 text-gray-600" />
                                    <h3 className="text-sm font-medium text-gray-700">Supporting Impact Claims</h3>
                                    <span className="text-xs text-gray-500">({linkedDataPoints.length})</span>
                                </div>
                                {loadingDataPoints ? (
                                    <div className="text-center py-4">
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-500 mx-auto"></div>
                                    </div>
                                ) : linkedDataPoints.length > 0 ? (
                                    (() => {
                                        // Group impact claims by metric
                                        const groupedByKPI: Record<string, { kpi: any, dataPoints: any[] }> = {}
                                        
                                        linkedDataPoints.forEach((dataPoint) => {
                                            const kpiId = dataPoint.kpi?.id || 'unknown'
                                            if (!groupedByKPI[kpiId]) {
                                                groupedByKPI[kpiId] = {
                                                    kpi: dataPoint.kpi,
                                                    dataPoints: []
                                                }
                                            }
                                            groupedByKPI[kpiId].dataPoints.push(dataPoint)
                                        })
                                        
                                        return (
                                            <div className="space-y-2.5">
                                                {Object.values(groupedByKPI).map((group, groupIndex) => {
                                                    // Calculate total for this metric
                                                    const total = group.dataPoints.reduce((sum, dp) => sum + (dp.value || 0), 0)
                                                    
                                                    return (
                                                        <div key={group.kpi?.id || groupIndex} className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-lg border border-blue-100/60 overflow-hidden">
                                                            {/* Metric Card Header */}
                                                            <div className="px-3 py-2.5 bg-gradient-to-r from-blue-100/80 to-indigo-100/60 border-b-2 border-blue-200/60 shadow-sm">
                                                                <div className="flex items-center space-x-2 min-w-0">
                                                                    <BarChart3 className="w-4 h-4 text-blue-700 flex-shrink-0" />
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="text-sm font-bold text-gray-900 truncate">
                                                                            {group.kpi?.title || 'Unknown Metric'}
                                                                        </div>
                                                                        <div className="flex items-baseline space-x-1 mt-0.5">
                                                                            <span className="text-sm font-bold text-blue-700">
                                                                                {total.toLocaleString()}
                                                                            </span>
                                                                            <span className="text-xs text-gray-600 font-medium">
                                                                                {group.kpi?.unit_of_measurement || ''}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            
                                                            {/* Compact Impact Claims List */}
                                                            <div className={`px-3 py-1.5 space-y-1 ${group.dataPoints.length > 3 ? 'max-h-[150px] overflow-y-auto' : ''}`}>
                                                                {group.dataPoints.map((dataPoint, idx) => {
                                                                    const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
                                                                    const displayDate = hasDateRange
                                                                        ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
                                                                        : formatDate(dataPoint.date_represented)
                                                                    
                                                                    // Calculate date coverage: how many days in the claim range the evidence covers
                                                                    let dateCoverageText = ''
                                                                    if (hasDateRange && evidence) {
                                                                        const claimStart = new Date(dataPoint.date_range_start)
                                                                        const claimEnd = new Date(dataPoint.date_range_end)
                                                                        const claimDays = Math.ceil((claimEnd.getTime() - claimStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                                        
                                                                        // Calculate how many days the evidence covers
                                                                        let coveredDays = 0
                                                                        if (evidence.date_range_start && evidence.date_range_end) {
                                                                            const evidenceStart = new Date(evidence.date_range_start)
                                                                            const evidenceEnd = new Date(evidence.date_range_end)
                                                                            const overlapStart = new Date(Math.max(claimStart.getTime(), evidenceStart.getTime()))
                                                                            const overlapEnd = new Date(Math.min(claimEnd.getTime(), evidenceEnd.getTime()))
                                                                            if (overlapEnd >= overlapStart) {
                                                                                coveredDays = Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
                                                                            }
                                                                        } else if (evidence.date_represented) {
                                                                            const evidenceDate = new Date(evidence.date_represented)
                                                                            if (evidenceDate >= claimStart && evidenceDate <= claimEnd) {
                                                                                coveredDays = 1
                                                                            }
                                                                        }
                                                                        
                                                                        dateCoverageText = `Evidence covers ${coveredDays} of ${claimDays} days`
                                                                    }
                                                                    
                                                                    const dataPointLocation = dataPoint.location_id ? dataPointLocations[dataPoint.location_id] : null

                                                                    return (
                                                                        <div 
                                                                            key={dataPoint.id} 
                                                                            onClick={() => onDataPointClick?.(dataPoint, group.kpi)}
                                                                            className={`flex items-center justify-between py-1.5 px-2 rounded-md transition-all ${
                                                                                onDataPointClick ? 'hover:bg-white/80 cursor-pointer hover:shadow-sm' : ''
                                                                            } ${idx < group.dataPoints.length - 1 ? 'border-b border-blue-100/40' : ''}`}
                                                                        >
                                                                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0"></div>
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex items-center space-x-2">
                                                                                        <span className="text-xs font-medium text-gray-900">
                                                                                            {dataPoint.value?.toLocaleString()} {group.kpi?.unit_of_measurement || ''}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-gray-500 flex items-center">
                                                                                            <Calendar className="w-2.5 h-2.5 mr-0.5" />
                                                                                            {displayDate.length > 20 ? displayDate.substring(0, 20) + '...' : displayDate}
                                                                                        </span>
                                                                                    </div>
                                                                                    {dataPointLocation && (
                                                                                        <div className="flex items-center space-x-1 text-[10px] text-gray-500 mt-0.5">
                                                                                            <MapPin className="w-2.5 h-2.5" />
                                                                                            <span className="truncate">{dataPointLocation.name}</span>
                                                                                        </div>
                                                                                    )}
                                                                                    {dateCoverageText && (
                                                                                        <div className="text-[10px] text-blue-600 font-medium mt-0.5">
                                                                                            {dateCoverageText}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )
                                    })()
                                ) : (
                                    <p className="text-sm text-gray-500 text-center py-4">No impact claims linked to this evidence</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
} 