import { supabase } from '../utils/supabase'
import { openai, isOpenAIConfigured } from '../utils/openai'
import { composeBrandedPng, parseGraphicAspect, parseGraphicLayout, type GraphicChrome, type GraphicCopy } from '../utils/contentCompose'
import { masterWriterPrompt, refineMasterPrompt, versionsWriterPrompt } from '../prompts/nexusCopyFramework'
import { OrgAccessService } from './orgAccessService'
import { SubscriptionService } from './subscriptionService'
import {
    ContentChannel,
    ContentChannelVersion,
    ContentCopy,
    ContentDraftStatus,
    ContentJourney,
    ContentJourneyStatus,
    ContentMaster,
    ContentMediaItem,
    ContentOverlay,
    ContentPackage,
    ContentPost,
    ContentPostFormat,
    ContentPostKind,
    ContentSource,
    ContentSourceRef,
    ContentSourceType,
    ContentStoryType,
    ContentUsageFilter,
    GraphicLayout,
} from '../types'

const MAX_MEDIA = 10

type JourneyStat = { count: number; published: number; last: string | null; cover: string | null }

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'gif']
const SOURCE_PAGE = 21
const SOURCE_FETCH_CAP = 84

type OrgRow = {
    id: string
    name: string
    statement?: string | null
    is_demo?: boolean | null
    logo_url?: string | null
    brand_color?: string | null
    slug?: string | null
    is_public?: boolean | null
}

function httpError(status: number, message: string, code?: string): Error {
    const err = new Error(message) as Error & { status: number; code?: string }
    err.status = status
    if (code) err.code = code
    return err
}

function isImageFile(fileType?: string | null, fileUrl?: string | null): boolean {
    const type = (fileType || '').toLowerCase()
    const url = (fileUrl || '').toLowerCase()
    if (type.startsWith('image/')) return true
    if (IMAGE_EXTS.includes(type)) return true
    return IMAGE_EXTS.some(ext => url.includes(`.${ext}`))
}

function firstImageUrl(files: Array<{ file_url?: string; file_type?: string }> | undefined, fallback?: string | null): string | null {
    const fromFiles = (files || []).find(f => isImageFile(f.file_type, f.file_url))
    if (fromFiles?.file_url) return fromFiles.file_url
    if (fallback && isImageFile(null, fallback)) return fallback
    return null
}

function wrapEmailHtml(orgName: string, subject: string, body: string, imageUrl?: string | null): string {
    const paragraphs = (body || '')
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
        .join('')
    const img = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="" style="width:100%;max-width:560px;border-radius:8px;margin:0 0 16px;display:block" />`
        : ''
    return `<div style="font-family:Georgia,serif;color:#334155;max-width:560px">
<p style="margin:0 0 4px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#64748b">${escapeHtml(orgName)}</p>
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1e293b">${escapeHtml(subject)}</h1>
${img}
${paragraphs}
</div>`
}

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

function asLineCopy(value: string): string {
    return String(value || '')
        .replace(/\\n/g, '\n')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+\n/g, '\n')
        .trim()
}

function splitSentences(text: string): string {
    return text
        .split(/(?<=[.!?])\s+/)
        .map(part => part.trim())
        .filter(Boolean)
        .join('\n\n')
}

function explodeLineCopy(text: string): string {
    const cleaned = asLineCopy(text)
    if (!cleaned) return ''
    const rows = cleaned.split('\n')
    const spoken = rows.filter(row => row.trim())
    if (spoken.length >= 2) {
        return rows
            .map(row => {
                if (!row.trim()) return ''
                if (row.length < 90 || !/[.!?].+\S/.test(row)) return row.trim()
                return splitSentences(row)
            })
            .join('\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim()
    }
    return splitSentences(cleaned)
}

function fromCopyLines(lines: unknown, fallback: string): string {
    if (Array.isArray(lines) && lines.length > 0) {
        return explodeLineCopy(lines.map(line => String(line ?? '')).join('\n'))
    }
    return explodeLineCopy(fallback)
}

function asStanzaBody(lines: unknown, fallback: string): string {
    const raw = Array.isArray(lines) && lines.length > 0
        ? lines.map(line => String(line ?? '')).join('\n')
        : String(fallback || '')
    return explodeLineCopy(raw)
        .split(/\n+/)
        .map(row => row.trim())
        .filter(Boolean)
        .join('\n\n')
}

function publicOrgUrl(org: OrgRow): string | null {
    if (!org.is_public || !org.slug) return null
    const origin = (process.env.APP_URL || process.env.FRONTEND_URL || 'https://www.nexusimpacts.ai').replace(/\/+$/, '')
    return `${origin}/org/${org.slug}`
}

function withSeeMore(channel: ContentChannel, text: string, publicUrl: string | null): string {
    const body = (text || '').trim()
    if (/see more of our impact here/i.test(body) || /see more @nexusimpacts/i.test(body)) return body
    if (channel === 'instagram') return `${body}\n\nSee more @nexusimpacts`
    if (!publicUrl) return body
    return `${body}\n\nSee more of our impact here: ${publicUrl}`
}

function publicThumbUrl(publicUrl: string, size = 480): string {
    const marker = '/storage/v1/object/public/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return publicUrl
    const origin = publicUrl.slice(0, idx)
    const rest = publicUrl.slice(idx + marker.length).split('?')[0]
    return `${origin}/storage/v1/render/image/public/${rest}?width=${size}&height=${size}&resize=cover&quality=65`
}

function parseStoragePath(publicUrl: string): { bucket: string; path: string } | null {
    const marker = '/storage/v1/object/public/'
    const idx = publicUrl.indexOf(marker)
    if (idx === -1) return null
    const rest = publicUrl.slice(idx + marker.length).split('?')[0]
    const slash = rest.indexOf('/')
    if (slash <= 0) return null
    return {
        bucket: rest.slice(0, slash),
        path: decodeURIComponent(rest.slice(slash + 1)),
    }
}

function guessContentType(pathOrUrl: string): string {
    const lower = pathOrUrl.toLowerCase()
    if (lower.includes('.png')) return 'image/png'
    if (lower.includes('.webp')) return 'image/webp'
    if (lower.includes('.gif')) return 'image/gif'
    return 'image/jpeg'
}

function filenameFrom(title: string, contentType: string): string {
    const ext = contentType.includes('png') ? 'png'
        : contentType.includes('webp') ? 'webp'
            : contentType.includes('gif') ? 'gif'
                : 'jpg'
    const base = title
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'impact-photo'
    return `${base}.${ext}`
}

function asObj(value: unknown): any | null {
    if (!value) return null
    return Array.isArray(value) ? value[0] || null : value
}

function trimText(value: string, max: number): string {
    const text = value.replace(/\s+/g, ' ').trim()
    return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`
}

function formatDateRange(start?: string | null, end?: string | null): string | null {
    if (start && end && start !== end) return `${start} to ${end}`
    return start || end || null
}

function collectNames(rows: any[] | undefined, nestedKey: string): string[] {
    const names = (rows || [])
        .map(row => asObj(row?.[nestedKey])?.name)
        .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
    return Array.from(new Set(names))
}

function formatClaimLine(claim: any): string | null {
    if (!claim || claim.value == null) return null
    const kpi = asObj(claim.kpis)
    const unit = kpi?.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : ''
    const metric = kpi?.title || 'Result'
    const when = formatDateRange(claim.date_range_start, claim.date_range_end) || claim.date_represented || ''
    const note = claim.note || claim.label
    return `- ${metric}: ${claim.value}${unit}${when ? ` (${when})` : ''}${note ? `. ${trimText(String(note), 180)}` : ''}`
}

function formatMetricLine(kpi: any): string {
    if (!kpi?.title) return ''
    const bits = [kpi.category, kpi.metric_type, kpi.unit_of_measurement].filter(Boolean)
    const desc = kpi.description ? `: ${trimText(kpi.description, 160)}` : ''
    return `- ${kpi.title}${bits.length ? ` (${bits.join(', ')})` : ''}${desc}`
}

function sourceKey(source: Pick<ContentSource, 'source_type' | 'source_id'>): string {
    return `${source.source_type}:${source.source_id}`
}

