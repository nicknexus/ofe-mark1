/**
 * Open Graph meta resolution for public /org and /demo URLs.
 * Used by Vercel edge middleware — keep deps-free (no React).
 */
import { getVideoThumbnailUrl } from '../utils/videoEmbed'

export type OgMeta = {
    title: string
    description: string
    image: string
    card: 'summary' | 'summary_large_image'
}

const DEFAULT_DESCRIPTION =
    'Expert-level system for charities to track, categorize, and showcase their impact'

/** Social / chat unfurlers only — never general search crawlers (empty body would hurt SEO). */
export const SOCIAL_BOT_UA =
    /facebookexternalhit|Facebot|Twitterbot|LinkedInBot|Slackbot|Slack-ImgProxy|Discordbot|WhatsApp|TelegramBot|SkypeUriPreview|Pinterest|redditbot|Embedly|Quora Link Preview|BitlyBot|Snapchat|Viber|Kakao|Iframely|vkShare|Outbrain|Yahoo MailProxy|YahooCacheSystem|developers\.google\.com\/\+\/web\/snippet|Google-InspectionTool|Storebot-Google|GoogleOther|bingpreview|Baiduspider|DuckDuckBot|Applebot|iMessageBot|EveryFeedSpider|FlipboardProxy|Tumblr|NotionEmbedder/i

type Route =
    | { kind: 'org'; orgSlug: string }
    | { kind: 'context'; orgSlug: string }
    | { kind: 'globalMetric'; orgSlug: string; metricSlug: string }
    | { kind: 'initiative'; orgSlug: string; initiativeSlug: string }
    | { kind: 'metric'; orgSlug: string; initiativeSlug: string; metricSlug: string }
    | { kind: 'claim'; orgSlug: string; initiativeSlug: string; claimId: string }
    | { kind: 'story'; orgSlug: string; initiativeSlug: string; storyId: string }
    | { kind: 'evidence'; orgSlug: string; initiativeSlug: string; evidenceId: string }
    | { kind: 'beneficiary'; orgSlug: string; initiativeSlug: string; groupId: string }

const RESERVED_ORG_SEGMENTS = new Set(['context', 'metric'])

export function parsePublicPath(pathname: string): Route | null {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    const root = parts[0]
    if (root !== 'org' && root !== 'demo') return null

    const orgSlug = parts[1]
    if (!orgSlug) return null

    if (parts.length === 2) return { kind: 'org', orgSlug }

    if (parts[2] === 'context' && parts.length === 3) {
        return { kind: 'context', orgSlug }
    }

    if (parts[2] === 'metric' && parts.length === 4) {
        return { kind: 'globalMetric', orgSlug, metricSlug: parts[3] }
    }

    // /org/:org/:initiative/...
    const initiativeSlug = parts[2]
    if (!initiativeSlug || RESERVED_ORG_SEGMENTS.has(initiativeSlug)) return null

    if (parts.length === 3) {
        return { kind: 'initiative', orgSlug, initiativeSlug }
    }

    if (parts.length === 5) {
        const [, , , type, id] = parts
        if (type === 'metric') return { kind: 'metric', orgSlug, initiativeSlug, metricSlug: id }
        if (type === 'claim') return { kind: 'claim', orgSlug, initiativeSlug, claimId: id }
        if (type === 'story') return { kind: 'story', orgSlug, initiativeSlug, storyId: id }
        if (type === 'evidence') return { kind: 'evidence', orgSlug, initiativeSlug, evidenceId: id }
        if (type === 'beneficiary') return { kind: 'beneficiary', orgSlug, initiativeSlug, groupId: id }
    }

    return null
}

function esc(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function cleanText(value: unknown, fallback = ''): string {
    if (typeof value !== 'string') return fallback
    return value.replace(/\s+/g, ' ').trim()
}

function absoluteUrl(url: string | null | undefined, siteOrigin: string, fallbackPath: string): string {
    const fallback = `${siteOrigin}${fallbackPath.startsWith('/') ? fallbackPath : `/${fallbackPath}`}`
    if (!url) return fallback
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith('//')) return `https:${url}`
    return `${siteOrigin}${url.startsWith('/') ? url : `/${url}`}`
}

