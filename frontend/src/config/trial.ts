/**
 * Display copy for the Growth/Pro trial. Keep in sync with backend
 * TRIAL_DURATION_DAYS (planCatalog.ts / env). Stripe uses the backend value.
 */
export const TRIAL_DURATION_DAYS = Number(import.meta.env.VITE_TRIAL_DURATION_DAYS) || 10
