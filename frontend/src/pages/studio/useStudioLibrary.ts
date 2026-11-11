import { useEffect, useState } from 'react'
import { useTeam } from '../../context/TeamContext'
import { apiService } from '../../services/api'
import type { ContentJourney, ContentPackage, ContentPublication } from '../../types'

const cache = new Map<string, { packages: ContentPackage[]; journeys: ContentJourney[] }>()

export function patchStudioPackage(orgId: string, packageId: string, publications: ContentPublication[]) {
  const hit = cache.get(orgId)
  if (!hit) return
  cache.set(orgId, {
    ...hit,
    packages: hit.packages.map(pkg => pkg.id === packageId ? { ...pkg, publications } : pkg),
  })
}

export function useStudioLibrary() {
  const { activeOrganization } = useTeam()
  const orgId = activeOrganization?.id || ''
  const hit = orgId ? cache.get(orgId) : undefined
  const [packages, setPackages] = useState<ContentPackage[]>(hit?.packages ?? [])
  const [journeys, setJourneys] = useState<ContentJourney[]>(hit?.journeys ?? [])
  const [loading, setLoading] = useState(!hit)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const cached = orgId ? cache.get(orgId) : undefined
    if (cached) {
      setPackages(cached.packages)
      setJourneys(cached.journeys)
      setLoading(false)
    } else {
      setPackages([])
      setJourneys([])
      setLoading(true)
    }
    let cancelled = false
    Promise.all([
      apiService.getContentPackages(),
      apiService.getContentJourneys(),
    ])
      .then(([posts, folders]) => {
        if (cancelled) return
        if (orgId) cache.set(orgId, { packages: posts, journeys: folders })
        setPackages(posts)
        setJourneys(folders)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load posts')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [orgId])

  return { packages, journeys, loading, error }
}
