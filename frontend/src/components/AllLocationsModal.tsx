import React, { useEffect, useMemo, useState } from 'react'
import { X, MapPin, Plus, Trash2, Search } from 'lucide-react'
import { Location } from '../types'
import { apiService } from '../services/api'
import LocationMap from './LocationMap'
import LocationModal from './LocationModal'
import toast from 'react-hot-toast'

interface AllLocationsModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function AllLocationsModal({ isOpen, onClose }: AllLocationsModalProps) {
    const [locations, setLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

    const load = async () => {
        try {
            setLoading(true)
            const data = await apiService.getOrgLocations()
            setLocations(data)
        } catch (err) {
            console.error('Failed to load org locations', err)
            toast.error('Failed to load locations')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            load()
            setSearch('')
            setSelectedId(null)
        }
    }, [isOpen])

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return locations
        return locations.filter(l =>
            l.name.toLowerCase().includes(q) ||
            (l.country?.toLowerCase().includes(q) ?? false)
        )
    }, [locations, search])

    const handleCreate = async (data: Partial<Location>) => {
        await apiService.createLocation(data)
        toast.success('Location added')
        await load()
        setIsCreateOpen(false)
    }

    const handleDelete = async (id: string) => {
        try {
            await apiService.deleteLocation(id)
            toast.success('Location deleted')
            await load()
            setDeleteConfirmId(null)
        } catch (err) {
            console.error('Failed to delete location', err)
            toast.error('Failed to delete location')
        }
    }

    if (!isOpen) return null

    const target = locations.find(l => l.id === deleteConfirmId)

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-fade-in">
                <div className="bg-white rounded-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                                <MapPin className="w-4 h-4 text-primary-500" />
                            </div>
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">All Locations</h2>
                                <p className="text-xs text-gray-500">{locations.length} across your organization</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setIsCreateOpen(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all shadow-bubble-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Location
                            </button>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body: map + sidebar */}
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 p-3 overflow-hidden min-h-0">
                        {/* Map */}
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-bubble border border-gray-100 p-2 overflow-hidden flex-col min-h-0 hidden lg:flex">
                            <LocationMap
                                locations={filtered}
                                selectedLocationId={selectedId}
                                onLocationClick={(loc) => setSelectedId(loc.id || null)}
                            />
                        </div>

                        {/* Sidebar list */}
                        <div className="lg:col-span-1 bg-white rounded-2xl shadow-bubble border border-gray-100 p-3 overflow-hidden flex flex-col min-h-0">
                            <div className="relative mb-3 flex-shrink-0">
                                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search locations..."
                                    className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                                {loading ? (
                                    <div className="py-12 flex items-center justify-center">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                                    </div>
                                ) : filtered.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <div className="icon-bubble mx-auto mb-3">
                                            <MapPin className="w-5 h-5 text-gray-400" />
                                        </div>
                                        <p className="text-sm text-gray-500 mb-3">
                                            {locations.length === 0 ? 'No locations yet' : 'No matches'}
                                        </p>
                                        {locations.length === 0 && (
                                            <button
                                                onClick={() => setIsCreateOpen(true)}
                                                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                            >
                                                Add your first location
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    filtered.map((loc) => (
                                        <div
                                            key={loc.id}
                                            onClick={() => setSelectedId(loc.id || null)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 group ${selectedId === loc.id
                                                    ? 'border-primary-300 bg-primary-50'
                                                    : 'border-gray-100 hover:border-gray-200 bg-white'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1 min-w-0 pr-2">
                                                    <h3 className="font-medium text-gray-800 text-sm truncate">{loc.name}</h3>
                                                    {loc.country && (
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{loc.country}</p>
                                                    )}
                                                    {(loc.initiative_ids?.length ?? 0) > 0 && (
                                                        <p className="text-[11px] text-gray-400 mt-1">
                                                            Linked to {loc.initiative_ids!.length} initiative{loc.initiative_ids!.length === 1 ? '' : 's'}
                                                        </p>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setDeleteConfirmId(loc.id || null)
                                                    }}
                                                    title="Delete (org-wide)"
                                                    className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            <LocationModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSubmit={handleCreate}
                initialLocation={null}
            />

            {/* Delete Confirmation */}
            {deleteConfirmId && target && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
                    <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-bubble-lg border border-gray-100">
                        <div className="flex items-start space-x-4 mb-6">
                            <div className="icon-bubble">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Location</h3>
                                <p className="text-sm text-gray-500">This action cannot be undone</p>
                            </div>
                        </div>

                        <p className="text-gray-600 mb-2 text-sm">
                            Permanently delete{' '}
                            <strong className="text-gray-800">"{target.name}"</strong>{' '}
                            from your organization?
                        </p>
                        <p className="text-xs text-gray-500 mb-6">
                            This removes the location from every initiative that uses it. Existing impact claims, evidence, and stories linked here will keep their data but lose the location reference.
                        </p>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all duration-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirmId)}
                                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-2xl transition-all duration-200 shadow-bubble-sm"
                            >
                                Delete Location
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
