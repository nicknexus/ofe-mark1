import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Calendar, MapPin, Users, FileText, Eye, Edit, Trash2, Plus, Camera, MessageSquare, DollarSign } from 'lucide-react'
import { apiService } from '../../services/api'
import { Evidence, Location, BeneficiaryGroup } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import EvidencePreviewModal from '../EvidencePreviewModal'
import AddEvidenceModal from '../AddEvidenceModal'
import toast from 'react-hot-toast'

interface EvidenceTabProps {
    initiativeId: string
    onRefresh?: () => void
}

export default function EvidenceTab({ initiativeId, onRefresh }: EvidenceTabProps) {
    const [evidence, setEvidence] = useState<Evidence[]>([])
    const [loading, setLoading] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
    const [availableKPIs, setAvailableKPIs] = useState<any[]>([])
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
    const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
    const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Master filter state
    const [datePickerValue, setDatePickerValue] = useState<{
        singleDate?: string
        startDate?: string
        endDate?: string
    }>({})
    const [selectedLocations, setSelectedLocations] = useState<string[]>([])
    const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])
    const [selectedEvidenceTypes, setSelectedEvidenceTypes] = useState<string[]>([])
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
    const [showEvidenceTypePicker, setShowEvidenceTypePicker] = useState(false)
    const locationButtonRef = useRef<HTMLButtonElement>(null)
    const beneficiaryButtonRef = useRef<HTMLButtonElement>(null)
    const evidenceTypeButtonRef = useRef<HTMLButtonElement>(null)
    const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
    const [beneficiaryDropdownPosition, setBeneficiaryDropdownPosition] = useState({ top: 0, left: 0 })
    const [evidenceTypeDropdownPosition, setEvidenceTypeDropdownPosition] = useState({ top: 0, left: 0 })

    const evidenceTypes = [
        { value: 'visual_proof', label: 'Visual Support', icon: Camera },
        { value: 'documentation', label: 'Documentation', icon: FileText },
        { value: 'testimony', label: 'Testimony', icon: MessageSquare },
        { value: 'financials', label: 'Financials', icon: DollarSign }
    ] as const

    // Load locations, beneficiary groups, and KPIs
    useEffect(() => {
        if (initiativeId) {
            Promise.all([
                apiService.getLocations(initiativeId),
                apiService.getBeneficiaryGroups(initiativeId),
                apiService.getKPIs(initiativeId)
            ]).then(([locs, groups, kpis]) => {
                setLocations(locs || [])
                setBeneficiaryGroups(groups || [])
                setAvailableKPIs(kpis || [])
            }).catch(() => {
                setLocations([])
                setBeneficiaryGroups([])
                setAvailableKPIs([])
            })
        }
    }, [initiativeId])

    // Load evidence with filters
    useEffect(() => {
        loadEvidence()
    }, [initiativeId, selectedLocations, selectedBeneficiaryGroups, selectedEvidenceTypes, datePickerValue, searchQuery])

    const loadEvidence = async () => {
        if (!initiativeId) return
        try {
            setLoading(true)
            // Get all evidence for the initiative
            const allEvidence = await apiService.getEvidence(initiativeId)
            
            // Apply client-side filters since API doesn't support all filters
            let filtered = allEvidence || []

            // Filter by search query
            if (searchQuery.trim()) {
                const query = searchQuery.trim().toLowerCase()
                filtered = filtered.filter(ev => 
                    ev.title?.toLowerCase().includes(query) ||
                    ev.description?.toLowerCase().includes(query)
                )
            }

            // Filter by date range
            if (datePickerValue.startDate || datePickerValue.endDate || datePickerValue.singleDate) {
                const filterDate = datePickerValue.singleDate || datePickerValue.startDate
                const endDate = datePickerValue.endDate || datePickerValue.singleDate
                
                filtered = filtered.filter(ev => {
                    const evDate = ev.date_represented || ev.date_range_start
                    if (!evDate) return false
                    
                    if (filterDate && endDate) {
                        return evDate >= filterDate && evDate <= endDate
                    } else if (filterDate) {
                        return evDate >= filterDate
                    }
                    return true
                })
            }

            // Filter by location (via linked KPIs)
            if (selectedLocations.length > 0) {
                // Note: This is a simplified filter - in a real implementation,
                // you'd need to check evidence linked to KPIs with those locations
                // For now, we'll filter evidence that has location_id if available
                filtered = filtered.filter(ev => {
                    // If evidence has location_id, check if it's selected
                    if (ev.location_id) {
                        return selectedLocations.includes(ev.location_id)
                    }
                    // Otherwise, include it (evidence might be linked via KPIs)
                    return true
                })
            }

            // Filter by beneficiary groups (via linked KPIs and locations)
            if (selectedBeneficiaryGroups.length > 0) {
                // Get location IDs from selected beneficiary groups
                const locationIdsFromBeneficiaries = beneficiaryGroups
                    .filter(bg => selectedBeneficiaryGroups.includes(bg.id!))
                    .map(bg => bg.location_id)
                    .filter(Boolean) as string[]

                filtered = filtered.filter(ev => {
                    // If evidence has location_id that matches beneficiary group locations
                    if (ev.location_id && locationIdsFromBeneficiaries.includes(ev.location_id)) {
                        return true
                    }
                    // Otherwise, include it (evidence might be linked via KPIs)
                    return true
                })
            }

            // Filter by evidence type
            if (selectedEvidenceTypes.length > 0) {
                filtered = filtered.filter(ev => selectedEvidenceTypes.includes(ev.type))
            }

            setEvidence(filtered)
        } catch (error) {
            console.error('Error loading evidence:', error)
            toast.error('Failed to load evidence')
            setEvidence([])
        } finally {
            setLoading(false)
        }
    }

    const handleViewEvidence = (ev: Evidence) => {
        setSelectedEvidence(ev)
        setIsPreviewModalOpen(true)
    }

    const handleEditEvidence = async (ev: Evidence) => {
        setIsPreviewModalOpen(false)
        setSelectedEvidence(null)
        // Ensure we have the full evidence data before opening edit modal
        try {
            const fullEvidence = await apiService.getEvidenceItem(ev.id!)
            setEditingEvidence(fullEvidence)
            setIsAddModalOpen(true)
        } catch (error) {
            console.error('Error loading evidence for edit:', error)
            toast.error('Failed to load evidence details')
            // Fallback to using the evidence we have
            setEditingEvidence(ev)
            setIsAddModalOpen(true)
        }
    }

    const handleDeleteEvidence = async (evidence: Evidence) => {
        if (!evidence.id) return
        if (!confirm('Are you sure you want to delete this evidence?')) return
        try {
            await apiService.deleteEvidence(evidence.id)
            toast.success('Evidence deleted successfully')
            loadEvidence()
            onRefresh?.()
        } catch (error) {
            toast.error('Failed to delete evidence')
        }
    }

    const handleSaveEvidence = async () => {
        apiService.clearCache('/evidence')
        await loadEvidence()
        onRefresh?.()
    }

    // Filter dropdown positioning
    useEffect(() => {
        if (showLocationPicker && locationButtonRef.current) {
            const rect = locationButtonRef.current.getBoundingClientRect()
            setLocationDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [showLocationPicker])

    useEffect(() => {
        if (showBeneficiaryPicker && beneficiaryButtonRef.current) {
            const rect = beneficiaryButtonRef.current.getBoundingClientRect()
            setBeneficiaryDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [showBeneficiaryPicker])

    useEffect(() => {
        if (showEvidenceTypePicker && evidenceTypeButtonRef.current) {
            const rect = evidenceTypeButtonRef.current.getBoundingClientRect()
            setEvidenceTypeDropdownPosition({
                top: rect.bottom + 4,
                left: rect.left
            })
        }
    }, [showEvidenceTypePicker])

    const hasActiveFilters = selectedLocations.length > 0 || selectedBeneficiaryGroups.length > 0 || 
        selectedEvidenceTypes.length > 0 || datePickerValue.singleDate || (datePickerValue.startDate && datePickerValue.endDate)

    const clearFilters = () => {
        setSelectedLocations([])
        setSelectedBeneficiaryGroups([])
        setSelectedEvidenceTypes([])
        setDatePickerValue({})
    }

    return (
        <div className="h-[calc(100vh-64px)] bg-gradient-to-br from-slate-50 via-white to-green-50/30 overflow-hidden flex flex-col">
            {/* Header with Search and Add Button */}
            <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Evidence</h2>
                        <p className="text-sm text-gray-500">View and manage all evidence uploaded for this initiative</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingEvidence(null)
                            setIsAddModalOpen(true)
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Evidence</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search evidence by title or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                </div>

                {/* Master Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Date Filter */}
                    <div className="relative">
                        <DateRangePicker
                            value={datePickerValue}
                            onChange={setDatePickerValue}
                            placeholder="Filter by date"
                        />
                    </div>

                    {/* Location Filter */}
                    <div className="relative">
                        <button
                            ref={locationButtonRef}
                            onClick={() => setShowLocationPicker(!showLocationPicker)}
                            className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                selectedLocations.length > 0
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <MapPin className="w-4 h-4" />
                            <span>
                                {selectedLocations.length === 0
                                    ? 'Location'
                                    : selectedLocations.length === 1
                                    ? locations.find(l => l.id === selectedLocations[0])?.name || '1 location'
                                    : `${selectedLocations.length} locations`}
                            </span>
                            {selectedLocations.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedLocations([])
                                    }}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </button>

                        {showLocationPicker && locationButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowLocationPicker(false)}
                                />
                                <div
                                    className="fixed z-[9999] mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${locationDropdownPosition.top}px`,
                                        left: `${locationDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-2">
                                        {locations.length === 0 ? (
                                            <p className="text-sm text-gray-500 p-2">No locations available</p>
                                        ) : (
                                            locations.map((location) => (
                                                <label
                                                    key={location.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLocations.includes(location.id!)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedLocations([...selectedLocations, location.id!])
                                                            } else {
                                                                setSelectedLocations(selectedLocations.filter(id => id !== location.id))
                                                            }
                                                        }}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{location.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>,
                            document.body
                        )}
                    </div>

                    {/* Beneficiary Group Filter */}
                    <div className="relative">
                        <button
                            ref={beneficiaryButtonRef}
                            onClick={() => setShowBeneficiaryPicker(!showBeneficiaryPicker)}
                            className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                selectedBeneficiaryGroups.length > 0
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            <span>
                                {selectedBeneficiaryGroups.length === 0
                                    ? 'Beneficiary Group'
                                    : selectedBeneficiaryGroups.length === 1
                                    ? beneficiaryGroups.find(bg => bg.id === selectedBeneficiaryGroups[0])?.name || '1 group'
                                    : `${selectedBeneficiaryGroups.length} groups`}
                            </span>
                            {selectedBeneficiaryGroups.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedBeneficiaryGroups([])
                                    }}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </button>

                        {showBeneficiaryPicker && beneficiaryButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowBeneficiaryPicker(false)}
                                />
                                <div
                                    className="fixed z-[9999] mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${beneficiaryDropdownPosition.top}px`,
                                        left: `${beneficiaryDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-2">
                                        {beneficiaryGroups.length === 0 ? (
                                            <p className="text-sm text-gray-500 p-2">No beneficiary groups available</p>
                                        ) : (
                                            beneficiaryGroups.map((group) => (
                                                <label
                                                    key={group.id}
                                                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedBeneficiaryGroups.includes(group.id!)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedBeneficiaryGroups([...selectedBeneficiaryGroups, group.id!])
                                                            } else {
                                                                setSelectedBeneficiaryGroups(selectedBeneficiaryGroups.filter(id => id !== group.id))
                                                            }
                                                        }}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <span className="text-sm text-gray-700">{group.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>,
                            document.body
                        )}
                    </div>

                    {/* Evidence Type Filter */}
                    <div className="relative">
                        <button
                            ref={evidenceTypeButtonRef}
                            onClick={() => setShowEvidenceTypePicker(!showEvidenceTypePicker)}
                            className={`flex items-center space-x-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
                                selectedEvidenceTypes.length > 0
                                    ? 'bg-green-50 border-green-300 text-green-700'
                                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            <span>
                                {selectedEvidenceTypes.length === 0
                                    ? 'Evidence Type'
                                    : selectedEvidenceTypes.length === 1
                                    ? evidenceTypes.find(et => et.value === selectedEvidenceTypes[0])?.label || '1 type'
                                    : `${selectedEvidenceTypes.length} types`}
                            </span>
                            {selectedEvidenceTypes.length > 0 && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setSelectedEvidenceTypes([])
                                    }}
                                    className="ml-1 text-green-600 hover:text-green-800"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </button>

                        {showEvidenceTypePicker && evidenceTypeButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowEvidenceTypePicker(false)}
                                />
                                <div
                                    className="fixed z-[9999] mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${evidenceTypeDropdownPosition.top}px`,
                                        left: `${evidenceTypeDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="p-2">
                                        {evidenceTypes.map((type) => {
                                            const typeInfo = getEvidenceTypeInfo(type.value)
                                            const bgColor = typeInfo.color.split(' ')[0]
                                            return (
                                                <label
                                                    key={type.value}
                                                    className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEvidenceTypes.includes(type.value)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedEvidenceTypes([...selectedEvidenceTypes, type.value])
                                                            } else {
                                                                setSelectedEvidenceTypes(selectedEvidenceTypes.filter(t => t !== type.value))
                                                            }
                                                        }}
                                                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                    />
                                                    <div className={`w-6 h-6 ${bgColor} rounded flex items-center justify-center`}>
                                                        {React.createElement(type.icon, { className: 'w-4 h-4' })}
                                                    </div>
                                                    <span className="text-sm text-gray-700">{type.label}</span>
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            </>,
                            document.body
                        )}
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                            <X className="w-4 h-4" />
                            <span>Clear Filters</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Evidence List */}
            <div className="flex-1 overflow-y-auto bg-white">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                    </div>
                ) : evidence.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <FileText className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">No evidence found</p>
                        <p className="text-sm mb-4">
                            {hasActiveFilters || searchQuery
                                ? 'Try adjusting your filters or search query'
                                : 'Add your first evidence to support your impact claims'}
                        </p>
                        {!hasActiveFilters && !searchQuery && (
                            <button
                                onClick={() => {
                                    setEditingEvidence(null)
                                    setIsAddModalOpen(true)
                                }}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Add Evidence
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-gray-200">
                        {/* Header Row */}
                        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                            <div className="col-span-1"></div>
                            <div className="col-span-5">Name</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2"></div>
                        </div>

                        {/* Evidence Items */}
                        {evidence.map((ev) => {
                            const typeInfo = getEvidenceTypeInfo(ev.type)
                            // Extract background color from typeInfo.color (e.g., "bg-pink-100 text-pink-800" -> "bg-pink-100")
                            const bgColor = typeInfo.color.split(' ')[0]
                            const evidenceType = evidenceTypes.find(et => et.value === ev.type)
                            const IconComponent = evidenceType?.icon || FileText
                            
                            return (
                                <div
                                    key={ev.id}
                                    className="px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer group grid grid-cols-12 gap-4 items-center"
                                    onClick={() => handleViewEvidence(ev)}
                                >
                                    {/* Icon */}
                                    <div className="col-span-1 flex items-center justify-center">
                                        <div className={`p-2 rounded-lg ${bgColor}`}>
                                            <IconComponent className="w-4 h-4" />
                                        </div>
                                    </div>

                                    {/* Name */}
                                    <div className="col-span-5 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                            {ev.title || 'Untitled Evidence'}
                                        </div>
                                        {ev.description && (
                                            <div className="text-sm text-gray-500 truncate mt-0.5">
                                                {ev.description}
                                            </div>
                                        )}
                                    </div>

                                    {/* Type */}
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                                            {typeInfo.label}
                                        </span>
                                    </div>

                                    {/* Date */}
                                    <div className="col-span-2 text-sm text-gray-600">
                                        {formatDate(ev.date_represented)}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 flex items-center justify-end space-x-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleViewEvidence(ev)
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="View"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                handleEditEvidence(ev)
                                            }}
                                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Evidence Preview Modal */}
            {isPreviewModalOpen && selectedEvidence && (
                <EvidencePreviewModal
                    isOpen={isPreviewModalOpen}
                    onClose={() => {
                        setIsPreviewModalOpen(false)
                        setSelectedEvidence(null)
                    }}
                    evidence={selectedEvidence}
                    onEdit={handleEditEvidence}
                    onDelete={handleDeleteEvidence}
                    onDataPointClick={(dataPoint) => {
                        // Navigate to metric detail if needed
                        console.log('Data point clicked:', dataPoint)
                    }}
                />
            )}

            {/* Add/Edit Evidence Modal */}
            {isAddModalOpen && (
                <AddEvidenceModal
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false)
                        setEditingEvidence(null)
                    }}
                    onSubmit={handleSaveEvidence}
                    availableKPIs={availableKPIs}
                    initiativeId={initiativeId}
                    editData={editingEvidence}
                />
            )}
        </div>
    )
}

