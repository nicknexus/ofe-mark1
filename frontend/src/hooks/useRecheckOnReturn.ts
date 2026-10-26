import { useEffect, useRef } from 'react'

/**
 * Calls `recheck` when the page becomes visible again (user returns from
 * Stripe Checkout or the billing portal in another tab / Safari sheet).
 * Throttled so rapid tab flips don't spam /subscription/status.
 */
export function useRecheckOnReturn(recheck: () => void, minIntervalMs = 5000) {
    const last = useRef(0)
    const fn = useRef(recheck)
    fn.current = recheck

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return
            const now = Date.now()
            if (now - last.current < minIntervalMs) return
            last.current = now
            fn.current()
        }
        document.addEventListener('visibilitychange', onVisible)
        window.addEventListener('pageshow', onVisible)
        return () => {
            document.removeEventListener('visibilitychange', onVisible)
            window.removeEventListener('pageshow', onVisible)
        }
    }, [minIntervalMs])
}
