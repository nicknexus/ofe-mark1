import { Router, Request, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionService, Subscription } from '../services/subscriptionService';
import { stripe, STRIPE_CONFIG, priceIdForTier, tierFromPriceId, BillingInterval } from '../utils/stripe';
import { normaliseTier, getPlan, PlanTier, TRIAL_DURATION_DAYS } from '../config/planCatalog';
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
        trial_used_at: sub.trial_used_at,
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
        //
        // Local/dev often has no `stripe listen`. After Checkout we already
        // stored stripe_customer_id, so pull the new sub from Stripe if the
        // webhook never arrived.
        if (sub.status !== 'free' && sub.stripe_subscription_id) {
            await syncSubscriptionFromStripe(req.user!.id, sub.stripe_subscription_id);
        } else if (sub.stripe_customer_id && (sub.status === 'none' || sub.status === 'expired' || sub.status === 'cancelled')) {
            await SubscriptionService.syncFromStripeCustomer(req.user!.id, sub.stripe_customer_id);
        }
        const { hasAccess, reason, subscription, isSupportMode } =
            await SubscriptionService.getAccessForContext(req.user!.id, requestedOrgId);
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            hasAccess,
            reason,
            subscription: toClientSubscription(subscription),
            remainingTrialDays,
            trialDurationDays: TRIAL_DURATION_DAYS,
            isSupportMode,
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
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
        await SubscriptionService.applyStripeSubscription(userId, sub);
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
        { name: 'Impact content studio', included: plan.features.contentStudio },
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

        const liveStripe =
            !!subscription.stripe_subscription_id &&
            (subscription.status === 'trial' || subscription.status === 'active' || subscription.status === 'past_due');
        if (liveStripe) {
            res.status(409).json({
                error: 'You already have an active subscription. Manage it from Billing.',
                usePortal: true,
            });
            return;
        }

        const grantTrial = !subscription.trial_used_at;

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
                payment_method_collection: 'always',
                // Shows the "Add promotion code" field on the Stripe-hosted
                // checkout page. Codes themselves are created in the Stripe
                // dashboard (coupon → promotion code); nothing to configure here.
                // Cannot be combined with a `discounts` param — we don't pass one.
                allow_promotion_codes: true,
                success_url: `${STRIPE_CONFIG.SUCCESS_URL}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${STRIPE_CONFIG.CANCEL_URL}?checkout=cancelled`,
                metadata: { user_id: userId, plan_tier: planTier },
                subscription_data: {
                    metadata: { user_id: userId, plan_tier: planTier },
                    ...(grantTrial ? {
                        trial_period_days: TRIAL_DURATION_DAYS,
                        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
                    } : {}),
                },
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
 * POST /api/subscription/confirm-checkout
 * After Stripe redirects back, write the session onto our row so the app
 * gate does not wait on a delayed webhook.
 */
router.post('/confirm-checkout', authenticateUser, blockInSupportMode, async (req: AuthenticatedRequest, res) => {
    try {
        if (!stripe) {
            res.status(503).json({ error: 'Payment system not configured' });
            return;
        }
        const sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId : '';
        if (!sessionId.startsWith('cs_')) {
            res.status(400).json({ error: 'A checkout session id is required' });
            return;
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.metadata?.user_id && session.metadata.user_id !== req.user!.id) {
            res.status(403).json({ error: 'This checkout session belongs to another account' });
            return;
        }
        if (session.status !== 'complete' || !session.subscription) {
            res.json({ success: false, pending: true });
            return;
        }

        let stripeSub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
        stripeSub = await SubscriptionService.enforceOneTrialPerCard(req.user!.id, stripeSub);
        const subscription = await SubscriptionService.applyStripeSubscription(req.user!.id, stripeSub, {
            markTrialUsed: true,
        });
        res.json({
            success: true,
            subscription: toClientSubscription(subscription),
            remainingTrialDays: SubscriptionService.getRemainingTrialDays(subscription),
            hasAccess: SubscriptionService.evaluate(subscription),
        });
    } catch (error) {
        console.error('Error confirming checkout:', error);
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
                    let stripeSubscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    ) as any;
                    stripeSubscription = await SubscriptionService.enforceOneTrialPerCard(userId, stripeSubscription);
                    const applied = await SubscriptionService.applyStripeSubscription(userId, stripeSubscription, {
                        markTrialUsed: true,
                    });
                    console.log(`✅ Subscription activated for user ${userId} (status=${applied.status}, tier=${applied.plan_tier})`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                let userId = subscription.metadata?.user_id;
                if (!userId) {
                    userId = await SubscriptionService.getUserIdByStripeSubscriptionId(subscription.id) ?? undefined;
                }

                console.log('[webhook] customer.subscription.updated', {
                    subscriptionId: subscription.id,
                    status: subscription.status,
                    cancel_at_period_end: subscription.cancel_at_period_end,
                    cancel_at: subscription.cancel_at,
                    hasUserId: !!userId,
                    metadata: subscription.metadata,
                });
                if (userId) {
                    const applied = await SubscriptionService.applyStripeSubscription(userId, subscription);
                    console.log(`✅ Subscription updated for user ${userId}: ${applied.status}, cancel_at_period_end=${applied.cancel_at_period_end}`);
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
                    const applied = await SubscriptionService.handleStripeCancellation(userId, subscription);
                    console.log(`✅ Subscription deleted for user ${userId} (status=${applied.status}, access until ${applied.current_period_end ?? 'now'})`);
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

