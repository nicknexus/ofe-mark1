-- Migration 2 of 2: remove the free plan. Run AFTER the new backend/frontend is
-- deployed (the old UI would tell grace users "you will be billed").
--
--  - Legacy status='free' rows get a 10-day card-less grace at Growth limits,
--    then lock. trial_used_at is set so their Checkout bills immediately.
--    Stale Stripe ids are cleared so a sync can't lock them before the grace ends.
--  - 'free' is removed from the status CHECK so nothing can write it again.

-- ── DRY RUN ────────────────────────────────────────────────────────────────
-- SELECT status, plan_tier, stripe_subscription_id IS NOT NULL AS has_stripe, count(*)
-- FROM subscriptions GROUP BY 1, 2, 3 ORDER BY 1, 2;
--
-- Admin comps (active, no Stripe) stay untouched; confirm each is intentional:
-- SELECT user_id, org_name, plan_tier, updated_at
-- FROM subscriptions WHERE status = 'active' AND stripe_subscription_id IS NULL;
--
-- Accounts that get the 10-day grace (email this list):
-- SELECT s.user_id, u.email, s.org_name, s.plan_tier
-- FROM subscriptions s JOIN auth.users u ON u.id = s.user_id
-- WHERE s.status = 'free';

BEGIN;

UPDATE subscriptions SET
    status              = 'trial',
    trial_started_at    = now(),
    trial_ends_at       = now() + interval '10 days',
    trial_used_at       = COALESCE(trial_used_at, now()),
    stripe_subscription_id = NULL,
    stripe_price_id     = NULL,
    plan_tier           = 'growth',
    initiatives_limit   = 10,
    team_members_limit  = 10,
    locations_limit     = 15,
    storage_limit_bytes = 322122547200,
    ai_reports_per_day  = NULL
WHERE status = 'free';

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status::text = ANY (ARRAY[
        'none','trial','active','past_due','cancelled','expired'
    ]::text[]));

COMMIT;

-- ── AFTER ──────────────────────────────────────────────────────────────────
-- SELECT status, count(*) FROM subscriptions GROUP BY 1;   -- no 'free'
-- 10 days later, card-less trials should have drained to 'expired':
-- SELECT count(*) FROM subscriptions WHERE status = 'trial' AND stripe_subscription_id IS NULL;