function isImageUrl(url: string | null | undefined): boolean {
    if (!url) return false
    return /\.(png|jpe?g|gif|webp|avif)(\?|$)/i.test(url) || /\/storage\/v1\/object\/public\//i.test(url)
}

async function apiGet<T>(apiBase: string, path: string): Promise<T | null> {
    const base = apiBase.replace(/\/$/, '')
    const res = await fetch(`${base}/api/public${path}`, {
        headers: { accept: 'application/json' },
        // Edge fetch — keep it snappy; fall open on timeout via AbortSignal if available
        signal: typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
            ? AbortSignal.timeout(4000)
            : undefined,
    })
    if (!res.ok) return null
    return (await res.json()) as T
}

export async function resolveOgMeta(
    pathname: string,
    apiBase: string,
    siteOrigin: string,
): Promise<OgMeta | null> {
    const route = parsePublicPath(pathname)
    if (!route) return null

    switch (route.kind) {
        case 'org':
        case 'context': {
            const data = await apiGet<{
                organization: {
                    name?: string
                    description?: string
                    statement?: string
                    logo_url?: string
                }
            }>(apiBase, `/organizations/${encodeURIComponent(route.orgSlug)}`)
            if (!data?.organization?.name) return null
            const org = data.organization
            const title =
                route.kind === 'context'
                    ? `${org.name} — Context`
                    : org.name!
            return {
                title,
                description:
                    cleanText(org.description) ||
                    cleanText(org.statement) ||
                    DEFAULT_DESCRIPTION,
                image: absoluteUrl(org.logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }

        case 'globalMetric': {
            const metric = await apiGet<{
                title?: string
                description?: string
                organization_name?: string
                organization_logo_url?: string
            }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}/metric/${encodeURIComponent(route.metricSlug)}`,
            )
            if (!metric?.title) return null
            return {
                title: metric.organization_name
                    ? `${metric.title} | ${metric.organization_name}`
                    : metric.title,
                description: cleanText(metric.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(metric.organization_logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }

        case 'initiative': {
            const initiative = await apiGet<{
                title?: string
                description?: string
                organization_name?: string
                organization_logo_url?: string
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}`,
            )
            if (!initiative?.title) return null
            return {
                title: initiative.organization_name
                    ? `${initiative.title} | ${initiative.organization_name}`
                    : initiative.title,
                description: cleanText(initiative.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(initiative.organization_logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }

        case 'metric': {
            const metric = await apiGet<{
                title?: string
                description?: string
                initiative?: { org_name?: string; brand_color?: string }
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}/metric/${encodeURIComponent(route.metricSlug)}`,
            )
            if (!metric?.title) return null
            // Logo isn't on metric detail — fetch org for image.
            const orgData = await apiGet<{ organization: { logo_url?: string; name?: string } }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}`,
            )
            const orgName = metric.initiative?.org_name || orgData?.organization?.name
            return {
                title: orgName ? `${metric.title} | ${orgName}` : metric.title,
                description: cleanText(metric.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(orgData?.organization?.logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }

        case 'claim': {
            const claim = await apiGet<{
                value?: number
                label?: string
                note?: string
                metric?: { title?: string; unit_of_measurement?: string }
                initiative?: { org_name?: string; title?: string }
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}/claim/${encodeURIComponent(route.claimId)}`,
            )
            if (!claim?.metric?.title) return null
            const orgData = await apiGet<{ organization: { logo_url?: string; name?: string } }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}`,
            )
            const orgName = claim.initiative?.org_name || orgData?.organization?.name
            const valueBit =
                claim.value != null
                    ? `${claim.value}${claim.metric.unit_of_measurement ? ` ${claim.metric.unit_of_measurement}` : ''}`
                    : ''
            const title = [claim.metric.title, valueBit, orgName].filter(Boolean).join(' · ')
            return {
                title,
                description:
                    cleanText(claim.note) ||
                    cleanText(claim.label) ||
                    `Impact claim for ${claim.metric.title}`,
                image: absoluteUrl(orgData?.organization?.logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }

        case 'story': {
            const story = await apiGet<{
                title?: string
                description?: string
                media_url?: string
                media_type?: string
                initiative?: { org_name?: string }
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}/story/${encodeURIComponent(route.storyId)}`,
            )
            if (!story?.title) return null
            const orgData = await apiGet<{ organization: { logo_url?: string; name?: string } }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}`,
            )
            // Photo → YouTube/Vimeo poster → org logo
            const photo =
                story.media_type === 'photo' && story.media_url ? story.media_url : null
            const videoThumb = getVideoThumbnailUrl(story.media_url)
            const preview = photo || videoThumb
            const orgName = story.initiative?.org_name || orgData?.organization?.name
            return {
                title: orgName ? `${story.title} | ${orgName}` : story.title,
                description: cleanText(story.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(
                    preview || orgData?.organization?.logo_url,
                    siteOrigin,
                    '/Nexuslogo.png',
                ),
                card: preview ? 'summary_large_image' : 'summary',
            }
        }

        case 'evidence': {
            const evidence = await apiGet<{
                title?: string
                description?: string
                file_url?: string
                files?: Array<{ file_url?: string; file_type?: string }>
                initiative?: { org_name?: string }
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}/evidence/${encodeURIComponent(route.evidenceId)}`,
            )
            if (!evidence?.title) return null
            const orgData = await apiGet<{ organization: { logo_url?: string; name?: string } }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}`,
            )
            const imageFile =
                evidence.files?.find(f => isImageUrl(f.file_url) || (f.file_type || '').startsWith('image/'))
                    ?.file_url ||
                (isImageUrl(evidence.file_url) ? evidence.file_url : null)
            // YouTube/Vimeo embeds stored as file URLs — use their poster frames.
            const videoThumb =
                evidence.files?.map(f => getVideoThumbnailUrl(f.file_url)).find(Boolean) ||
                getVideoThumbnailUrl(evidence.file_url) ||
                null
            const preview = imageFile || videoThumb
            const orgName = evidence.initiative?.org_name || orgData?.organization?.name
            return {
                title: orgName ? `${evidence.title} | ${orgName}` : evidence.title,
                description: cleanText(evidence.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(
                    preview || orgData?.organization?.logo_url,
                    siteOrigin,
                    '/Nexuslogo.png',
                ),
                card: preview ? 'summary_large_image' : 'summary',
            }
        }

        case 'beneficiary': {
            const group = await apiGet<{
                name?: string
                description?: string
                initiative?: { org_name?: string }
            }>(
                apiBase,
                `/initiatives/${encodeURIComponent(route.orgSlug)}/${encodeURIComponent(route.initiativeSlug)}/beneficiary/${encodeURIComponent(route.groupId)}`,
            )
            if (!group?.name) return null
            const orgData = await apiGet<{ organization: { logo_url?: string; name?: string } }>(
                apiBase,
                `/organizations/${encodeURIComponent(route.orgSlug)}`,
            )
            const orgName = group.initiative?.org_name || orgData?.organization?.name
            return {
                title: orgName ? `${group.name} | ${orgName}` : group.name,
                description: cleanText(group.description) || DEFAULT_DESCRIPTION,
                image: absoluteUrl(orgData?.organization?.logo_url, siteOrigin, '/Nexuslogo.png'),
                card: 'summary',
            }
        }
    }
}

export function renderOgHtml(meta: OgMeta, pageUrl: string): string {
    const title = esc(meta.title)
    const description = esc(meta.description || DEFAULT_DESCRIPTION)
    const image = esc(meta.image)
    const url = esc(pageUrl)
    const card = meta.card

    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${url}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Nexus Impacts" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${image}" />
  <meta property="og:url" content="${url}" />
  <meta name="twitter:card" content="${card}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${image}" />
</head>
<body>
  <p>${title}</p>
</body>
</html>`
}
