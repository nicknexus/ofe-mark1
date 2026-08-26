import { supabase } from '../utils/supabase'
import { openai, isOpenAIConfigured } from '../utils/openai'
import { composeBrandedPng, parseGraphicLayout } from '../utils/contentCompose'
import { OrgAccessService } from './orgAccessService'
import { SubscriptionService } from './subscriptionService'
import {
    ContentCopy,
    ContentOverlay,
    ContentPost,
    ContentPostFormat,
    ContentPostKind,
    ContentSource,
    ContentSourceType,
} from '../types'

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
            .select('id, name, statement, is_demo, logo_url, brand_color')
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
        }
    ): Promise<{ sources: ContentSource[]; has_more: boolean }> {
        const { organizationId } = await this.assertStudioAccess(userId, requestedOrgId)
        const initiativeIds = await OrgAccessService.getAccessibleInitiativeIds(userId, requestedOrgId)
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
        const page = sources.slice(offset, offset + limit)
        const hitFetchCap = (evidenceRes.data || []).length >= fetchCount || (storiesRes.data || []).length >= fetchCount
        const has_more = sources.length > offset + limit || (hitFetchCap && page.length === limit)
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
            max_tokens: 900,
            messages: [
                {
                    role: 'system',
                    content: `You write short, factual copy for charities from proof they already logged.
Use the photo title and description as the human story. Use connected claims for numbers. Use the program (initiative) and its metrics so the copy is about the right work.
Never invent numbers, names, locations, or outcomes that are not in the facts.
If there are connected claims, lead with the strongest number. If there are none, write from title, description, and program only. Do not guess a count.
No hashtag spam (at most 3, only if they fit). No emojis. No em dashes.
Return JSON with keys: caption, email_subject, email_body.
caption: one social post, max 160 words, first line is the hook. Same text works for Instagram, Facebook, and LinkedIn.
email_subject: max 70 characters.
email_body: 2-4 short paragraphs, first-person plural ("we"), suitable to paste into Gmail or Mailchimp.`,
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
        layout?: string
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const { org } = await this.assertStudioAccess(userId, requestedOrgId)
        const source = await this.loadSource(userId, sourceType, sourceId, requestedOrgId)
        if (!source) throw httpError(404, 'Source not found', 'SOURCE_NOT_FOUND')

        const photo = await this.downloadImage(userId, sourceType, sourceId, requestedOrgId)
        const [logo, overlay, location] = await Promise.all([
            org.logo_url ? this.fetchBinary(org.logo_url) : Promise.resolve(null),
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
            layout: parseGraphicLayout(layout),
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
            if (data.approval_status === 'pending') return null
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
}
