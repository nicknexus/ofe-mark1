import React, { useState, useEffect, useRef } from 'react'
import { X, MapPin, Save, Search, Loader2 } from 'lucide-react'
import { Location } from '../types'
import { debounce } from '../utils'

interface NominatimResult {
    place_id: number
    display_name: string
    lat: string
    lon: string
    type: string
    address?: {
        city?: string
        town?: string
        village?: string
        state?: string
        country?: string
        [key: string]: string | undefined
    }
}

interface LocationModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (location: Partial<Location>) => Promise<void>
    initialLocation?: Location | null
    initiativeId: string
    initialCoordinates?: [number, number] | null
}

export default function LocationModal({
    isOpen,
    onClose,
    onSubmit,
    initialLocation,
    initiativeId,
    initialCoordinates,
}: LocationModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        latitude: '',
        longitude: '',
        address: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const searchRef = useRef<HTMLDivElement>(null)

    // Add/remove body class to dim map when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add('location-modal-open')
        } else {
            document.body.classList.remove('location-modal-open')
        }
        return () => {
            document.body.classList.remove('location-modal-open')
        }
    }, [isOpen])

    // Debounced search function
    const debouncedSearch = useRef(
        debounce(async (query: string) => {
            if (!query.trim() || query.length < 3) {
                setSearchResults([])
                setIsSearching(false)
                return
            }

            try {
                setIsSearching(true)
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
                    {
                        headers: {
                            'User-Agent': 'OFE App', // Nominatim requires User-Agent
                        },
                    }
                )
                const data = await response.json()
                setSearchResults(data)
            } catch (err) {
                console.error('Geocoding error:', err)
                setSearchResults([])
            } finally {
                setIsSearching(false)
            }
        }, 500)
    ).current

    useEffect(() => {
        if (isOpen) {
            if (initialLocation) {
                setFormData({
                    name: initialLocation.name || '',
                    description: initialLocation.description || '',
                    latitude: initialLocation.latitude.toString(),
                    longitude: initialLocation.longitude.toString(),
                    address: '',
                })
            } else if (initialCoordinates) {
                setFormData({
                    name: '',
                    description: '',
                    latitude: initialCoordinates[1].toFixed(6),
                    longitude: initialCoordinates[0].toFixed(6),
                    address: '',
                })
            } else {
                setFormData({
                    name: '',
                    description: '',
                    latitude: '',
                    longitude: '',
                    address: '',
                })
            }
            setSearchQuery('')
            setSearchResults([])
            setError(null)
        }
    }, [isOpen, initialLocation, initialCoordinates])

    // Handle clicks outside search results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleSearchChange = (value: string) => {
        setSearchQuery(value)
        setShowResults(true)
        debouncedSearch(value)
    }

    const handleSelectResult = (result: NominatimResult) => {
        setFormData({
            ...formData,
            latitude: result.lat,
            longitude: result.lon,
            name: formData.name || result.display_name.split(',')[0], // Use first part as name if not set
            address: result.display_name,
        })
        setSearchQuery(result.display_name)
        setSearchResults([])
        setShowResults(false)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        const lat = parseFloat(formData.latitude)
        const lng = parseFloat(formData.longitude)

        if (!formData.name.trim()) {
            setError('Location name is required')
            return
        }

        if (isNaN(lat) || lat < -90 || lat > 90) {
            setError('Valid latitude is required (-90 to 90)')
            return
        }

        if (isNaN(lng) || lng < -180 || lng > 180) {
            setError('Valid longitude is required (-180 to 180)')
            return
        }

        setLoading(true)
        try {
            await onSubmit({
                initiative_id: initiativeId,
                name: formData.name.trim(),
                description: formData.description.trim() || undefined,
                latitude: lat,
                longitude: lng,
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save location')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] transform transition-all duration-200 ease-out animate-slide-up-fast">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-primary-50 to-primary-100">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary-100 rounded-lg">
                            <MapPin className="w-5 h-5 text-primary-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {initialLocation ? 'Edit Location' : 'Add Location'}
                            </h2>
                            <p className="text-sm text-gray-500">
                                {initialLocation ? 'Update location details' : 'Search for a place or enter coordinates'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors duration-150"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    {/* Address Search */}
                    <div className="relative" ref={searchRef}>
                        <label className="label">
                            <Search className="w-4 h-4 inline mr-2" />
                            Search for a Place
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => handleSearchChange(e.target.value)}
                                onFocus={() => setShowResults(true)}
                                className="input-field pl-10 transition-all duration-150 hover:border-gray-400"
                                placeholder="e.g., Central Park, New York or 123 Main St, London"
                            />
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                            )}
                        </div>

                        {/* Search Results Dropdown */}
                        {showResults && searchResults.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                {searchResults.map((result) => (
                                    <button
                                        key={result.place_id}
                                        type="button"
                                        onClick={() => handleSelectResult(result)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="font-medium text-gray-900 text-sm">
                                            {result.display_name.split(',')[0]}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 line-clamp-2">
                                            {result.display_name}
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">
                                            {result.lat}, {result.lon}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Name */}
                    <div>
                        <label className="label">
                            Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="input-field transition-all duration-150 hover:border-gray-400"
                            placeholder="e.g., Main Office, School Campus A"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="label">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            className="input-field resize-none"
                            rows={3}
                            placeholder="Optional description or additional details..."
                        />
                    </div>

                    {/* Coordinates */}
                    <div>
                        <label className="label text-sm text-gray-600 mb-2 block">
                            Coordinates (auto-filled when selecting a place, or enter manually)
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label text-xs">
                                    Latitude <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.latitude}
                                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                    className="input-field transition-all duration-150 hover:border-gray-400"
                                    placeholder="e.g., 40.7128"
                                    required
                                    min="-90"
                                    max="90"
                                />
                            </div>
                            <div>
                                <label className="label text-xs">
                                    Longitude <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="any"
                                    value={formData.longitude}
                                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                    className="input-field transition-all duration-150 hover:border-gray-400"
                                    placeholder="e.g., -74.0060"
                                    required
                                    min="-180"
                                    max="180"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150 hover:shadow-md disabled:opacity-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary-500 to-primary-600 border border-transparent rounded-lg hover:from-primary-600 hover:to-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 hover:shadow-lg transform hover:scale-[1.02] flex items-center justify-center space-x-2"
                            disabled={loading}
                        >
                            <Save className="w-4 h-4" />
                            <span>{loading ? 'Saving...' : initialLocation ? 'Update' : 'Create'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

