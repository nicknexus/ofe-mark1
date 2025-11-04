import React, { useState, useEffect } from 'react'
import { X, MapPin, BarChart3, FileText, Calendar, Info, Loader2, ExternalLink } from 'lucide-react'
import { Location, KPIUpdate, Evidence } from '../types'
import { apiService } from '../services/api'

interface LocationDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    location: Location | null
    onLocationClick?: (location: Location) => void
    refreshKey?: number // Key to trigger refresh when updates/evidence change
}

export default function LocationDetailsModal({
    isOpen,
    onClose,
    location,
    onLocationClick,
    refreshKey,
}: LocationDetailsModalProps) {
    const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isOpen && location?.id) {
            setLoading(true)
            Promise.all([
                apiService.getLocationKPIUpdates(location.id),
                apiService.getLocationEvidence(location.id),
            ])
                .then(([updates, ev]) => {
                    setKpiUpdates(updates || [])
                    setEvidence(ev || [])
                })
                .catch((error) => {
                    console.error('Failed to fetch location data:', error)
                    setKpiUpdates([])
                    setEvidence([])
                })
                .finally(() => {
                    setLoading(false)
                })
        } else {
            setKpiUpdates([])
            setEvidence([])
        }
    }, [isOpen, location?.id, refreshKey])

    if (!isOpen || !location) return null

    const evidenceTypeColors: Record<string, string> = {
        visual_proof: 'bg-purple-100 text-purple-700 border-purple-200',
        documentation: 'bg-blue-100 text-blue-700 border-blue-200',
        testimony: 'bg-green-100 text-green-700 border-green-200',
        financials: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    }

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const formatDateRange = (start?: string, end?: string) => {
        if (!start && !end) return null
        if (start && end) {
            return `${formatDate(start)} - ${formatDate(end)}`
        }
        return start ? formatDate(start) : formatDate(end!)
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
            <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-gray-200 flex-shrink-0">
                    <div className="flex items-start space-x-4 flex-1">
                        <div className="p-3 bg-green-100 rounded-xl">
                            <MapPin className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">{location.name}</h2>
                            {location.description && (
                                <p className="text-gray-600 mb-3">{location.description}</p>
                            )}
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                                <div className="flex items-center space-x-2">
                                    <Info className="w-4 h-4" />
                                    <span>
                                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                                    </span>
                                </div>
                                {location.created_at && (
                                    <div className="flex items-center space-x-2">
                                        <Calendar className="w-4 h-4" />
                                        <span>Created {formatDate(location.created_at)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1 transition-colors flex-shrink-0"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                            <span className="ml-3 text-gray-600">Loading location data...</span>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Impact Claims Section */}
                            <div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <BarChart3 className="w-5 h-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Impact Claims</h3>
                                        <p className="text-sm text-gray-500">
                                            {kpiUpdates.length} {kpiUpdates.length === 1 ? 'impact claim' : 'impact claims'}{' '}
                                            linked to this location
                                        </p>
                                    </div>
                                </div>

                                {kpiUpdates.length === 0 ? (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                                        <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No impact claims linked to this location yet</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Add impact claims and link them to this location when creating KPI updates
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {kpiUpdates.map((update: any) => (
                                            <div
                                                key={update.id}
                                                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">
                                                            {update.kpis?.title || 'Unknown KPI'}
                                                        </h4>
                                                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                                                            <span className="font-medium text-gray-900">
                                                                {update.value} {update.kpis?.unit_of_measurement || ''}
                                                            </span>
                                                            {update.kpis?.metric_type && (
                                                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">
                                                                    {update.kpis.metric_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-100">
                                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>
                                                            {update.date_range_start && update.date_range_end
                                                                ? formatDateRange(update.date_range_start, update.date_range_end)
                                                                : formatDate(update.date_represented)}
                                                        </span>
                                                    </div>
                                                    {update.label && (
                                                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                                                            {update.label}
                                                        </span>
                                                    )}
                                                </div>
                                                {update.note && (
                                                    <p className="text-sm text-gray-600 mt-2 pt-2 border-t border-gray-100">
                                                        {update.note}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Evidence Section */}
                            <div>
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                        <FileText className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-gray-900">Evidence</h3>
                                        <p className="text-sm text-gray-500">
                                            {evidence.length} {evidence.length === 1 ? 'evidence item' : 'evidence items'}{' '}
                                            linked to this location
                                        </p>
                                    </div>
                                </div>

                                {evidence.length === 0 ? (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-gray-500">No evidence linked to this location yet</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Add evidence and link it to this location when uploading
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {evidence.map((ev) => (
                                            <div
                                                key={ev.id}
                                                className="bg-white border border-gray-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all"
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-900 mb-1">{ev.title}</h4>
                                                        <div className="flex items-center space-x-2">
                                                            <span
                                                                className={`text-xs px-2 py-1 rounded border capitalize ${evidenceTypeColors[ev.type || ''] ||
                                                                    'bg-gray-100 text-gray-700 border-gray-200'
                                                                    }`}
                                                            >
                                                                {ev.type?.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                {ev.description && (
                                                    <p className="text-sm text-gray-600 mt-2">{ev.description}</p>
                                                )}
                                                <div className="flex items-center space-x-4 mt-3 pt-3 border-t border-gray-100">
                                                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                                                        <Calendar className="w-3.5 h-3.5" />
                                                        <span>
                                                            {ev.date_range_start && ev.date_range_end
                                                                ? formatDateRange(ev.date_range_start, ev.date_range_end)
                                                                : formatDate(ev.date_represented)}
                                                        </span>
                                                    </div>
                                                    {ev.file_url && (
                                                        <a
                                                            href={ev.file_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-700"
                                                        >
                                                            <ExternalLink className="w-3.5 h-3.5" />
                                                            <span>View File</span>
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 p-4 flex items-center justify-between flex-shrink-0">
                    <p className="text-sm text-gray-500">
                        Click location in sidebar to edit
                    </p>
                    <div className="flex space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                        >
                            Close
                        </button>
                        {onLocationClick && (
                            <button
                                onClick={() => {
                                    onClose()
                                    onLocationClick(location)
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Edit in Sidebar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

