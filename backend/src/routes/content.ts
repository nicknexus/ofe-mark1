import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { ContentService } from '../services/contentService'
import { ContentChannel, ContentDraftStatus, ContentPostFormat, ContentPostKind, ContentSourceType, ContentStoryType } from '../types'

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
        const result = await ContentService.listSources(req.user!.id, requestedOrgId, {
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
        const { source_type, source_id, story_type, why } = req.body || {}
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
            requestedOrgId
        )
        res.json(master)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/refine-master', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const { source_type, source_id, story_type, hook, body, evidence_line, cta, context, why } = req.body || {}
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
            { source_type, source_id, story_type, hook, body, evidence_line, cta, context, why },
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
        const { source_type, source_id, story_type, hook, body, evidence_line, cta, channels, context } = req.body || {}
        if (!Array.isArray(channels) || channels.some((c: string) => !CHANNELS.has(c))) {
            res.status(400).json({ error: 'channels must be a list of known channels' })
            return
        }
        const versions = await ContentService.generateVersions(
            req.user!.id,
            { source_type, source_id, story_type, hook, body, evidence_line, cta, channels, context },
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
        const packages = await ContentService.listPackages(req.user!.id, requestedOrgId)
        res.json(packages)
    } catch (error) {
        sendError(res, error)
    }
})

router.post('/packages', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const pkg = await ContentService.savePackage(req.user!.id, req.body || {}, requestedOrgId)
        res.status(201).json(pkg)
    } catch (error) {
        sendError(res, error)
    }
})

router.patch('/packages/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const status = req.body?.status as ContentDraftStatus
        if (status !== 'draft' && status !== 'ready') {
            res.status(400).json({ error: 'status must be draft or ready' })
            return
        }
        const pkg = await ContentService.updatePackageStatus(req.user!.id, req.params.id, status, requestedOrgId)
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

export default router
