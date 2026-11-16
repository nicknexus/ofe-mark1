/**
 * Upload Post client. Connect, disconnect, and publish are live.
 * The API key stays on the server.
 */

import { SOCIAL_CAPTION_LIMIT, photoCaptionFields, textCaptionFields, type SocialPlatform } from './uploadPostCaption'

function httpError(status: number, message: string, code?: string): Error {
    const err = new Error(message) as Error & { status: number; code?: string }
    err.status = status
    if (code) err.code = code
    return err
}

export interface UploadPostAccount {
    configured: boolean
    mutations: boolean
    email: string | null
    plan: string | null
    /** Upload quota. count is null when /me does not include api_usage. */
    usage: {
        count: number | null
        limit: number | null
    }
    connections: Record<string, { connected: boolean; label: string | null }>
}

const CONNECT_PLATFORMS = ['instagram', 'facebook', 'linkedin'] as const

function accountConnected(value: unknown): { connected: boolean; label: string | null } {
    if (!value || value === '') return { connected: false, label: null }
    if (typeof value === 'string') return { connected: true, label: value }
    if (typeof value === 'object') {
        const row = value as { display_name?: unknown; handle?: unknown; username?: unknown }
        const label = [row.display_name, row.handle, row.username].find(item => typeof item === 'string' && item) as string | undefined
        const connected = !!label || Object.keys(value as object).length > 0
        return { connected, label: label || null }
    }
    return { connected: false, label: null }
}

const BASE = 'https://api.upload-post.com'
let accountCache: { at: number; value: UploadPostAccount } | null = null
let uploadCache: { at: number; username: string; rows: UploadReceipt[] } | null = null
let analyticsCache: { key: string; at: number; value: SocialPlatformStats[] } | null = null
let postMetricsCache: { username: string; at: number; value: { posts: SocialPostMetrics[]; removed: number } } | null = null

export interface SocialPlatformStats {
    platform: 'instagram' | 'facebook' | 'linkedin'
    error: string | null
    followers: number | null
    reach: number | null
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
    series: { date: string; reach: number }[]
}

function metric(row: any, key: string): number | null {
    const value = row?.[key]
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readPlatformStats(platform: SocialPlatformStats['platform'], row: any): SocialPlatformStats {
    if (!row || typeof row !== 'object' || typeof row.message === 'string' || typeof row.error === 'string') {
        return {
            platform,
            error: (typeof row?.message === 'string' && row.message) || (typeof row?.error === 'string' && row.error) || 'No numbers for this account yet.',
            followers: null,
            reach: null,
            views: null,
            likes: null,
            comments: null,
            shares: null,
            saves: null,
            series: [],
        }
    }
    return {
        platform,
        error: null,
        followers: metric(row, 'followers'),
        reach: metric(row, 'reach'),
        views: metric(row, 'views') ?? metric(row, 'impressions'),
        likes: metric(row, 'likes'),
        comments: metric(row, 'comments'),
        shares: metric(row, 'shares'),
        saves: metric(row, 'saves'),
        series: readReachSeries(row),
    }
}

function readReachSeries(row: any): { date: string; reach: number }[] {
    const list = Array.isArray(row?.reach_timeseries) ? row.reach_timeseries : []
    return list
        .map((point: any) => ({
            date: typeof point?.date === 'string' ? point.date.slice(0, 10) : '',
            reach: typeof point?.value === 'number' && Number.isFinite(point.value) ? point.value : 0,
        }))
        .filter((point: { date: string }) => /^\d{4}-\d{2}-\d{2}$/.test(point.date))
}

const EXTERNAL_ID = /^pkg_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})_(instagram|facebook|linkedin)_(.+)$/i

export interface UploadReceipt {
    externalId: string
    packageId: string
    platform: 'instagram' | 'facebook' | 'linkedin'
    status: 'accepted' | 'scheduled' | 'published' | 'failed'
    postUrl: string | null
    error: string | null
    requestId: string | null
    jobId: string | null
    platformPostId: string | null
    title: string
    sentAt: string
    scheduledAt: string | null
}

export interface SocialPostMetrics {
    platform: 'instagram' | 'facebook' | 'linkedin'
    packageId: string
    title: string
    postUrl: string | null
    sentAt: string
    reach: number | null
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    saves: number | null
}

