import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { DataImportService } from '../services/dataImportService';

const router = Router();
const spreadsheetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const extension = file.originalname.split('.').pop()?.toLowerCase();
        if (extension === 'csv' || extension === 'xlsx') callback(null, true);
        else callback(new Error('Please choose a .csv or .xlsx file'));
    },
});
const analysisLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req as AuthenticatedRequest).user?.id || 'unauthenticated',
    message: { error: 'Too many spreadsheet analyses. Please wait before trying again.' },
});

router.post('/analyze', authenticateUser, analysisLimiter, spreadsheetUpload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'Spreadsheet file is required' });
            return;
        }
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const analysis = await DataImportService.analyze(req.file, req.user!.id, requestedOrgId);
        res.json(analysis);
    } catch (error: any) {
        console.error('Spreadsheet analysis failed:', error);
        const status = typeof error?.status === 'number' ? error.status : 500;
        if (error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
            res.status(402).json({ error: 'OpenAI quota exceeded', code: 'insufficient_quota' });
            return;
        }
        if (error?.status === 429) {
            res.status(429).json({ error: 'AI analysis is busy. Please try again shortly.', code: 'rate_limit' });
            return;
        }
        res.status(status).json({
            error: status >= 500 ? 'AI could not analyze this spreadsheet' : error.message,
            message: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
});

export default router;
