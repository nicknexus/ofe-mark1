import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { TeamService } from '../services/teamService';

/**
 * Middleware to require owner permissions for an action
 * Used to protect delete endpoints
 */
export const requireOwnerPermission = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const permissions = await TeamService.getUserPermissions(req.user!.id);

        if (!permissions.isOwner) {
            res.status(403).json({
                error: 'Only the organization owner can perform this action',
                code: 'OWNER_PERMISSION_REQUIRED'
            });
            return;
        }

        // Attach permissions to request for use in route handlers
        (req as any).permissions = permissions;
        next();
    } catch (error) {
        console.error('Error checking owner permission:', error);
        res.status(500).json({ error: 'Failed to verify permissions' });
    }
};

/**
 * Middleware to require impact claims permission
 * Used to protect story creation
 */
export const requireImpactClaimsPermission = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const permissions = await TeamService.getUserPermissions(req.user!.id);

        if (!permissions.canAddImpactClaims) {
            res.status(403).json({
                error: 'You do not have permission to create impact claims. Contact your organization owner.',
                code: 'IMPACT_CLAIMS_PERMISSION_REQUIRED'
            });
            return;
        }

        // Attach permissions to request for use in route handlers
        (req as any).permissions = permissions;
        next();
    } catch (error) {
        console.error('Error checking impact claims permission:', error);
        res.status(500).json({ error: 'Failed to verify permissions' });
    }
};

/**
 * Middleware to load user permissions without blocking
 * Attaches permissions to request for use in conditional logic
 */
export const loadPermissions = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const permissions = await TeamService.getUserPermissions(req.user!.id);
        (req as any).permissions = permissions;
        next();
    } catch (error) {
        console.error('Error loading permissions:', error);
        // Don't block the request, just continue without permissions
        next();
    }
};

/**
 * Helper function to check delete permission for a resource
 * Returns true if user can delete, false otherwise
 */
export async function canDeleteResource(userId: string): Promise<boolean> {
    const permissions = await TeamService.getUserPermissions(userId);
    return permissions.isOwner;
}

/**
 * Helper function to check impact claims permission
 * Returns true if user can create impact claims, false otherwise
 */
export async function canCreateImpactClaim(userId: string): Promise<boolean> {
    const permissions = await TeamService.getUserPermissions(userId);
    return permissions.canAddImpactClaims;
}