function postTitle(value: unknown): string {
    if (typeof value !== 'string') return 'Post'
    const line = value.replace(/\r/g, '').split('\n').find(part => part.trim())
    return (line || 'Post').trim().slice(0, 120)
}

function parseUploads(body: any): UploadReceipt[] {
    const rows = [...(Array.isArray(body?.history) ? body.history : []), ...(Array.isArray(body?.in_progress) ? body.in_progress : [])]
    const out: UploadReceipt[] = []
    for (const row of rows) {
        const externalId = typeof row?.external_id === 'string' ? row.external_id : ''
        const match = EXTERNAL_ID.exec(externalId)
        if (!match) continue
        const platform = match[2].toLowerCase() as UploadReceipt['platform']
        const postUrl = typeof row?.post_url === 'string' && row.post_url.startsWith('http') ? row.post_url : null
        const suffix = match[3]
        const scheduledAt = suffix === 'now' ? null : suffix
        let status: UploadReceipt['status'] = 'accepted'
        if (row?.success === false) status = 'failed'
        else if (row?.success === true && postUrl) status = 'published'
        else if (row?.success === true) status = 'accepted'
        else if (scheduledAt) status = 'scheduled'
        out.push({
            externalId,
            packageId: match[1],
            platform,
            status,
            postUrl,
            error: typeof row?.error_message === 'string' ? row.error_message : null,
            requestId: typeof row?.request_id === 'string' ? row.request_id : null,
            jobId: typeof row?.job_id === 'string' ? row.job_id : null,
            platformPostId: row?.platform_post_id != null && String(row.platform_post_id) ? String(row.platform_post_id) : null,
            title: postTitle(row?.post_title),
            sentAt: typeof row?.upload_timestamp === 'string' ? row.upload_timestamp : new Date().toISOString(),
            scheduledAt,
        })
    }
    return out
}

export class UploadPostService {
    static configured(): boolean {
        return !!process.env.UPLOAD_POST_API_KEY
    }

    /** Off unless someone explicitly opts in. Do not set this on the free trial. */
    static mutationsEnabled(): boolean {
        return process.env.UPLOAD_POST_MUTATIONS === '1'
    }

    static assertMutations(): void {
        if (!this.mutationsEnabled()) {
            throw httpError(
                409,
                'Connecting and sending are off while the Upload Post trial is protected.',
                'TRIAL_LOCKED',
            )
        }
    }

    static profileUsername(organizationId: string): string {
        return `org_${organizationId.replace(/-/g, '')}`
    }

    static async account(): Promise<UploadPostAccount> {
        if (!this.configured()) {
            return {
                configured: false,
                mutations: false,
                email: null,
                plan: null,
                usage: { count: null, limit: null },
                connections: {},
            }
        }
        if (accountCache && Date.now() - accountCache.at < 60_000) return accountCache.value
        const body = await this.request('/api/uploadposts/me')
        const plan = typeof body?.plan === 'string' ? body.plan : null
        const reported = body?.api_usage || body?.usage || null
        const count = typeof reported?.count === 'number' ? reported.count : null
        const reportedLimit = typeof reported?.limit === 'number' ? reported.limit : null
        const free = !plan || /free|default/i.test(plan)
        const value: UploadPostAccount = {
            configured: true,
            mutations: this.mutationsEnabled(),
            email: typeof body?.email === 'string' ? body.email : null,
            plan,
            usage: {
                count,
                limit: reportedLimit ?? (free ? 10 : null),
            },
            connections: {},
        }
        accountCache = { at: Date.now(), value }
        return value
    }

