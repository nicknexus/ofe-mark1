import React, { useState, useEffect } from 'react'
import { ChevronDown, X, MapPin } from 'lucide-react'
import { useFilterStore } from '../../state/filters/filterStore'
import { Labels } from '../../ui/labels'

// Temporary interface until we have the locations service
interface Location {
    id: string
    name: string
    type: 'site' | 'clinic' | 'region'
    city?: string
    region?: string
}

interface LocationMultiSelectProps {
    className?: string
}

export default function LocationMultiSelect({ className = '' }: LocationMultiSelectProps) {
    const { selectedLocationIds, setSelectedLocationIds } = useFilterStore()
    const [isOpen, setIsOpen] = useState(false)
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        loadLocations()
    }, [])

    const loadLocations = async () => {
        setLoading(true)
        try {
            // TODO: Replace with actual locations service call
            // const locationList = await locationsService.getLocations()
            // setLocations(locationList)

            // Temporary mock data
            setLocations([
                { id: '1', name: 'Main Clinic', type: 'clinic', city: 'New York' },
                { id: '2', name: 'Community Center', type: 'site', city: 'Boston' },
                { id: '3', name: 'Regional Office', type: 'region', region: 'Northeast' }
            ])
        } catch (error) {
            console.error('Failed to load locations:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleLocation = (locationId: string) => {
        const currentIds = selectedLocationIds || []
        const newIds = currentIds.includes(locationId)
            ? currentIds.filter(id => id !== locationId)
            : [...currentIds, locationId]

        setSelectedLocationIds(newIds.length === 0 ? null : newIds)
    }

    const handleClearAll = () => {
        setSelectedLocationIds(null)
    }

    const getSelectedLocations = () => {
        if (!selectedLocationIds) return []
        return locations.filter(location => selectedLocationIds.includes(location.id))
    }

    const formatSelection = () => {
        const selected = getSelectedLocations()
        if (selected.length === 0) return `Select ${Labels.locations.toLowerCase()}`
        if (selected.length === 1) return selected[0].name
        return `${selected.length} ${Labels.locations.toLowerCase()} selected`
    }

    const getLocationTypeIcon = (type: string) => {
        switch (type) {
            case 'clinic':
                return '🏥'
            case 'site':
                return '📍'
            case 'region':
                return '🗺️'
            default:
                return '📍'
        }
    }

    return (
        <div className={`relative ${className}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
                <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 truncate">{formatSelection()}</span>
                </div>
                <div className="flex items-center space-x-1">
                    {selectedLocationIds && selectedLocationIds.length > 0 && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                handleClearAll()
                            }}
                            className="p-1 hover:bg-gray-200 rounded"
                        >
                            <X className="w-3 h-3 text-gray-500" />
                        </button>
                    )}
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute top-full left-0 mt-1 w-full min-w-64 bg-white border border-gray-200 rounded-md shadow-lg z-20 max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                Loading {Labels.locations.toLowerCase()}...
                            </div>
                        ) : (
                            <div className="py-1">
                                {locations.map((location) => {
                                    const isSelected = selectedLocationIds?.includes(location.id) || false
                                    return (
                                        <label
                                            key={location.id}
                                            className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleToggleLocation(location.id)}
                                                className="mr-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center space-x-2">
                                                    <span className="text-sm">{getLocationTypeIcon(location.type)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-gray-900 truncate">
                                                            {location.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {location.city || location.region} • {location.type}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </label>
                                    )
                                })}
                                {locations.length === 0 && (
                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                        No {Labels.locations.toLowerCase()} found
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
