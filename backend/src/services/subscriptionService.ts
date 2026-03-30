import { supabase } from '../utils/supabase';
import { TeamService } from './teamService';
import { PLAN_LIMITS, stripe } from '../utils/stripe';

export interface Subscription {
    id: string;
    user_id: string;
    organization_id?: string;
    status: 'none' | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired';
    plan_tier?: 'starter' | 'professional' | 'enterprise' | null;
    billing_interval?: 'monthly' | 'yearly' | 'lifetime' | null;
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
     * Start free trial - sets status to 'trial' and calculates end date
     */
    static async startTrial(userId: string): Promise<Subscription> {
        const now = new Date();
        const trialEnd = new Date(now.getTime() + TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
            .from('subscriptions')
            .update({
                status: 'trial',
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString(),
                initiatives_limit: PLAN_LIMITS.trial.initiatives_limit
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to start trial: ${error.message}`);
        }

        return data;
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
            case 'trial':
                if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()) {
                    return { hasAccess: true, reason: 'trial_active', subscription };
                }
                // Trial expired - update status
                const expiredSub = await this.updateStatus(userId, 'expired');
                // Don't return yet - check inherited access
                break;

            case 'active':
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
                // Could implement grace period here - but check inherited access first
                break;

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
     * Check if user has inherited access via team membership
     */
    static async checkInheritedAccess(userId: string): Promise<{ hasAccess: boolean; organizationId?: string }> {
        // Check if user is a team member
        const membership = await TeamService.getUserTeamMembership(userId);
        if (!membership) {
            return { hasAccess: false };
        }

        // Get organization owner's user ID
        const ownerId = await TeamService.getOrganizationOwnerId(membership.organization_id);
        if (!ownerId) {
            return { hasAccess: false };
        }

        // Check owner's subscription
        const ownerSubscription = await this.getByUserId(ownerId);
        if (!ownerSubscription) {
            return { hasAccess: false };
        }

        // Check if owner has active access
        switch (ownerSubscription.status) {
            case 'trial':
                if (ownerSubscription.trial_ends_at && new Date(ownerSubscription.trial_ends_at) > new Date()) {
                    return { hasAccess: true, organizationId: membership.organization_id };
                }
                return { hasAccess: false };

            case 'active':
                if (ownerSubscription.current_period_end && new Date(ownerSubscription.current_period_end) > new Date()) {
                    return { hasAccess: true, organizationId: membership.organization_id };
                }
                // Period might be ongoing (handled by webhooks)
                return { hasAccess: true, organizationId: membership.organization_id };

            case 'cancelled':
                // Still active until period end
                if (ownerSubscription.current_period_end && new Date(ownerSubscription.current_period_end) > new Date()) {
                    return { hasAccess: true, organizationId: membership.organization_id };
                }
                return { hasAccess: false };

            default:
                return { hasAccess: false };
        }
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
                initiatives_limit: PLAN_LIMITS.trial.initiatives_limit
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
     * Get initiatives usage (current count vs limit)
     */
    static async getInitiativesUsage(userId: string): Promise<{
        current: number;
        limit: number | null;
        canCreate: boolean;
    }> {
        // Get subscription to check limit
        const subscription = await this.getOrCreate(userId);

        // Get current initiatives count for this user's organization
        const { count, error } = await supabase
            .from('initiatives')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        if (error) {
            throw new Error(`Failed to count initiatives: ${error.message}`);
        }

        const currentCount = count || 0;
        const limit = subscription.initiatives_limit ?? null;

        // Can create if no limit (null/undefined = unlimited) or under limit
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

