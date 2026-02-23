import { useState, useEffect, useCallback, useRef } from 'react'

const POLL_INTERVAL = 60_000

export function useVersionCheck() {
    const [updateAvailable, setUpdateAvailable] = useState(false)
    const knownVersion = useRef<string | null>(null)
    const dismissedVersion = useRef<string | null>(
        sessionStorage.getItem('nexus-dismissed-version')
    )

    const checkVersion = useCallback(async () => {
        try {
            const res = await fetch('/version.json', { cache: 'no-store' })
            if (!res.ok) return
            const { version } = await res.json()

            if (knownVersion.current === null) {
                knownVersion.current = version
                return
            }

            if (version !== knownVersion.current && version !== dismissedVersion.current) {
                setUpdateAvailable(true)
            }
        } catch {
            // network error, ignore
        }
    }, [])

    const dismiss = useCallback(() => {
        setUpdateAvailable(false)
        if (knownVersion.current) {
            dismissedVersion.current = knownVersion.current
            sessionStorage.setItem('nexus-dismissed-version', knownVersion.current)
        }
    }, [])

    const refresh = useCallback(() => {
        window.location.reload()
    }, [])

    useEffect(() => {
        checkVersion()
        const interval = setInterval(checkVersion, POLL_INTERVAL)

        const handleVisibility = () => {
            if (document.visibilityState === 'visible') checkVersion()
        }
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            clearInterval(interval)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [checkVersion])

    return { updateAvailable, dismiss, refresh }
}
