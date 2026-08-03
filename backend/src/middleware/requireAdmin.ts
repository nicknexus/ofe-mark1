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

/**
 * Allows the request through only if the user is a SUPER platform admin.
 * Used to gate support-agent management (only super admins manage sub-accounts).
 * MUST be used AFTER `authenticateUser`.
 */
export const requireSuperAdmin = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        if (!(await PlatformAdminService.isSuperAdmin(req.user.id))) {
            res.status(403).json({ error: 'Super admin access required' });
            return;
        }
        next();
    } catch (error) {
        console.error('[requireSuperAdmin] error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

/**
 * Gate a customer-org route on the caller actually being allowed to support
 * THAT org: super admins may touch any org, support agents only the ones
 * assigned to them in `support_org_assignments`.
 *
 * Without this, `requireAdmin` alone only proves "is some kind of admin" — a
 * support agent could read or modify any org by id, bypassing the assignment
 * filter that the org LIST route applies. Every route carrying a customer-org
 * id must use this.
 *
 * Demo routes deliberately do NOT use it: they verify `is_demo = true` on the
 * target instead, so they can never reach a customer org, and demo tooling
 * stays shared across all admins.
 *
 * Responds 404 (not 403) on denial so an unassigned agent can't probe which
 * org ids exist. MUST be used AFTER `authenticateUser` + `requireAdmin`.
 */
export const requireOrgAccess = (paramName = 'id') => async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        if (!req.user?.id) {
            res.status(401).json({ error: 'Not authenticated' });
            return;
        }
        const organizationId = req.params[paramName];
        if (!organizationId) {
            res.status(400).json({ error: 'Organization id is required' });
            return;
        }
        if (!(await PlatformAdminService.canAccessOrg(req.user.id, organizationId))) {
            console.warn(
                `[requireOrgAccess] denied: admin ${req.user.email} (${req.user.id}) → org ${organizationId}`
            );
            res.status(404).json({ error: 'Organization not found' });
            return;
        }
        next();
    } catch (error) {
        console.error('[requireOrgAccess] error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
