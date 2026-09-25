-- Migration 1 of 2: remove the free plan. Additive only; safe to run any time,
-- including before the new backend is deployed (old code ignores the columns).
--
--  - first_paid_at: marks accounts that have paid. A failed payment only keeps
--    access if this is set, so every current payer is backfilled here. Missing
--    this backfill would lock paying customers on their next failed renewal.
--  - card_fingerprint: one free trial per card.
--
-- Part 2 (remove_free_plan_2_convert.sql) runs AFTER the new backend is live.

BEGIN;

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS first_paid_at TIMESTAMPTZ;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS card_fingerprint TEXT;
CREATE INDEX IF NOT EXISTS idx_subscriptions_card_fingerprint
    ON subscriptions (card_fingerprint) WHERE card_fingerprint IS NOT NULL;

-- Everyone currently billed through Stripe counts as having paid.
UPDATE subscriptions
SET first_paid_at = COALESCE(current_period_start, created_at)
WHERE first_paid_at IS NULL
  AND stripe_subscription_id IS NOT NULL
  AND status IN ('active', 'past_due');

COMMIT;

-- Check: every Stripe payer is marked. Must return 0.
-- SELECT count(*) FROM subscriptions
-- WHERE stripe_subscription_id IS NOT NULL AND status IN ('active','past_due') AND first_paid_at IS NULL;
