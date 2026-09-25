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
-- Org owners who get the 10-day grace (email this list; team members excluded):
-- SELECT s.user_id, u.email, o.name AS org, s.plan_tier
-- FROM subscriptions s
-- JOIN auth.users u ON u.id = s.user_id
-- JOIN organizations o ON o.owner_id = s.user_id AND COALESCE(o.is_demo, false) = false
-- WHERE s.status = 'free'
-- ORDER BY s.plan_tier DESC, o.name;
--
-- Team members (set to 'none', inherit from their owner):
-- SELECT s.user_id, u.email FROM subscriptions s JOIN auth.users u ON u.id = s.user_id
-- WHERE s.status = 'free'
--   AND NOT EXISTS (SELECT 1 FROM organizations o WHERE o.owner_id = s.user_id AND COALESCE(o.is_demo, false) = false);
--
-- Internal / comped accounts: grant them BEFORE running this so they're skipped:
-- UPDATE subscriptions SET status = 'active', stripe_subscription_id = NULL,
--     current_period_end = '2999-12-31', plan_tier = 'growth', initiatives_limit = 10,
--     team_members_limit = 10, locations_limit = 15, storage_limit_bytes = 322122547200,
--     ai_reports_per_day = NULL
-- WHERE user_id IN ('<uuid>');

BEGIN;

-- Guard: a 'free' row still linked to a Stripe subscription may be someone
-- paying whose row never updated. Clearing that link would cut them off from
-- their billing, so abort (nothing changes) and review those rows by hand.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM subscriptions WHERE status = 'free' AND stripe_subscription_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Aborted: free rows linked to a Stripe subscription exist. Review them before converting.';
    END IF;
END $$;

-- Team members (own no org) never needed a plan of their own: access comes
-- from the org owner. 'none' = no own plan, no banner, inherits the owner's.
UPDATE subscriptions s SET
    status              = 'none',
    stripe_subscription_id = NULL,
    stripe_price_id     = NULL,
    plan_tier           = 'free',
    initiatives_limit   = 1,
    team_members_limit  = 2,
    locations_limit     = 3,
    storage_limit_bytes = 26843545600,
    ai_reports_per_day  = 1
WHERE s.status = 'free'
  AND NOT EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.owner_id = s.user_id AND COALESCE(o.is_demo, false) = false
  );

-- Org owners → 10-day card-less grace, then locked.
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
