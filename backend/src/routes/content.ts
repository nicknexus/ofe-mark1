import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { ContentService } from '../services/contentService'
import { ContentIdeasService } from '../services/contentIdeasService'
import { UploadPostService } from '../services/uploadPostService'
import { socialCaption } from '../services/uploadPostCaption'
import { TeamService } from '../services/teamService'
import { ContentChannel, ContentJourneyStatus, ContentPostFormat, ContentPostKind, ContentSourceType, ContentStoryType } from '../types'

const router = Router()

function sendError(res: any, error: unknown) {
    const err = error as Error & { status?: number; code?: string }
    const status = err.status || 500
    res.status(status).json({ error: err.message, code: err.code })
}

function parseFlag(value: unknown): boolean | undefined {
    if (value == null || value === '') return undefined
    const s = String(value).toLowerCase()
    if (s === '1' || s === 'true') return true
    if (s === '0' || s === 'false') return false
    return undefined
}

function asText(value: unknown): string | undefined {
    if (value == null) return undefined
    return String(value)
}

router.get('/sources', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const offset = Number(req.query.offset || 0)
        const limit = Number(req.query.limit || 21)
        const sourceType = req.query.source_type as string | undefined
        const usage = req.query.usage as string | undefined
        const singleDate = (req.query.single_date as string | undefined) || undefined
        const startDate = (req.query.start_date as string | undefined) || undefined
        const endDate = (req.query.end_date as string | undefined) || undefined
        const initiativeId = (req.query.initiative_id as string | undefined) || undefined
        const result = await ContentService.listSources(req.user!.id, requestedOrgId, {
            initiativeId,
            offset: Number.isFinite(offset) ? offset : 0,
            limit: Number.isFinite(limit) ? limit : 21,
            sourceType: sourceType === 'evidence' || sourceType === 'story' ? sourceType : 'all',
            usage: usage === 'unused' || usage === 'used' ? usage : 'all',
            singleDate,
            startDate,
            endDate,
        })
        res.json(result)
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/posts', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const posts = await ContentService.listPosts(req.user!.id, requestedOrgId)
        res.json(posts)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/posts', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { kind, format, source_type, source_id, caption, email_subject, email_body, overlay } = req.body || {}
        if (kind !== 'social' && kind !== 'email') {
            res.status(400).json({ error: 'kind must be social or email' })
            return
        }
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const post = await ContentService.createPost(
            req.user!.id,
            {
                kind: kind as ContentPostKind,
                format: format as ContentPostFormat | undefined,
                source_type: source_type as ContentSourceType,
                source_id,
                caption,
                email_subject,
                email_body,
                overlay,
            },
            requestedOrgId
        )
        res.status(201).json(post)
    } catch (error) {
        sendError(res, error)
    }
})

router.patch('/posts/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const post = await ContentService.updatePost(req.user!.id, req.params.id, req.body || {}, requestedOrgId)
        res.json(post)
    } catch (error) {
        sendError(res, error)
    }
})

