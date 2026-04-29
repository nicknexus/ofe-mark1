import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MapPin, Users, Tag as TagIcon, ChevronDown } from 'lucide-react'
import { Location, BeneficiaryGroup, MetricTag } from '../types'
import DateRangePicker from './DateRangePicker'
import { getLocalDateString } from '../utils'

export interface KPIFilterBarProps {
    locations: Location[]
    beneficiaryGroups: BeneficiaryGroup[]
    tags: MetricTag[]

    selectedLocations: string[]
    onLocationsChange: (ids: string[]) => void

    selectedBeneficiaryGroups: string[]
    onBeneficiaryGroupsChange: (ids: string[]) => void

    selectedTags: string[]
    onTagsChange: (ids: string[]) => void

    datePickerValue: { singleDate?: string; startDate?: string; endDate?: string }
    onDatePickerChange: (value: { singleDate?: string; startDate?: string; endDate?: string }) => void

    onClearAll?: () => void
    className?: string
}

/**
 * Compact filter bar matching the EvidenceTab pill style. Used on the expanded
 * metric view so that all panels (chart, claim list, tag breakdown) update from
 * one row of controls.
 */
export default function KPIFilterBar({
    locations,
    beneficiaryGroups,
    tags,
    selectedLocations,
    onLocationsChange,
    selectedBeneficiaryGroups,
    onBeneficiaryGroupsChange,
    selectedTags,
    onTagsChange,
    datePickerValue,
    onDatePickerChange,
    onClearAll,
    className = '',
}: KPIFilterBarProps) {
    const [showLocationPicker, setShowLocationPicker] = useState(false)
    const [showBeneficiaryPicker, setShowBeneficiaryPicker] = useState(false)
    const [showTagPicker, setShowTagPicker] = useState(false)

    const locationButtonRef = useRef<HTMLButtonElement>(null)
    const beneficiaryButtonRef = useRef<HTMLButtonElement>(null)
    const tagButtonRef = useRef<HTMLButtonElement>(null)

    const [locationDropdownPosition, setLocationDropdownPosition] = useState({ top: 0, left: 0 })
    const [beneficiaryDropdownPosition, setBeneficiaryDropdownPosition] = useState({ top: 0, left: 0 })
    const [tagDropdownPosition, setTagDropdownPosition] = useState({ top: 0, left: 0 })

    useEffect(() => {
        if (showLocationPicker && locationButtonRef.current) {
            const rect = locationButtonRef.current.getBoundingClientRect()
            setLocationDropdownPosition({ top: rect.bottom + 4, left: rect.left })
        }
    }, [showLocationPicker])

    useEffect(() => {
        if (showBeneficiaryPicker && beneficiaryButtonRef.current) {
            const rect = beneficiaryButtonRef.current.getBoundingClientRect()
            setBeneficiaryDropdownPosition({ top: rect.bottom + 4, left: rect.left })
        }
    }, [showBeneficiaryPicker])

    useEffect(() => {
        if (showTagPicker && tagButtonRef.current) {
            const rect = tagButtonRef.current.getBoundingClientRect()
            setTagDropdownPosition({ top: rect.bottom + 4, left: rect.left })
        }
    }, [showTagPicker])

    const hasAny = selectedLocations.length > 0 || selectedBeneficiaryGroups.length > 0
        || selectedTags.length > 0
        || !!datePickerValue.singleDate
        || !!(datePickerValue.startDate && datePickerValue.endDate)

    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`} onClick={(e) => e.stopPropagation()}>
            {/* Date */}
            <DateRangePicker
                value={datePickerValue}
                onChange={onDatePickerChange}
                maxDate={getLocalDateString(new Date())}
                placeholder="Date"
                className="w-auto text-xs"
            />

            {/* Location */}
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
                        <MapPin className={`w-5 h-5 ${selectedLocations.length > 0 ? 'text-primary-500' : 'text-gray-600'}`} />
                    </div>
                    <span className="ml-3">
                        {selectedLocations.length === 0
                            ? 'Location'
                            : selectedLocations.length === 1
                                ? locations.find(l => l.id === selectedLocations[0])?.name || '1 location'
                                : `${selectedLocations.length} locations`}
                    </span>
                    {selectedLocations.length > 0 && (
                        <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">{selectedLocations.length}</span>
                    )}
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showLocationPicker ? 'rotate-180' : ''}`} />
                </button>

                {showLocationPicker && locationButtonRef.current && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowLocationPicker(false)} />
                        <div
                            className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                            style={{ top: `${locationDropdownPosition.top}px`, left: `${locationDropdownPosition.left}px` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {locations.length === 0 ? (
                                <p className="text-xs text-gray-500">No locations available</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Locations</span>
                                        {selectedLocations.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); onLocationsChange([]) }} className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
                                        )}
                                    </div>
                                    {locations.map((loc) => (
                                        <label key={loc.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedLocations.includes(loc.id!)}
                                                onChange={(e) => {
                                                    if (e.target.checked) onLocationsChange([...selectedLocations, loc.id!])
                                                    else onLocationsChange(selectedLocations.filter(id => id !== loc.id))
                                                }}
                                                className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <span className="text-xs text-gray-700 truncate flex-1">{loc.name}</span>
                                        </label>
                                    ))}
                                </>
                            )}
                        </div>
                    </>,
                    document.body
                )}
            </div>

            {/* Tag */}
            <div className="relative">
                <button
                    ref={tagButtonRef}
                    onClick={() => setShowTagPicker(!showTagPicker)}
                    className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 shadow-bubble-sm ${selectedTags.length > 0
                        ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
                        : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
                        }`}
                >
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${selectedTags.length > 0
                        ? 'bg-primary-100 border-primary-500'
                        : 'bg-gray-100 border-gray-200'
                        }`}>
                        <TagIcon className={`w-5 h-5 ${selectedTags.length > 0 ? 'text-primary-500' : 'text-gray-600'}`} />
                    </div>
                    <span className="ml-3">
                        {selectedTags.length === 0
                            ? 'Tag'
                            : selectedTags.length === 1
                                ? tags.find(t => t.id === selectedTags[0])?.name || '1 tag'
                                : `${selectedTags.length} tags`}
                    </span>
                    {selectedTags.length > 0 && (
                        <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">{selectedTags.length}</span>
                    )}
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showTagPicker ? 'rotate-180' : ''}`} />
                </button>

                {showTagPicker && tagButtonRef.current && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowTagPicker(false)} />
                        <div
                            className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                            style={{ top: `${tagDropdownPosition.top}px`, left: `${tagDropdownPosition.left}px` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {tags.length === 0 ? (
                                <p className="text-xs text-gray-500">No tags on this metric</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Tags</span>
                                        {selectedTags.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); onTagsChange([]) }} className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
                                        )}
                                    </div>
                                    {tags.map((tag) => (
                                        <label key={tag.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedTags.includes(tag.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) onTagsChange([...selectedTags, tag.id])
                                                    else onTagsChange(selectedTags.filter(id => id !== tag.id))
                                                }}
                                                className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
                                            />
                                            <span className="text-xs text-gray-700 truncate flex-1">{tag.name}</span>
                                        </label>
                                    ))}
                                </>
                            )}
                        </div>
                    </>,
                    document.body
                )}
            </div>

            {/* Beneficiary group */}
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
                        <Users className={`w-5 h-5 ${selectedBeneficiaryGroups.length > 0 ? 'text-primary-500' : 'text-gray-600'}`} />
                    </div>
                    <span className="ml-3">
                        {selectedBeneficiaryGroups.length === 0
                            ? 'Beneficiary Group'
                            : selectedBeneficiaryGroups.length === 1
                                ? beneficiaryGroups.find(bg => bg.id === selectedBeneficiaryGroups[0])?.name || '1 group'
                                : `${selectedBeneficiaryGroups.length} groups`}
                    </span>
                    {selectedBeneficiaryGroups.length > 0 && (
                        <span className="ml-1 bg-primary-500 text-white text-[10px] px-1 rounded-full">{selectedBeneficiaryGroups.length}</span>
                    )}
                    <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showBeneficiaryPicker ? 'rotate-180' : ''}`} />
                </button>

                {showBeneficiaryPicker && beneficiaryButtonRef.current && createPortal(
                    <>
                        <div className="fixed inset-0 z-[9998]" onClick={() => setShowBeneficiaryPicker(false)} />
                        <div
                            className="fixed bg-white border border-gray-100 rounded-xl shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
                            style={{ top: `${beneficiaryDropdownPosition.top}px`, left: `${beneficiaryDropdownPosition.left}px` }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {beneficiaryGroups.length === 0 ? (
                                <p className="text-xs text-gray-500">No beneficiary groups available</p>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold text-gray-700">Select Beneficiary Groups</span>
                                        {selectedBeneficiaryGroups.length > 0 && (
                                            <button onClick={(e) => { e.stopPropagation(); onBeneficiaryGroupsChange([]) }} className="text-xs text-blue-600 hover:text-blue-800">Clear</button>
                                        )}
                                    </div>
                                    {beneficiaryGroups.map((group) => (
                                        <label key={group.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedBeneficiaryGroups.includes(group.id!)}
                                                onChange={(e) => {
                                                    if (e.target.checked) onBeneficiaryGroupsChange([...selectedBeneficiaryGroups, group.id!])
                                                    else onBeneficiaryGroupsChange(selectedBeneficiaryGroups.filter(id => id !== group.id))
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

            {hasAny && onClearAll && (
                <button
                    onClick={(e) => { e.stopPropagation(); onClearAll() }}
                    className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                >
                    Clear all
                </button>
            )}
        </div>
    )
}
