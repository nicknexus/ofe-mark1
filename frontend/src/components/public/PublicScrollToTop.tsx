import { useLayoutEffect } from 'react'
import { useLocation } from 'react-router-dom'

const PUBLIC_PATH = /^\/(org|demo|explore|tos|terms-of-service)(\/|$)/

/** SPA navigations keep the previous window scroll. Public pages are document-scrolled, so hop org → metric (etc.) lands mid-page. */
export default function PublicScrollToTop() {
    const { pathname } = useLocation()

    useLayoutEffect(() => {
        if (!PUBLIC_PATH.test(pathname)) return
        window.scrollTo(0, 0)
        document.documentElement.scrollTop = 0
        document.body.scrollTop = 0
    }, [pathname])

    return null
}
