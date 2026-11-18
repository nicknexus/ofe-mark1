import { useEffect, useState } from 'react'
import { useTeam } from '../../context/TeamContext'
import { apiService } from '../../services/api'

export type SocialAccount = Awaited<ReturnType<typeof apiService.getSocialAccount>>

const cache = new Map<string, SocialAccount>()

export function useSocialAccount() {
  const { activeOrganization } = useTeam()
  const orgId = activeOrganization?.id || ''
  const cached = orgId ? cache.get(orgId) : undefined
  const [account, setAccount] = useState<SocialAccount | null>(cached ?? null)
  const [ready, setReady] = useState(!!cached)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const hit = orgId ? cache.get(orgId) : undefined
    if (hit) {
      setAccount(hit)
      setReady(true)
    } else if (tick === 0) {
      setAccount(null)
      setReady(false)
    }
    let cancelled = false
    apiService.getSocialAccount(tick > 0)
      .then(next => {
        if (cancelled) return
        if (orgId) cache.set(orgId, next)
        setAccount(next)
        setError(null)
        setReady(true)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Could not load your accounts')
        setReady(true)
      })
    return () => { cancelled = true }
  }, [orgId, tick])

  return { account, ready, error, reload: () => setTick(value => value + 1) }
}
