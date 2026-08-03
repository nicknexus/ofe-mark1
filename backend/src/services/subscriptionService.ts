import { supabase } from '../utils/supabase';
import { TeamService } from './teamService';
import { PlatformAdminService } from './platformAdminService';
import { stripe } from '../utils/stripe';
import { EntitlementService } from './entitlementService';
import { PLAN_CATALOG, PlanTier, getPlan, normaliseTier, planLimitColumns } from '../config/planCatalog';

export interface Subscription {
    id: string;
    user_id: string;
    organization_id?: string;
    // 'free' = on the always-free plan (no Stripe sub, permanent access).
    status: 'none' | 'free' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    // Current tiers are free/growth/pro. Legacy values (starter/professional/
    // enterprise) may still exist until the rename migration runs; normaliseTier()
    // maps them. Kept as string to avoid churn during migration.
    plan_tier?: string | null;
    billing_interval?: 'monthly' | 'annual' | 'yearly' | 'lifetime' | null;
    trial_started_at?: string;
    trial_ends_at?: string;
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    stripe_price_id?: string;
    current_period_start?: string;
    current_period_end?: string;
    cancel_at_period_end?: boolean;
    cancelled_at?: string;
    initiatives_limit?: number | null;
    team_members_limit?: number | null;
    locations_limit?: number | null;
    storage_limit_bytes?: number | null;
    ai_reports_per_day?: number | null;
    created_at: string;
    updated_at: string;
}

export interface SubscriptionAccessResult {
    hasAccess: boolean;
    reason: string;
    subscription: Subscription;
    isInherited?: boolean;
    inheritedFromOrgId?: string;
}

const TRIAL_DURATION_DAYS = 30;

export interface AccessCode {
    id: string;
    code: string;
    days_granted: number;
    max_uses: number | null;
    times_used: number;
    description?: string;
    expires_at?: string;
    is_active: boolean;
    created_at: string;
}

