import { Router } from 'express'
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth'
import { ContentService } from '../services/contentService'
import { ContentPostFormat, ContentPostKind, ContentSourceType } from '../types'

const router = Router()

function sendError(res: any, error: unknown) {
    const err = error as Error & { status?: number; code?: string }
    const status = err.status || 500
    res.status(status).json({ error: err.message, code: err.code })
}

router.get('/sources', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined
        const offset = Number(req.query.offset || 0)
        const limit = Number(req.query.limit || 21)
        const sourceType = req.query.source_type as string | undefined
        const singleDate = (req.query.single_date as string | undefined) || undefined
        const startDate = (req.query.start_date as string | undefined) || undefined
        const endDate = (req.query.end_date as string | undefined) || undefined
        const result = await ContentService.listSources(req.user!.id, requestedOrgId, {
            offset: Number.isFinite(offset) ? offset : 0,
            limit: Number.isFinite(limit) ? limit : 21,
            sourceType: sourceType === 'evidence' || sourceType === 'story' ? sourceType : 'all',
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
        const layout = req.query.layout as string | undefined
        if (source_type !== 'evidence' && source_type !== 'story') {
            res.status(400).json({ error: 'source_type must be evidence or story' })
            return
        }
        if (!source_id) {
            res.status(400).json({ error: 'source_id is required' })
            return
        }
        const file = await ContentService.composeGraphic(
            req.user!.id,
            source_type as ContentSourceType,
            source_id,
            requestedOrgId,
            layout
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

export default router
