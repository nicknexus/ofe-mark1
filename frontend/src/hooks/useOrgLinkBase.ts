import { useLocation } from 'react-router-dom'

/**
 * Returns the current public-page URL base prefix: either `/org` or `/demo`.
 *
 * Demo / sandbox organizations live under `/demo/:slug` so they stay
 * completely separate from the real public app at `/org/:slug`. Public-page
 * components use this hook to build internal `<Link>` URLs that stay under
 * whichever prefix the user entered through.
 */
export function useOrgLinkBase(): '/org' | '/demo' {
    const { pathname } = useLocation()
    return pathname.startsWith('/demo/') || pathname === '/demo' ? '/demo' : '/org'
}
