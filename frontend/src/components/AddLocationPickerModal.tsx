import React, { useEffect, useMemo, useState } from 'react'
import { X, MapPin, Plus, Search, Check } from 'lucide-react'
import { Location } from '../types'
import { apiService } from '../services/api'
import ModalFrame from './ModalFrame'
import { notify } from '../lib/notify'
import { SectionLoader, Spinner } from './ui'

interface AddLocationPickerModalProps {
 isOpen: boolean
 onClose: () => void
 initiativeId: string
 /** location IDs already linked to this initiative — hidden from the list */
 excludeIds: string[]
 onCreateNew: () => void
 onLinked: () => void
 /** Fired as soon as Add is clicked, before the links finish. */
 onOptimisticAdd?: (count: number) => void
}

export default function AddLocationPickerModal({
 isOpen,
 onClose,
 initiativeId,
 excludeIds,
 onCreateNew,
 onLinked,
 onOptimisticAdd,
}: AddLocationPickerModalProps) {
 const [allLocations, setAllLocations] = useState<Location[]>([])
 const [loading, setLoading] = useState(false)
 const [adding, setAdding] = useState(false)
 const [selected, setSelected] = useState<string[]>([])
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
 notify.error('Failed to load locations')
 } finally {
 if (!cancelled) setLoading(false)
 }
 })()
 return () => { cancelled = true }
 }, [isOpen])

 useEffect(() => {
 if (!isOpen) {
 setSelected([])
 setSearch('')
 }
 }, [isOpen])

 const filtered = useMemo(() => {
 const excluded = new Set(excludeIds)
 const q = search.trim().toLowerCase()
 return allLocations
 .filter(l => l.id && !excluded.has(l.id))
 .filter(l => !q || l.name.toLowerCase().includes(q) || (l.country?.toLowerCase().includes(q) ?? false))
 }, [allLocations, excludeIds, search])

 const toggle = (id: string) => {
 setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
 }

 const handleAdd = async () => {
 if (selected.length === 0 || adding) return
 const ids = [...selected]
 onOptimisticAdd?.(ids.length)
 onClose()
 const results = await Promise.allSettled(
 ids.map(id => apiService.linkLocationToInitiative(id, initiativeId))
 )
 const added = results.filter(r => r.status === 'fulfilled').length
 const failed = results.length - added
 if (added > 0) {
 notify.success(added === 1 ? 'Added 1 location' : `Added ${added} locations`)
 onLinked()
 }
 if (added === 0) onOptimisticAdd?.(-ids.length)
 if (failed > 0 && added > 0) onOptimisticAdd?.(-failed)
 if (failed > 0) {
 notify.error(failed === results.length ? 'Failed to add locations' : `${failed} could not be added`)
 }
 }

 if (!isOpen) return null

 return (
 <ModalFrame panelClassName="bg-white rounded-xl max-w-xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-app-modal border border-gray-200">
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
 <div className="w-9 h-9 rounded-full bg-primary-500 text-secondary-900 flex items-center justify-center flex-shrink-0">
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
className="app-input pl-10"
 />
 </div>
 </div>

 {/* List */}
 <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
 {loading ? (
 <SectionLoader />
 ) : filtered.length === 0 ? (
 <div className="py-12 text-center text-sm text-gray-500">
 {allLocations.length === 0
 ? 'No locations yet. Create your first one above.'
 : excludeIds.length === allLocations.length
 ? 'All your locations are already linked to this program.'
 : 'No matches'}
 </div>
 ) : (
 <div className="space-y-1.5">
 {filtered.map((loc) => {
 const isSelected = !!loc.id && selected.includes(loc.id)
 return (
 <button
 key={loc.id}
 type="button"
 onClick={() => loc.id && toggle(loc.id)}
 disabled={adding}
 className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left disabled:opacity-60 ${
 isSelected
 ? 'border-primary-400 bg-primary-50/70 ring-1 ring-primary-200'
 : 'border-gray-100 bg-white hover:bg-gray-50 hover:border-gray-200'
 }`}
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
 <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
 isSelected ? 'bg-primary-600 border-primary-600 text-white' : 'border-gray-300 bg-white text-transparent'
 }`}>
 <Check className="w-3 h-3" />
 </span>
 </button>
 )
 })}
 </div>
 )}
 </div>

 {/* Footer */}
 <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
 <button type="button" onClick={onClose} disabled={adding} className="app-btn app-btn-secondary">
 Cancel
 </button>
 <button type="button" onClick={handleAdd} disabled={adding || selected.length === 0} className="app-btn app-btn-primary">
 {adding ? <Spinner className="w-4 h-4" /> : null}
 {selected.length > 0 ? `Add ${selected.length}` : 'Add'}
 </button>
 </div>
 </ModalFrame>
 )
}
