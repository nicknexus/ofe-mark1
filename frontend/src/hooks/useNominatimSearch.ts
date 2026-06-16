import { useRef, useState } from 'react'
import { debounce } from '../utils'

export interface NominatimResult {
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

/**
 * Shared OpenStreetMap / Nominatim place-search behavior. Extracted from
 * LocationModal so the onboarding wizard's location step reuses identical
 * search + reverse-geocode logic without re-rendering the modal chrome.
 */
export function useNominatimSearch() {
  const [results, setResults] = useState<NominatimResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const search = useRef(
    debounce(async (query: string) => {
      if (!query.trim() || query.length < 3) {
        setResults([])
        setIsSearching(false)
        return
      }
      try {
        setIsSearching(true)
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
          { headers: { 'User-Agent': 'OFE App' } }
        )
        const data = await response.json()
        setResults(data)
      } catch (err) {
        console.error('Geocoding error:', err)
        setResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)
  ).current

  const clearResults = () => setResults([])

  /** Best-effort reverse geocode to fill in a country when coords were entered manually. */
  const reverseGeocodeCountry = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
        { headers: { 'User-Agent': 'OFE App' } }
      )
      const data = await response.json()
      return data.address?.country || ''
    } catch (err) {
      console.error('Reverse geocoding failed:', err)
      return ''
    }
  }

  return { results, isSearching, search, clearResults, reverseGeocodeCountry }
}
