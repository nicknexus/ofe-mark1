import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { TeamService } from '../services/teamService';
import { PlatformAdminService } from '../services/platformAdminService';
import { recordAdminAction } from '../utils/auditLog';

/**
 * SUPPORT MODE — a platform admin operating inside a customer org.
 *
 * Detected purely from server-side facts: the caller is a platform admin who
 * may support the requested org, and is neither its owner nor a member. The
 * frontend's localStorage flag is a UI convenience only — never trusted here.
 */
export interface SupportContext {
    active: boolean;
    organizationId?: string;
}

export async function resolveSupportContext(
    userId: string,
    requestedOrgId?: string
): Promise<SupportContext> {
    if (!requestedOrgId) return { active: false };

    // Cheapest discriminator first. This runs on every write request in the
    // app, and only a platform admin can ever be in support mode — so settle
    // it with one lookup against a tiny indexed table rather than two
    // ownership/membership queries per request for every ordinary user.
    if (!(await PlatformAdminService.isAdmin(userId))) return { active: false };

    // An admin working in their OWN org is an ordinary session, not support.
    if (await TeamService.isUserOwnerOfOrganization(userId, requestedOrgId)) return { active: false };
    if (await TeamService.getUserTeamMembership(userId, requestedOrgId)) return { active: false };

    if (await PlatformAdminService.canAccessOrg(userId, requestedOrgId)) {
        return { active: true, organizationId: requestedOrgId };
    }
    return { active: false };
}

/** Convenience wrapper reading the org hint off the request. */
export async function getSupportContext(req: AuthenticatedRequest): Promise<SupportContext> {
    if (!req.user?.id) return { active: false };
    const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
    return resolveSupportContext(req.user.id, requestedOrgId);
}

/**
 * Refuse money-moving actions while in support mode.
 *
 * An admin inside a customer account must never be able to start a checkout,
 * open a billing portal, redeem a code, or activate a plan — those would act on
 * the ADMIN's own subscription while they believe they're working on the
 * customer's, and a portal session would expose the admin's real card details
 * inside what looks like the customer's account. Plan changes belong in the
 * admin console, which is explicit about whose plan it's editing.
 */
export const blockInSupportMode = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const ctx = await getSupportContext(req);
        if (ctx.active) {
            res.status(403).json({
                error: 'Billing actions are disabled while viewing a customer account. Use the admin console to change their plan.',
                code: 'support_mode_billing_blocked',
            });
            return;
        }
        next();
    } catch (error) {
        console.error('[blockInSupportMode] error:', error);
        // Fail closed: if we can't prove this ISN'T support mode, don't take money actions.
        res.status(500).json({ error: 'Internal server error' });
    }
};

/** Request bodies are logged for context, minus anything sensitive. */
const REDACTED_BODY_KEYS = new Set(['password', 'token', 'access_token', 'code', 'secret']);

function safeDetail(body: unknown): Record<string, unknown> | null {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (REDACTED_BODY_KEYS.has(k.toLowerCase())) {
            out[k] = '[redacted]';
        } else if (typeof v === 'string') {
            out[k] = v.length > 200 ? `${v.slice(0, 200)}…` : v;
        } else if (v === null || ['number', 'boolean'].includes(typeof v)) {
            out[k] = v;
        } else {
            out[k] = Array.isArray(v) ? `[array:${v.length}]` : '[object]';
        }
    }
    return out;
}

/**
 * Audit every write an admin makes inside a customer org.
 *
 * Mounted globally so it records the REQUEST, not a button click. The console's
 * "support.enter" event only fires if the frontend cooperates — an admin
 * hitting the API directly would otherwise leave no trail at all. Logged after
 * the response so the recorded status reflects what actually happened, and
 * best-effort throughout: auditing must never break a support fix in progress.
 */
export const auditSupportWrites = (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
): void => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        next();
        return;
    }

    // Snapshot the body now — handlers are free to mutate req.body downstream.
    const detail = safeDetail(req.body);

    // All the work happens after the response is sent: `req.user` is only
    // populated once the route's own authenticateUser has run, and doing the
    // lookups here keeps auditing off the request's critical path.
    res.on('finish', () => {
        void (async () => {
            try {
                if (res.statusCode >= 400) return; // only record writes that landed
                if (!req.user?.id) return;         // unauthenticated / public route

                const ctx = await getSupportContext(req);
                if (!ctx.active) return;

                await recordAdminAction({
                    adminUserId: req.user.id,
                    adminEmail: req.user.email,
                    organizationId: ctx.organizationId ?? null,
                    action: 'support.write',
                    detail: {
                        method: req.method,
                        path: req.originalUrl.split('?')[0],
                        status: res.statusCode,
                        ...(detail ? { body: detail } : {}),
                    },
                });
            } catch (error) {
                console.error('[auditSupportWrites] failed to record:', (error as Error).message);
            }
        })();
    });

    next();
};
