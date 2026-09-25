import { supabase } from '../utils/supabase';
import { TeamService } from './teamService';
import { PlatformAdminService } from './platformAdminService';
import { stripe, mapStripeSubscriptionStatus, tierFromPriceId } from '../utils/stripe';
import { EntitlementService } from './entitlementService';
import { PlanTier, getPlan, normaliseTier, planLimitColumns } from '../config/planCatalog';

export interface Subscription {
    id: string;
    user_id: string;
    organization_id?: string;
    // 'free' is legacy: remove_free_plan.sql converts every row and the CHECK
    // constraint forbids new ones. Kept in the type until that has run everywhere.
    status: 'none' | 'free' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    // Current tiers are free/growth/pro. Legacy values (starter/professional/
    // enterprise) may still exist until the rename migration runs; normaliseTier()
    // maps them. Kept as string to avoid churn during migration.
    plan_tier?: string | null;
    billing_interval?: 'monthly' | 'annual' | 'yearly' | 'lifetime' | null;
    trial_started_at?: string;
    trial_ends_at?: string;
    /** Set once on the first Stripe Checkout (trial or paid). Never cleared. */
    trial_used_at?: string | null;
    /** First real payment. Null = never paid (a failed post-trial charge locks). */
    first_paid_at?: string | null;
    /** Card fingerprint from Checkout, used to allow one trial per card. */
    card_fingerprint?: string | null;
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
            // Card-less trials (legacy grace) expire locally. Stripe-backed trials
            // are left to the Stripe sync: at the trial→paid moment the local
            // clock can pass trial_ends_at before Stripe's update lands.
            if (existing.status === 'trial' && existing.trial_ends_at && !existing.stripe_subscription_id) {
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
     * Whether a subscription row grants app access right now, from the row
     * alone (no Stripe calls, no writes). The single access rule: hasAccess,
     * inherited access, the API gate and public visibility all use it.
     *
     * `activeGraceDays` lets an 'active' row stay open that many days past
     * current_period_end, so a missed renewal webhook can't lock out a paying
     * customer between syncs. Only the API gate passes it.
     */
    static evaluate(
        sub: Subscription | null | undefined,
        opts?: { activeGraceDays?: number; now?: Date }
    ): boolean {
        if (!sub) return false;
        const now = opts?.now ?? new Date();
        const after = (iso: string | null | undefined, days = 0) =>
            !!iso && new Date(iso).getTime() + days * 86_400_000 > now.getTime();

        switch (sub.status) {
            case 'free':
                return true;
            case 'trial':
                return after(sub.trial_ends_at);
            case 'active':
                // No Stripe sub behind it = admin comp; no period to check.
                return !sub.stripe_subscription_id || after(sub.current_period_end, opts?.activeGraceDays ?? 0);
            case 'past_due':
                // Renewal failed for someone who has paid before: keep access
                // while Stripe retries. A failed FIRST charge after the trial
                // locks. `undefined` means the column isn't migrated yet.
                return sub.first_paid_at !== null;
            case 'cancelled':
                return after(sub.current_period_end);
            default:
                return false;
        }
    }

    /** Client-facing reason for a locked account, so the UI can say trial vs subscription ended. */
    static lockedReason(sub: Subscription): string {
        const hasPaid = !!sub.first_paid_at;
        switch (sub.status) {
            case 'past_due':
                return 'trial_payment_failed';
            case 'trial':
            case 'expired':
            case 'cancelled':
                return hasPaid ? 'subscription_ended' : 'trial_expired';
            default:
                return 'no_subscription';
        }
    }

    /**
     * Read-only access check for the API gate: no Stripe calls and no writes,
     * so it's safe on every request. /subscription/status still does the full
     * self-healing sync; this only reads rows.
     */
    static async checkAccessReadOnly(userId: string): Promise<{ hasAccess: boolean; reason: string; status: string }> {
        const sub = await this.getByUserId(userId);
        // Any 'active' row passes: hasAccess trusts Stripe's 'active' even with a
        // stale period end, and the gate must never be stricter than the
        // paywall screen or the client would bounce between them.
        if (sub?.status === 'active' || this.evaluate(sub, { activeGraceDays: 7 })) {
            return { hasAccess: true, reason: 'own_subscription', status: sub!.status };
        }
        const inherited = await this.checkInheritedAccess(userId);
        if (inherited.hasAccess) {
            return { hasAccess: true, reason: 'inherited_access', status: sub?.status ?? 'none' };
        }
        return {
            hasAccess: false,
            reason: sub ? this.lockedReason(sub) : 'no_subscription',
            status: sub?.status ?? 'none',
        };
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
     * Paid/trial access ended. Lock the account (no free fallback) and take
     * every owned non-demo org off the public web. Data is untouched; they
     * republish after they subscribe again.
     */
    static async deactivateAndUnpublish(userId: string): Promise<Subscription> {
        const existing = await this.getByUserId(userId);
        // Grandfathered always-free: never lock or unpublish from a stale
        // canceled Stripe id left on the row after the old downgrade path.
        if (existing?.status === 'free') return existing;

        const { data, error } = await supabase
            .from('subscriptions')
            .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancel_at_period_end: false,
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to deactivate subscription: ${error.message}`);
        }

        const { error: unpubError } = await supabase
            .from('organizations')
            .update({ is_public: false })
            .eq('owner_id', userId)
            .eq('is_demo', false);
        if (unpubError) {
            console.error(`[deactivateAndUnpublish] unpublish failed for ${userId}:`, unpubError.message);
        }

        EntitlementService.bustAll();
        return data;
    }

    /**
     * Stripe says the subscription is over. If it was cancelled mid-trial
     * (portal set to cancel immediately, or an admin cancel in Stripe), the
     * user keeps the trial they were promised: stored as cancelled with the
     * period running to trial_end, so access and the public page end then.
     * Otherwise lock and unpublish now.
     */
    static async handleStripeCancellation(userId: string, stripeSub: any): Promise<Subscription> {
        const trialEndMs = stripeSub?.trial_end ? stripeSub.trial_end * 1000 : 0;
        if (trialEndMs > Date.now()) {
            const updated = await this.updateFromStripe(userId, {
                status: 'cancelled',
                current_period_end: new Date(trialEndMs).toISOString(),
                trial_ends_at: new Date(trialEndMs).toISOString(),
                cancel_at_period_end: false,
                cancelled_at: new Date().toISOString(),
            });
            EntitlementService.bustAll();
            return updated;
        }
        return this.deactivateAndUnpublish(userId);
    }

    /**
     * One free trial per card. When a trialing Checkout completes with a card
     * that already started a trial on another account, end the trial now so
     * Stripe bills immediately. Best-effort: any failure leaves the trial as-is.
     * Returns the (possibly updated) Stripe subscription.
     */
    static async enforceOneTrialPerCard(userId: string, stripeSub: any): Promise<any> {
        if (!stripe || stripeSub?.status !== 'trialing') return stripeSub;
        try {
            const existing = await this.getByUserId(userId);
            if (!existing || !('card_fingerprint' in existing)) return stripeSub;

            let pm = stripeSub.default_payment_method;
            if (typeof pm === 'string') pm = await stripe.paymentMethods.retrieve(pm);
            const fingerprint: string | undefined = pm?.card?.fingerprint;
            if (!fingerprint) return stripeSub;

            if (existing.card_fingerprint !== fingerprint) {
                await supabase.from('subscriptions').update({ card_fingerprint: fingerprint }).eq('user_id', userId);
            }

            const { data: others } = await supabase
                .from('subscriptions')
                .select('user_id')
                .eq('card_fingerprint', fingerprint)
                .neq('user_id', userId)
                .not('trial_used_at', 'is', null)
                .limit(1);
            if (!others?.length) return stripeSub;

            console.warn(`[trial] card already used for a trial by ${others[0].user_id}; ending trial for ${userId}`);
            return await stripe.subscriptions.update(stripeSub.id, { trial_end: 'now', proration_behavior: 'none' });
        } catch (e) {
            console.error(`[trial] one-trial-per-card check failed for ${userId}:`, (e as Error).message);
            return stripeSub;
        }
    }

    /** Owner's public page may be served (or stay listed). Grandfathered free stays live. */
    static isLiveForPublic(sub: Subscription | null | undefined): boolean {
        // Paying rows stay live even with a stale period end: a paying org's
        // public page must never drop because a renewal webhook was missed.
        if (sub?.status === 'active' || sub?.status === 'past_due') return true;
        return this.evaluate(sub);
    }

    /**
     * Org ids whose owner currently has live access (trial/active/past_due/free,
     * or cancelled-but-still-in-period). Demo orgs always pass. Used as a
     * read-time belt so a missed webhook cannot leave a lapsed page up.
     */
    static async orgIdsWithLiveAccess(orgIds: string[]): Promise<Set<string>> {
        const unique = [...new Set(orgIds.filter(Boolean))];
        const live = new Set<string>();
        if (unique.length === 0) return live;

        const { data: orgs, error } = await supabase
            .from('organizations')
            .select('id, owner_id, is_demo')
            .in('id', unique);
        if (error || !orgs) return live;

        const ownerIds = [...new Set(orgs.map(o => o.owner_id).filter(Boolean))] as string[];
        const subByOwner = new Map<string, Subscription>();
        if (ownerIds.length > 0) {
            const { data: subs } = await supabase
                .from('subscriptions')
                .select('user_id, status, trial_ends_at, current_period_end')
                .in('user_id', ownerIds);
            for (const s of subs || []) subByOwner.set(s.user_id, s as Subscription);
        }

        for (const org of orgs) {
            if (org.is_demo) {
                live.add(org.id);
                continue;
            }
            if (this.isLiveForPublic(subByOwner.get(org.owner_id))) live.add(org.id);
        }
        return live;
    }

    static async orgIsLiveForPublic(orgId: string): Promise<boolean> {
        const live = await this.orgIdsWithLiveAccess([orgId]);
        return live.has(orgId);
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

        if (this.evaluate(subscription)) {
            return { hasAccess: true, reason: `${subscription.status}_access`, subscription };
        }

        // Row says no. If Stripe is behind it, ask Stripe before locking (a
        // renewal or trial→paid webhook may have been missed). Stripe is the
        // source of truth for anything it bills; a Stripe 'active' always wins.
        if (subscription.stripe_subscription_id && subscription.status !== 'none') {
            subscription = await this.syncFromStripeDirectly(userId, subscription.stripe_subscription_id);
            if (subscription.status === 'active' || this.evaluate(subscription)) {
                return { hasAccess: true, reason: `${subscription.status}_access`, subscription };
            }
        } else if (subscription.status === 'trial') {
            // Card-less trial (legacy grace) ran out.
            subscription = await this.updateStatus(userId, 'expired');
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

        return { hasAccess: false, reason: this.lockedReason(subscription), subscription };
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
            // Same grace as the API gate: a paying owner's missed renewal
            // webhook must not lock their whole team out.
            if (this.evaluate(ownerSubscription, { activeGraceDays: 7 })) {
                return { hasAccess: true, organizationId: membership.organization_id };
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
                    status: 'none',
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
     * Currently Free restricts tags, beneficiary groups, and content studio.
     */
    static async getFeatureAccess(userId: string, requestedOrgId?: string): Promise<{
        tier: PlanTier;
        tags: boolean;
        beneficiaryGroups: boolean;
        contentStudio: boolean;
    }> {
        const { subscription } = await this.resolveActiveOrg(userId, requestedOrgId);
        const plan = getPlan(subscription.plan_tier);
        return {
            tier: plan.tier,
            tags: plan.features.tags,
            beneficiaryGroups: plan.features.beneficiaryGroups,
            contentStudio: plan.features.contentStudio,
        };
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
            throw new Error(`Failed to count programs: ${error.message}`);
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
     * Apply a Stripe subscription object onto our row. Shared by the webhook,
     * /status self-heal, and confirm-checkout so mapping cannot drift.
     */
    static async applyStripeSubscription(
        userId: string,
        stripeSub: any,
        opts?: { markTrialUsed?: boolean }
    ): Promise<Subscription> {
        const status = mapStripeSubscriptionStatus(stripeSub.status);
        if (status === 'cancelled') {
            return this.handleStripeCancellation(userId, stripeSub);
        }

        const item = stripeSub.items?.data?.[0];
        const rawPeriodStart = stripeSub.current_period_start ?? item?.current_period_start;
        const rawPeriodEnd = stripeSub.current_period_end ?? item?.current_period_end ?? stripeSub.cancel_at;
        // Newer Stripe API versions record a portal cancel as `cancel_at` (the
        // period/trial end) and leave cancel_at_period_end false.
        const cancelAtPeriodEnd =
            stripeSub.cancel_at_period_end === true ||
            (!!stripeSub.cancel_at && (stripeSub.status === 'active' || stripeSub.status === 'trialing'));
        const priceId = item?.price?.id as string | undefined;
        const trialStart = stripeSub.trial_start
            ? new Date(stripeSub.trial_start * 1000).toISOString()
            : undefined;
        const trialEnd = stripeSub.trial_end
            ? new Date(stripeSub.trial_end * 1000).toISOString()
            : undefined;

        const existing = await this.getByUserId(userId);
        const markTrialUsed = !!(opts?.markTrialUsed || status === 'trial') && !existing?.trial_used_at;
        // Stripe only reports 'active' once an invoice is settled. The `in`
        // check keeps this a no-op until the column is migrated.
        const markFirstPaid = status === 'active' && !!existing && 'first_paid_at' in existing && !existing.first_paid_at;

        const updated = await this.updateFromStripe(userId, {
            stripe_subscription_id: stripeSub.id,
            ...(typeof stripeSub.customer === 'string' && { stripe_customer_id: stripeSub.customer }),
            ...(priceId && { stripe_price_id: priceId }),
            status,
            cancel_at_period_end: cancelAtPeriodEnd,
            ...(rawPeriodStart && { current_period_start: new Date(rawPeriodStart * 1000).toISOString() }),
            ...(rawPeriodEnd && { current_period_end: new Date(rawPeriodEnd * 1000).toISOString() }),
            ...(trialStart && { trial_started_at: trialStart }),
            ...(trialEnd && { trial_ends_at: trialEnd }),
            ...(status === 'active' && {
                cancelled_at: null,
                billing_interval: tierFromPriceId(priceId)?.interval || undefined,
            }),
            ...(status === 'trial' && {
                cancelled_at: null,
                billing_interval: tierFromPriceId(priceId)?.interval || undefined,
            }),
            ...(markTrialUsed && { trial_used_at: new Date().toISOString() }),
            ...(markFirstPaid && { first_paid_at: new Date().toISOString() }),
        });

        if (status === 'active' || status === 'trial') {
            const fromPrice = tierFromPriceId(priceId);
            const metaTier = stripeSub.metadata?.plan_tier;
            const tier: PlanTier = fromPrice?.tier
                || (metaTier === 'pro' || metaTier === 'growth' ? metaTier : null)
                || (normaliseTier(metaTier) === 'free' ? 'growth' : normaliseTier(metaTier));
            if (tier === 'growth' || tier === 'pro') {
                await this.applyPlan(userId, tier);
            }
        }

        return (await this.getByUserId(userId)) || updated;
    }

    /**
     * If Checkout finished but the webhook never arrived (local `stripe listen`
     * off), find a live Stripe sub on this customer and apply it.
     */
    static async syncFromStripeCustomer(userId: string, stripeCustomerId: string): Promise<Subscription> {
        if (!stripe) return this.getOrCreate(userId);
        try {
            const list = await stripe.subscriptions.list({
                customer: stripeCustomerId,
                status: 'all',
                limit: 5,
            });
            const live = list.data.find(s =>
                s.status === 'trialing' || s.status === 'active' || s.status === 'past_due'
            );
            if (!live) return this.getOrCreate(userId);
            return this.applyStripeSubscription(userId, live, { markTrialUsed: true });
        } catch (e) {
            console.error(`[syncFromStripeCustomer] Failed for user ${userId}:`, (e as Error).message);
            return this.getOrCreate(userId);
        }
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
            const updated = await this.applyStripeSubscription(userId, sub);
            console.log(`[syncFromStripeDirectly] Synced subscription for user ${userId}: status=${updated.status}`);
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
            trial_started_at?: string;
            trial_ends_at?: string;
            trial_used_at?: string | null;
            first_paid_at?: string | null;
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

