import { Router, Request, Response } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionService } from '../services/subscriptionService';
import { stripe, STRIPE_CONFIG, PLAN_LIMITS } from '../utils/stripe';
import { supabase } from '../utils/supabase';

const router = Router();

/**
 * GET /api/subscription/status
 * Get current subscription status and access rights
 */
router.get('/status', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { hasAccess, reason, subscription } = await SubscriptionService.hasAccess(req.user!.id);
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            hasAccess,
            reason,
            subscription,
            remainingTrialDays
        });
    } catch (error) {
        console.error('Error fetching subscription status:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/start-trial
 * Activate the 30-day free trial
 */
router.post('/start-trial', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        // Get current subscription
        const existing = await SubscriptionService.getOrCreate(req.user!.id);

        // Prevent restarting trial or starting if already subscribed
        if (existing.status !== 'none') {
            const errorMessages: Record<string, string> = {
                'trial': 'Trial is already active',
                'active': 'You already have an active subscription',
                'past_due': 'Please update your payment method',
                'cancelled': 'Trial has already been used',
                'expired': 'Trial has already been used'
            };

            res.status(400).json({
                error: errorMessages[existing.status] || 'Cannot start trial',
                currentStatus: existing.status
            });
            return;
        }

        // Start the trial
        const subscription = await SubscriptionService.startTrial(req.user!.id);
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            success: true,
            subscription,
            remainingTrialDays,
            message: `Your 30-day free trial has started! You have full access until ${new Date(subscription.trial_ends_at!).toLocaleDateString()}.`
        });
    } catch (error) {
        console.error('Error starting trial:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/redeem-code
 * Redeem an access code for extended trial
 */
router.post('/redeem-code', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const { code } = req.body;

        if (!code || typeof code !== 'string') {
            res.status(400).json({ error: 'Access code is required' });
            return;
        }

        const result = await SubscriptionService.redeemAccessCode(req.user!.id, code);

        if (!result.success) {
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
 * GET /api/subscription/details
 * Get full subscription details (for account page)
 */
router.get('/details', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        const subscription = await SubscriptionService.getOrCreate(req.user!.id);
        const remainingTrialDays = SubscriptionService.getRemainingTrialDays(subscription);

        res.json({
            subscription,
            remainingTrialDays,
            features: getFeaturesByPlan(subscription.plan_tier, subscription.status)
        });
    } catch (error) {
        console.error('Error fetching subscription details:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * Helper: Get features available for a plan tier
 * This will be useful when you implement different pricing tiers
 */
function getFeaturesByPlan(
    planTier: string | null | undefined,
    status: string
): { name: string; included: boolean }[] {
    // During trial, all features are available
    if (status === 'trial') {
        return [
            { name: 'Unlimited initiatives', included: true },
            { name: 'Full KPI tracking', included: true },
            { name: 'Evidence management', included: true },
            { name: 'Public reports', included: true },
            { name: 'All integrations', included: true },
            { name: 'Priority support', included: true }
        ];
    }

    // Future: Different features per plan tier
    switch (planTier) {
        case 'starter':
            return [
                { name: 'Up to 3 initiatives', included: true },
                { name: 'Basic KPI tracking', included: true },
                { name: 'Evidence management', included: true },
                { name: 'Public reports', included: false },
                { name: 'All integrations', included: false },
                { name: 'Priority support', included: false }
            ];
        case 'professional':
            return [
                { name: 'Unlimited initiatives', included: true },
                { name: 'Full KPI tracking', included: true },
                { name: 'Evidence management', included: true },
                { name: 'Public reports', included: true },
                { name: 'All integrations', included: true },
                { name: 'Priority support', included: false }
            ];
        case 'enterprise':
            return [
                { name: 'Unlimited initiatives', included: true },
                { name: 'Full KPI tracking', included: true },
                { name: 'Evidence management', included: true },
                { name: 'Public reports', included: true },
                { name: 'All integrations', included: true },
                { name: 'Priority support', included: true }
            ];
        default:
            return [
                { name: 'Unlimited initiatives', included: false },
                { name: 'Full KPI tracking', included: false },
                { name: 'Evidence management', included: false },
                { name: 'Public reports', included: false },
                { name: 'All integrations', included: false },
                { name: 'Priority support', included: false }
            ];
    }
}

/**
 * POST /api/subscription/create-checkout-session
 * Create a Stripe checkout session for the starter plan
 */
router.post('/create-checkout-session', authenticateUser, async (req: AuthenticatedRequest, res) => {
    try {
        if (!stripe) {
            res.status(503).json({ error: 'Payment system not configured' });
            return;
        }
        const stripeClient = stripe;

        const userId = req.user!.id;
        const userEmail = req.user!.email;

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
                    { price: STRIPE_CONFIG.STARTER_PRICE_ID, quantity: 1 },
                ],
                mode: 'subscription',
                success_url: `${STRIPE_CONFIG.SUCCESS_URL}?checkout=success`,
                cancel_url: `${STRIPE_CONFIG.CANCEL_URL}?checkout=cancelled`,
                metadata: { user_id: userId },
                subscription_data: { metadata: { user_id: userId } },
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
                    // Get subscription details from Stripe
                    const stripeSubscription = await stripe.subscriptions.retrieve(
                        session.subscription as string
                    ) as any;
                    
                    const periodStart = stripeSubscription.current_period_start 
                        ? new Date(stripeSubscription.current_period_start * 1000).toISOString()
                        : new Date().toISOString();
                    const periodEnd = stripeSubscription.current_period_end
                        ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
                        : new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(); // 28 days from now
                    
                    await SubscriptionService.updateFromStripe(userId, {
                        stripe_subscription_id: stripeSubscription.id,
                        stripe_price_id: STRIPE_CONFIG.STARTER_PRICE_ID,
                        status: 'active',
                        plan_tier: 'starter',
                        billing_interval: 'monthly', // 4 weeks treated as monthly
                        current_period_start: periodStart,
                        current_period_end: periodEnd,
                    });

                    // Set initiative limit for starter plan
                    await supabase
                        .from('subscriptions')
                        .update({ initiatives_limit: PLAN_LIMITS.starter.initiatives_limit })
                        .eq('user_id', userId);
                        
                    console.log(`✅ Subscription activated for user ${userId}`);
                }
                break;
            }

            case 'customer.subscription.updated': {
                const subscription = event.data.object as any;
                const userId = subscription.metadata?.user_id;
                
                if (userId) {
                    const status = subscription.status === 'active' ? 'active' 
                        : subscription.status === 'past_due' ? 'past_due'
                        : subscription.status === 'canceled' ? 'cancelled'
                        : 'active';

                    const periodStart = subscription.current_period_start 
                        ? new Date(subscription.current_period_start * 1000).toISOString()
                        : undefined;
                    const periodEnd = subscription.current_period_end
                        ? new Date(subscription.current_period_end * 1000).toISOString()
                        : undefined;

                    await SubscriptionService.updateFromStripe(userId, {
                        status,
                        ...(periodStart && { current_period_start: periodStart }),
                        ...(periodEnd && { current_period_end: periodEnd }),
                        cancel_at_period_end: subscription.cancel_at_period_end,
                    });
                    
                    console.log(`✅ Subscription updated for user ${userId}: ${status}`);
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object as any;
                const userId = subscription.metadata?.user_id;
                
                if (userId) {
                    await SubscriptionService.updateFromStripe(userId, {
                        status: 'cancelled',
                        cancelled_at: new Date().toISOString(),
                    });
                    
                    console.log(`✅ Subscription cancelled for user ${userId}`);
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
        const usage = await SubscriptionService.getInitiativesUsage(userId);
        res.json(usage);
    } catch (error) {
        console.error('Error getting initiatives usage:', error);
        res.status(500).json({ error: (error as Error).message });
    }
});

/**
 * POST /api/subscription/create-portal-session
 * Create Stripe customer portal session for managing subscription
 */
router.post('/create-portal-session', authenticateUser, async (req: AuthenticatedRequest, res) => {
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

