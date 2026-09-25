import { Response, NextFunction } from 'express';
import { authenticateUser, AuthenticatedRequest } from './auth';
import { SubscriptionService } from '../services/subscriptionService';
import { PlatformAdminService } from '../services/platformAdminService';

/**
 * Server-side paywall for app data routes.
 *
 * ENFORCE_APP_ACCESS:
 *  - 'off' (default): does nothing.
 *  - 'log': never blocks; logs every request that WOULD be blocked, so the
 *    rollout can be verified against real traffic before enforcing.
 *  - 'on': blocks with 403 { code: 'subscription_required' }. The frontend
 *    turns that into the "trial ended / subscription ended" screen.
 *
 * Safety:
 *  - Fails OPEN. Any lookup error lets the request through; only a definite
 *    "no access" answer blocks.
 *  - Only positive results are cached. A user who just paid is never held
 *    out by a stale "no" on another instance.
 *  - Requests without a bearer token pass through untouched; the route's own
 *    auth decides (public endpoints, invite lookups).
 */

type Mode = 'off' | 'log' | 'on';

function mode(): Mode {
    const v = (process.env.ENFORCE_APP_ACCESS || 'off').toLowerCase();
    return v === 'on' || v === 'log' ? v : 'off';
}

const ALLOW_TTL_MS = 60_000;
const allowCache = new Map<string, number>();

async function isAllowed(userId: string): Promise<{ allowed: boolean; reason: string; status: string }> {
    const hit = allowCache.get(userId);
    if (hit && hit > Date.now()) return { allowed: true, reason: 'cached', status: 'cached' };

    if (await PlatformAdminService.isAdmin(userId)) {
        allowCache.set(userId, Date.now() + ALLOW_TTL_MS);
        return { allowed: true, reason: 'platform_admin', status: 'admin' };
    }

    const result = await SubscriptionService.checkAccessReadOnly(userId);
    if (result.hasAccess) allowCache.set(userId, Date.now() + ALLOW_TTL_MS);
    return { allowed: result.hasAccess, reason: result.reason, status: result.status };
}

/**
 * @param skip Paths (relative to the router mount) that must stay reachable
 *   for locked users, e.g. what the paywall and invite screens call.
 */
export function requireAppAccess(skip?: (req: AuthenticatedRequest) => boolean) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
        const m = mode();
        if (m === 'off' || req.method === 'OPTIONS') return next();
        if (skip?.(req)) return next();
        if (!req.headers.authorization?.startsWith('Bearer ')) return next();

        authenticateUser(req, res, async () => {
            const userId = req.user?.id;
            if (!userId) return next();
            try {
                const { allowed, reason, status } = await isAllowed(userId);
                if (allowed) return next();

                console.warn(
                    `[app-access] ${m === 'on' ? 'BLOCKED' : 'would block'} user=${userId} status=${status} reason=${reason} ${req.method} ${req.baseUrl}${req.path}`
                );
                if (m === 'log') return next();

                res.status(403).json({
                    error: 'Your plan has ended.',
                    code: 'subscription_required',
                    reason,
                });
            } catch (e) {
                console.error(`[app-access] check failed for ${userId}, allowing:`, (e as Error).message);
                next();
            }
        });
    };
}
