import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config({ path: process.env.NODE_ENV === 'production' ? undefined : '../.env' });

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

// Detect if we're using test or live keys
const isTestMode = stripeSecretKey?.startsWith('sk_test_');
const isLiveMode = stripeSecretKey?.startsWith('sk_live_');

if (!stripeSecretKey) {
    console.warn('⚠️ STRIPE_SECRET_KEY not set - Stripe features will be disabled');
} else if (isTestMode) {
    console.log('💳 Stripe initialized in TEST mode');
} else if (isLiveMode) {
    console.log('💳 Stripe initialized in LIVE mode');
}

export const stripe = stripeSecretKey 
    ? new Stripe(stripeSecretKey)
    : null;

// Use different price IDs for test vs live mode
// Set STRIPE_STARTER_PRICE_ID_LIVE in production env for live price
export const STRIPE_CONFIG = {
    STARTER_PRICE_ID: isLiveMode 
        ? (process.env.STRIPE_STARTER_PRICE_ID_LIVE || process.env.STRIPE_STARTER_PRICE_ID || '')
        : (process.env.STRIPE_STARTER_PRICE_ID || 'price_1SnPx6EWWQnPyocG2Ke92Kho'),
    WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
    SUCCESS_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    CANCEL_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    IS_TEST_MODE: isTestMode,
    IS_LIVE_MODE: isLiveMode,
};

// Plan configurations
export const PLAN_LIMITS = {
    starter: {
        initiatives_limit: 2,
        plan_tier: 'starter' as const,
    },
    trial: {
        initiatives_limit: null, // unlimited during trial
        plan_tier: null,
    }
};

