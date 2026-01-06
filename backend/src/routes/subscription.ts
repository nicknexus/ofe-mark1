import { Router } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionService } from '../services/subscriptionService';

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

export default router;

