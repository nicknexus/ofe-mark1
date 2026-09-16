/**
 * Tiny stale-while-revalidate cache on sessionStorage.
 *
 * Pages seed their state from here so they paint instantly on revisit /
 * refresh, then refetch in the background and overwrite. The in-memory
 * apiService cache only lives for the tab's JS lifetime and 60s, so this
 * is what makes a hard refresh or a return visit feel instant.
 *
 * Never treat this as a source of truth: always refetch after reading.
 */
const PREFIX = 'nexus-swr:'

export function readSWR<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeSWR<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // Quota exceeded or storage disabled: silently skip, the page still
    // works, it just won't paint from cache next time.
  }
}

export function clearSWR(prefix?: string): void {
  try {
    const full = PREFIX + (prefix || '')
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i)
      if (k && k.startsWith(full)) sessionStorage.removeItem(k)
    }
  } catch {
    // ignore
  }
}
