import { Router, Request, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionService, Subscription } from '../services/subscriptionService';
import { stripe, STRIPE_CONFIG, priceIdForTier, tierFromPriceId, BillingInterval } from '../utils/stripe';
import { normaliseTier, getPlan, PlanTier } from '../config/planCatalog';
import { EntitlementService } from '../services/entitlementService';
import { supabase } from '../utils/supabase';
import { blockInSupportMode } from '../middleware/supportMode';

const router = Router();

/**
 * Resolve the plan tier a Stripe subscription represents, always re-deriving
 * from the price id first (self-healing across upgrades/downgrades/portal
 * changes), then falling back to metadata, then Growth as a safe default for a
 * paid subscription.
 */
function resolvePaidTier(priceId: string | undefined, metadataPlanTier: string | undefined): PlanTier {
    const fromPrice = tierFromPriceId(priceId);
    if (fromPrice) return fromPrice.tier;
    if (metadataPlanTier) return normaliseTier(metadataPlanTier);
    return 'growth';
}

/**
 * Explicit whitelist of the subscription fields the customer app is allowed to
 * see. A whitelist (not a blacklist) so any column added to `subscriptions`
 * later — internal notes, support flags, comp reasons — cannot reach a browser
 * by being forgotten. Add a field here only after checking it's safe for the
 * account holder AND for a support admin viewing someone else's account.
 */
function toClientSubscription(sub: Subscription | null | undefined) {
    if (!sub) return sub;
    return {
        id: sub.id,
        user_id: sub.user_id,
        organization_id: sub.organization_id,
        status: sub.status,
        plan_tier: sub.plan_tier,
        billing_interval: sub.billing_interval,
        trial_started_at: sub.trial_started_at,
        trial_ends_at: sub.trial_ends_at,
        stripe_customer_id: sub.stripe_customer_id,
        stripe_subscription_id: sub.stripe_subscription_id,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        initiatives_limit: sub.initiatives_limit,
        team_members_limit: sub.team_members_limit,
        locations_limit: sub.locations_limit,
        storage_limit_bytes: sub.storage_limit_bytes,
        ai_reports_per_day: sub.ai_reports_per_day,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
    };
}

/**
 * GET /api/subscription/status
 * Get current subscription status and access rights.
 *
 * In support mode this describes the CUSTOMER's plan, not the admin's — see
 * SubscriptionService.getAccessForContext.
 */
router.get('/status', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const sub = await SubscriptionService.getOrCreate(req.user!.id);
        // Only ever self-heal the caller's OWN Stripe record. An admin viewing a
        // customer must not trigger writes to that customer's billing row.
        if (sub.stripe_subscription_id) {
            await syncSubscriptionFromStripe(req.user!.id, sub.stripe_subscription_id);
        }
        const { hasAccess, reason, subscription, isSupportMode } =
            await SubscriptionService.getAccessForContext(req.user!.id, requestedOrgId);
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            hasAccess,
            reason,
            subscription: toClientSubscription(subscription),
            remainingTrialDays,
            isSupportMode,
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/activate-free
 * (alias: POST /api/subscription/start-trial — kept for the existing frontend)
 * Activate the always-free plan. No card, no expiry. Only valid from status
 * 'none'; if already on any plan we just return the current subscription.
 */
const activateFreeHandler = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const existing = await SubscriptionService.getOrCreate(req.user!.id);

        // Already on a plan (free/active/etc.) — idempotent no-op.
        if (existing.status !== 'none') {
            res.json({
                success: true,
                subscription: existing,
                remainingTrialDays: null,
                message: 'Your plan is already active.'
            });
            return;
        }

        const subscription = await SubscriptionService.activateFree(req.user!.id);
        res.json({
            success: true,
            subscription,
            remainingTrialDays: null,
            message: 'Your free plan is active. Welcome aboard!'
        });
    } catch (error) {
        console.error('Error activating free plan:', error);
        res.status(500).json({ error: (error as Error).message });
    }
};

router.post('/activate-free', authenticateUser, blockInSupportMode, activateFreeHandler);
router.post('/start-trial', authenticateUser, blockInSupportMode, activateFreeHandler);