    /**
     * One platform per call. Idempotency-Key collapses a double-click for 24 hours.
     * A 2xx means accepted or scheduled, not that the network has published it.
     */
    static async publish(input: {
        profileUsername: string
        platform: SocialPlatform
        text: string
        idempotencyKey: string
        requestId: string
        externalId: string
        scheduledDate?: string
        timezone?: string
        imageUrls?: string[]
    }): Promise<{ status: 'accepted' | 'scheduled'; requestId: string | null; jobId: string | null }> {
        const caption = input.text.replace(/\r\n/g, '\n').trim()
        const limit = SOCIAL_CAPTION_LIMIT[input.platform]
        if (caption.length > limit) {
            const name = input.platform.charAt(0).toUpperCase() + input.platform.slice(1)
            throw httpError(400, `${name} captions can be ${limit} characters. This one is ${caption.length}.`)
        }
        const form = new FormData()
        form.set('user', input.profileUsername)
        form.append('platform[]', input.platform)
        const fields = input.imageUrls?.length
            ? photoCaptionFields(input.platform, caption)
            : textCaptionFields(input.platform, caption)
        for (const [key, value] of Object.entries(fields)) form.set(key, value)
        form.set('external_id', input.externalId)
        form.set('request_id', input.requestId)
        if (input.scheduledDate) form.set('scheduled_date', input.scheduledDate)
        if (input.timezone) form.set('timezone', input.timezone)
        for (const url of input.imageUrls || []) form.append('photos[]', url)
        const path = input.imageUrls?.length ? '/api/upload_photos' : '/api/upload_text'
        const body = await this.request(path, {
            method: 'POST',
            headers: { 'Idempotency-Key': input.idempotencyKey },
            body: form,
        })
        const jobId = typeof body?.job_id === 'string' ? body.job_id : null
        const requestId = typeof body?.request_id === 'string' ? body.request_id : input.requestId
        return {
            status: input.scheduledDate ? 'scheduled' : 'accepted',
            requestId,
            jobId,
        }
    }

    /** Recent uploads for one org profile. Cached for a minute. */
    static async uploadsForProfile(username: string): Promise<UploadReceipt[]> {
        const now = Date.now()
        if (uploadCache && uploadCache.username === username && now - uploadCache.at < 60_000) {
            return uploadCache.rows
        }
        const body = await this.request(`/api/uploadposts/history?limit=50&profile_username=${encodeURIComponent(username)}`)
        const rows = parseUploads(body)
        uploadCache = { at: now, username, rows }
        return rows
    }

    static async findUpload(externalId: string): Promise<UploadReceipt | null> {
        const body = await this.request(`/api/uploadposts/history?limit=10&external_id=${encodeURIComponent(externalId)}`)
        return parseUploads(body).find(row => row.externalId === externalId) || null
    }

    static clearUploadCache(): void {
        uploadCache = null
        postMetricsCache = null
    }

    /** Account totals for the connected networks. Cached for five minutes. */
    static async profileAnalytics(organizationId: string, platforms: Array<typeof CONNECT_PLATFORMS[number]>): Promise<SocialPlatformStats[]> {
        const username = this.profileUsername(organizationId)
        const key = `${username}:${platforms.join(',')}`
        if (analyticsCache && analyticsCache.key === key && Date.now() - analyticsCache.at < 5 * 60_000) {
            return analyticsCache.value
        }
        if (!platforms.length) return []
        const body = await this.request(`/api/analytics/${encodeURIComponent(username)}?platforms=${platforms.join(',')}`)
        const stats = platforms.map(platform => readPlatformStats(platform, body?.[platform]))
        analyticsCache = { key, at: Date.now(), value: stats }
        return stats
    }

    /**
     * Live metrics for posts that are still on the network.
     * A deleted post comes back as an error and is counted, not shown.
     */
    static async publishedPostMetrics(organizationId: string): Promise<{ posts: SocialPostMetrics[]; removed: number }> {
        const username = this.profileUsername(organizationId)
        if (postMetricsCache && postMetricsCache.username === username && Date.now() - postMetricsCache.at < 5 * 60_000) {
            return postMetricsCache.value
        }
        const uploads = await this.uploadsForProfile(username)
        const published = uploads.filter(row => row.status === 'published' && row.platformPostId)
        const posts: SocialPostMetrics[] = []
        let removed = 0
        for (const row of published.slice(0, 8)) {
            const metrics = await this.livePostMetrics(username, row.platform, row.platformPostId as string)
            if (!metrics) {
                removed += 1
                continue
            }
            posts.push({
                platform: row.platform,
                packageId: row.packageId,
                title: row.title,
                postUrl: row.postUrl,
                sentAt: row.sentAt,
                ...metrics,
            })
        }
        const value = { posts, removed }
        postMetricsCache = { username, at: Date.now(), value }
        return value
    }

