import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? undefined : '../.env' });

const isProduction = process.env.NODE_ENV === 'production';
const stripeSecretKey = isProduction
    ? process.env.STRIPE_SECRET_KEY_LIVE
    : process.env.STRIPE_SECRET_KEY;

const isTestMode = stripeSecretKey?.startsWith('sk_test_');
const isLiveMode = stripeSecretKey?.startsWith('sk_live_');

if (!stripeSecretKey) {
    console.warn('⚠️ Stripe secret key not set - Stripe features will be disabled');
} else if (isTestMode) {
    console.log('💳 Stripe initialized in TEST mode');
} else if (isLiveMode) {
    console.log('💳 Stripe initialized in LIVE mode');
}

export const stripe = stripeSecretKey
    ? new Stripe(stripeSecretKey)
    : null;

// Pick the live or test price id from env based on environment.
const envPrice = (liveKey: string, testKey: string) =>
    (isProduction ? process.env[liveKey] : process.env[testKey]) || '';

export const STRIPE_CONFIG = {
    // Legacy single starter price — kept so grandfathered starter subscriptions
    // and existing offer links keep resolving. New self-serve checkout uses the
    // tier prices below.
    STARTER_PRICE_ID: isProduction
        ? (process.env.STRIPE_STARTER_PRICE_ID_LIVE || '')
        : (process.env.STRIPE_STARTER_PRICE_ID || 'price_1SnPx6EWWQnPyocG2Ke92Kho'),

    // New self-serve tier prices (monthly + annual; annual = 2 months free).
    GROWTH_MONTHLY_PRICE_ID: envPrice('STRIPE_GROWTH_MONTHLY_PRICE_ID_LIVE', 'STRIPE_GROWTH_MONTHLY_PRICE_ID'),
    GROWTH_ANNUAL_PRICE_ID: envPrice('STRIPE_GROWTH_ANNUAL_PRICE_ID_LIVE', 'STRIPE_GROWTH_ANNUAL_PRICE_ID'),
    PRO_MONTHLY_PRICE_ID: envPrice('STRIPE_PRO_MONTHLY_PRICE_ID_LIVE', 'STRIPE_PRO_MONTHLY_PRICE_ID'),
    PRO_ANNUAL_PRICE_ID: envPrice('STRIPE_PRO_ANNUAL_PRICE_ID_LIVE', 'STRIPE_PRO_ANNUAL_PRICE_ID'),

    WEBHOOK_SECRET: isProduction
        ? (process.env.STRIPE_WEBHOOK_SECRET_LIVE || '')
        : (process.env.STRIPE_WEBHOOK_SECRET || ''),
    SUCCESS_URL: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
    CANCEL_URL: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
    IS_TEST_MODE: isTestMode,
    IS_LIVE_MODE: isLiveMode,
};

export type BillingInterval = 'monthly' | 'annual';

/** Resolve the Stripe price id for a tier + interval (self-serve checkout). */
export function priceIdForTier(
    tier: 'growth' | 'pro',
    interval: BillingInterval
): string {
    if (tier === 'growth') {
        return interval === 'annual' ? STRIPE_CONFIG.GROWTH_ANNUAL_PRICE_ID : STRIPE_CONFIG.GROWTH_MONTHLY_PRICE_ID;
    }
    return interval === 'annual' ? STRIPE_CONFIG.PRO_ANNUAL_PRICE_ID : STRIPE_CONFIG.PRO_MONTHLY_PRICE_ID;
}

/**
 * Reverse map: given a Stripe price id, what tier + interval does it represent?
 * Used by the webhook so limits are always re-derived from the price (self-healing
 * across upgrades/downgrades/portal changes) rather than trusted from metadata.
 * Returns null for unknown prices (e.g. bespoke offer prices) so the caller can
 * fall back to metadata.
 */
export function tierFromPriceId(
    priceId: string | null | undefined
): { tier: 'growth' | 'pro'; interval: BillingInterval } | null {
    if (!priceId) return null;
    switch (priceId) {
        case STRIPE_CONFIG.GROWTH_MONTHLY_PRICE_ID: return { tier: 'growth', interval: 'monthly' };
        case STRIPE_CONFIG.GROWTH_ANNUAL_PRICE_ID: return { tier: 'growth', interval: 'annual' };
        case STRIPE_CONFIG.PRO_MONTHLY_PRICE_ID: return { tier: 'pro', interval: 'monthly' };
        case STRIPE_CONFIG.PRO_ANNUAL_PRICE_ID: return { tier: 'pro', interval: 'annual' };
        default: return null;
    }
}

