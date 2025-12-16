import { Router, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { StorageService, PLACEHOLDER_MAX_STORAGE_BYTES } from '../services/storageService';
import { getCompressionStatus } from '../utils/imageCompression';

const router = Router();

/**
 * STORAGE ROUTES - Phase 1: Tracking Only
 * 
 * These endpoints provide storage usage information.
 * NO limits are enforced in Phase 1.
 * 
 * TODO Phase 2 (after Stripe integration):
 * - Add actual plan limits to response
 * - Add upgrade-required flag
 * - Add subscription info
 */

// Compression status diagnostic endpoint (no auth required for debugging)
router.get('/compression-status', async (req, res: Response): Promise<void> => {
    try {
        const status = await getCompressionStatus();
        console.log('[StorageRoute] Compression status requested:', status);
        res.json({
            ...status,
            message: status.available 
                ? '✅ Image compression is ACTIVE' 
                : '❌ Image compression is DISABLED - images will upload uncompressed',
        });
    } catch (error) {
        console.error('Compression status error:', error);
        res.status(500).json({ 
            error: 'Failed to get compression status',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});

// Get storage usage for current user
router.get('/usage', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const usage = await StorageService.getUsageForUser(req.user.id);

        if (!usage) {
            res.status(404).json({ error: 'No organization found for user' });
            return;
        }

        res.json({
            ...usage,
            // Phase 1: Include placeholder values for UI
            placeholder_max_bytes: PLACEHOLDER_MAX_STORAGE_BYTES,
            placeholder_max_gb: PLACEHOLDER_MAX_STORAGE_BYTES / (1024 * 1024 * 1024),
            // TODO Phase 2: Replace these with actual plan values
            // storage_limit_bytes: planLimit,
            // limit_gb: planLimit / (1024 * 1024 * 1024),
            // plan_tier: 'free',
            // limits_enforced: false, // Phase 1
        });
    } catch (error) {
        console.error('Storage usage error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get storage usage';
        res.status(500).json({ error: errorMessage });
    }
});

// Get storage usage for a specific organization (owner only)
router.get('/usage/:organizationId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const usage = await StorageService.getUsage(req.params.organizationId);

        res.json({
            ...usage,
            placeholder_max_bytes: PLACEHOLDER_MAX_STORAGE_BYTES,
            placeholder_max_gb: PLACEHOLDER_MAX_STORAGE_BYTES / (1024 * 1024 * 1024),
        });
    } catch (error) {
        console.error('Storage usage error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get storage usage';
        res.status(500).json({ error: errorMessage });
    }
});

// Recalculate storage (admin/debug endpoint)
router.post('/recalculate/:organizationId', authenticateUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'User not authenticated' });
            return;
        }

        const newTotal = await StorageService.recalculateStorage(req.params.organizationId);

        res.json({
            success: true,
            storage_used_bytes: newTotal,
            used_gb: Math.round((newTotal / (1024 * 1024 * 1024)) * 100) / 100,
        });
    } catch (error) {
        console.error('Storage recalculate error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to recalculate storage';
        res.status(500).json({ error: errorMessage });
    }
});

export default router;

