import React, { useRef, useState, useEffect } from 'react'
import { MapPin, Search, Plus, Trash2, ChevronDown, Globe } from 'lucide-react'
import StepHeader from '../StepHeader'
import { OnboardingDraftApi } from '../useOnboardingDraft'
import { useNominatimSearch, NominatimResult } from '../../../hooks/useNominatimSearch'
import { apiService } from '../../../services/api'
import { notify } from '../../../lib/notify'
import { Spinner } from '../../ui'

interface Props {
  draftApi: OnboardingDraftApi
}

export default function LocationsStep({ draftApi }: Props) {
  const { draft, addLocation, removeLocation } = draftApi
  const { results, isSearching, search, clearResults, reverseGeocodeCountry } = useNominatimSearch()

  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [country, setCountry] = useState('')
  const [showCoords, setShowCoords] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleSelect = (r: NominatimResult) => {
    setLat(r.lat)
    setLng(r.lon)
    setName(name || r.display_name.split(',')[0])
    setCountry(r.address?.country || '')
    setQuery(r.display_name)
    clearResults()
    setShowResults(false)
  }

  const resetForm = () => {
    setQuery(''); setName(''); setDescription(''); setLat(''); setLng(''); setCountry('')
    clearResults(); setShowCoords(false); setError(null)
  }

  const handleAdd = async () => {
    setError(null)
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (!name.trim()) { setError('Location name is required'); return }
    if (isNaN(latNum) || latNum < -90 || latNum > 90) { setError('Pick a place from search, or enter a valid latitude'); return }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) { setError('Pick a place from search, or enter a valid longitude'); return }

    setSaving(true)
    try {
      let resolvedCountry = country
      if (!resolvedCountry) resolvedCountry = await reverseGeocodeCountry(latNum, lngNum)
      // Created org-wide (no initiative_id) — global, linkable later.
      const created = await apiService.createLocation({
        name: name.trim(),
        description: description.trim() || undefined,
        latitude: latNum,
        longitude: lngNum,
        country: resolvedCountry || undefined,
      })
      addLocation(created)
      notify.success('Location added')
      resetForm()
    } catch (e) {
      notify.error((e as Error).message || 'Could not add location')
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (id: string) => {
    try {
      await apiService.deleteLocation(id)
      removeLocation(id)
    } catch (e) {
      notify.error((e as Error).message || 'Could not remove location')
    }
  }

  const hasCoords = !!(lat && lng)

  return (
    <div>
      <StepHeader
        icon={MapPin}
        title="Where are you creating impact?"
        subtitle="Your locations"
        description="Add the places where you create impact. Locations are shared across your whole account — create each one once, then use it with any initiative, metric, impact claim, or evidence. Add as many as you'd like."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
        {/* Add form */}
        <div className="app-card p-5 sm:p-6 space-y-4">
          <div className="relative" ref={searchRef}>
            <label className="app-label">Search a place</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 z-10" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowResults(true); search(e.target.value) }}
                onFocus={() => setShowResults(true)}
                className="app-input pl-10 pr-9"
                placeholder="e.g. Nairobi, Kenya"
              />
              {isSearching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />}
            </div>
            {showResults && results.length > 0 && (
              <div className="absolute z-50 w-full mt-1.5 app-card-elevated max-h-60 overflow-y-auto">
                {results.map(r => (
                  <button
                    key={r.place_id}
                    type="button"
                    onClick={() => handleSelect(r)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-b-0"
                  >
                    <div className="font-medium text-secondary-900 text-sm truncate">{r.display_name.split(',')[0]}</div>
                    <div className="text-xs text-secondary-500 mt-0.5 line-clamp-2">{r.display_name}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="app-label">Name <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="app-input" placeholder="e.g. Main Office" />
          </div>

          <div>
            <label className="app-label">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="app-input resize-none" rows={2} placeholder="Optional" />
          </div>

          <div className="app-card-muted rounded-xl">
            <button type="button" onClick={() => setShowCoords(s => !s)} className="w-full flex items-center justify-between px-3.5 py-2.5 text-left">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-secondary-700">Coordinates</p>
                {hasCoords
                  ? <p className="text-xs text-secondary-500 mt-0.5 font-mono truncate">{parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}</p>
                  : <p className="text-xs text-secondary-500 mt-0.5">Auto-filled from search, or enter manually</p>}
              </div>
              <ChevronDown className={`w-4 h-4 text-secondary-400 transition-transform flex-shrink-0 ${showCoords ? 'rotate-180' : ''}`} />
            </button>
            {showCoords && (
              <div className="px-3.5 pb-3 grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1 block">Latitude</label>
                  <input type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} className="app-input" placeholder="-1.2921" />
                </div>
                <div>
                  <label className="text-xs font-medium text-secondary-500 mb-1 block">Longitude</label>
                  <input type="number" step="any" value={lng} onChange={(e) => setLng(e.target.value)} className="app-input" placeholder="36.8219" />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="button" onClick={handleAdd} disabled={saving} className="app-btn app-btn-primary w-full">
            {saving ? 'Adding…' : (<><Plus className="w-4 h-4" /> Add location</>)}
          </button>
        </div>

        {/* Added list */}
        <div>
          <h3 className="onboarding-list-label">Your locations <span className="onboarding-list-label-count">{draft.locations.length}</span></h3>
          {draft.locations.length === 0 ? (
            <div className="onboarding-empty">
              <span className="onboarding-empty-icon"><Globe className="w-5 h-5" /></span>
              <p className="onboarding-empty-text">No locations yet. Search for a place above to add your first one.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {draft.locations.map(loc => (
                <div key={loc.id} className="app-card p-3.5 flex items-center gap-3 group">
                  <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><MapPin className="w-4 h-4" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-secondary-900 truncate">{loc.name}</p>
                    <p className="text-xs text-secondary-500 truncate">
                      {loc.country || `${loc.latitude.toFixed(3)}, ${loc.longitude.toFixed(3)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => loc.id && handleRemove(loc.id)}
                    className="app-btn app-btn-icon app-btn-ghost opacity-0 group-hover:opacity-100 text-secondary-400 hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