export class SubscriptionService {
    /**
     * Get subscription for user, create one with status 'none' if doesn't exist
     */
    static async getOrCreate(userId: string, organizationId?: string): Promise<Subscription> {
        // Try to get existing subscription
        const { data: existing, error: fetchError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (fetchError) {
            throw new Error(`Failed to fetch subscription: ${fetchError.message}`);
        }

        if (existing) {
            // Check if trial expired and update status automatically
            if (existing.status === 'trial' && existing.trial_ends_at) {
                if (new Date(existing.trial_ends_at) < new Date()) {
                    return await this.updateStatus(userId, 'expired');
                }
            }
            return existing;
        }

        // Look up the user's org name
        let orgName: string | null = null;
        const { data: orgRow } = await supabase
            .from('user_organizations')
            .select('organizations(name)')
            .eq('user_id', userId)
            .maybeSingle();
        if (orgRow && (orgRow as any).organizations?.name) {
            orgName = (orgRow as any).organizations.name;
        }

        // Create new subscription record with status 'none'
        const { data: newSubscription, error: createError } = await supabase
            .from('subscriptions')
            .insert([{
                user_id: userId,
                organization_id: organizationId || null,
                org_name: orgName,
                status: 'none'
            }])
            .select()
            .single();

        if (createError) {
            throw new Error(`Failed to create subscription: ${createError.message}`);
        }

        return newSubscription;
    }

    /**
     * Activate the always-free plan for a user. Sets status 'free', plan_tier
     * 'free', and applies all Free limits. Replaces the old free trial — no card,
     * no expiry. Idempotent-ish: only meaningful from status 'none'.
     */
    static async activateFree(userId: string): Promise<Subscription> {
        const { data, error } = await supabase
            .from('subscriptions')
            .update({
                status: 'free',
                ...planLimitColumns('free'),
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to activate free plan: ${error.message}`);
        }

        return data;
    }

    /** @deprecated Trial removed — kept so old callers activate the free plan. */
    static async startTrial(userId: string): Promise<Subscription> {
        return this.activateFree(userId);
    }

    /**
     * Apply a paid (or free) tier's full limit set + plan_tier to a subscription.
     * Single writer for plan limits so the DB never drifts from the catalog.
     */
    static async applyPlan(userId: string, tier: PlanTier): Promise<Subscription> {
        const { data, error } = await supabase
            .from('subscriptions')
            .update(planLimitColumns(tier))
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to apply plan ${tier}: ${error.message}`);
        }
        // Plan changed → drop cached entitlements so public/private visibility
        // reflects the new tier immediately.
        EntitlementService.bustAll();
        return data;
    }

    /**
     * Downgrade a user to the free plan (e.g. paid subscription lapsed/cancelled).
     * Applies Free limits and sets status 'free'. Nothing else is touched:
     * over-limit initiatives, tags, and beneficiary groups are hidden/locked at
     * read time by EntitlementService, so the user's data (and their is_public
     * choices) are preserved exactly and reappear instantly on re-upgrade.
     */
    static async downgradeToFree(userId: string): Promise<Subscription> {
        const sub = await supabase
            .from('subscriptions')
            .update({ status: 'free', ...planLimitColumns('free'), cancelled_at: new Date().toISOString() })
            .eq('user_id', userId)
            .select()
            .single();

        if (sub.error) {
            throw new Error(`Failed to downgrade to free: ${sub.error.message}`);
        }
        EntitlementService.bustAll();
        return sub.data;
    }

    /**
     * Update subscription status
     */
    static async updateStatus(userId: string, status: Subscription['status']): Promise<Subscription> {
        const { data, error } = await supabase
            .from('subscriptions')
            .update({ status })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update subscription status: ${error.message}`);
        }

        return data;
    }

    /**
     * Check if user has active access to the app
     * Checks own subscription first, then inherited access from team membership
     */
    static async hasAccess(userId: string): Promise<SubscriptionAccessResult> {
        let subscription = await this.getOrCreate(userId);

        // First check user's own subscription
        switch (subscription.status) {
            case 'free':
                // Always-free plan: permanent access at Free limits.
                return { hasAccess: true, reason: 'free_plan', subscription };

            case 'trial':
                if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()) {
                    return { hasAccess: true, reason: 'trial_active', subscription };
                }
                // Trial expired - update status
                const expiredSub = await this.updateStatus(userId, 'expired');
                // Don't return yet - check inherited access
                break;

            case 'active':
                // Admin-granted plan: 'active' with no Stripe subscription behind
                // it. There's no billing period to check, so access holds until an
                // admin changes it back — never expires it out from under them.
                if (!subscription.stripe_subscription_id) {
                    return { hasAccess: true, reason: 'admin_granted_plan', subscription };
                }
                if (subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                    return { hasAccess: true, reason: 'subscription_active', subscription };
                }
                // Period ended — try syncing from Stripe before giving up (webhook may have been missed)
                if (subscription.stripe_subscription_id) {
                    subscription = await this.syncFromStripeDirectly(userId, subscription.stripe_subscription_id);
                    if (subscription.status === 'active' && subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                        return { hasAccess: true, reason: 'subscription_active', subscription };
                    }
                }
                if (subscription.status === 'active') {
                    subscription = await this.updateFromStripe(userId, {
                        status: 'expired',
                        cancelled_at: subscription.current_period_end || new Date().toISOString(),
                    });
                }
                break;

            case 'past_due':
                // Payment failed but Stripe is still retrying (dunning). Keep access
                // during the grace window — Stripe will either recover the payment
                // (→ active) or eventually cancel (→ subscription.deleted →
                // downgradeToFree). We never hard-lock the user out.
                return { hasAccess: true, reason: 'payment_past_due_grace', subscription };

            case 'cancelled':
                // Check if still in paid period (user cancelled but period hasn't ended)
                if (subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                    return { hasAccess: true, reason: 'subscription_active_until_period_end', subscription };
                }
                // Check inherited access
                break;

            case 'expired':
                // If there's a Stripe subscription, re-check — it may have been renewed
                if (subscription.stripe_subscription_id) {
                    subscription = await this.syncFromStripeDirectly(userId, subscription.stripe_subscription_id);
                    if (subscription.status === 'active' && subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                        return { hasAccess: true, reason: 'subscription_active', subscription };
                    }
                }
                break;

            case 'none':
            default:
                break;
        }

        // Check for inherited access from team membership
        const inheritedAccess = await this.checkInheritedAccess(userId);
        if (inheritedAccess.hasAccess) {
            return {
                hasAccess: true,
                reason: 'inherited_access',
                subscription,
                isInherited: true,
                inheritedFromOrgId: inheritedAccess.organizationId
            };
        }

        // No access - return appropriate reason based on subscription status
        switch (subscription.status) {
            case 'trial':
            case 'expired':
                return { hasAccess: false, reason: 'trial_expired', subscription };
            case 'past_due':
                return { hasAccess: false, reason: 'payment_past_due', subscription };
            case 'cancelled':
                return { hasAccess: false, reason: 'subscription_cancelled', subscription };
            case 'none':
            default:
                return { hasAccess: false, reason: 'no_subscription', subscription };
        }
    }

    /**
     * Access + subscription for the account the caller is actually LOOKING AT.
     *
     * Normal sessions: identical to hasAccess(userId).
     *
     * Support mode (platform admin inside a customer org): returns the CUSTOMER
     * OWNER's subscription, so every plan badge, limit and usage figure in the
     * UI describes the customer rather than the admin. Access is forced true —
     * an admin must be able to get into an expired or lapsed account, since
     * those are exactly the ones needing support. `isSupportMode` lets the
     * frontend label the plan as someone else's.
     */
    static async getAccessForContext(userId: string, requestedOrgId?: string): Promise<
        SubscriptionAccessResult & { isSupportMode: boolean }
    > {
        // Fast path. /subscription/status runs on every app load, and only a
        // platform admin can ever be in support mode — so gate the extra
        // ownership/membership lookups behind one small indexed check that
        // returns false immediately for every normal user.
        if (requestedOrgId && (await PlatformAdminService.isAdmin(userId))) {
            const { subscription, isSupportMode } = await this.resolveActiveOrg(userId, requestedOrgId);
            if (isSupportMode) {
                return {
                    hasAccess: true,
                    reason: 'support_mode',
                    subscription,
                    isSupportMode: true,
                };
            }
        }

        return { ...(await this.hasAccess(userId)), isSupportMode: false };
    }

    /**
     * Check if user has inherited access via team membership
     */
    static async checkInheritedAccess(userId: string): Promise<{ hasAccess: boolean; organizationId?: string }> {
        const memberships = await TeamService.getUserTeamMemberships(userId);

        for (const membership of memberships) {
            const ownerId = await TeamService.getOrganizationOwnerId(membership.organization_id);
            if (!ownerId) continue;

            const ownerSubscription = await this.getByUserId(ownerId);
            if (!ownerSubscription) continue;

            switch (ownerSubscription.status) {
                case 'free':
                    // Team member of a free-plan owner inherits access (Free allows team members).
                    return { hasAccess: true, organizationId: membership.organization_id };

                case 'trial':
                    if (ownerSubscription.trial_ends_at && new Date(ownerSubscription.trial_ends_at) > new Date()) {
                        return { hasAccess: true, organizationId: membership.organization_id };
                    }
                    break;

                case 'active':
                    if (ownerSubscription.current_period_end && new Date(ownerSubscription.current_period_end) > new Date()) {
                        return { hasAccess: true, organizationId: membership.organization_id };
                    }
                    return { hasAccess: true, organizationId: membership.organization_id };

                case 'past_due':
                    // Owner is in the payment-retry grace window — team keeps access.
                    return { hasAccess: true, organizationId: membership.organization_id };

                case 'cancelled':
                    if (ownerSubscription.current_period_end && new Date(ownerSubscription.current_period_end) > new Date()) {
                        return { hasAccess: true, organizationId: membership.organization_id };
                    }
                    break;

                default:
                    break;
            }
        }

        return { hasAccess: false };
    }

    /**
     * Get remaining trial days (null if not on trial)
     */
    static getRemainingTrialDays(subscription: Subscription): number | null {
        if (subscription.status !== 'trial' || !subscription.trial_ends_at) {
            return null;
        }

        const now = new Date();
        const end = new Date(subscription.trial_ends_at);
        const diffMs = end.getTime() - now.getTime();

        return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    /**
     * Get subscription by user ID (simple fetch, no auto-create)
     */
    static async getByUserId(userId: string): Promise<Subscription | null> {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to fetch subscription: ${error.message}`);
        }