/**
 * POST /api/subscription/redeem-code
 * Redeem an access code for extended trial
 */
router.post('/redeem-code', authenticateUser, blockInSupportMode, async (req: AuthenticatedRequest, res) => {
    try {
        const { code } = req.body;
        console.log('[redeem-code] body:', JSON.stringify(req.body), 'code:', code);

        if (!code || typeof code !== 'string') {
            console.log('[redeem-code] 400: Access code is required');
            res.status(400).json({ error: 'Access code is required' });
            return;
        }

        const result = await SubscriptionService.redeemAccessCode(req.user!.id, code);

        if (!result.success) {
            console.log('[redeem-code] 400:', result.error);
            res.status(400).json({ error: result.error });
            return;
        }

        const remainingTrialDays = result.subscription
            ? SubscriptionService.getRemainingTrialDays(result.subscription)
            : result.daysGranted;

        res.json({
            success: true,
            subscription: result.subscription,
            remainingTrialDays,
            daysGranted: result.daysGranted,
            message: `Access code redeemed! You have ${result.daysGranted} days of full access.`
        });
    } catch (error) {
        console.error('Error redeeming access code:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * Sync subscription row from Stripe (cancel_at_period_end, status, period end, cancelled_at).
 * Call when loading subscription so DB matches Stripe even if webhooks were missed.
 */
async function syncSubscriptionFromStripe(userId: string, stripeSubscriptionId: string): Promise<void> {
    if (!stripe) return;
    try {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId) as any;
        const status = sub.status === 'active' ? 'active'
            : sub.status === 'past_due' ? 'past_due'
                : sub.status === 'canceled' || sub.status === 'unpaid' ? 'cancelled'
                    : 'active';
        const cancelAtPeriodEnd =
            sub.cancel_at_period_end === true ||
            (!!sub.cancel_at && sub.status === 'active');
        const item = sub.items?.data?.[0];
        const rawPeriodStart = sub.current_period_start ?? item?.current_period_start;
        const rawPeriodEnd = sub.current_period_end ?? item?.current_period_end ?? sub.cancel_at;
        await SubscriptionService.updateFromStripe(userId, {
            status,
            cancel_at_period_end: cancelAtPeriodEnd,
            ...(rawPeriodStart && { current_period_start: new Date(rawPeriodStart * 1000).toISOString() }),
            ...(rawPeriodEnd && { current_period_end: new Date(rawPeriodEnd * 1000).toISOString() }),
            ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() }),
            ...(status === 'active' && { cancelled_at: null }),
        });
    } catch (e) {
        console.error('Sync from Stripe failed:', (e as Error).message);
    }
}

/**
 * GET /api/subscription/details
 * Get full subscription details (for account page)
 */
router.get('/details', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const { subscription: contextSub, isSupportMode } =
            await SubscriptionService.getAccessForContext(req.user!.id, requestedOrgId);

        // Support mode: report the customer's plan and never write to their row.
        let subscription = contextSub;
        if (!isSupportMode) {
            subscription = await SubscriptionService.getOrCreate(req.user!.id);
            if (subscription.stripe_subscription_id) {
                await syncSubscriptionFromStripe(req.user!.id, subscription.stripe_subscription_id);
                subscription = (await SubscriptionService.getByUserId(req.user!.id)) ?? subscription;
            }
        }
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            subscription: toClientSubscription(subscription),
            remainingTrialDays,
            features: getFeaturesByPlan(subscription.plan_tier, subscription.status),
            isSupportMode,
        });
    } catch (error) {
        console.error('Error fetching subscription details:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * Helper: Get features available for a plan tier, derived from the catalog.
 * Limits shown as human-readable lines; Free omits tags + beneficiary groups.
 */
function getFeaturesByPlan(
    planTier: string | null | undefined,
    _status: string
): { name: string; included: boolean }[] {
    const plan = getPlan(planTier);
    const fmtLimit = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `Up to ${n} ${unit}`);
    const gb = (bytes: number | null) => (bytes === null ? 'Unlimited storage' : `${Math.round(bytes / (1024 ** 3))} GB storage`);
    return [
        { name: fmtLimit(plan.initiatives_limit, 'programs'), included: true },
        { name: fmtLimit(plan.team_members_limit, 'team members'), included: true },
        { name: fmtLimit(plan.locations_limit, 'locations'), included: true },
        { name: gb(plan.storage_limit_bytes), included: true },
        { name: plan.ai_reports_per_day === null ? 'Unlimited AI reports' : `${plan.ai_reports_per_day} AI report/day`, included: true },
        { name: 'Metric tags / themes', included: plan.features.tags },
        { name: 'Beneficiary groups', included: plan.features.beneficiaryGroups },
    ];
}

/**
 * POST /api/subscription/create-checkout-session
 * Create a Stripe checkout session for the starter plan
 */
router.post('/create-checkout-session', authenticateUser, blockInSupportMode, async (req: AuthenticatedRequest, res) => {
    try {
        if (!stripe) {
            res.status(503).json({ error: 'Payment system not configured' });
            return;
        }
        const stripeClient = stripe;

        const userId = req.user!.id;
        const userEmail = req.user!.email;
        // Self-serve: pass { tier: 'growth'|'pro', interval: 'monthly'|'annual' }.
        // Legacy/offer links may still pass an explicit { priceId }.
        const { priceId, tier, interval } = req.body || {};

        let finalPriceId: string;
        let planTier: PlanTier;
        if (tier === 'growth' || tier === 'pro') {
            const billingInterval: BillingInterval = interval === 'annual' ? 'annual' : 'monthly';
            finalPriceId = priceIdForTier(tier, billingInterval);
            planTier = tier;
            if (!finalPriceId) {
                res.status(400).json({ error: `No Stripe price configured for ${tier} (${billingInterval})` });
                return;
            }
        } else {
            finalPriceId = priceId || STRIPE_CONFIG.STARTER_PRICE_ID;
            // Derive the tier from the price where possible (grandfathered/offer prices fall back to growth).
            planTier = resolvePaidTier(finalPriceId, undefined);
        }

        // Get or create subscription to get/create stripe customer
        let subscription = await SubscriptionService.getOrCreate(userId);

        let customerId = subscription.stripe_customer_id;

        // Create Stripe customer if doesn't exist
        if (!customerId) {
            const customer = await stripeClient.customers.create({
                email: userEmail,
                metadata: {
                    user_id: userId,
                }
            });
            customerId = customer.id;
            await supabase
                .from('subscriptions')
                .update({ stripe_customer_id: customerId })
                .eq('user_id', userId);
        }

        const createSession = () =>
            stripeClient.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                billing_address_collection: 'required',
                automatic_tax: { enabled: true },
                customer_update: { address: 'auto' },
                line_items: [
                    { price: finalPriceId, quantity: 1 },
                ],
                mode: 'subscription',
                // Shows the "Add promotion code" field on the Stripe-hosted
                // checkout page. Codes themselves are created in the Stripe
                // dashboard (coupon → promotion code); nothing to configure here.
                // Cannot be combined with a `discounts` param — we don't pass one.
                allow_promotion_codes: true,
                success_url: `${STRIPE_CONFIG.SUCCESS_URL}?checkout=success`,
                cancel_url: `${STRIPE_CONFIG.CANCEL_URL}?checkout=cancelled`,
                metadata: { user_id: userId, plan_tier: planTier },
                subscription_data: { metadata: { user_id: userId, plan_tier: planTier } },
            });

        let session;
        try {
            session = await createSession();
        } catch (err: unknown) {
            const stripeErr = err as { code?: string; param?: string };
            // Stale customer ID (e.g. live id in test mode, or deleted in Stripe)
            if (stripeErr.code === 'resource_missing' && stripeErr.param === 'customer') {
                const customer = await stripeClient.customers.create({
                    email: userEmail,
                    metadata: { user_id: userId },
                });
                customerId = customer.id;
                await supabase
                    .from('subscriptions')
                    .update({ stripe_customer_id: customerId })
                    .eq('user_id', userId);
                session = await createSession();
            } else {
                throw err;
            }
        }

        res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
        console.error('Error creating checkout session:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/webhook
 * Handle Stripe webhook events
 * Note: This needs raw body - handled specially in index.ts
 */
router.post('/webhook', async (req: Request, res: Response) => {
    if (!stripe) {
        res.status(503).json({ error: 'Payment system not configured' });
        return;
    }

    const sig = req.headers['stripe-signature'] as string;

    let event;

    try {
        // req.body should be raw buffer for webhook verification
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            STRIPE_CONFIG.WEBHOOK_SECRET
        );
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        res.status(400).send(`Webhook Error: ${(err as Error).message}`);
        return;
    }

    // Handle the event
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as any;
                const userId = session.metadata?.user_id;

                if (userId && session.subscription) {
                    const stripeSubscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    ) as any;

                    const item = stripeSubscription.items?.data?.[0];
                    const rawPeriodStart = stripeSubscription.current_period_start ?? item?.current_period_start;
                    const rawPeriodEnd = stripeSubscription.current_period_end ?? item?.current_period_end;
                    const periodStart = rawPeriodStart
                        ? new Date(rawPeriodStart * 1000).toISOString()
                        : new Date().toISOString();
                    const periodEnd = rawPeriodEnd
                        ? new Date(rawPeriodEnd * 1000).toISOString()
                        : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();

                    const actualPriceId = stripeSubscription.items?.data?.[0]?.price?.id || STRIPE_CONFIG.STARTER_PRICE_ID;
                    const planTier = resolvePaidTier(actualPriceId, session.metadata?.plan_tier);
                    const billingInterval = tierFromPriceId(actualPriceId)?.interval || 'monthly';

                    await SubscriptionService.updateFromStripe(userId, {
                        stripe_subscription_id: stripeSubscription.id,
                        stripe_price_id: actualPriceId,
                        status: 'active',
                        billing_interval: billingInterval,
                        current_period_start: periodStart,
                        current_period_end: periodEnd,
                    });

                    // Apply the full limit set + plan_tier from the catalog.
                    await SubscriptionService.applyPlan(userId, planTier);

                    console.log(`✅ Subscription activated for user ${userId} (${planTier}, ${billingInterval})`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                let userId = subscription.metadata?.user_id;
                if (!userId) {
                    userId = await SubscriptionService.getUserIdByStripeSubscriptionId(subscription.id) ?? undefined;
                }

                // Period dates moved to subscription item level in newer Stripe API versions
                const item = subscription.items?.data?.[0];
                const rawPeriodStart = subscription.current_period_start ?? item?.current_period_start;
                const rawPeriodEnd = subscription.current_period_end ?? item?.current_period_end ?? subscription.cancel_at;

                console.log('[webhook] customer.subscription.updated', {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    hasUserId: !!userId,
                    metadata: subscription.metadata,
                    rawPeriodStart,
                    rawPeriodEnd,
                });
                if (userId) {
                    const status = subscription.status === 'active' ? 'active'
                        : subscription.status === 'past_due' ? 'past_due'
                            : subscription.status === 'canceled' ? 'cancelled'
                                : 'active';

                    const periodStart = rawPeriodStart
                        ? new Date(rawPeriodStart * 1000).toISOString()
                        : undefined;
                    const periodEnd = rawPeriodEnd
                        ? new Date(rawPeriodEnd * 1000).toISOString()
                        : undefined;

                    const cancelAtPeriodEnd =
                        subscription.cancel_at_period_end === true ||
                        (!!subscription.cancel_at && subscription.status === 'active');

                    const updatedPriceId = item?.price?.id as string | undefined;

                    await SubscriptionService.updateFromStripe(userId, {
                        status,
                        ...(updatedPriceId && { stripe_price_id: updatedPriceId }),
                        ...(periodStart && { current_period_start: periodStart }),
                        ...(periodEnd && { current_period_end: periodEnd }),
                        ...(status === 'active' && { billing_interval: tierFromPriceId(updatedPriceId)?.interval || undefined }),
                        cancel_at_period_end: cancelAtPeriodEnd,
                        ...(status === 'cancelled' && { cancelled_at: new Date().toISOString() }),
                        ...(status === 'active' && { cancelled_at: null }),
                    });

                    // Re-apply limits from the (possibly changed) price so plan
                    // switches via the Stripe portal self-heal. On cancellation,
                    // drop to Free and hide overflow public initiatives.
                    if (status === 'active') {
                        const tier = resolvePaidTier(updatedPriceId, subscription.metadata?.plan_tier);
                        await SubscriptionService.applyPlan(userId, tier);
                        console.log(`✅ Subscription updated for user ${userId}: active (${tier}), periodEnd=${periodEnd}`);
                    } else if (status === 'cancelled') {
                        await SubscriptionService.downgradeToFree(userId);
                        console.log(`✅ Subscription cancelled for user ${userId} → downgraded to Free`);
                    } else {
                        console.log(`✅ Subscription updated for user ${userId}: ${status}, cancel_at_period_end=${cancelAtPeriodEnd}`);
                    }
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                let userId = subscription.metadata?.user_id;
                if (!userId) {
                    userId = await SubscriptionService.getUserIdByStripeSubscriptionId(subscription.id) ?? undefined;
                }
                if (userId) {
                    // Paid subscription ended → downgrade to Free (keep access) and
                    // hide overflow public initiatives instead of locking the user out.
                    await SubscriptionService.downgradeToFree(userId);
                    console.log(`✅ Subscription deleted for user ${userId} → downgraded to Free`);
                } else {
                    console.warn('[webhook] customer.subscription.deleted: no user_id (metadata or stripe_subscription_id lookup)', subscription.id);
                }
                break;
            }

            case 'invoice.payment_failed': {
                const invoice = event.data.object as any;
                const subscriptionId = invoice.subscription as string;

                if (subscriptionId) {
                    const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId) as any;
                    const userId = stripeSubscription.metadata?.user_id;

                    if (userId) {
                        await SubscriptionService.updateFromStripe(userId, {
                            status: 'past_due',
                        });

                        console.log(`⚠️ Payment failed for user ${userId}`);
                    }
                }
                break;
            }

            default:
                console.log(`Unhandled event type: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Error handling webhook:', error);
        res.status(500).json({ error: 'Webhook handler failed' });
    }
});

/**
 * GET /api/subscription/initiatives-usage
 * Get current initiatives count vs limit
 */
router.get('/initiatives-usage', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const userId = req.user!.id;
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const usage = await SubscriptionService.getInitiativesUsage(userId, requestedOrgId);
        res.json(usage);
    } catch (error) {
        console.error('Error getting programs usage:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/subscription/locations-usage
 * Get current locations count vs limit
 */
router.get('/locations-usage', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const usage = await SubscriptionService.getLocationsUsage(req.user!.id, requestedOrgId);
        res.json(usage);
    } catch (error) {
        console.error('Error getting locations usage:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * GET /api/subscription/features
 * Feature access for the active org (tier + which features are unlocked).
 * Frontend uses this to lock the tags / beneficiary-group UI on Free.
 */
router.get('/features', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const requestedOrgId = req.headers['x-organization-id'] as string | undefined;
        const features = await SubscriptionService.getFeatureAccess(req.user!.id, requestedOrgId);
        res.json(features);
    } catch (error) {
        console.error('Error getting feature access:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/create-portal-session
 * Create Stripe customer portal session for managing subscription
 */
router.post('/create-portal-session', authenticateUser, blockInSupportMode, async (req: AuthenticatedRequest, res) => {
    try {
        if (!stripe) {
            res.status(503).json({ error: 'Payment system not configured' });
            return;
        }

        const subscription = await SubscriptionService.getOrCreate(req.user!.id);

        if (!subscription.stripe_customer_id) {
            res.status(400).json({ error: 'No billing account found' });
            return;
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: subscription.stripe_customer_id,
            return_url: STRIPE_CONFIG.SUCCESS_URL,
        });

        res.json({ url: session.url });
    } catch (error) {
        console.error('Error creating portal session:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

export default router;