function extrasFacts(extras: ContentSource[]): string {
    if (extras.length === 0) return ''
    const lines = extras.map(s => {
        const desc = s.description?.trim() ? `: ${trimText(s.description, 160)}` : ''
        return `- ${s.title}${desc} (${s.initiative_title}, ${s.date_represented})`
    })
    return `Other photos in this carousel post (the first photo above is the cover):\n${lines.join('\n')}`
}

function asSourceRefs(value: unknown): ContentSourceRef[] {
    if (!Array.isArray(value)) return []
    return value
        .filter((row: any) => (row?.source_type === 'evidence' || row?.source_type === 'story') && typeof row?.source_id === 'string')
        .map((row: any) => ({ source_type: row.source_type, source_id: row.source_id }))
}

function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
    const message = error?.message || ''
    return error?.code === '42P01' || /does not exist/i.test(message) || /schema cache/i.test(message)
}

function schemaMissing(table: string): Error {
    return httpError(
        503,
        `Content library is missing ${table}. Run database/migrations/add_content_posts.sql, add_content_engine_v1.sql, add_content_journeys.sql, then add_content_publishing.sql.`,
        'SCHEMA_MISSING'
    )
}

const CHANNELS: ContentChannel[] = ['instagram', 'linkedin', 'facebook', 'donor_email', 'newsletter', 'sms']

function channelKind(channel: ContentChannel): { kind: ContentPostKind; format: ContentPostFormat } {
    if (channel === 'donor_email' || channel === 'newsletter') return { kind: 'email', format: 'email' }
    if (channel === 'linkedin') return { kind: 'social', format: 'linkedin' }
    return { kind: 'social', format: 'ig_square' }
}

function defaultLayout(storyType: ContentStoryType): GraphicLayout {
    if (storyType === 'glance') return 'stats'
    if (storyType === 'moment') return 'title'
    return 'clean'
}

function daysAgo(iso?: string | null): number {
    if (!iso) return 365
    const then = new Date(iso).getTime()
    if (!Number.isFinite(then)) return 365
    return Math.max(0, (Date.now() - then) / 86400000)
}

function uniqueMetrics(kpis: Array<any | null>): any[] {
    const seen = new Set<string>()
    const out: any[] = []
    for (const kpi of kpis) {
        if (!kpi?.id && !kpi?.title) continue
        const key = kpi.id || kpi.title
        if (seen.has(key)) continue
        seen.add(key)
        out.push(kpi)
    }
    return out.filter(k => formatMetricLine(k))
}

export class ContentService {
    static async assertStudioAccess(userId: string, requestedOrgId?: string): Promise<{
        organizationId: string
        org: OrgRow
    }> {
        const ctx = await OrgAccessService.resolveOrgContext(userId, requestedOrgId)
        if (!ctx) throw OrgAccessService.accessDenied()

        const { data: org, error } = await supabase
            .from('organizations')
            .select('id, name, statement, is_demo, logo_url, brand_color, slug, is_public')
            .eq('id', ctx.organizationId)
            .maybeSingle()
        if (error) throw new Error(`Failed to load organization: ${error.message}`)
        if (!org) throw OrgAccessService.accessDenied()

        const features = await SubscriptionService.getFeatureAccess(userId, requestedOrgId)
        if (!features.contentStudio && !org.is_demo) {
            throw httpError(403, 'Impact content is available on Growth and Pro.', 'FEATURE_GATED')
        }

        return { organizationId: ctx.organizationId, org }
    }

    static async listSources(
        userId: string,
        requestedOrgId?: string,
        opts?: {
            offset?: number
            limit?: number
            sourceType?: ContentSourceType | 'all'
            singleDate?: string
            startDate?: string
            endDate?: string
            usage?: ContentUsageFilter
            initiativeId?: string
        }
    ): Promise<{ sources: ContentSource[]; has_more: boolean }> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        let initiativeIds = await OrgAccessService.getAccessibleInitiativeIds(userId, requestedOrgId)
        if (opts?.initiativeId) initiativeIds = initiativeIds.filter(id => id === opts.initiativeId)
        if (initiativeIds.length === 0) return { sources: [], has_more: false }

        const offset = Math.max(0, opts?.offset || 0)
        const limit = Math.min(Math.max(1, opts?.limit || SOURCE_PAGE), SOURCE_PAGE)
        const fetchCount = Math.min(offset + limit, SOURCE_FETCH_CAP)
        const sourceType = opts?.sourceType === 'evidence' || opts?.sourceType === 'story' ? opts.sourceType : 'all'

        const { data: initiatives } = await supabase
            .from('initiatives')
            .select('id, title')
            .eq('organization_id', organizationId)
            .in('id', initiativeIds)
        const titleById = new Map((initiatives || []).map(i => [i.id as string, i.title as string]))

        const applyDates = (query: any) => {
            if (opts?.singleDate) return query.eq('date_represented', opts.singleDate)
            if (opts?.startDate) query = query.gte('date_represented', opts.startDate)
            if (opts?.endDate) query = query.lte('date_represented', opts.endDate)
            return query
        }

        const wantEvidence = sourceType !== 'story'
        const wantStories = sourceType !== 'evidence'

        const [evidenceRes, storiesRes] = await Promise.all([
            wantEvidence
                ? applyDates(
                    supabase
                        .from('evidence')
                        .select(`
                            id, title, date_represented, initiative_id, file_url, file_type,
                            approval_status,
                            evidence_files(file_url, file_type, display_order)
                        `)
                        .eq('type', 'visual_proof')
                        .in('initiative_id', initiativeIds)
                        .or('approval_status.eq.approved,approval_status.is.null')
                )
                    .order('date_represented', { ascending: false })
                    .limit(fetchCount)
                : Promise.resolve({ data: [] as any[], error: null }),
            wantStories
                ? applyDates(
                    supabase
                        .from('stories')
                        .select('id, title, date_represented, initiative_id, media_url, media_type')
                        .eq('media_type', 'photo')
                        .in('initiative_id', initiativeIds)
                        .not('media_url', 'is', null)
                )
                    .order('date_represented', { ascending: false })
                    .limit(fetchCount)
                : Promise.resolve({ data: [] as any[], error: null }),
        ])

        if (evidenceRes.error) throw new Error(`Failed to load evidence: ${evidenceRes.error.message}`)
        if (storiesRes.error) throw new Error(`Failed to load stories: ${storiesRes.error.message}`)

        const sources: ContentSource[] = []

        for (const row of evidenceRes.data || []) {
            const files = ((row as any).evidence_files || [])
                .slice()
                .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
            const image_url = firstImageUrl(files, row.file_url)
            if (!image_url) continue
            sources.push({
                source_type: 'evidence',
                source_id: row.id,
                title: row.title,
                date_represented: row.date_represented,
                image_url,
                thumb_url: publicThumbUrl(image_url),
                initiative_id: row.initiative_id,
                initiative_title: titleById.get(row.initiative_id) || 'Program',
            })
        }

        for (const row of storiesRes.data || []) {
            if (!row.media_url || !isImageFile(null, row.media_url)) continue
            sources.push({
                source_type: 'story',
                source_id: row.id,
                title: row.title,
                date_represented: row.date_represented,
                image_url: row.media_url,
                thumb_url: publicThumbUrl(row.media_url),
                initiative_id: row.initiative_id,
                initiative_title: titleById.get(row.initiative_id) || 'Program',
            })
        }

