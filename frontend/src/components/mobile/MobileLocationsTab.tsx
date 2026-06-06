import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
 Plus, 
 MapPin, 
 Search, 
 Edit, 
 Trash2,
 X,
 Check,
 Settings
} from 'lucide-react'
import { apiService } from '../../services/api'
import { Location } from '../../types'
import { debounce } from '../../utils'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import { EmptyState, SectionLoader, Spinner } from '../ui'

interface MobileLocationsTabProps {
 initiativeId: string
 autoAdd?: boolean
}

interface NominatimResult {
 place_id: number
 display_name: string
 lat: string
 lon: string
}

export default function MobileLocationsTab({ initiativeId, autoAdd }: MobileLocationsTabProps) {
 const { canEditLocations, canDelete } = useTeam()
 const [locations, setLocations] = useState<Location[]>([])
 const [loading, setLoading] = useState(true)
 const [showAddFlow, setShowAddFlow] = useState(!!autoAdd)
 const [editingLocation, setEditingLocation] = useState<Location | null>(null)
 const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
 const [openMenuId, setOpenMenuId] = useState<string | null>(null)

 useEffect(() => {
 loadLocations()
 }, [initiativeId])

 const loadLocations = async () => {
 try {
 setLoading(true)
 const data = await apiService.getLocations(initiativeId)
 setLocations(data || [])
 } catch (error) {
 console.error('Error loading locations:', error)
 notify.error('Failed to load locations')
 } finally {
 setLoading(false)
 }
 }

 const handleDelete = async (id: string) => {
 try {
 await apiService.deleteLocation(id)
 notify.success('Location deleted')
 setDeleteConfirmId(null)
 loadLocations()
 } catch (error) {
 notify.error('Failed to delete location')
 }
 }

 if (showAddFlow || editingLocation) {
 return (
 <MobileLocationForm
 initiativeId={initiativeId}
 editLocation={editingLocation}
 onClose={() => {
 setShowAddFlow(false)
 setEditingLocation(null)
 }}
 onSuccess={() => {
 setShowAddFlow(false)
 setEditingLocation(null)
 loadLocations()
 }}
 />
 )
 }

 return (
 <div className="p-4">
 {/* Header */}
 <div className="flex items-center justify-between mb-4">
 <div>
 <h1 className="text-xl font-bold text-gray-900">Locations</h1>
 <p className="text-sm text-gray-500">{locations.length} location{locations.length !== 1 ? 's' : ''}</p>
 </div>
 {canEditLocations && (
 <button
 onClick={() => setShowAddFlow(true)}
 className="app-btn app-btn-primary app-btn-sm active:scale-[0.98]"
 >
 <Plus className="w-4 h-4" />
 Add
 </button>
 )}
 </div>

 {/* Locations List */}
 {loading ? (
 <SectionLoader className="h-64" />
 ) : locations.length === 0 ? (
 <EmptyState
 className="app-card"
 icon={MapPin}
 title="No Locations Yet"
 description="Add locations where your initiative operates."
 action={
 canEditLocations ? (
 <button type="button" onClick={() => setShowAddFlow(true)} className="app-btn app-btn-primary">
 Add Location
 </button>
 ) : undefined
 }
 />
 ) : (
 <div className="space-y-3">
 {locations.map((location) => (
 <div
 key={location.id}
 className="app-card overflow-hidden relative"
 >
 <div className="p-4 flex items-start gap-3">
 <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
 <MapPin className="w-5 h-5 text-primary-500" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-semibold text-gray-800">{location.name}</h3>
 {location.description && (
 <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
 {location.description}
 </p>
 )}
 <p className="text-xs text-gray-400 mt-1">
 {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
 </p>
 </div>
 {(canEditLocations || canDelete) && (
 <button
 onClick={() => setOpenMenuId(openMenuId === location.id ? null : location.id!)}
 className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors flex-shrink-0"
 aria-label="Options"
 >
 <Settings className="w-5 h-5" />
 </button>
 )}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Settings popup - compact centered bubble */}
 {openMenuId && (() => {
 const location = locations.find(l => l.id === openMenuId)
 if (!location) return null
 return createPortal(
 <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setOpenMenuId(null)}>
 <div className="absolute inset-0 bg-black/20" />
 <div
 className="relative app-card-elevated w-64 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
 <p className="text-sm font-semibold text-gray-800 truncate">{location.name}</p>
 </div>
 <div className="py-1">
 {canEditLocations && (
 <button
 onClick={() => {
 setEditingLocation(location)
 setOpenMenuId(null)
 }}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
 >
 <Edit className="w-4 h-4 text-gray-400" />
 Edit Location
 </button>
 )}
 {canDelete && (
 <button
 onClick={() => {
 setDeleteConfirmId(location.id!)
 setOpenMenuId(null)
 }}
 className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 )}
 </div>
 </div>
 </div>,
 document.body
 )
 })()}

 {/* Delete Confirmation */}
 {deleteConfirmId && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
 <div className="app-card max-w-sm w-full p-6">
 <div className="flex items-center gap-3 mb-4">
 <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
 <Trash2 className="w-5 h-5 text-red-600" />
 </div>
 <div>
 <h3 className="font-semibold text-gray-900">Delete Location</h3>
 <p className="text-xs text-gray-500">This cannot be undone</p>
 </div>
 </div>
 <p className="text-sm text-gray-600 mb-6">
 Are you sure you want to delete this location?
 </p>
 <div className="flex gap-3">
 <button
 onClick={() => setDeleteConfirmId(null)}
 className="app-btn app-btn-secondary flex-1 py-3"
 >
 Cancel
 </button>
 <button
 onClick={() => handleDelete(deleteConfirmId)}
 className="app-btn app-btn-danger flex-1 py-3"
 >
 Delete
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 )
}

// Mobile Location Form
interface LocationFormProps {
 initiativeId: string
 editLocation: Location | null
 onClose: () => void
 onSuccess: () => void
}

function MobileLocationForm({ initiativeId, editLocation, onClose, onSuccess }: LocationFormProps) {
 const [loading, setLoading] = useState(false)
 const [searchQuery, setSearchQuery] = useState('')
 const [searchResults, setSearchResults] = useState<NominatimResult[]>([])
 const [isSearching, setIsSearching] = useState(false)
 const [formData, setFormData] = useState({
 name: editLocation?.name || '',
 description: editLocation?.description || '',
 latitude: editLocation?.latitude?.toString() || '',
 longitude: editLocation?.longitude?.toString() || ''
 })

 // Debounced search
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
 `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`,
 { headers: { 'User-Agent': 'OFE App' } }
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

 const handleSearchChange = (value: string) => {
 setSearchQuery(value)
 debouncedSearch(value)
 }

 const handleSelectResult = (result: NominatimResult) => {
 setFormData({
 ...formData,
 latitude: result.lat,
 longitude: result.lon,
 name: formData.name || result.display_name.split(',')[0]
 })
 setSearchQuery(result.display_name)
 setSearchResults([])
 }

 const handleSubmit = async () => {
 if (!formData.name.trim()) {
 notify.error('Please enter a name')
 return
 }

 const lat = parseFloat(formData.latitude)
 const lng = parseFloat(formData.longitude)

 if (isNaN(lat) || lat < -90 || lat > 90) {
 notify.error('Valid latitude required (-90 to 90)')
 return
 }
 if (isNaN(lng) || lng < -180 || lng > 180) {
 notify.error('Valid longitude required (-180 to 180)')
 return
 }

 setLoading(true)
 try {
 const locationData = {
 initiative_id: initiativeId,
 name: formData.name.trim(),
 description: formData.description.trim() || undefined,
 latitude: lat,
 longitude: lng
 }

 if (editLocation?.id) {
 await apiService.updateLocation(editLocation.id, locationData)
 notify.success('Location updated!')
 } else {
 await apiService.createLocation(locationData)
 notify.success('Location created!')
 }
 onSuccess()
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to save location'
 notify.error(message)
 } finally {
 setLoading(false)
 }
 }

 return (
 <div className="fixed inset-0 bg-white z-[100] flex flex-col">
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-gray-100">
 <button onClick={onClose} className="p-2 -ml-2">
 <X className="w-5 h-5 text-gray-500" />
 </button>
 <span className="font-semibold text-gray-800">
 {editLocation ? 'Edit Location' : 'Add Location'}
 </span>
 <div className="w-9" />
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4">
 {/* Search */}
 <div>
 <label className="app-label">
 <Search className="w-4 h-4 inline mr-1" />
 Search for a Place
 </label>
 <div className="relative">
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 placeholder="e.g., Central Park, New York"
 className="app-input pr-10"
 />
 {isSearching && (
 <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />
 )}
 </div>

 {/* Search Results */}
 {searchResults.length > 0 && (
 <div className="mt-2 app-card overflow-hidden">
 {searchResults.map((result) => (
 <button
 key={result.place_id}
 onClick={() => handleSelectResult(result)}
 className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
 >
 <div className="font-medium text-gray-800 text-sm">
 {result.display_name.split(',')[0]}
 </div>
 <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
 {result.display_name}
 </div>
 </button>
 ))}
 </div>
 )}
 </div>

 {/* Name */}
 <div>
 <label className="app-label">
 Name <span className="text-red-500">*</span>
 </label>
 <input
 type="text"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 placeholder="e.g., Main Office"
 className="app-input"
 />
 </div>

 {/* Description */}
 <div>
 <label className="app-label">Description (optional)</label>
 <textarea
 value={formData.description}
 onChange={(e) => setFormData({ ...formData, description: e.target.value })}
 placeholder="Additional details..."
 rows={3}
 className="app-input resize-none"
 />
 </div>

 {/* Coordinates */}
 <div>
 <label className="app-label">Coordinates</label>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="app-label text-xs mb-1">Latitude *</label>
 <input
 type="number"
 step="any"
 value={formData.latitude}
 onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
 placeholder="e.g., 40.7128"
 className="app-input"
 />
 </div>
 <div>
 <label className="app-label text-xs mb-1">Longitude *</label>
 <input
 type="number"
 step="any"
 value={formData.longitude}
 onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
 placeholder="e.g., -74.0060"
 className="app-input"
 />
 </div>
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="p-4 border-t border-gray-100 safe-area-pb">
 <div className="flex gap-3">
 <button
 onClick={onClose}
 className="app-btn app-btn-secondary flex-1 py-3"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 disabled={loading}
 className="app-btn app-btn-primary flex-1 py-3"
 >
 {loading ? (
 <>
 <Spinner className="w-4 h-4" />
 Saving...
 </>
 ) : (
 <>
 <Check className="w-4 h-4" />
 {editLocation ? 'Update' : 'Create'}
 </>
 )}
 </button>
 </div>
 </div>
 </div>
 )
}



