/**
 * Bot-only Open Graph HTML for public /org and /demo URLs.
 *
 * Humans always fall through to the Vite SPA (zero UI change).
 * If API/env fails, we also fall through — previews stay generic rather than
 * breaking the site.
 *
 * Requires VITE_API_URL (or API_URL) in the frontend Vercel project env —
 * same value the SPA already uses.
 */
import { next } from '@vercel/functions'
import { SOCIAL_BOT_UA, resolveOgMeta, renderOgHtml } from './src/lib/ogMeta'

export const config = {
    matcher: ['/org/:path*', '/demo/:path*'],
}

function apiBase(): string | null {
    const raw = process.env.VITE_API_URL || process.env.API_URL
    if (!raw) return null
    return raw.replace(/\/$/, '')
}

export default async function middleware(request: Request) {
    const ua = request.headers.get('user-agent') || ''
    if (!SOCIAL_BOT_UA.test(ua)) {
        return next()
    }

    try {
        const url = new URL(request.url)
        const base = apiBase()
        if (!base) {
            console.warn('[og] VITE_API_URL / API_URL not set — skipping OG inject')
            return next()
        }

        const meta = await resolveOgMeta(url.pathname, base, url.origin)
        if (!meta) return next()

        const html = renderOgHtml(meta, url.toString())
        return new Response(html, {
            status: 200,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                // Short edge cache so logo/title updates show up soon; scrapers are chatty.
                'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400',
                'x-robots-tag': 'noindex',
            },
        })
    } catch (err) {
        console.error('[og] middleware error — falling through to SPA', err)
        return next()
    }
}