        return data;
    }

    /** Get user_id by Stripe subscription ID (for webhooks when metadata is missing) */
    static async getUserIdByStripeSubscriptionId(stripeSubscriptionId: string): Promise<string | null> {
        const { data, error } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', stripeSubscriptionId)
            .maybeSingle();
        if (error || !data) return null;
        return data.user_id;
    }

    /**
     * Validate and redeem an access code
     */
    static async redeemAccessCode(userId: string, code: string): Promise<{ success: boolean; subscription?: Subscription; error?: string; daysGranted?: number }> {
        // Find the access code
        const { data: accessCode, error: codeError } = await supabase
            .from('access_codes')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .eq('is_active', true)
            .maybeSingle();

        if (codeError || !accessCode) {
            console.log('[redeem-code] lookup failed — code:', code.toUpperCase().trim(), 'error:', codeError, 'data:', accessCode);
            return { success: false, error: 'Invalid access code' };
        }

        // Check if code has expired
        if (accessCode.expires_at && new Date(accessCode.expires_at) < new Date()) {
            return { success: false, error: 'This access code has expired' };
        }

        // Check if code has reached max uses
        if (accessCode.max_uses !== null && accessCode.times_used >= accessCode.max_uses) {
            return { success: false, error: 'This access code has reached its maximum uses' };
        }

        // All good - redeem the code
        const now = new Date();
        const trialEnd = new Date(now.getTime() + accessCode.days_granted * 24 * 60 * 60 * 1000);

        // Ensure subscription row exists, then update it
        const existing = await this.getOrCreate(userId);
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .update({
                status: 'trial',
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                // Comped access codes grant Growth-level limits for the window.
                ...planLimitColumns('growth'),
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (subError) {
            console.error('[redeem-code] subscription update failed:', subError);
            return { success: false, error: 'Failed to activate access code' };
        }

        // Record the redemption
        await supabase
            .from('access_code_redemptions')
            .insert([{
                access_code_id: accessCode.id,
                user_id: userId
            }]);

        // Increment times_used
        await supabase
            .from('access_codes')
            .update({ times_used: accessCode.times_used + 1 })
            .eq('id', accessCode.id);

        return {
            success: true,
            subscription,
            daysGranted: accessCode.days_granted
        };
    }

    /**
     * Resolve which org a user is acting in and whose subscription governs it.
     * The org owner's subscription is always the source of truth for limits.
     * Shared by every per-org limit/feature check.
     */
    static async resolveActiveOrg(userId: string, requestedOrgId?: string): Promise<{
        activeOrgId: string | null;
        ownerId: string;
        subscription: Subscription;
        /** True when a platform admin is acting inside a customer org (support mode). */
        isSupportMode: boolean;
    }> {
        let activeOrgId: string | null = null;
        let isSupportMode = false;
        if (requestedOrgId) {
            const ownsRequested = await TeamService.isUserOwnerOfOrganization(userId, requestedOrgId);
            const membership = ownsRequested
                ? null
                : await TeamService.getUserTeamMembership(userId, requestedOrgId);
            if (ownsRequested || membership) {
                activeOrgId = requestedOrgId;
            } else if (await PlatformAdminService.canAccessOrg(userId, requestedOrgId)) {
                // Support mode: a platform admin working inside an org they
                // neither own nor belong to. Without this branch we fall through
                // to "their own org" below and every limit, feature flag, usage
                // count and storage cap would be resolved from the ADMIN's plan
                // instead of the customer's — enforcing the wrong plan on the
                // customer's data and leaking the admin's own account state into
                // the customer-facing UI.
                activeOrgId = requestedOrgId;
                isSupportMode = true;
            }
        }
        if (!activeOrgId) {
            const owned = await TeamService.getUserOwnedOrganization(userId);
            if (owned) activeOrgId = owned.id;
        }
        if (!activeOrgId) {
            const membership = await TeamService.getUserTeamMembership(userId);
            if (membership) activeOrgId = membership.organization_id;
        }

        // Subscription is owned by the org owner; fall back to the current user
        // if no org context yet (first-org flow).
        //
        // In support mode we must NEVER fall back to the admin: an org with no
        // owner_id would otherwise resolve to the admin's own subscription. Fail
        // closed to Free instead, so a data gap can't hand out the admin's plan.
        const resolvedOwnerId = activeOrgId
            ? await TeamService.getOrganizationOwnerId(activeOrgId)
            : null;
        if (isSupportMode && !resolvedOwnerId) {
            console.warn(`[resolveActiveOrg] support mode on ownerless org ${activeOrgId} — defaulting to Free limits`);
            return {
                activeOrgId,
                ownerId: '',
                subscription: {
                    id: '',
                    user_id: '',
                    status: 'free',
                    ...planLimitColumns('free'),
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                } as Subscription,
                isSupportMode,
            };
        }

        const ownerId = resolvedOwnerId || userId;
        const subscription = await this.getOrCreate(ownerId);
        return { activeOrgId, ownerId, subscription, isSupportMode };
    }

    /**
     * Feature access for the user's active org, derived from the owner's plan tier.
     * Currently only Free restricts tags + beneficiary groups.
     */
    static async getFeatureAccess(userId: string, requestedOrgId?: string): Promise<{
        tier: PlanTier;
        tags: boolean;
        beneficiaryGroups: boolean;
    }> {
        const { subscription } = await this.resolveActiveOrg(userId, requestedOrgId);
        const plan = getPlan(subscription.plan_tier);
        return { tier: plan.tier, tags: plan.features.tags, beneficiaryGroups: plan.features.beneficiaryGroups };
    }

    /** Locations usage (org-scoped count vs the owner plan's limit). */
    static async getLocationsUsage(userId: string, requestedOrgId?: string): Promise<{
        current: number;
        limit: number | null;
        canCreate: boolean;
    }> {
        const { activeOrgId, subscription } = await this.resolveActiveOrg(userId, requestedOrgId);
        let countQuery = supabase
            .from('locations')
            .select('*', { count: 'exact', head: true });
        countQuery = activeOrgId
            ? countQuery.eq('organization_id', activeOrgId)
            : countQuery.eq('user_id', userId);
        const { count, error } = await countQuery;
        if (error) throw new Error(`Failed to count locations: ${error.message}`);

        const current = count || 0;
        const limit = subscription.locations_limit ?? null;
        return { current, limit, canCreate: limit === null || current < limit };
    }

    /**
     * Storage usage (org bytes used vs the owner plan's byte limit).
     * `limitBytes` is the raw column (null = unlimited, used for enforcement).
     * `effectiveLimitBytes` falls back to the plan-tier default when the column
     * isn't set yet (used for display so the UI never shows a stale number).
     */
    static async getStorageLimit(userId: string, requestedOrgId?: string): Promise<{
        usedBytes: number;
        limitBytes: number | null;
        effectiveLimitBytes: number | null;
        organizationId: string | null;
    }> {
        const { activeOrgId, subscription } = await this.resolveActiveOrg(userId, requestedOrgId);
        let usedBytes = 0;
        if (activeOrgId) {
            const { data } = await supabase
                .from('organizations')
                .select('storage_used_bytes')
                .eq('id', activeOrgId)
                .maybeSingle();
            usedBytes = data?.storage_used_bytes || 0;
        }
        const limitBytes = subscription.storage_limit_bytes ?? null;
        const effectiveLimitBytes = limitBytes ?? getPlan(subscription.plan_tier).storage_limit_bytes;
        return { usedBytes, limitBytes, effectiveLimitBytes, organizationId: activeOrgId };
    }

    /**
     * Whether an upload of `additionalBytes` would fit within the org's storage
     * limit. Returns allowed=true when unlimited or under the cap.
     */
    static async checkStorageAllowed(userId: string, requestedOrgId: string | undefined, additionalBytes: number): Promise<{
        allowed: boolean;
        usedBytes: number;
        limitBytes: number | null;
    }> {
        const { usedBytes, limitBytes } = await this.getStorageLimit(userId, requestedOrgId);
        if (limitBytes === null) return { allowed: true, usedBytes, limitBytes };
        return { allowed: usedBytes + Math.max(0, additionalBytes) <= limitBytes, usedBytes, limitBytes };
    }

    /**
     * Whether the org may generate another AI report today, given its plan's
     * daily limit. Counts rows logged in ai_report_log for the current UTC day.
     */
    static async checkAiReportQuota(userId: string, requestedOrgId?: string): Promise<{
        canGenerate: boolean;
        used: number;
        limit: number | null;
        organizationId: string | null;
    }> {
        const { activeOrgId, subscription } = await this.resolveActiveOrg(userId, requestedOrgId);
        const limit = subscription.ai_reports_per_day ?? null;
        if (limit === null) return { canGenerate: true, used: 0, limit: null, organizationId: activeOrgId };
        if (!activeOrgId) return { canGenerate: true, used: 0, limit, organizationId: null };

        const startOfDay = new Date();
        startOfDay.setUTCHours(0, 0, 0, 0);
        const { count, error } = await supabase
            .from('ai_report_log')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', activeOrgId)
            .gte('created_at', startOfDay.toISOString());

        if (error) {
            // Fail open — never block report generation on a logging-table error.
            console.error('[checkAiReportQuota] count failed, allowing:', error.message);
            return { canGenerate: true, used: 0, limit, organizationId: activeOrgId };
        }
        const used = count || 0;
        return { canGenerate: used < limit, used, limit, organizationId: activeOrgId };
    }

    /** Record an AI report generation for daily-quota accounting. Best-effort. */
    static async logAiReport(organizationId: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('ai_report_log')
            .insert([{ organization_id: organizationId, user_id: userId }]);
        if (error) console.error('[logAiReport] insert failed:', error.message);
    }

    /**
     * Get initiatives usage (current count vs limit) for the user's *active* org.
     * For team members creating in a team org, the org owner's subscription is
     * the source of truth and the count is org-scoped.
     */
    static async getInitiativesUsage(userId: string, requestedOrgId?: string): Promise<{
        current: number;
        limit: number | null;
        canCreate: boolean;
    }> {
        const { activeOrgId, subscription } = await this.resolveActiveOrg(userId, requestedOrgId);

        let countQuery = supabase
            .from('initiatives')
            .select('*', { count: 'exact', head: true });
        if (activeOrgId) {
            countQuery = countQuery.eq('organization_id', activeOrgId);
        } else {
            countQuery = countQuery.eq('user_id', userId);
        }
        const { count, error } = await countQuery;

        if (error) {
            throw new Error(`Failed to count initiatives: ${error.message}`);
        }

        const currentCount = count || 0;
        const limit = subscription.initiatives_limit ?? null;
        const canCreate = limit === null || currentCount < limit;

        return {
            current: currentCount,
            limit,
            canCreate
        };
    }

    /**
     * Check if user can create a new initiative
     */
    static async canCreateInitiative(userId: string): Promise<boolean> {
        const usage = await this.getInitiativesUsage(userId);
        return usage.canCreate;
    }

    /**
     * Sync subscription directly from Stripe API. Returns the updated local subscription.
     * Falls back to returning the existing subscription if Stripe call fails.
     */
    static async syncFromStripeDirectly(userId: string, stripeSubscriptionId: string): Promise<Subscription> {
        if (!stripe) {
            return await this.getOrCreate(userId);
        }
        try {
            const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any;
            const status: Subscription['status'] = sub.status === 'active' ? 'active'
                : sub.status === 'past_due' ? 'past_due'
                    : sub.status === 'canceled' || sub.status === 'unpaid' ? 'cancelled'
                        : 'active';
            const item = sub.items?.data?.[0];
            const rawPeriodStart = sub.current_period_start ?? item?.current_period_start;
            const rawPeriodEnd = sub.current_period_end ?? item?.current_period_end ?? sub.cancel_at;
            const updated = await this.updateFromStripe(userId, {
                status,
                ...(rawPeriodStart && { current_period_start: new Date(rawPeriodStart * 1000).toISOString() }),
                ...(rawPeriodEnd && { current_period_end: new Date(rawPeriodEnd * 1000).toISOString() }),
                ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() }),
                ...(status === 'active' && { cancelled_at: null }),
            });
            console.log(`[syncFromStripeDirectly] Synced subscription for user ${userId}: status=${status}`);
            return updated;
        } catch (e) {
            console.error(`[syncFromStripeDirectly] Failed for user ${userId}:`, (e as Error).message);
            return await this.getOrCreate(userId);
        }
    }

    /**
     * Update subscription from Stripe webhook data
     */
    static async updateFromStripe(
        userId: string,
        stripeData: {
            stripe_customer_id?: string;
            stripe_subscription_id?: string;
            stripe_price_id?: string;
            status?: Subscription['status'];
            plan_tier?: Subscription['plan_tier'];
            billing_interval?: Subscription['billing_interval'];
            current_period_start?: string;
            current_period_end?: string;
            cancel_at_period_end?: boolean;
            cancelled_at?: string | null;
        }
    ): Promise<Subscription> {
        const { data, error } = await supabase
            .from('subscriptions')
            .update(stripeData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update subscription from Stripe: ${error.message}`);
        }

        return data;
    }
}