        sources.sort((a, b) => (a.date_represented < b.date_represented ? 1 : -1))
        const usedKeys = await this.loadUsedSourceKeys(organizationId)
        for (const source of sources) source.used = usedKeys.has(sourceKey(source))
        const usage = opts?.usage
        const filtered = usage === 'unused'
            ? sources.filter(s => !s.used)
            : usage === 'used'
                ? sources.filter(s => s.used)
                : sources
        const page = filtered.slice(offset, offset + limit)
        const hitFetchCap = (evidenceRes.data || []).length >= fetchCount || (storiesRes.data || []).length >= fetchCount
        const has_more = filtered.length > offset + limit || (hitFetchCap && page.length === limit)
        return { sources: page, has_more }
    }

    static async listPosts(userId: string, requestedOrgId?: string): Promise<ContentPost[]> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const { data, error } = await supabase
            .from('content_posts')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
        if (error) throw new Error(`Failed to load posts: ${error.message}`)
        return (data || []) as ContentPost[]
    }

    static async createPost(
        userId: string,
        input: {
            kind: ContentPostKind
            format?: ContentPostFormat
            source_type: ContentSourceType
            source_id: string
            caption?: string | null
            email_subject?: string | null
            email_body?: string | null
            overlay?: ContentOverlay | null
        },
        requestedOrgId?: string
    ): Promise<ContentPost> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        const source = await this.loadSource(userId, input.source_type, input.source_id, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const kind = input.kind === 'email' ? 'email' : 'social'
        const format: ContentPostFormat = kind === 'email'
            ? 'email'
            : (input.format === 'linkedin' ? 'linkedin' : 'ig_square')

        const email_body = input.email_body?.trim() || null
        const email_subject = input.email_subject?.trim() || null

        const row = {
            organization_id: organizationId,
            kind,
            format,
            source_type: source.source_type,
            source_id: source.source_id,
            caption: input.caption?.trim() || null,
            email_subject,
            email_body,
            email_html: kind === 'email' && email_subject && email_body
                ? wrapEmailHtml(org.name, email_subject, email_body, source.image_url)
                : null,
            image_url: source.image_url,
            overlay: input.overlay || source.overlay || null,
            created_by: userId,
        }

        const { data, error } = await supabase
            .from('content_posts')
            .insert([row])
            .select('*')
            .single()
        if (error) throw new Error(`Failed to save post: ${error.message}`)
        return data as ContentPost
    }

    static async updatePost(
        userId: string,
        postId: string,
        patch: {
            caption?: string | null
            email_subject?: string | null
            email_body?: string | null
            kind?: ContentPostKind
            format?: ContentPostFormat
        },
        requestedOrgId?: string
    ): Promise<ContentPost> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        const { data: existing, error: loadError } = await supabase
            .from('content_posts')
            .select('*')
            .eq('id', postId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (loadError) throw new Error(`Failed to load post: ${loadError.message}`)
        if (!existing) throw OrgAccessService.accessDenied()

        const next = {
            caption: patch.caption !== undefined ? patch.caption : existing.caption,
            email_subject: patch.email_subject !== undefined ? patch.email_subject : existing.email_subject,
            email_body: patch.email_body !== undefined ? patch.email_body : existing.email_body,
            kind: patch.kind || existing.kind,
            format: patch.format || existing.format,
        }
        const email_html = next.kind === 'email' && next.email_subject && next.email_body
            ? wrapEmailHtml(org.name, next.email_subject, next.email_body, existing.image_url)
            : existing.email_html

        const { data, error } = await supabase
            .from('content_posts')
            .update({ ...next, email_html })
            .eq('id', postId)
            .eq('organization_id', organizationId)
            .select('*')
            .single()
        if (error) throw new Error(`Failed to update post: ${error.message}`)
        return data as ContentPost
    }

    static async deletePost(userId: string, postId: string, requestedOrgId?: string): Promise<void> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const { data: existing } = await supabase
            .from('content_posts')
            .select('id')
            .eq('id', postId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (!existing) throw OrgAccessService.accessDenied()
        const { error } = await supabase
            .from('content_posts')
            .delete()
            .eq('id', postId)
            .eq('organization_id', organizationId)
        if (error) throw new Error(`Failed to delete post: ${error.message}`)
    }

    static async generateCopy(
        userId: string,
        sourceType: ContentSourceType,
        sourceId: string,
        requestedOrgId?: string
    ): Promise<ContentCopy> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        if (!isOpenAIConfigured() || !openai) {
            throw httpError(500, 'OpenAI API key not configured')
        }

        const quota = await SubscriptionService.checkAiReportQuota(userId, requestedOrgId)
        if (!quota.canGenerate) {
            throw httpError(
                403,
                `You've used your ${quota.limit} AI generation for today on the Free plan. Upgrade to Growth or Pro for unlimited.`,
                'AI_REPORT_LIMIT_REACHED'
            )
        }

        const source = await this.loadSource(userId, sourceType, sourceId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const facts = await this.loadCopyFacts(source, org)

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 1100,
            messages: [
                {
                    role: 'system',
                    content: `${masterWriterPrompt('moment')}

Also return JSON keys caption, email_subject, email_body for this legacy endpoint.
caption: Instagram/Facebook moment style, with line breaks and 1-3 emojis.
email_subject: max 70 characters, no emoji.
email_body: donor-email depth, line breaks, no emojis.`,
                },
                {
                    role: 'user',
                    content: facts,
                },
            ],
        })

        const raw = completion.choices[0]?.message?.content || '{}'
        let parsed: Partial<ContentCopy> & { caption?: string } = {}
        try {
            parsed = JSON.parse(raw)
        } catch {
            parsed = {}
        }

        const caption = (parsed.caption || parsed.caption_short || parsed.caption_linkedin || '').trim()
        const copy: ContentCopy = {
            caption_short: caption,
            caption_linkedin: caption,
            email_subject: (parsed.email_subject || '').trim(),
            email_body: (parsed.email_body || '').trim(),
        }
        if (!copy.caption_short && !copy.email_body) {
            throw httpError(500, 'Failed to generate copy')
        }

        if (organizationId) {
            await SubscriptionService.logAiReport(organizationId, userId)
        }
        return copy
    }

    static async downloadImage(
        userId: string,
        sourceType: ContentSourceType,
        sourceId: string,
        requestedOrgId?: string
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const source = await this.loadSource(userId, sourceType, sourceId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const parsed = parseStoragePath(source.image_url)
        if (parsed) {
            const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path)
            if (!error && data) {
                const buffer = Buffer.from(await data.arrayBuffer())
                const contentType = data.type || guessContentType(parsed.path)
                return { buffer, contentType, filename: filenameFrom(source.title, contentType) }
            }
        }

        const res = await fetch(source.image_url)
        if (!res.ok) throw httpError(502, 'Could not fetch photo')
        const buffer = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || guessContentType(source.image_url)
        return { buffer, contentType, filename: filenameFrom(source.title, contentType) }
    }

    static async composeGraphic(
        userId: string,
        sourceType: ContentSourceType,
        sourceId: string,
        requestedOrgId?: string,
        opts?: {
            layout?: string
            aspect?: string
            chrome?: Partial<GraphicChrome>
            copy?: GraphicCopy
        }
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const { org } = await this.assertStudioAccess(userId, requestedOrgId)
        const source = await this.loadSource(userId, sourceType, sourceId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const photo = await this.downloadImage(userId, sourceType, sourceId, requestedOrgId)
        const [logo, overlay, location] = await Promise.all([
            opts?.chrome?.logo === false ? Promise.resolve(null) : (org.logo_url ? this.fetchBinary(org.logo_url) : Promise.resolve(null)),
            this.loadOverlay(source),
            this.loadLocation(source),
        ])

        const buffer = await composeBrandedPng({
            photo: photo.buffer,
            logo,
            orgName: org.name,
            photoTitle: source.title,
            location,
            brandColor: org.brand_color,
            overlay,
            layout: parseGraphicLayout(opts?.layout),
            aspect: parseGraphicAspect(opts?.aspect),
            chrome: opts?.chrome,
            copy: opts?.copy,
        })
        return {
            buffer,
            contentType: 'image/png',
            filename: filenameFrom(source.title, 'image/png'),
        }
    }

    /** Title, description, program, claims, and metrics for the generator. */
    private static async loadCopyFacts(source: ContentSource, org: OrgRow): Promise<string> {
        const sections: string[] = [
            `Organization: ${org.name}`,
            org.statement?.trim() ? `Mission: ${org.statement.trim()}` : '',
            `Photo type: ${source.source_type === 'story' ? 'story' : 'visual evidence'}`,
            `Title: ${source.title}`,
            `Description: ${source.description?.trim() || '(none)'}`,
            `Date: ${source.date_represented}`,
            `Program: ${source.initiative_title}`,
        ]
        const extra = await this.loadOrgStoryContext(org.id)
        if (extra) sections.push(extra)

        if (source.source_type === 'evidence') {
            const { data, error } = await supabase
                .from('evidence')
                .select(`
                    date_range_start, date_range_end,
                    initiatives(title, description),
                    evidence_locations(locations(name)),
                    evidence_metric_tags(metric_tags(name)),
                    evidence_kpis(kpis(id, title, description, unit_of_measurement, metric_type, category)),
                    evidence_kpi_updates(
                        kpi_updates(
                            id, value, date_represented, date_range_start, date_range_end, note, label,
                            kpis(id, title, description, unit_of_measurement, metric_type, category)
                        )
                    )
                `)
                .eq('id', source.source_id)
                .maybeSingle()
            if (error) {
                console.error('[content] evidence context failed:', error.message)
            } else {

            const init = asObj((data as any)?.initiatives)
            if (init?.description) sections.push(`Program about: ${trimText(init.description, 400)}`)
            const range = formatDateRange((data as any)?.date_range_start, (data as any)?.date_range_end)
            if (range) sections.push(`Photo covers: ${range}`)

            const locations = collectNames((data as any)?.evidence_locations, 'locations')
            if (locations.length) sections.push(`Locations: ${locations.join(', ')}`)

            const tags = collectNames((data as any)?.evidence_metric_tags, 'metric_tags')
            if (tags.length) sections.push(`Themes: ${tags.join(', ')}`)

            const claims = ((data as any)?.evidence_kpi_updates || [])
                .map((link: any) => asObj(link?.kpi_updates))
                .filter(Boolean)
                .slice(0, 8)
            const claimLines = claims.map((claim: any) => formatClaimLine(claim)).filter(Boolean)
            sections.push(
                claimLines.length
                    ? `Connected claims (this photo proves these results):\n${claimLines.join('\n')}`
                    : 'Connected claims: none. Do not invent a number.'
            )

            const metrics = uniqueMetrics([
                ...claims.map((c: any) => asObj(c?.kpis)),
                ...((data as any)?.evidence_kpis || []).map((link: any) => asObj(link?.kpis)),
            ])
            if (metrics.length) sections.push(`Connected metrics:\n${metrics.map(formatMetricLine).join('\n')}`)
            }
        } else {
            const { data, error } = await supabase
                .from('stories')
                .select(`
                    initiatives(title, description),
                    story_locations(locations(name)),
                    story_metric_tags(metric_tags(name)),
                    story_beneficiaries(beneficiary_groups(name, description))
                `)
                .eq('id', source.source_id)
                .maybeSingle()
            if (error) {
                console.error('[content] story context failed:', error.message)
            } else {

            const init = asObj((data as any)?.initiatives)
            if (init?.description) sections.push(`Program about: ${trimText(init.description, 400)}`)

            const locations = collectNames((data as any)?.story_locations, 'locations')
            if (locations.length) sections.push(`Locations: ${locations.join(', ')}`)

            const tags = collectNames((data as any)?.story_metric_tags, 'metric_tags')
            if (tags.length) sections.push(`Themes: ${tags.join(', ')}`)

            const groups = ((data as any)?.story_beneficiaries || [])
                .map((link: any) => asObj(link?.beneficiary_groups))
                .filter(Boolean)
            if (groups.length) {
                sections.push(
                    `People:\n${groups.map((g: any) => `- ${g.name}${g.description ? `: ${trimText(g.description, 160)}` : ''}`).join('\n')}`
                )
            }

            sections.push('Connected claims: none on stories. Do not invent a number unless a program metric below is clearly about this photo.')
            }
        }

        const { data: kpis } = await supabase
            .from('kpis')
            .select('title, description, unit_of_measurement, metric_type, category')
            .eq('initiative_id', source.initiative_id)
            .is('archived_at', null)
            .order('display_order', { ascending: true })
            .limit(8)
        const programMetrics = (kpis || []).map(formatMetricLine).filter(Boolean)
        if (programMetrics.length) {
            sections.push(`Program metrics (context for the work, not all are about this photo):\n${programMetrics.join('\n')}`)
        }

        return sections.filter(Boolean).join('\n')
    }

    private static async loadOverlay(source: ContentSource): Promise<ContentOverlay | null> {
        if (source.source_type !== 'evidence') return null
        const { data, error } = await supabase
            .from('evidence')
            .select(`
                evidence_kpi_updates(
                    kpi_updates(
                        value, date_represented,
                        kpis(title, unit_of_measurement)
                    )
                )
            `)
            .eq('id', source.source_id)
            .maybeSingle()
        if (error || !data) return null

        const claims = ((data as any).evidence_kpi_updates || [])
            .map((link: any) => asObj(link?.kpi_updates))
            .filter((claim: any) => claim && claim.value != null)
            .sort((a: any, b: any) => String(b.date_represented || '').localeCompare(String(a.date_represented || '')))
        const claim = claims[0]
        if (!claim) return null
        const kpi = asObj(claim.kpis)
        const value = Number(claim.value)
        if (Number.isNaN(value)) return null
        return {
            label: kpi?.title || 'Result',
            value,
            unit: kpi?.unit_of_measurement || '',
        }
    }

    private static async loadLocation(source: ContentSource): Promise<string | null> {
        if (source.source_type === 'evidence') {
            const { data, error } = await supabase
                .from('evidence')
                .select('evidence_locations(locations(name))')
                .eq('id', source.source_id)
                .maybeSingle()
            if (error || !data) return null
            const names = collectNames((data as any).evidence_locations, 'locations')
            return names.slice(0, 2).join(', ') || null
        }
        const { data, error } = await supabase
            .from('stories')
            .select('story_locations(locations(name))')
            .eq('id', source.source_id)
            .maybeSingle()
        if (error || !data) return null
        const names = collectNames((data as any).story_locations, 'locations')
        return names.slice(0, 2).join(', ') || null
    }

    private static async fetchBinary(url: string): Promise<Buffer | null> {
        const parsed = parseStoragePath(url)
        if (parsed) {
            const { data, error } = await supabase.storage.from(parsed.bucket).download(parsed.path)
            if (!error && data) return Buffer.from(await data.arrayBuffer())
        }
        try {
            const res = await fetch(url)
            if (!res.ok) return null
            return Buffer.from(await res.arrayBuffer())
        } catch {
            return null
        }
    }

    private static async loadSource(
        userId: string,
        sourceType: ContentSourceType,
        sourceId: string,
        requestedOrgId?: string
    ): Promise<ContentSource | null> {
        const initiativeIds = await OrgAccessService.getAccessibleInitiativeIds(userId, requestedOrgId)
        if (initiativeIds.length === 0) return null

        if (sourceType === 'evidence') {
            const { data, error } = await supabase
                .from('evidence')
                .select(`
                    id, title, description, date_represented, initiative_id, file_url,
                    approval_status, type,
                    evidence_files(file_url, file_type, display_order),
                    initiatives(title)
                `)
                .eq('id', sourceId)
                .maybeSingle()
            if (error) throw new Error(`Failed to load evidence: ${error.message}`)
            if (!data || data.type !== 'visual_proof') return null
            // Pending stays out of the photo library. A photo just logged from
            // content can still be drafted by id until it is approved.
            if (!initiativeIds.includes(data.initiative_id)) return null
            const files = ((data as any).evidence_files || [])
                .slice()
                .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
            const image_url = firstImageUrl(files, data.file_url)
            if (!image_url) return null
            return {
                source_type: 'evidence',
                source_id: data.id,
                title: data.title,
                description: data.description || undefined,
                date_represented: data.date_represented,
                image_url,
                initiative_id: data.initiative_id,
                initiative_title: (data as any).initiatives?.title || 'Program',
            }
        }

        const { data, error } = await supabase
            .from('stories')
            .select('id, title, description, date_represented, initiative_id, media_url, media_type, initiatives(title)')
            .eq('id', sourceId)
            .maybeSingle()
        if (error) throw new Error(`Failed to load story: ${error.message}`)
        if (!data || data.media_type !== 'photo' || !data.media_url) return null
        if (!initiativeIds.includes(data.initiative_id)) return null
        if (!isImageFile(null, data.media_url)) return null
        return {
            source_type: 'story',
            source_id: data.id,
            title: data.title,
            description: data.description || undefined,
            date_represented: data.date_represented,
            image_url: data.media_url,
            initiative_id: data.initiative_id,
            initiative_title: (data as any).initiatives?.title || 'Program',
        }
    }

    static async recommend(
        userId: string,
        requestedOrgId?: string,
        _storyType?: ContentStoryType
    ): Promise<ContentMaster> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const { sources } = await this.listSources(userId, requestedOrgId, { offset: 0, limit: SOURCE_PAGE, usage: 'all' })
        // Pull extra pages so scoring sees more than one screen of photos.
        let all = [...sources]
        let offset = sources.length
        while (all.length < SOURCE_FETCH_CAP) {
            const next = await this.listSources(userId, requestedOrgId, { offset, limit: SOURCE_PAGE, usage: 'all' })
            if (next.sources.length === 0) break
            all = all.concat(next.sources)
            offset += next.sources.length
            if (!next.has_more) break
        }
        if (all.length === 0) {
            throw httpError(404, 'No photos to share yet. Log visual evidence or a photo story first.', 'NO_SOURCES')
        }

        const evidenceIds = all.filter(s => s.source_type === 'evidence').map(s => s.source_id)
        const [claimRows, recentTypes] = await Promise.all([
            evidenceIds.length
                ? supabase.from('evidence_kpi_updates').select('evidence_id').in('evidence_id', evidenceIds)
                : Promise.resolve({ data: [] as Array<{ evidence_id: string }>, error: null }),
            this.loadRecentStoryTypes(organizationId),
        ])

        const withClaims = new Set((claimRows.data || []).map(r => r.evidence_id))

        const scored = all.map(source => {
            let score = source.used ? 8 : 42
            score += Math.max(0, 30 - daysAgo(source.date_represented))
            if (recentTypes.includes('moment') && source.used) score -= 12
            return { source, story_type: 'moment' as const, score }
        }).sort((a, b) => b.score - a.score)

        const pick = scored[0]
        const why = this.recommendWhy(pick.source, 'moment', withClaims.has(pick.source.source_id), !pick.source.used)
        return this.generateMaster(
            userId,
            pick.source.source_type,
            pick.source.source_id,
            'moment',
            why,
            requestedOrgId
        )
    }

    static async generateMaster(
        userId: string,
        sourceType: ContentSourceType,
        sourceId: string,
        storyType: ContentStoryType,
        why?: string,
        requestedOrgId?: string,
        opts?: { journeyId?: string | null; packageId?: string | null; extras?: ContentSourceRef[]; ideaId?: string | null }
    ): Promise<ContentMaster> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        this.assertOpenAi()
        await this.assertQuota(userId, requestedOrgId)
        const journeyId = opts?.journeyId || null
        storyType = journeyId ? 'journey' : 'moment'
        const journeyFacts = journeyId ? await this.loadJourneyFacts(organizationId, journeyId, opts?.packageId || undefined) : ''
        const extras = await this.loadExtras(userId, opts?.extras, { source_type: sourceType, source_id: sourceId }, requestedOrgId)

        const source = await this.loadSource(userId, sourceType, sourceId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')
        const usedKeys = await this.loadUsedSourceKeys(organizationId)
        source.used = usedKeys.has(sourceKey(source))
        const [overlay, location] = await Promise.all([
            this.loadOverlay(source),
            this.loadLocation(source),
        ])
        source.overlay = overlay
        source.location = location

        const ideaFacts = opts?.ideaId ? await this.loadIdeaFacts(organizationId, opts.ideaId) : ''
        const facts = [await this.loadCopyFacts(source, org), extrasFacts(extras), journeyFacts, ideaFacts].filter(Boolean).join('\n\n')
        const completion = await openai!.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.7,
            max_tokens: 450,
            messages: [
                {
                    role: 'system',
                    content: masterWriterPrompt(storyType),
                },
                { role: 'user', content: facts },
            ],
        })
        const parsed = this.parseJson(completion.choices[0]?.message?.content)
        const hook = String(parsed.hook || source.title).trim()
        const body = asStanzaBody(parsed.body_lines || parsed.lines, parsed.body || source.description || '')
        if (!hook || !body) throw httpError(500, 'Failed to write the story')
        if (organizationId) await SubscriptionService.logAiReport(organizationId, userId)

        return {
            story_type: storyType,
            hook,
            body,
            evidence_line: '',
            cta: String(parsed.cta || 'Learn more about our work.').trim(),
            why: (why || '').trim(),
            layout: defaultLayout(storyType),
            source,
            extras,
        }
    }

    static async refineMaster(
        userId: string,
        input: {
            source_type: ContentSourceType
            source_id: string
            story_type: ContentStoryType
            hook: string
            body: string
            evidence_line?: string
            cta?: string
            context: string
            why?: string
            journey_id?: string | null
            package_id?: string | null
            extras?: ContentSourceRef[]
        },
        requestedOrgId?: string
    ): Promise<ContentMaster> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        this.assertOpenAi()
        await this.assertQuota(userId, requestedOrgId)
        const context = String(input.context || '').trim()
        if (!context) throw httpError(400, 'Add context first')
        const storyType: ContentStoryType = input.journey_id ? 'journey' : 'moment'
        const journeyFacts = input.journey_id
            ? await this.loadJourneyFacts(organizationId, input.journey_id, input.package_id || undefined)
            : ''

        const source = await this.loadSource(userId, input.source_type, input.source_id, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')
        const usedKeys = await this.loadUsedSourceKeys(organizationId)
        source.used = usedKeys.has(sourceKey(source))
        const [overlay, location] = await Promise.all([
            this.loadOverlay(source),
            this.loadLocation(source),
        ])
        source.overlay = overlay
        source.location = location
        const extras = await this.loadExtras(userId, input.extras, source, requestedOrgId)

        const facts = [await this.loadCopyFacts(source, org), extrasFacts(extras), journeyFacts].filter(Boolean).join('\n\n')
        const draft = [
            `HOOK: ${input.hook}`,
            `BODY: ${input.body}`,
            `CTA: ${input.cta || ''}`,
            `USER CONTEXT:\n${context.slice(0, 4000)}`,
        ].join('\n')
        const completion = await openai!.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.65,
            max_tokens: 450,
            messages: [
                { role: 'system', content: refineMasterPrompt() },
                { role: 'user', content: `${draft}\n\nFACTS:\n${facts}` },
            ],
        })
        const parsed = this.parseJson(completion.choices[0]?.message?.content)
        const hook = String(input.hook || '').trim()
        const body = asStanzaBody(parsed.body_lines || parsed.lines, parsed.body || input.body)
        if (!hook || !body) throw httpError(500, 'Failed to update the story')
        if (organizationId) await SubscriptionService.logAiReport(organizationId, userId)

        return {
            story_type: storyType,
            hook,
            body,
            evidence_line: input.evidence_line || '',
            cta: String(input.cta || 'Learn more about our work.').trim(),
            why: (input.why || '').trim(),
            layout: defaultLayout(storyType),
            source,
            extras,
        }
    }

    static async generateVersions(
        userId: string,
        input: {
            source_type: ContentSourceType
            source_id: string
            story_type: ContentStoryType
            hook: string
            body: string
            evidence_line?: string
            cta?: string
            context?: string
            channels: ContentChannel[]
            journey_id?: string | null
            package_id?: string | null
            extras?: ContentSourceRef[]
        },
        requestedOrgId?: string
    ): Promise<ContentChannelVersion[]> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        this.assertOpenAi()
        await this.assertQuota(userId, requestedOrgId)
        const channels = (input.channels || []).filter((c): c is ContentChannel => CHANNELS.includes(c))
        if (channels.length === 0) throw httpError(400, 'Pick at least one channel')

        const source = await this.loadSource(userId, input.source_type, input.source_id, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')
        const journeyFacts = input.journey_id
            ? await this.loadJourneyFacts(organizationId, input.journey_id, input.package_id || undefined)
            : ''
        const extras = await this.loadExtras(userId, input.extras, source, requestedOrgId)
        const facts = [await this.loadCopyFacts(source, org), extrasFacts(extras), journeyFacts].filter(Boolean).join('\n\n')
        const extra = String(input.context || '').trim()
        const master = [
            `HOOK: ${input.hook}`,
            `BODY: ${input.body}`,
            `CTA: ${input.cta || ''}`,
            extra ? `USER CONTEXT:\n${extra.slice(0, 4000)}` : '',
        ].filter(Boolean).join('\n')

        const completion = await openai!.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            temperature: 0.75,
            max_tokens: 2200,
            messages: [
                {
                    role: 'system',
                    content: versionsWriterPrompt(channels),
                },
                { role: 'user', content: `${master}\n\nFACTS:\n${facts}` },
            ],
        })
        const parsed = this.parseJson(completion.choices[0]?.message?.content)
        const raw = Array.isArray(parsed.versions) ? parsed.versions : []
        const byChannel = new Map<string, any>()
        for (const row of raw) {
            if (row?.channel) byChannel.set(row.channel, row)
        }
        const seeMoreUrl = publicOrgUrl(org)
        const versions: ContentChannelVersion[] = channels.map(channel => {
            const row = byChannel.get(channel) || {}
            if (channel === 'donor_email' || channel === 'newsletter') {
                return {
                    channel,
                    email_subject: asLineCopy(row.email_subject || input.hook).slice(0, 80),
                    email_body: withSeeMore(
                        channel,
                        fromCopyLines(row.email_lines || row.body_lines, row.email_body || `${input.body}\n\n${input.cta || ''}`),
                        seeMoreUrl
                    ),
                }
            }
            const fallback = channel === 'sms'
                ? input.hook.slice(0, 160)
                : [input.hook, input.body, input.cta].filter(Boolean).join('\n\n')
            return {
                channel,
                caption: withSeeMore(
                    channel,
                    fromCopyLines(row.caption_lines || row.lines, row.caption || fallback),
                    seeMoreUrl
                ),
            }
        })
        if (organizationId) await SubscriptionService.logAiReport(organizationId, userId)
        return versions
    }

    static async listPackages(
        userId: string,
        requestedOrgId?: string,
        opts?: { journeyId?: string | 'none'; packageId?: string }
    ): Promise<ContentPackage[]> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        let query = supabase
            .from('content_packages')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
        if (opts?.journeyId === 'none') query = query.is('journey_id', null)
        else if (opts?.journeyId) query = query.eq('journey_id', opts.journeyId)
        if (opts?.packageId) query = query.eq('id', opts.packageId)
        const { data, error } = await query
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing('content_packages')
            throw new Error(`Failed to load packages: ${error.message}`)
        }
        const packages = (data || []) as ContentPackage[]
        if (packages.length === 0) return []
        const { data: posts, error: postsError } = await supabase
            .from('content_posts')
            .select('*')
            .eq('organization_id', organizationId)
            .in('package_id', packages.map(p => p.id))
            .order('created_at', { ascending: true })
        if (postsError && !isMissingRelation(postsError)) {
            throw new Error(`Failed to load versions: ${postsError.message}`)
        }
        const byPackage = new Map<string, ContentPost[]>()
        for (const post of (posts || []) as ContentPost[]) {
            if (!post.package_id) continue
            const list = byPackage.get(post.package_id) || []
            list.push(post)
            byPackage.set(post.package_id, list)
        }
        return packages.map(pkg => {
            const versions = byPackage.get(pkg.id) || []
            const image_url = pkg.image_url || versions[0]?.image_url || null
            const media = Array.isArray(pkg.media) && pkg.media.length
                ? pkg.media
                : pkg.visual_source_type && pkg.visual_source_id && image_url
                    ? [{ source_type: pkg.visual_source_type, source_id: pkg.visual_source_id, image_url, title: pkg.hook || 'Photo' }]
                    : []
            const newestVersion = versions.reduce((max, v) => (v.created_at > max ? v.created_at : max), '')
            const channels_stale = !!(versions.length && pkg.edited_at && newestVersion &&
                new Date(pkg.edited_at).getTime() > new Date(newestVersion).getTime())
            return { ...pkg, image_url: media[0]?.image_url || image_url, media, versions, channels_stale }
        })
    }

    /** Saves the master only (the public-page post). Channel versions are separate. */
    static async savePackage(
        userId: string,
        input: {
            id?: string | null
            hook: string
            body: string
            evidence_line?: string
            cta?: string
            why?: string
            layout?: GraphicLayout
            source_type: ContentSourceType
            source_id: string
            extras?: ContentSourceRef[]
            journey_id?: string | null
            idea_id?: string | null
            publish?: boolean
        },
        requestedOrgId?: string
    ): Promise<ContentPackage> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const hook = String(input.hook || '').trim()
        const body = String(input.body || '').trim()
        if (!hook || !body) throw httpError(400, 'Add a headline and a body first')
        const source = await this.loadSource(userId, input.source_type, input.source_id, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const existing = input.id ? await this.loadPackageRow(organizationId, input.id) : null
        const journeyId = existing ? existing.journey_id : (input.journey_id || null)
        if (journeyId) await this.assertJourney(organizationId, journeyId)
        const storyType: ContentStoryType = journeyId ? 'journey' : 'moment'
        const layout = input.layout || existing?.layout || defaultLayout(storyType)

        const extras = await this.loadExtras(userId, input.extras, source, requestedOrgId)
        const ideaId = !existing && input.idea_id ? await this.checkIdea(organizationId, input.idea_id) : null
        const media: ContentMediaItem[] = [source, ...extras].map(s => ({
            source_type: s.source_type,
            source_id: s.source_id,
            image_url: s.image_url,
            title: s.title,
        }))

        const now = new Date().toISOString()
        const fields: Record<string, unknown> = {
            story_type: storyType,
            hook,
            body,
            evidence_line: input.evidence_line?.trim() || null,
            cta: input.cta?.trim() || null,
            why: input.why?.trim() || null,
            visual_source_type: source.source_type,
            visual_source_id: source.source_id,
            media,
            layout,
            edited_at: now,
        }
        if (input.publish === true) fields.published_at = existing?.published_at || now
        else if (input.publish === false) fields.published_at = null

        const { data: pkg, error } = existing
            ? await supabase
                .from('content_packages')
                .update(fields)
                .eq('id', existing.id)
                .eq('organization_id', organizationId)
                .select('id')
                .single()
            : await supabase
                .from('content_packages')
                .insert([{ ...fields, organization_id: organizationId, journey_id: journeyId, created_by: userId, ...(ideaId ? { idea_id: ideaId } : {}) }])
                .select('id')
                .single()
        if (error) {
            if (isMissingRelation(error) || /journey_id|media|published_at|edited_at/.test(error.message)) {
                throw schemaMissing('content_packages publishing columns')
            }
            throw new Error(`Failed to save: ${error.message}`)
        }

        if (journeyId) {
            await this.touchJourney(organizationId, journeyId)
            if (fields.published_at) await this.publishJourneyIfDraft(organizationId, journeyId)
        }
        if (ideaId) {
            await supabase
                .from('content_ideas')
                .update({
                    status: 'posted',
                    package_id: pkg.id,
                    story_id: source.source_type === 'story' ? source.source_id : null,
                    acted_at: now,
                    acted_by: userId,
                })
                .eq('id', ideaId)
                .eq('organization_id', organizationId)
        }
        return this.getPackage(userId, pkg.id, requestedOrgId)
    }

    static async setPackagePublished(
        userId: string,
        packageId: string,
        published: boolean,
        requestedOrgId?: string
    ): Promise<ContentPackage> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const existing = await this.loadPackageRow(organizationId, packageId)
        const { error } = await supabase
            .from('content_packages')
            .update({ published_at: published ? existing.published_at || new Date().toISOString() : null })
            .eq('id', packageId)
            .eq('organization_id', organizationId)
        if (error) throw new Error(`Failed to update: ${error.message}`)
        if (published && existing.journey_id) await this.publishJourneyIfDraft(organizationId, existing.journey_id)
        return this.getPackage(userId, packageId, requestedOrgId)
    }

    /** Writes channel versions from the saved master, then stores them. */
    static async generateChannels(
        userId: string,
        packageId: string,
        input: { channels: ContentChannel[]; context?: string },
        requestedOrgId?: string
    ): Promise<ContentPackage> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const pkg = await this.loadPackageRow(organizationId, packageId)
        const media = (Array.isArray(pkg.media) ? pkg.media : []) as ContentMediaItem[]
        const cover: ContentSourceRef | null = media[0]
            || (pkg.visual_source_type && pkg.visual_source_id
                ? { source_type: pkg.visual_source_type, source_id: pkg.visual_source_id }
                : null)
        if (!cover) throw httpError(400, 'This post is missing its photo')
        const versions = await this.generateVersions(
            userId,
            {
                source_type: cover.source_type,
                source_id: cover.source_id,
                story_type: pkg.story_type,
                hook: pkg.hook || '',
                body: pkg.body || '',
                evidence_line: pkg.evidence_line || '',
                cta: pkg.cta || '',
                context: input.context,
                channels: input.channels,
                journey_id: pkg.journey_id,
                package_id: pkg.id,
                extras: media.slice(1),
            },
            requestedOrgId
        )
        return this.saveChannels(userId, packageId, versions, requestedOrgId)
    }

    /** Replaces the channel versions on a master. */
    static async saveChannels(
        userId: string,
        packageId: string,
        versions: ContentChannelVersion[],
        requestedOrgId?: string
    ): Promise<ContentPackage> {
        const { organizationId, org } = await this.assertStudioAccess(userId, requestedOrgId)
        const pkg = await this.loadPackageRow(organizationId, packageId)
        const media = (Array.isArray(pkg.media) ? pkg.media : []) as ContentMediaItem[]
        const coverType = media[0]?.source_type || pkg.visual_source_type
        const coverId = media[0]?.source_id || pkg.visual_source_id
        if (!coverType || !coverId) throw httpError(400, 'This post is missing its photo')
        const source = await this.loadSource(userId, coverType, coverId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')
        source.overlay = await this.loadOverlay(source)

        const valid = (versions || []).filter(v => CHANNELS.includes(v?.channel))
        const { error: clearError } = await supabase
            .from('content_posts')
            .delete()
            .eq('package_id', packageId)
            .eq('organization_id', organizationId)
        if (clearError) throw new Error(`Failed to replace versions: ${clearError.message}`)

        const rows = valid.map(version => {
            const { kind, format } = channelKind(version.channel)
            const email_subject = version.email_subject?.trim() || null
            const email_body = version.email_body?.trim() || null
            return {
                organization_id: organizationId,
                kind,
                format,
                source_type: source.source_type,
                source_id: source.source_id,
                caption: version.caption?.trim() || null,
                email_subject,
                email_body,
                email_html: kind === 'email' && email_subject && email_body
                    ? wrapEmailHtml(org.name, email_subject, email_body, source.image_url)
                    : null,
                image_url: source.image_url,
                overlay: source.overlay || null,
                created_by: userId,
                package_id: packageId,
                channel: version.channel,
                status: 'ready' as ContentDraftStatus,
            }
        })
        if (rows.length) {
            const { error: postError } = await supabase.from('content_posts').insert(rows)
            if (postError) {
                if (isMissingRelation(postError)) throw schemaMissing('content_posts')
                throw new Error(`Failed to save versions: ${postError.message}`)
            }
        }
        return this.getPackage(userId, packageId, requestedOrgId)
    }

    static async deletePackage(userId: string, packageId: string, requestedOrgId?: string): Promise<void> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        await this.loadPackageRow(organizationId, packageId)
        const { error } = await supabase
            .from('content_packages')
            .delete()
            .eq('id', packageId)
            .eq('organization_id', organizationId)
        if (error) throw new Error(`Failed to delete: ${error.message}`)
    }

    private static async getPackage(userId: string, packageId: string, requestedOrgId?: string): Promise<ContentPackage> {
        const [match] = await this.listPackages(userId, requestedOrgId, { packageId })
        if (!match) throw OrgAccessService.accessDenied()
        return match
    }

    private static async loadPackageRow(organizationId: string, packageId: string): Promise<any> {
        const { data, error } = await supabase
            .from('content_packages')
            .select('*')
            .eq('id', packageId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing('content_packages')
            throw new Error(`Failed to load post: ${error.message}`)
        }
        if (!data) throw OrgAccessService.accessDenied()
        return data
    }

    static async listJourneys(userId: string, requestedOrgId?: string): Promise<ContentJourney[]> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const { data, error } = await supabase
            .from('content_journeys')
            .select('*, initiatives(title)')
            .eq('organization_id', organizationId)
            .order('updated_at', { ascending: false })
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing('content_journeys')
            throw new Error(`Failed to load journeys: ${error.message}`)
        }
        const rows = data || []
        if (rows.length === 0) return []

        const { data: updates, error: updatesError } = await supabase
            .from('content_packages')
            .select('id, journey_id, created_at, media, published_at')
            .eq('organization_id', organizationId)
            .in('journey_id', rows.map(r => r.id))
            .order('created_at', { ascending: false })
        if (updatesError) throw new Error(`Failed to load updates: ${updatesError.message}`)

        const stats = new Map<string, JourneyStat>()
        for (const row of updates || []) {
            const prev = stats.get(row.journey_id) || { count: 0, published: 0, last: null, cover: null }
            const media = Array.isArray(row.media) ? row.media as ContentMediaItem[] : []
            stats.set(row.journey_id, {
                count: prev.count + 1,
                published: prev.published + (row.published_at ? 1 : 0),
                last: prev.last || row.created_at,
                cover: prev.cover || media[0]?.image_url || null,
            })
        }
        return rows.map(row => this.toJourney(row, stats.get(row.id)))
    }

    static async createJourney(
        userId: string,
        input: { title: string; description?: string | null; initiative_id?: string | null },
        requestedOrgId?: string
    ): Promise<ContentJourney> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const title = String(input.title || '').trim()
        if (!title) throw httpError(400, 'Give the journey a name')
        const initiativeId = await this.checkInitiative(userId, input.initiative_id, requestedOrgId)
        const { data, error } = await supabase
            .from('content_journeys')
            .insert([{
                organization_id: organizationId,
                title: title.slice(0, 120),
                description: String(input.description || '').trim().slice(0, 1000) || null,
                initiative_id: initiativeId,
                status: 'ongoing',
                created_by: userId,
            }])
            .select('*, initiatives(title)')
            .single()
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing('content_journeys')
            throw new Error(`Failed to create journey: ${error.message}`)
        }
        return this.toJourney(data)
    }

    static async updateJourney(
        userId: string,
        journeyId: string,
        patch: {
            title?: string
            description?: string | null
            initiative_id?: string | null
            status?: ContentJourneyStatus
            published?: boolean
        },
        requestedOrgId?: string
    ): Promise<ContentJourney> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        await this.assertJourney(organizationId, journeyId)
        const next: Record<string, unknown> = {}
        if (patch.title !== undefined) {
            const title = String(patch.title || '').trim()
            if (!title) throw httpError(400, 'Give the journey a name')
            next.title = title.slice(0, 120)
        }
        if (patch.description !== undefined) next.description = String(patch.description || '').trim().slice(0, 1000) || null
        if (patch.initiative_id !== undefined) next.initiative_id = await this.checkInitiative(userId, patch.initiative_id, requestedOrgId)
        if (patch.status !== undefined) next.status = patch.status === 'completed' ? 'completed' : 'ongoing'
        if (patch.published !== undefined) next.published_at = patch.published ? new Date().toISOString() : null
        const { error } = await supabase
            .from('content_journeys')
            .update(next)
            .eq('id', journeyId)
            .eq('organization_id', organizationId)
        if (error) throw new Error(`Failed to update journey: ${error.message}`)
        const match = (await this.listJourneys(userId, requestedOrgId)).find(j => j.id === journeyId)
        if (!match) throw OrgAccessService.accessDenied()
        return match
    }

    static async deleteJourney(userId: string, journeyId: string, requestedOrgId?: string): Promise<void> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        await this.assertJourney(organizationId, journeyId)
        const { error } = await supabase
            .from('content_journeys')
            .delete()
            .eq('id', journeyId)
            .eq('organization_id', organizationId)
        if (error) throw new Error(`Failed to delete journey: ${error.message}`)
    }

    private static toJourney(row: any, stat?: JourneyStat): ContentJourney {
        const { initiatives, ...rest } = row
        return {
            ...rest,
            status: rest.status === 'completed' || rest.status === 'archived' ? 'completed' : 'ongoing',
            initiative_title: asObj(initiatives)?.title || null,
            update_count: stat?.count || 0,
            published_count: stat?.published || 0,
            last_update_at: stat?.last || null,
            cover_url: stat?.cover || null,
        }
    }

    private static async publishJourneyIfDraft(organizationId: string, journeyId: string): Promise<void> {
        await supabase
            .from('content_journeys')
            .update({ published_at: new Date().toISOString() })
            .eq('id', journeyId)
            .eq('organization_id', organizationId)
            .is('published_at', null)
    }

    private static async checkInitiative(userId: string, initiativeId: unknown, requestedOrgId?: string): Promise<string | null> {
        if (!initiativeId) return null
        const ids = await OrgAccessService.getAccessibleInitiativeIds(userId, requestedOrgId)
        if (!ids.includes(String(initiativeId))) throw httpError(404, 'Program not found')
        return String(initiativeId)
    }

    private static async assertJourney(organizationId: string, journeyId: string): Promise<{ id: string; title: string; description: string | null; initiative_id: string | null }> {
        const { data, error } = await supabase
            .from('content_journeys')
            .select('id, title, description, initiative_id')
            .eq('id', journeyId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (error) {
            if (isMissingRelation(error)) throw schemaMissing('content_journeys')
            throw new Error(`Failed to load journey: ${error.message}`)
        }
        if (!data) throw httpError(404, 'Journey not found')
        return data
    }

    private static async touchJourney(organizationId: string, journeyId: string): Promise<void> {
        await supabase
            .from('content_journeys')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', journeyId)
            .eq('organization_id', organizationId)
    }

    /** Journey brief plus earlier updates, so a new update reads as what changed since last time. */
    private static async loadJourneyFacts(organizationId: string, journeyId: string, excludePackageId?: string): Promise<string> {
        const journey = await this.assertJourney(organizationId, journeyId)
        const { data } = await supabase
            .from('content_packages')
            .select('id, hook, body, created_at')
            .eq('organization_id', organizationId)
            .eq('journey_id', journeyId)
            .order('created_at', { ascending: true })
        const earlier = (data || []).filter(row => row.id !== excludePackageId)
        const position = excludePackageId
            ? (data || []).findIndex(row => row.id === excludePackageId) + 1 || earlier.length + 1
            : earlier.length + 1
        const recent = earlier.slice(-6).map(row => {
            const when = String(row.created_at || '').slice(0, 10)
            return `- ${when}: ${row.hook || ''}. ${trimText(String(row.body || ''), 200)}`
        })
        return [
            `JOURNEY: ${journey.title}`,
            journey.description?.trim() ? `Following: ${trimText(journey.description, 500)}` : '',
            `This is update ${position} of this journey.`,
            recent.length
                ? `Earlier updates (oldest first). Do not repeat them. Show what is new:\n${recent.join('\n')}`
                : 'This is the first update. Introduce who or what we are following.',
        ].filter(Boolean).join('\n')
    }

    /** Extra carousel photos, validated for access, deduped against the cover, capped. */
    private static async loadExtras(
        userId: string,
        refs: unknown,
        cover: ContentSourceRef,
        requestedOrgId?: string
    ): Promise<ContentSource[]> {
        const seen = new Set([sourceKey(cover)])
        const unique = asSourceRefs(refs).filter(ref => {
            const key = sourceKey(ref)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        }).slice(0, MAX_MEDIA - 1)
        const loaded = await Promise.all(unique.map(ref => this.loadSource(userId, ref.source_type, ref.source_id, requestedOrgId)))
        return loaded.filter((s): s is ContentSource => !!s)
    }

    private static assertOpenAi() {
        if (!isOpenAIConfigured() || !openai) throw httpError(500, 'OpenAI API key not configured')
    }

    private static async assertQuota(userId: string, requestedOrgId?: string) {
        const quota = await SubscriptionService.checkAiReportQuota(userId, requestedOrgId)
        if (!quota.canGenerate) {
            throw httpError(
                403,
                `You've used your ${quota.limit} AI generation for today on the Free plan. Upgrade to Growth or Pro for unlimited.`,
                'AI_REPORT_LIMIT_REACHED'
            )
        }
    }

    /** Returns the idea id when it belongs to the org; null when missing (the post still saves). */
    private static async checkIdea(organizationId: string, ideaId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('content_ideas')
            .select('id')
            .eq('id', ideaId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (error || !data) return null
        return data.id as string
    }

    private static async loadIdeaFacts(organizationId: string, ideaId: string): Promise<string> {
        const { data, error } = await supabase
            .from('content_ideas')
            .select('card, angle')
            .eq('id', ideaId)
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (error || !data?.card) return ''
        const card = data.card as { title?: string; why?: string; who?: string; ask?: string[] }
        return [
            'This post comes from a capture idea the team went out and photographed:',
            card.title ? `- Story: ${card.title}` : '',
            card.why ? `- Why it matters: ${trimText(card.why, 300)}` : '',
            card.who ? `- Who: ${trimText(card.who, 160)}` : '',
            card.ask?.length ? `- Questions they asked: ${card.ask.join(' | ')}` : '',
            'If the photo description contains their exact words, build the post around that quote and keep it word for word.',
        ].filter(Boolean).join('\n')
    }

    private static parseJson(raw?: string | null): any {
        try {
            return JSON.parse(raw || '{}')
        } catch {
            return {}
        }
    }

    private static async loadUsedSourceKeys(organizationId: string): Promise<Set<string>> {
        const { data, error } = await supabase
            .from('content_posts')
            .select('source_type, source_id')
            .eq('organization_id', organizationId)
        if (error) {
            if (isMissingRelation(error)) return new Set()
            throw new Error(`Failed to load used photos: ${error.message}`)
        }
        const keys = new Set((data || []).map(row => `${row.source_type}:${row.source_id}`))
        const { data: packages } = await supabase
            .from('content_packages')
            .select('media')
            .eq('organization_id', organizationId)
        for (const row of packages || []) {
            for (const item of Array.isArray(row.media) ? row.media as ContentMediaItem[] : []) {
                keys.add(`${item.source_type}:${item.source_id}`)
            }
        }
        return keys
    }

    private static async loadRecentStoryTypes(organizationId: string): Promise<ContentStoryType[]> {
        const { data, error } = await supabase
            .from('content_packages')
            .select('story_type, created_at')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .limit(8)
        if (error || !data) return []
        return data.map(row => row.story_type).filter(Boolean) as ContentStoryType[]
    }

    private static recommendWhy(
        source: ContentSource,
        storyType: ContentStoryType,
        hasClaim: boolean,
        unused: boolean
    ): string {
        const bits: string[] = []
        if (unused) bits.push('it has not been used in a post yet')
        if (daysAgo(source.date_represented) <= 21) bits.push('it is recent')
        if (hasClaim) bits.push('it has a connected result')
        if (storyType === 'journey') bits.push('it can show people over time')
        if (storyType === 'glance') bits.push('it can lead with a number')
        if (bits.length === 0) bits.push(`it is a strong ${storyType} from ${source.initiative_title}`)
        return `Recommended because ${bits.join(', ')}.`
    }

    private static async loadOrgStoryContext(organizationId: string): Promise<string> {
        const { data, error } = await supabase
            .from('organization_context')
            .select('problem_statement, theory_of_change')
            .eq('organization_id', organizationId)
            .maybeSingle()
        if (error || !data) return ''
        const parts: string[] = []
        if (data.problem_statement?.trim()) parts.push(`Problem: ${trimText(data.problem_statement, 400)}`)
        if (data.theory_of_change?.trim()) parts.push(`Theory of change: ${trimText(data.theory_of_change, 400)}`)
        return parts.join('\n')
    }
}
