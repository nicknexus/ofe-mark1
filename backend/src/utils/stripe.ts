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

export const STRIPE_CONFIG = {
    STARTER_PRICE_ID: isProduction
        ? (process.env.STRIPE_STARTER_PRICE_ID_LIVE || '')
        : (process.env.STRIPE_STARTER_PRICE_ID || 'price_1SnPx6EWWQnPyocG2Ke92Kho'),
    WEBHOOK_SECRET: isProduction
        ? (process.env.STRIPE_WEBHOOK_SECRET_LIVE || '')
        : (process.env.STRIPE_WEBHOOK_SECRET || ''),
    SUCCESS_URL: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
    CANCEL_URL: process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000',
    IS_TEST_MODE: isTestMode,
    IS_LIVE_MODE: isLiveMode,
};

// Plan configurations
export const PLAN_LIMITS = {
    starter: {
        initiatives_limit: 3,
        plan_tier: 'starter' as const,
    },
    trial: {
        initiatives_limit: 3,
        plan_tier: null,
    }
};

