import { supabase } from '../utils/supabase';

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
    created_at: string;
    updated_at: string;
}

export interface SubscriptionAccessResult {
    hasAccess: boolean;
    reason: string;
    subscription: Subscription;
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

        // Create new subscription record with status 'none'
        const { data: newSubscription, error: createError } = await supabase
            .from('subscriptions')
            .insert([{
                user_id: userId,
                organization_id: organizationId || null,
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
                trial_ends_at: trialEnd.toISOString()
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
     */
    static async hasAccess(userId: string): Promise<SubscriptionAccessResult> {
        const subscription = await this.getOrCreate(userId);

        switch (subscription.status) {
            case 'trial':
                if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()) {
                    return { hasAccess: true, reason: 'trial_active', subscription };
                }
                // Trial expired - update status
                const expiredSub = await this.updateStatus(userId, 'expired');
                return { hasAccess: false, reason: 'trial_expired', subscription: expiredSub };

            case 'active':
                // Check if still in paid period
                if (subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                    return { hasAccess: true, reason: 'subscription_active', subscription };
                }
                // Period ended - for Stripe this would be handled by webhooks
                return { hasAccess: true, reason: 'subscription_active', subscription };

            case 'past_due':
                // Could implement grace period here
                return { hasAccess: false, reason: 'payment_past_due', subscription };

            case 'cancelled':
                // Check if still in paid period (user cancelled but period hasn't ended)
                if (subscription.current_period_end && new Date(subscription.current_period_end) > new Date()) {
                    return { hasAccess: true, reason: 'subscription_active_until_period_end', subscription };
                }
                return { hasAccess: false, reason: 'subscription_cancelled', subscription };

            case 'none':
                return { hasAccess: false, reason: 'no_subscription', subscription };

            case 'expired':
            default:
                return { hasAccess: false, reason: 'expired', subscription };
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

    /**
     * Validate and redeem an access code
     */
    static async redeemAccessCode(userId: string, code: string): Promise<{ success: boolean; subscription?: Subscription; error?: string; daysGranted?: number }> {
        // Check if user already redeemed a code
        const { data: existingRedemption } = await supabase
            .from('access_code_redemptions')
            .select('id')
            .eq('user_id', userId)
            .maybeSingle();

        if (existingRedemption) {
            return { success: false, error: 'You have already redeemed an access code' };
        }

        // Find the access code
        const { data: accessCode, error: codeError } = await supabase
            .from('access_codes')
            .select('*')
            .eq('code', code.toUpperCase().trim())
            .eq('is_active', true)
            .maybeSingle();

        if (codeError || !accessCode) {
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

        // Update subscription
        const { data: subscription, error: subError } = await supabase
            .from('subscriptions')
            .update({
                status: 'trial',
                trial_started_at: now.toISOString(),
                trial_ends_at: trialEnd.toISOString()
            })
            .eq('user_id', userId)
            .select()
            .single();

        if (subError) {
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
     * Future: Update subscription from Stripe webhook data
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
            cancelled_at?: string;
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

