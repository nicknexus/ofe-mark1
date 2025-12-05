import React, { useState, useEffect } from 'react'
import { X, Calendar, FileText, Camera, MessageSquare, DollarSign, ExternalLink, Download, Edit, BarChart3, MapPin, Trash2, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
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
            await new Promise(resolve => setTimeout(resolve, 300))
        }
    }

    const loadLinkedDataPoints = async () => {
        if (!evidence?.id) return
        try {
            setLoadingDataPoints(true)
            const dataPoints = await apiService.getDataPointsForEvidence(evidence.id)
            setLinkedDataPoints(dataPoints || [])
            
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

    const hasDateRange = evidence.date_range_start && evidence.date_range_end
    const displayDate = hasDateRange
        ? `${formatDate(evidence.date_range_start!)} - ${formatDate(evidence.date_range_end!)}`
        : formatDate(evidence.date_represented)

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fade-in">
            <div className="bubble-card max-w-4xl w-full max-h-[90vh] overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className={`icon-bubble ${typeInfo.color}`}>
                            <IconComponent className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Evidence</h2>
                            <p className="text-sm text-gray-500">{evidence.title}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex flex-col lg:flex-row max-h-[calc(90vh-80px)]">
                    {/* Left Side - File Preview */}
                    {evidenceFiles.length > 0 && (
                        <div className="w-full lg:w-1/2 p-6 border-r border-gray-200 overflow-y-auto">
                            <div className="sticky top-0 bg-white pb-4 mb-4 border-b border-gray-100">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="icon-bubble-sm bg-primary-100">
                                            <FileText className="w-4 h-4 text-primary-600" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-700">Files</h3>
                                        <span className="status-pill">{evidenceFiles.length}</span>
                                    </div>
                                    {evidenceFiles.length > 1 && (
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handlePrevFile}
                                                className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors border border-gray-200"
                                            >
                                                <ChevronLeft className="w-4 h-4 text-gray-600" />
                                            </button>
                                            <span className="text-xs text-gray-500 font-medium px-2">
                                                {currentFileIndex + 1} of {evidenceFiles.length}
                                            </span>
                                            <button
                                                onClick={handleNextFile}
                                                className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors border border-gray-200"
                                            >
                                                <ChevronRight className="w-4 h-4 text-gray-600" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* File Preview */}
                            <div className="flex items-center justify-center min-h-[400px] bg-gray-50 rounded-xl p-6 mb-4">
                                {loadingFiles ? (
                                    <div className="flex flex-col items-center space-y-2">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                                        <p className="text-sm text-gray-500">Loading files...</p>
                                    </div>
                                ) : currentFile && isImage(currentFile.file_url) ? (
                                    <div className="max-w-full max-h-[500px] relative">
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
                                            className="max-w-full max-h-[500px] object-contain rounded-lg shadow-lg"
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

                            {/* Thumbnail strip */}
                            {evidenceFiles.length > 1 && (
                                <div className="flex justify-center space-x-2 overflow-x-auto py-2 mb-4">
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

                            {/* Download All */}
                            {evidenceFiles.length > 1 && (
                                <div className="flex justify-center">
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

                    {/* Right Side - Details */}
                    <div className="w-full lg:w-1/2 p-6 overflow-y-auto">
                        {/* Main Evidence Display */}
                        <div className="bg-gradient-to-br from-primary-50/80 to-primary-50/40 rounded-2xl p-6 border border-primary-100/60 mb-6">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-primary-600 mb-2 uppercase tracking-wide">Evidence Type</p>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-lg ${typeInfo.color}`}>
                                            <IconComponent className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-gray-900">{typeInfo.label}</h3>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Info Grid */}
                        <div className="grid grid-cols-1 gap-4 mb-6">
                            {/* Date */}
                            <div className="bubble-card p-4">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="icon-bubble-sm bg-primary-100">
                                        <Calendar className="w-4 h-4 text-primary-600" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-700">
                                        {hasDateRange ? 'Date Range' : 'Date'}
                                    </h3>
                                </div>
                                <p className="text-base font-medium text-gray-900 ml-12">
                                    {displayDate}
                                </p>
                            </div>

                            {/* Location */}
                            {evidence.location_id && (
                                <div className="bubble-card p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="icon-bubble-sm bg-orange-100">
                                            <MapPin className="w-4 h-4 text-orange-600" />
                                        </div>
                                        <h3 className="text-sm font-semibold text-gray-700">Location</h3>
                                    </div>
                                    {loadingLocation ? (
                                        <div className="ml-12">
                                            <div className="animate-pulse h-4 bg-gray-200 rounded w-32"></div>
                                        </div>
                                    ) : location ? (
                                        <div className="ml-12">
                                            <p className="text-base font-medium text-gray-900">{location.name}</p>
                                            {location.description && (
                                                <p className="text-xs text-gray-500 mt-1">{location.description}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-400 ml-12">Location not found</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Description */}
                        {evidence.description && (
                            <div className="bubble-card p-4 mb-6">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="icon-bubble-sm bg-purple-100">
                                        <MessageSquare className="w-4 h-4 text-purple-600" />
                                    </div>
                                    <h3 className="text-sm font-semibold text-gray-700">Description</h3>
                                </div>
                                <p className="text-gray-700 ml-12 whitespace-pre-wrap">{evidence.description}</p>
                            </div>
                        )}

                        {/* Linked Impact Claims - Blue Branded */}
                        <div className="bubble-card p-5">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="icon-bubble-sm bg-blue-100">
                                    <BarChart3 className="w-4 h-4 text-blue-600" />
                                </div>
                                <h3 className="text-sm font-semibold text-gray-700">Supporting Impact Claims</h3>
                                <span className="status-pill">{linkedDataPoints.length}</span>
                            </div>
                            {loadingDataPoints ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                                </div>
                            ) : linkedDataPoints.length > 0 ? (
                                (() => {
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
                                                        
                                                        {/* Impact Claims List */}
                                                        <div className={`px-3 py-1.5 space-y-1 ${group.dataPoints.length > 3 ? 'max-h-[150px] overflow-y-auto' : ''}`}>
                                                            {group.dataPoints.map((dataPoint, idx) => {
                                                                const hasDateRange = dataPoint.date_range_start && dataPoint.date_range_end
                                                                const displayDate = hasDateRange
                                                                    ? `${formatDate(dataPoint.date_range_start)} - ${formatDate(dataPoint.date_range_end)}`
                                                                    : formatDate(dataPoint.date_represented)
                                                                
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
                                                                            </div>
                                                                        </div>
                                                                        {onDataPointClick && (
                                                                            <Eye className="w-3 h-3 text-gray-400 ml-2 flex-shrink-0" />
                                                                        )}
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
                                <div className="text-center py-8">
                                    <div className="icon-bubble mx-auto mb-3 bg-gray-100">
                                        <BarChart3 className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <p className="text-sm text-gray-500">No impact claims linked to this evidence</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between p-5 border-t border-gray-100 bg-gray-50/50">
                    <div>
                        {onDelete && (
                            <button
                                onClick={() => {
                                    onDelete(evidence)
                                    onClose()
                                }}
                                className="flex items-center gap-2 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-medium"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete Evidence</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="btn-secondary py-2.5 px-5 text-sm"
                        >
                            Close
                        </button>
                        {onEdit && (
                            <button
                                onClick={() => {
                                    onEdit(evidence)
                                    onClose()
                                }}
                                className="btn-primary flex items-center gap-2 py-2.5 px-5 text-sm"
                            >
                                <Edit className="w-4 h-4" />
                                <span>Edit Evidence</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