router.delete('/posts/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await ContentService.deletePost(req.user!.id, req.params.id, requestedOrgId)
        res.status(204).end()
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/image', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const source_type = req.query.source_type as string
        const source_id = req.query.source_id as string
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const file = await ContentService.downloadImage(
            req.user!.id,
            source_type as ContentSourceType,
            source_id,
            requestedOrgId
        )
        res.setHeader('Content-Type', file.contentType)
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
        res.setHeader('Cache-Control', 'private, max-age=120')
        res.send(file.buffer)
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/graphic', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const source_type = req.query.source_type as string
        const source_id = req.query.source_id as string
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const layout = req.query.layout as string | undefined
        const aspect = req.query.aspect as string | undefined
        const file = await ContentService.composeGraphic(
            req.user!.id,
            source_type as ContentSourceType,
            source_id,
            requestedOrgId,
            {
                layout,
                aspect,
                chrome: {
                    logo: parseFlag(req.query.show_logo),
                    orgName: parseFlag(req.query.show_name),
                    title: parseFlag(req.query.show_title),
                    metric: parseFlag(req.query.show_metric),
                    location: parseFlag(req.query.show_location),
                },
                copy: {
                    orgName: asText(req.query.org_name),
                    title: asText(req.query.title),
                    metricText: asText(req.query.metric_text),
                    metricLabel: asText(req.query.metric_label),
                    location: asText(req.query.location),
                },
            }
        )
        res.setHeader('Content-Type', file.contentType)
        res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`)
        res.setHeader('Cache-Control', 'private, max-age=60')
        res.send(file.buffer)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/generate-copy', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { source_type, source_id } = req.body || {}
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const copy = await ContentService.generateCopy(
            req.user!.id,
            source_type as ContentSourceType,
            source_id,
            requestedOrgId
        )
        res.json(copy)
    } catch (error) {
        sendError(res, error)
    }
})

const STORY_TYPES = new Set(['glance', 'moment', 'journey'])
const CHANNELS = new Set(['linkedin', 'instagram', 'facebook', 'donor_email', 'newsletter', 'sms'])

router.post('/recommend', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const story_type = req.body?.story_type
        if (story_type && !STORY_TYPES.has(story_type)) {
            res.status(400).json({ error: 'story_type must be glance, moment, or journey' })
            return
        }
        const master = await ContentService.recommend(
            req.user!.id,
            requestedOrgId,
            story_type as ContentStoryType | undefined
        )
        res.json(master)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/generate-master', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { source_type, source_id, story_type, why, journey_id, package_id, extras, idea_id, context, hook, body, cta } = req.body || {}
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        if (!STORY_TYPES.has(story_type)) {
            res.status(400).json({ error: 'story_type must be glance, moment, or journey' })
            return
        }
        const master = await ContentService.generateMaster(
            req.user!.id,
            source_type,
            source_id,
            story_type,
            why,
            requestedOrgId,
            { journeyId: journey_id, packageId: package_id, extras, ideaId: idea_id, context, draft: context && (hook || body) ? { hook, body, cta } : undefined }
        )
        res.json(master)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/refine-master', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { source_type, source_id, story_type, hook, body, evidence_line, cta, context, why, journey_id, package_id, extras } = req.body || {}
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const master = await ContentService.refineMaster(
            req.user!.id,
            { source_type, source_id, story_type, hook, body, evidence_line, cta, context, why, journey_id, package_id, extras },
            requestedOrgId
        )
        res.json(master)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/generate-versions', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { source_type, source_id, story_type, hook, body, evidence_line, cta, channels, context, journey_id, package_id, extras } = req.body || {}
        if (!Array.isArray(channels) || channels.some((c: string) => !CHANNELS.has(c))) {
            res.status(400).json({ error: 'channels must be a list of known channels' })
            return
        }
        const versions = await ContentService.generateVersions(
            req.user!.id,
            { source_type, source_id, story_type, hook, body, evidence_line, cta, channels, context, journey_id, package_id, extras },
            requestedOrgId
        )
        res.json({ versions })
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/packages', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const journeyId = (req.query.journey_id as string | undefined) || undefined
        const packages = await ContentService.listPackages(req.user!.id, requestedOrgId, { journeyId })
        res.json(packages)
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/packages/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const [pkg] = await ContentService.listPackages(req.user!.id, requestedOrgId, { packageId: req.params.id })
        if (!pkg) {
            res.status(404).json({ error: 'Post not found' })
            return
        }
        res.json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/packages', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { id: _ignored, ...input } = req.body || {}
        const pkg = await ContentService.savePackage(req.user!.id, input, requestedOrgId)
        res.status(201).json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.put('/packages/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const pkg = await ContentService.savePackage(req.user!.id, { ...(req.body || {}), id: req.params.id }, requestedOrgId)
        res.json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.patch('/packages/:id/publish', authenticateUser, async (_req: AuthenticatedRequest, res) => {
    res.status(400).json({ error: 'A post goes on your Nexus page when it is sent to a connected account.' })
})

router.post('/packages/:id/channels/generate', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { channels, context } = req.body || {}
        if (!Array.isArray(channels) || channels.length === 0 || channels.some((c: string) => !CHANNELS.has(c))) {
            res.status(400).json({ error: 'channels must be a list of known channels' })
            return
        }
        const pkg = await ContentService.generateChannels(
            req.user!.id,
            req.params.id,
            { channels: channels as ContentChannel[], context: typeof context === 'string' ? context : undefined },
            requestedOrgId
        )
        res.json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.put('/packages/:id/channels', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const versions = req.body?.versions
        if (!Array.isArray(versions) || versions.some((v: any) => !CHANNELS.has(v?.channel))) {
            res.status(400).json({ error: 'versions must be a list of channel versions' })
            return
        }
        const pkg = await ContentService.saveChannels(req.user!.id, req.params.id, versions, requestedOrgId)
        res.json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.delete('/packages/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await ContentService.deletePackage(req.user!.id, req.params.id, requestedOrgId)
        res.status(204).end()
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/ideas', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.list(req.user!.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/ideas/refresh', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.refresh(req.user!.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/ideas/signals', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, requestedOrgId)
        res.json(await ContentIdeasService.detectSignals(organizationId))
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/ideas/web', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.web(req.user!.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/ideas/for/:stakeholder', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.forStakeholder(req.user!.id, req.params.stakeholder, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/ideas/:id/another', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.another(req.user!.id, req.params.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/ideas/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentIdeasService.get(req.user!.id, req.params.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.patch('/ideas/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { status, reason, snooze_days, selection } = req.body || {}
        res.json(await ContentIdeasService.update(req.user!.id, req.params.id, { status, reason, snooze_days, selection }, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/journeys', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        res.json(await ContentService.listJourneys(req.user!.id, requestedOrgId))
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/journeys', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { title, description, initiative_id } = req.body || {}
        const journey = await ContentService.createJourney(req.user!.id, { title, description, initiative_id }, requestedOrgId)
        res.status(201).json(journey)
    } catch (error) {
        sendError(res, error)
    }
})

router.patch('/journeys/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { title, description, initiative_id, status, published } = req.body || {}
        if (status !== undefined && status !== 'ongoing' && status !== 'completed') {
            res.status(400).json({ error: 'status must be ongoing or completed' })
            return
        }
        if (published !== undefined && typeof published !== 'boolean') {
            res.status(400).json({ error: 'published must be true or false' })
            return
        }
        const journey = await ContentService.updateJourney(
            req.user!.id,
            req.params.id,
            { title, description, initiative_id, status: status as ContentJourneyStatus | undefined, published },
            requestedOrgId
        )
        res.json(journey)
    } catch (error) {
        sendError(res, error)
    }
})

function connectRedirect(req: AuthenticatedRequest): string {
    const origin = req.get('origin') || ''
    const allowed = [process.env.FRONTEND_URL, process.env.APP_URL, 'http://localhost:3000']
        .filter((value): value is string => !!value)
        .map(value => value.replace(/\/+$/, ''))
    const base = allowed.includes(origin) ? origin : (allowed[0] || 'http://localhost:3000')
    return `${base}/studio/accounts`
}

router.get('/social/account', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, req.headers['x-organization-id'] as string | undefined)
        const account = await UploadPostService.account()
        const connections = account.configured
            ? await UploadPostService.connections(organizationId).catch(() => ({}))
            : {}
        res.json({ ...account, connections })
    } catch (error) {
        sendError(res, error)
    }
})

router.get('/social/insights', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, req.headers['x-organization-id'] as string | undefined)
        const connections = await UploadPostService.connections(organizationId).catch(() => ({} as Record<string, { connected: boolean; label: string | null }>))
        const platforms = (['instagram', 'facebook', 'linkedin'] as const).filter(platform => connections[platform]?.connected)
        const [stats, metrics] = await Promise.all([
            UploadPostService.profileAnalytics(organizationId, platforms),
            UploadPostService.publishedPostMetrics(organizationId),
        ])
        const { posts, removed } = metrics
        const context = await ContentService.socialInsightContext(organizationId, posts.map(post => post.packageId))
        res.json({
            platforms: stats.map(row => ({
                ...row,
                label: row.platform.charAt(0).toUpperCase() + row.platform.slice(1),
            })),
            posts: posts.map(post => {
                const extra = context.get(post.packageId)
                return {
                    ...post,
                    title: extra?.hook || post.title,
                    imageUrl: extra?.imageUrl || null,
                    program: extra?.program || null,
                }
            }),
            removed,
        })
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/social/release', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, requestedOrgId)
        if (!(await TeamService.canEditOrgSettings(req.user!.id, organizationId))) {
            res.status(403).json({ error: 'Only an owner or admin can connect accounts.', code: 'FORBIDDEN' })
            return
        }
        const removed = await UploadPostService.releaseIfUnused(organizationId)
        res.json({ removed })
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/social/connect', authenticateUser, async (req: AuthenticatedRequest, res) => {
    let organizationId: string | undefined
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const resolved = await ContentService.assertStudioAccess(req.user!.id, requestedOrgId)
        organizationId = resolved.organizationId
        if (!(await TeamService.canEditOrgSettings(req.user!.id, organizationId))) {
            res.status(403).json({ error: 'Only an owner or admin can connect accounts.', code: 'FORBIDDEN' })
            return
        }
        const platform = req.body?.platform
        if (platform !== 'instagram' && platform !== 'facebook' && platform !== 'linkedin') {
            res.status(400).json({ error: 'platform must be instagram, facebook, or linkedin' })
            return
        }
        const url = await UploadPostService.connectUrl(organizationId, resolved.org.name || 'Organization', platform, connectRedirect(req))
        res.json({ url })
    } catch (error) {
        if (organizationId) await UploadPostService.releaseIfUnused(organizationId).catch(() => {})
        sendError(res, error)
    }
})

router.delete('/social/connect', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, requestedOrgId)
        if (!(await TeamService.canEditOrgSettings(req.user!.id, organizationId))) {
            res.status(403).json({ error: 'Only an owner or admin can disconnect accounts.', code: 'FORBIDDEN' })
            return
        }
        const platform = req.body?.platform
        if (platform !== 'instagram' && platform !== 'facebook' && platform !== 'linkedin') {
            res.status(400).json({ error: 'platform must be instagram, facebook, or linkedin' })
            return
        }
        const result = await UploadPostService.disconnect(organizationId, platform)
        res.json(result)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/packages/:id/social', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { organizationId } = await ContentService.assertStudioAccess(req.user!.id, requestedOrgId)
        const platforms = Array.isArray(req.body?.platforms) ? req.body.platforms : []
        const allowed = platforms.filter((platform: string) => platform === 'instagram' || platform === 'facebook' || platform === 'linkedin')
        if (!allowed.length) {
            res.status(400).json({ error: 'Pick at least one connected account.' })
            return
        }
        const [pkg] = await ContentService.listPackages(req.user!.id, requestedOrgId, { packageId: req.params.id })
        if (!pkg) {
            res.status(404).json({ error: 'Post not found' })
            return
        }
        const text = socialCaption([pkg.hook, pkg.body, pkg.cta])
        if (!text.trim()) {
            res.status(400).json({ error: 'Write a headline or body before posting.' })
            return
        }
        const images = (Array.isArray(pkg.media) ? pkg.media : [])
            .map((item: { image_url?: string }) => item?.image_url)
            .filter((url: string | undefined): url is string => !!url && url.startsWith('https://'))
        if (!images.length && pkg.image_url?.startsWith('https://')) images.push(pkg.image_url)
        if (allowed.includes('instagram') && !images.length) {
            res.status(400).json({ error: 'Instagram needs a public photo on the post.' })
            return
        }
        const linked = await UploadPostService.connections(organizationId)
        const scheduledAt = typeof req.body?.scheduled_at === 'string' && req.body.scheduled_at ? req.body.scheduled_at : undefined
        const timezone = typeof req.body?.timezone === 'string' && req.body.timezone ? req.body.timezone : 'UTC'
        const username = UploadPostService.profileUsername(organizationId)
        const results = []
        for (const platform of allowed) {
            if (!linked[platform]?.connected) {
                results.push({ platform, ok: false, error: `${platform} is not connected` })
                continue
            }
            const externalId = `pkg_${pkg.id}_${platform}_${scheduledAt || 'now'}`.slice(0, 120)
            const reusedKey = await ContentService.socialIdempotencyKey(organizationId, pkg.id, platform, externalId)
            const idempotencyKey = reusedKey || `${externalId}_${Date.now()}`.slice(0, 180)
            const sourceType = pkg.visual_source_type || (Array.isArray(pkg.media) ? pkg.media[0]?.source_type : null)
            const sourceId = pkg.visual_source_id || (Array.isArray(pkg.media) ? pkg.media[0]?.source_id : null)
            try {
                const sent = await UploadPostService.publish({
                    profileUsername: username,
                    platform,
                    text,
                    idempotencyKey,
                    requestId: externalId,
                    externalId,
                    scheduledDate: scheduledAt,
                    timezone: scheduledAt ? timezone : undefined,
                    imageUrls: images,
                })
                let status: 'accepted' | 'scheduled' | 'published' | 'failed' = scheduledAt ? 'scheduled' : 'accepted'
                let postUrl: string | null = null
                let failure: string | null = null
                let sentAt = new Date().toISOString()
                if (!scheduledAt) {
                    const found = await UploadPostService.findUpload(externalId).catch(() => null)
                    if (found?.postUrl) {
                        status = 'published'
                        postUrl = found.postUrl
                        sentAt = found.sentAt || sentAt
                    } else if (found?.status === 'failed') {
                        status = 'failed'
                        failure = found.error
                    }
                }
                const receipt = await ContentService.rememberSocialSend({
                    organizationId,
                    userId: req.user!.id,
                    packageId: pkg.id,
                    sourceType,
                    sourceId,
                    imageUrl: images[0] || pkg.image_url || null,
                    platform,
                    status,
                    postUrl,
                    error: failure,
                    requestId: sent.requestId,
                    jobId: sent.jobId,
                    externalId,
                    idempotencyKey,
                    sentAt,
                    scheduledAt: scheduledAt || null,
                })
                results.push({
                    platform,
                    ok: receipt.status !== 'failed',
                    status: receipt.status,
                    error: receipt.error,
                    postUrl: receipt.post_url,
                    sentAt: receipt.created_at,
                    requestId: sent.requestId,
                    jobId: sent.jobId,
                })
            } catch (error) {
                const err = error as Error
                await ContentService.rememberSocialSend({
                    organizationId,
                    userId: req.user!.id,
                    packageId: pkg.id,
                    sourceType,
                    sourceId,
                    imageUrl: images[0] || pkg.image_url || null,
                    platform,
                    status: 'failed',
                    error: err.message,
                    externalId,
                    idempotencyKey,
                    sentAt: new Date().toISOString(),
                    scheduledAt: scheduledAt || null,
                })
                results.push({ platform, ok: false, status: 'failed', error: err.message })
            }
        }
        const live = results.some(item => item.status === 'accepted' || item.status === 'published')
        let publishedAt = pkg.published_at || null
        if (live) {
            const stamped = await ContentService.noteSocialLive(organizationId, [pkg.id])
            publishedAt = stamped.get(pkg.id) || publishedAt
        }
        res.json({ results, published_at: publishedAt })
    } catch (error) {
        sendError(res, error)
    }
})

router.delete('/packages/:id/social', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const platform = typeof req.query.platform === 'string' ? req.query.platform : ''
        if (platform !== 'instagram' && platform !== 'facebook' && platform !== 'linkedin') {
            res.status(400).json({ error: 'platform must be instagram, facebook, or linkedin' })
            return
        }
        const pkg = await ContentService.unscheduleSocial(req.user!.id, req.params.id, platform, requestedOrgId)
        res.json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.delete('/journeys/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        await ContentService.deleteJourney(req.user!.id, req.params.id, requestedOrgId)
        res.status(204).end()
    } catch (error) {
        sendError(res, error)
    }
})

export default router
