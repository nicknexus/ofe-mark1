import React, { useEffect, useMemo, useState } from 'react'
import { X, MapPin, Plus, Search, Check } from 'lucide-react'
import { Location } from '../types'
import { apiService } from '../services/api'
import toast from 'react-hot-toast'

interface AddLocationPickerModalProps {
    isOpen: boolean
    onClose: () => void
    initiativeId: string
    /** location IDs already linked to this initiative — hidden from the list */
    excludeIds: string[]
    onCreateNew: () => void
    onLinked: () => void
}

export default function AddLocationPickerModal({
    isOpen,
    onClose,
    initiativeId,
    excludeIds,
    onCreateNew,
    onLinked,
}: AddLocationPickerModalProps) {
    const [allLocations, setAllLocations] = useState<Location[]>([])
    const [loading, setLoading] = useState(false)
    const [linkingId, setLinkingId] = useState<string | null>(null)
    const [search, setSearch] = useState('')

    useEffect(() => {
        if (!isOpen) return
        let cancelled = false
            ; (async () => {
                try {
                    setLoading(true)
                    const data = await apiService.getOrgLocations()
                    if (!cancelled) setAllLocations(data)
                } catch (err) {
                    console.error('Failed to load org locations', err)
                    toast.error('Failed to load locations')
                } finally {
                    if (!cancelled) setLoading(false)
                }
            })()
        return () => { cancelled = true }
    }, [isOpen])

    const filtered = useMemo(() => {
        const excluded = new Set(excludeIds)
        const q = search.trim().toLowerCase()
        return allLocations
            .filter(l => l.id && !excluded.has(l.id))
            .filter(l => !q || l.name.toLowerCase().includes(q) || (l.country?.toLowerCase().includes(q) ?? false))
    }, [allLocations, excludeIds, search])

    const handleLink = async (loc: Location) => {
        if (!loc.id) return
        try {
            setLinkingId(loc.id)
            await apiService.linkLocationToInitiative(loc.id, initiativeId)
            toast.success(`Added "${loc.name}" to this initiative`)
            onLinked()
        } catch (err) {
            console.error('Failed to link location', err)
            toast.error('Failed to add location')
        } finally {
            setLinkingId(null)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[80] animate-fade-in">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden shadow-[0_25px_80px_-10px_rgba(0,0,0,0.3)] border border-gray-100">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                            <MapPin className="w-4 h-4 text-primary-500" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">Add Location</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Create new */}
                <div className="px-5 pt-4 flex-shrink-0">
                    <button
                        onClick={() => { onClose(); onCreateNew() }}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-primary-300 bg-primary-50/50 hover:bg-primary-50 hover:border-primary-400 transition-all text-left"
                    >
                        <div className="w-9 h-9 rounded-full bg-primary-500 text-white flex items-center justify-center flex-shrink-0">
                            <Plus className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-sm">Create new location</p>
                            <p className="text-xs text-gray-500">Add a brand-new location to your organization</p>
                        </div>
                    </button>
                </div>

                {/* Search */}
                <div className="px-5 pt-4 flex-shrink-0">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        Or pick from existing
                    </div>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search locations..."
                            className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
                    {loading ? (
                        <div className="py-12 flex items-center justify-center">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="py-12 text-center text-sm text-gray-500">
                            {allLocations.length === 0
                                ? 'No locations yet. Create your first one above.'
                                : excludeIds.length === allLocations.length
                                    ? 'All your locations are already linked to this initiative.'
                                    : 'No matches'}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {filtered.map((loc) => (
                                <button
                                    key={loc.id}
                                    onClick={() => handleLink(loc)}
                                    disabled={linkingId === loc.id}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200 transition-all text-left disabled:opacity-60"
                                >
                                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                        <MapPin className="w-4 h-4 text-gray-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 text-sm truncate">{loc.name}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {loc.country || `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
                                        </p>
                                    </div>
                                    {linkingId === loc.id ? (
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
                                    ) : (
                                        <Check className="w-4 h-4 text-gray-300" />
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}
