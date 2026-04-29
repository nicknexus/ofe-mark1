import React, { useState, useEffect, useRef } from 'react'
import { X, MapPin, Save, Search, Loader2, ChevronDown } from 'lucide-react'
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
    /** When omitted, the location is created org-wide (not auto-linked to any initiative). */
    initiativeId?: string
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
        country: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
    const [isSearching, setIsSearching] = useState(false)
    const [showResults, setShowResults] = useState(false)
    const [showCoords, setShowCoords] = useState(false)
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
                    country: initialLocation.country || '',
                })
            } else if (initialCoordinates) {
                setFormData({
                    name: '',
                    description: '',
                    latitude: initialCoordinates[1].toFixed(6),
                    longitude: initialCoordinates[0].toFixed(6),
                    address: '',
                    country: '',
                })
            } else {
                setFormData({
                    name: '',
                    description: '',
                    latitude: '',
                    longitude: '',
                    address: '',
                    country: '',
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
            country: result.address?.country || '',
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
            // If no country is set (manual coordinates or map click), try to reverse geocode
            let country = formData.country
            if (!country) {
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
                        { headers: { 'User-Agent': 'OFE App' } }
                    )
                    const data = await response.json()
                    country = data.address?.country || ''
                } catch (err) {
                    console.error('Reverse geocoding failed:', err)
                }
            }

            await onSubmit({
                ...(initiativeId ? { initiative_id: initiativeId } : {}),
                name: formData.name.trim(),
                description: formData.description.trim() || undefined,
                latitude: lat,
                longitude: lng,
                country: country || undefined,
            })
            onClose()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save location')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    const hasCoords = formData.latitude && formData.longitude

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100 animate-slide-up-fast">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary-500" />
                        </div>
                        <div>
                            <h2 className="text-base font-semibold text-gray-900">
                                {initialLocation ? 'Edit Location' : 'New Location'}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {initialLocation ? 'Update details' : 'Search a place or click on the map'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto min-h-0">
                    <div className="px-5 py-4 space-y-4">
                        {error && (
                            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        {/* Address Search */}
                        <div className="relative" ref={searchRef}>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Search a place
                            </label>
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onFocus={() => setShowResults(true)}
                                    className="w-full pl-10 pr-9 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-gray-400"
                                    placeholder="e.g. Central Park, New York"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {showResults && searchResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-1.5 bg-white border border-gray-100 rounded-xl shadow-[0_12px_32px_-10px_rgba(0,0,0,0.18)] max-h-60 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.place_id}
                                            type="button"
                                            onClick={() => handleSelectResult(result)}
                                            className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0"
                                        >
                                            <div className="font-medium text-gray-900 text-sm truncate">
                                                {result.display_name.split(',')[0]}
                                            </div>
                                            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                                {result.display_name}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Name */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Name <span className="text-red-500 normal-case">*</span>
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder:text-gray-400"
                                placeholder="e.g. Main Office"
                                required
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                Description
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-3.5 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none placeholder:text-gray-400"
                                rows={2}
                                placeholder="Optional"
                            />
                        </div>

                        {/* Coordinates - collapsible advanced */}
                        <div className="border border-gray-100 rounded-xl bg-gray-50/40">
                            <button
                                type="button"
                                onClick={() => setShowCoords(s => !s)}
                                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                            >
                                <div className="min-w-0">
                                    <p className="text-xs font-semibold text-gray-700">Coordinates</p>
                                    {hasCoords ? (
                                        <p className="text-[11px] text-gray-500 mt-0.5 font-mono truncate">
                                            {parseFloat(formData.latitude).toFixed(5)}, {parseFloat(formData.longitude).toFixed(5)}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-gray-500 mt-0.5">Auto-filled from search, or enter manually</p>
                                    )}
                                </div>
                                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showCoords ? 'rotate-180' : ''}`} />
                            </button>
                            {showCoords && (
                                <div className="px-3.5 pb-3 grid grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Latitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.latitude}
                                            onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="40.7128"
                                            required
                                            min="-90"
                                            max="90"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Longitude</label>
                                        <input
                                            type="number"
                                            step="any"
                                            value={formData.longitude}
                                            onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                            placeholder="-74.0060"
                                            required
                                            min="-180"
                                            max="180"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 flex-shrink-0 bg-gray-50/40">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-xl transition-colors shadow-bubble-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{loading ? 'Saving...' : initialLocation ? 'Update' : 'Create'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

