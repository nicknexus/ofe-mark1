import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { ReportImportService } from '../services/reportImportService';

const router = Router();

/**
 * Annual report import.
 *
 * The file itself is uploaded directly to Supabase Storage by the client (via
 * the existing /upload signed-URL flow, which bypasses serverless body limits).
 * The client then POSTs the resulting file location here; we create a job row
 * and run extraction, returning the structured suggestions for review.
 */

// List recent imports for the active org.
router.get('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const imports = await ReportImportService.listForOrg(req.user!.id, requestedOrgId);
        res.json(imports);
    } catch (error: any) {
        res.status(error?.status || 500).json({ error: error?.message || 'Failed to list imports' });
    }
});

// Get a single import (used to poll a long-running extraction).
router.get('/:id', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const row = await ReportImportService.getById(req.params.id, req.user!.id, requestedOrgId);
        if (!row) {
            res.status(404).json({ error: 'Import not found' });
            return;
        }
        res.json(row);
    } catch (error: any) {
        res.status(error?.status || 500).json({ error: error?.message || 'Failed to fetch import' });
    }
});

// Create a job from an uploaded file and run extraction synchronously.
// Body: { file_name, file_path, file_url }
router.post('/', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const { file_name, file_path, file_url } = req.body || {};

        if (!file_path && !file_url) {
            res.status(400).json({ error: 'file_path or file_url is required' });
            return;
        }

        const job = await ReportImportService.create(req.user!.id, requestedOrgId, {
            file_name,
            file_path,
            file_url,
        });

        const result = await ReportImportService.process(job.id, req.user!.id, requestedOrgId);
        res.status(201).json(result);
    } catch (error: any) {
        console.error('[ReportImport] POST / failed:', error?.stack || error?.message || error);
        if (error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
            res.status(402).json({ error: 'OpenAI Quota Exceeded', code: 'insufficient_quota' });
            return;
        }
        if (error?.status === 429) {
            res.status(429).json({ error: 'Rate Limit Exceeded', code: 'rate_limit' });
            return;
        }
        res.status(error?.status || 500).json({ error: error?.message || 'Failed to process report' });
    }
});

// Re-run extraction for an existing job (e.g. after a timeout).
router.post('/:id/process', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const result = await ReportImportService.process(req.params.id, req.user!.id, requestedOrgId);
        res.json(result);
    } catch (error: any) {
        res.status(error?.status || 500).json({ error: error?.message || 'Failed to process report' });
    }
});

export default router;