    private static async livePostMetrics(
        username: string,
        platform: SocialPostMetrics['platform'],
        platformPostId: string,
    ): Promise<Pick<SocialPostMetrics, 'reach' | 'views' | 'likes' | 'comments' | 'shares' | 'saves'> | null> {
        const params = new URLSearchParams({
            platform_post_id: platformPostId,
            platform,
            user: username,
        })
        const body = await this.request(`/api/uploadposts/post-analytics?${params.toString()}`)
        const row = body?.platforms?.[platform]
        if (!row || row.post_metrics_error || !row.post_metrics) return null
        const numbers = row.post_metrics
        return {
            reach: metric(numbers, 'reach'),
            views: metric(numbers, 'views') ?? metric(numbers, 'impressions'),
            likes: metric(numbers, 'likes'),
            comments: metric(numbers, 'comments'),
            shares: metric(numbers, 'shares'),
            saves: metric(numbers, 'saves'),
        }
    }

    static async disconnect(organizationId: string, platform: typeof CONNECT_PLATFORMS[number]): Promise<{ removedProfile: boolean }> {
        const username = this.profileUsername(organizationId)
        await this.request('/api/uploadposts/users/social', {
            method: 'DELETE',
            body: JSON.stringify({
                profile_username: username,
                social_platform: platform,
            }),
        })
        const body = await this.request(`/api/uploadposts/users/${encodeURIComponent(username)}`, undefined, true)
        const social = body?.profile?.social_accounts || {}
        const stillLinked = Object.values(social).some(value => accountConnected(value).connected)
        if (stillLinked || !body) return { removedProfile: false }
        await this.request('/api/uploadposts/users', {
            method: 'DELETE',
            body: JSON.stringify({ username }),
        })
        return { removedProfile: true }
    }

    static async connections(organizationId: string): Promise<UploadPostAccount['connections']> {
        const username = this.profileUsername(organizationId)
        const body = await this.request(`/api/uploadposts/users/${encodeURIComponent(username)}`, undefined, true)
        const social = body?.profile?.social_accounts || {}
        const out: UploadPostAccount['connections'] = {}
        for (const id of CONNECT_PLATFORMS) out[id] = accountConnected(social[id])
        return out
    }

    /** Creates the org profile if needed, then returns that network's consent URL. Does not upload. */
    static async connectUrl(
        organizationId: string,
        displayName: string,
        platform: typeof CONNECT_PLATFORMS[number],
        redirectUrl: string,
    ): Promise<string> {
        const username = await this.ensureProfile(organizationId, displayName)
        const body = await this.request(`/api/uploadposts/oauth/${platform}/start`, {
            method: 'POST',
            body: JSON.stringify({
                profile: username,
                redirect_url: redirectUrl,
            }),
        })
        const url = body?.authorize_url
        if (typeof url !== 'string' || !url.startsWith('https://')) {
            throw httpError(502, 'Upload Post did not return a connect link.', 'NO_CONNECT_URL')
        }
        return url
    }

    private static async ensureProfile(organizationId: string, displayName: string): Promise<string> {
        const username = this.profileUsername(organizationId)
        const existing = await this.request(`/api/uploadposts/users/${encodeURIComponent(username)}`, undefined, true)
        if (existing) return username
        try {
            await this.request('/api/uploadposts/users', {
                method: 'POST',
                body: JSON.stringify({
                    username,
                    display_name: displayName.slice(0, 100) || 'Organization',
                }),
            })
        } catch (error) {
            const status = (error as { status?: number }).status
            if (status !== 409) throw error
        }
        return username
    }

    private static async request(path: string, init?: RequestInit, allow404 = false): Promise<any> {
        const key = process.env.UPLOAD_POST_API_KEY
        if (!key) throw httpError(503, 'Upload Post is not configured.', 'NOT_CONFIGURED')
        const headers = new Headers(init?.headers)
        headers.set('Authorization', `Apikey ${key}`)
        if (typeof init?.body === 'string' && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json')
        }
        const response = await fetch(`${BASE}${path}`, { ...init, headers })
        if (response.status === 404 && allow404) return null
        const text = await response.text()
        let body: any = null
        try { body = text ? JSON.parse(text) : null } catch { body = null }
        if (!response.ok) {
            const message = body?.message || body?.error || `Upload Post returned ${response.status}`
            throw httpError(response.status, message, body?.error_code)
        }
        return body
    }
}
