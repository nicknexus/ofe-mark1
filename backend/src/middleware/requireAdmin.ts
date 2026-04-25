import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { PlatformAdminService } from '../services/platformAdminService';

/**
 * Express middleware that allows the request through only if the
 * authenticated user is listed in the platform_admins table.
 * MUST be used AFTER `authenticateUser` so `req.user` is populated.
 */
export const requireAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }

        const isAdmin = await PlatformAdminService.isAdmin(req.user.id);
        if (!isAdmin) {
            res.status(403).json({ error: 'Admin access required' });
            return;
        }
        next();
    } catch (error) {
        console.error('[requireAdmin] error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
