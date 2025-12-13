import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, X, Calendar, MapPin, Users, FileText, Eye, Edit, Trash2, Plus, Camera, MessageSquare, DollarSign, ChevronDown } from 'lucide-react'
import { apiService } from '../../services/api'
import { Evidence, Location, BeneficiaryGroup } from '../../types'
import { formatDate, getEvidenceTypeInfo } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import EvidencePreviewModal from '../EvidencePreviewModal'
import DataPointPreviewModal from '../DataPointPreviewModal'
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
    const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null)
    const [selectedDataPointKpi, setSelectedDataPointKpi] = useState<any>(null)
    const [isDataPointPreviewOpen, setIsDataPointPreviewOpen] = useState(false)

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
        { value: 'testimony', label: 'Testemonies', icon: MessageSquare },
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

    const handleSaveEvidence = async (evidenceData: any) => {
        try {
            if (editingEvidence?.id) {
                // Update existing evidence
                await apiService.updateEvidence(editingEvidence.id, evidenceData)
                toast.success('Evidence updated successfully!')
            } else {
                // Create new evidence
                await apiService.createEvidence(evidenceData)
                toast.success('Evidence added successfully!')
            }

            apiService.clearCache('/evidence')
            await loadEvidence()
            onRefresh?.()
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save evidence'
            toast.error(message)
            throw error
        }
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
        <div className="h-screen overflow-hidden flex flex-col">
            {/* Header with Search and Add Button */}
            <div className="p-4 sm:p-6 border-b border-gray-100 bg-white shadow-bubble-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-800">Evidence</h2>
                        <p className="text-sm text-gray-500">View and manage all evidence uploaded for this initiative</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingEvidence(null)
                            setIsAddModalOpen(true)
                        }}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-evidence-500/25"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Evidence</span>
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-3">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search evidence by title or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-2.5 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-evidence-400 focus:border-transparent bg-gray-50/50 text-sm"
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
                            className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${selectedLocations.length > 0
                                ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedLocations.length > 0
                                ? 'bg-primary-100 border-primary-500'
                                : 'bg-gray-100 border-gray-200'
                                }`}>
                                <MapPin className={`w-5 h-5 ${selectedLocations.length > 0
                                    ? 'text-primary-500'
                                    : 'text-gray-600'
                                    }`} />
                            </div>
                            <span className="ml-3">
                                {selectedLocations.length === 0
                                    ? 'Location'
                                    : selectedLocations.length === 1
                                        ? locations.find(l => l.id === selectedLocations[0])?.name || '1 location'
                                        : `${selectedLocations.length} locations`}
                            </span>
                            {selectedLocations.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedLocations.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
                        </button>

                        {showLocationPicker && locationButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowLocationPicker(false)}
                                />
                                <div
                                    className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${locationDropdownPosition.top}px`,
                                        left: `${locationDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {locations.length === 0 ? (
                                        <p className="text-xs text-gray-500">No locations available</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-gray-700">Select Locations</span>
                                                {selectedLocations.length > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedLocations([])
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-800"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {locations.map((location) => (
                                                <label
                                                    key={location.id}
                                                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
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
                                                        className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                                    />
                                                    <span className="text-xs text-gray-700 truncate flex-1">{location.name}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
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
                            className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${selectedBeneficiaryGroups.length > 0
                                ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedBeneficiaryGroups.length > 0
                                ? 'bg-primary-100 border-primary-500'
                                : 'bg-gray-100 border-gray-200'
                                }`}>
                                <Users className={`w-5 h-5 ${selectedBeneficiaryGroups.length > 0
                                    ? 'text-primary-500'
                                    : 'text-gray-600'
                                    }`} />
                            </div>
                            <span className="ml-3">
                                {selectedBeneficiaryGroups.length === 0
                                    ? 'Beneficiary Group'
                                    : selectedBeneficiaryGroups.length === 1
                                        ? beneficiaryGroups.find(bg => bg.id === selectedBeneficiaryGroups[0])?.name || '1 group'
                                        : `${selectedBeneficiaryGroups.length} groups`}
                            </span>
                            {selectedBeneficiaryGroups.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedBeneficiaryGroups.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showBeneficiaryPicker ? 'rotate-180' : ''}`} />
                        </button>

                        {showBeneficiaryPicker && beneficiaryButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowBeneficiaryPicker(false)}
                                />
                                <div
                                    className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${beneficiaryDropdownPosition.top}px`,
                                        left: `${beneficiaryDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {beneficiaryGroups.length === 0 ? (
                                        <p className="text-xs text-gray-500">No beneficiary groups available</p>
                                    ) : (
                                        <>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-gray-700">Select Beneficiary Groups</span>
                                                {selectedBeneficiaryGroups.length > 0 && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            setSelectedBeneficiaryGroups([])
                                                        }}
                                                        className="text-xs text-blue-600 hover:text-blue-800"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                            </div>
                                            {beneficiaryGroups.map((group) => (
                                                <label
                                                    key={group.id}
                                                    className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
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
                                                        className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                                    />
                                                    <span className="text-xs text-gray-700 truncate flex-1">{group.name}</span>
                                                </label>
                                            ))}
                                        </>
                                    )}
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
                            className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${selectedEvidenceTypes.length > 0
                                ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                                : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                        >
                            <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedEvidenceTypes.length > 0
                                ? 'bg-primary-100 border-primary-500'
                                : 'bg-gray-100 border-gray-200'
                                }`}>
                                <FileText className={`w-5 h-5 ${selectedEvidenceTypes.length > 0
                                    ? 'text-primary-500'
                                    : 'text-gray-600'
                                    }`} />
                            </div>
                            <span className="ml-3">
                                {selectedEvidenceTypes.length === 0
                                    ? 'Evidence Type'
                                    : selectedEvidenceTypes.length === 1
                                        ? evidenceTypes.find(et => et.value === selectedEvidenceTypes[0])?.label || '1 type'
                                        : `${selectedEvidenceTypes.length} types`}
                            </span>
                            {selectedEvidenceTypes.length > 0 && (
                                <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">
                                    {selectedEvidenceTypes.length}
                                </span>
                            )}
                            <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showEvidenceTypePicker ? 'rotate-180' : ''}`} />
                        </button>

                        {showEvidenceTypePicker && evidenceTypeButtonRef.current && createPortal(
                            <>
                                <div
                                    className="fixed inset-0 z-[9998]"
                                    onClick={() => setShowEvidenceTypePicker(false)}
                                />
                                <div
                                    className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                                    style={{
                                        top: `${evidenceTypeDropdownPosition.top}px`,
                                        left: `${evidenceTypeDropdownPosition.left}px`
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Evidence Types</span>
                                        {selectedEvidenceTypes.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    setSelectedEvidenceTypes([])
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-800"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                    {evidenceTypes.map((type) => {
                                        const typeInfo = getEvidenceTypeInfo(type.value)
                                        const bgColor = typeInfo.color.split(' ')[0]
                                        return (
                                            <label
                                                key={type.value}
                                                className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
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
                                                    className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                                />
                                                <div className={`w-6 h-6 ${bgColor} rounded flex items-center justify-center`}>
                                                    {React.createElement(type.icon, { className: 'w-4 h-4' })}
                                                </div>
                                                <span className="text-xs text-gray-700 truncate flex-1">{type.label}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </>,
                            document.body
                        )}
                    </div>

                    {/* Clear Filters */}
                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="flex items-center space-x-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200"
                        >
                            <X className="w-4 h-4" />
                            <span>Clear</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Evidence List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-evidence-400"></div>
                    </div>
                ) : evidence.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 p-12 text-center">
                        <div className="icon-bubble mx-auto mb-4">
                            <FileText className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">No evidence found</h3>
                        <p className="text-gray-500 text-sm mb-6">
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
                                className="px-5 py-2.5 bg-evidence-500 hover:bg-evidence-600 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-evidence-500/25"
                            >
                                Add Evidence
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl shadow-bubble border border-gray-100 overflow-hidden">
                        {/* Header Row */}
                        <div className="px-6 py-3 bg-gray-50/50 border-b border-gray-100 grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
                            <div className="col-span-1"></div>
                            <div className="col-span-5">Name</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-2">Date</div>
                            <div className="col-span-2"></div>
                        </div>

                        {/* Evidence Items */}
                        <div className="divide-y divide-gray-100">
                            {evidence.map((ev) => {
                                const typeInfo = getEvidenceTypeInfo(ev.type)
                                // Extract background color from typeInfo.color (e.g., "bg-pink-100 text-pink-800" -> "bg-pink-100")
                                const bgColor = typeInfo.color.split(' ')[0]
                                const evidenceType = evidenceTypes.find(et => et.value === ev.type)
                                const IconComponent = evidenceType?.icon || FileText

                                return (
                                    <div
                                        key={ev.id}
                                        className="px-6 py-4 hover:bg-gray-50/50 transition-all duration-200 cursor-pointer group grid grid-cols-12 gap-4 items-center"
                                        onClick={() => handleViewEvidence(ev)}
                                    >
                                        {/* Icon */}
                                        <div className="col-span-1 flex items-center justify-center">
                                            <div className={`p-2 rounded-xl ${bgColor}`}>
                                                <IconComponent className="w-4 h-4" />
                                            </div>
                                        </div>

                                        {/* Name */}
                                        <div className="col-span-5 min-w-0">
                                            <div className="font-medium text-gray-800 truncate">
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
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                                                {typeInfo.label}
                                            </span>
                                        </div>

                                        {/* Date */}
                                        <div className="col-span-2 text-sm text-gray-500">
                                            {formatDate(ev.date_represented)}
                                        </div>

                                        {/* Actions */}
                                        <div className="col-span-2 flex items-center justify-end space-x-1">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleViewEvidence(ev)
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-evidence-400 rounded-lg hover:bg-evidence-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                title="View"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleEditEvidence(ev)
                                                }}
                                                className="p-1.5 text-gray-400 hover:text-evidence-400 rounded-lg hover:bg-evidence-50 transition-all duration-200 opacity-0 group-hover:opacity-100"
                                                title="Edit"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
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
                    onDataPointClick={(dataPoint, kpi) => {
                        setSelectedDataPoint(dataPoint)
                        setSelectedDataPointKpi(kpi)
                        setIsPreviewModalOpen(false)
                        setIsDataPointPreviewOpen(true)
                    }}
                />
            )}

            {/* Data Point Preview Modal - opens when clicking impact claim from evidence */}
            {selectedDataPoint && (
                <DataPointPreviewModal
                    isOpen={isDataPointPreviewOpen}
                    onClose={() => {
                        setIsDataPointPreviewOpen(false)
                        setSelectedDataPoint(null)
                        setSelectedDataPointKpi(null)
                    }}
                    dataPoint={selectedDataPoint}
                    kpi={selectedDataPointKpi || selectedDataPoint.kpi}
                    onEvidenceClick={(ev) => {
                        setSelectedEvidence(ev)
                        setIsDataPointPreviewOpen(false)
                        setIsPreviewModalOpen(true)
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

