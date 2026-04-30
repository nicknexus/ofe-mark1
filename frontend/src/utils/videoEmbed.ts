/**
 * Lightweight YouTube/Vimeo URL parser.
 *
 * Centralised here so private (input validation) and public (embed render)
 * sides agree on what counts as a valid feature video, and so future platform
 * additions are a one-file change.
 */

export type VideoProvider = 'youtube' | 'vimeo'

export interface ParsedVideo {
    provider: VideoProvider
    id: string
    /** Iframe-ready URL. */
    embedUrl: string
}

const YT_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be']
const VIMEO_HOSTS = ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']

function withScheme(raw: string): string | null {
    const trimmed = raw.trim()
    if (!trimmed) return null
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

export function parseVideoUrl(raw: string | null | undefined): ParsedVideo | null {
    if (!raw) return null
    const candidate = withScheme(raw)
    if (!candidate) return null

    let url: URL
    try {
        url = new URL(candidate)
    } catch {
        return null
    }
    const host = url.hostname.toLowerCase()

    if (YT_HOSTS.includes(host)) {
        let id = ''
        if (host === 'youtu.be') {
            id = url.pathname.split('/').filter(Boolean)[0] || ''
        } else if (url.pathname.startsWith('/embed/')) {
            id = url.pathname.replace('/embed/', '').split('/')[0] || ''
        } else if (url.pathname.startsWith('/shorts/')) {
            id = url.pathname.replace('/shorts/', '').split('/')[0] || ''
        } else if (url.pathname.startsWith('/watch')) {
            id = url.searchParams.get('v') || ''
        } else if (url.pathname.startsWith('/v/')) {
            id = url.pathname.replace('/v/', '').split('/')[0] || ''
        }
        if (!id || !/^[A-Za-z0-9_-]{6,}$/.test(id)) return null
        return { provider: 'youtube', id, embedUrl: `https://www.youtube.com/embed/${id}` }
    }

    if (VIMEO_HOSTS.includes(host)) {
        // Common shapes: vimeo.com/123, vimeo.com/123/abc (private hash),
        // player.vimeo.com/video/123
        const parts = url.pathname.split('/').filter(Boolean)
        let id = ''
        let hash = ''
        if (host === 'player.vimeo.com' && parts[0] === 'video') {
            id = parts[1] || ''
            hash = parts[2] || ''
        } else {
            id = parts[0] || ''
            hash = parts[1] || ''
        }
        if (!/^\d+$/.test(id)) return null
        const hashQuery = hash ? `?h=${encodeURIComponent(hash)}` : ''
        return { provider: 'vimeo', id, embedUrl: `https://player.vimeo.com/video/${id}${hashQuery}` }
    }

    return null
}

export function isValidVideoUrl(raw: string | null | undefined): boolean {
    return parseVideoUrl(raw) !== null
}
