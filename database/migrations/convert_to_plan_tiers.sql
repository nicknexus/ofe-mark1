-- Migration: convert existing subscriptions to Free / Growth (run 2026-07-05)
-- Run AFTER add_plan_tiers.sql and AFTER deploying the plan-tier code
-- (older backends don't understand status='free' and would lock users out).
--
-- Policy (as actually executed at launch):
--  * All PAYING users (active/past_due, any legacy tier) -> Growth limits,
--    keeping their existing Stripe price/amount (grandfathered).
--  * All CURRENT TRIALS -> complimentary Growth: status 'free' (permanent
--    access, no expiry cliff) with Growth limits. These are audited manually
--    afterward and selectively dropped to Free.
--  * Everyone inactive (expired / cancelled / never subscribed) -> Free.
--  * Rows already status='free' are untouched.
--
-- Limit values mirror backend/src/config/planCatalog.ts. Keep them in sync.
--   free:    1 init,  2 team,  3 loc,  25 GB,  1 AI/day   (25*1024^3   = 26843545600)
--   growth: 10 init, 10 team, 15 loc, 300 GB, unlimited AI (300*1024^3 = 322122547200)

-- ── DRY RUN (run first to preview) ─────────────────────────────────────────
-- SELECT status, plan_tier, count(*)
-- FROM subscriptions
-- GROUP BY status, plan_tier
-- ORDER BY status, plan_tier;

BEGIN;

-- A) All paying users → Growth limits (Stripe price/amount untouched)
UPDATE subscriptions SET
    plan_tier           = 'growth',
    initiatives_limit   = 10,
    team_members_limit  = 10,
    locations_limit     = 15,
    storage_limit_bytes = 322122547200,
    ai_reports_per_day  = NULL
WHERE status IN ('active', 'past_due');

-- B) All current trials → complimentary Growth (permanent access; audit later)
UPDATE subscriptions SET
    status              = 'free',
    plan_tier           = 'growth',
    initiatives_limit   = 10,
    team_members_limit  = 10,
    locations_limit     = 15,
    storage_limit_bytes = 322122547200,
    ai_reports_per_day  = NULL
WHERE status = 'trial';

-- C) Everyone inactive → Free
UPDATE subscriptions SET
    status              = 'free',
    plan_tier           = 'free',
    initiatives_limit   = 1,
    team_members_limit  = 2,
    locations_limit     = 3,
    storage_limit_bytes = 26843545600,
    ai_reports_per_day  = 1
WHERE status IN ('expired', 'cancelled', 'none');

COMMIT;

-- ── AUDIT: comped-Growth accounts (not paying, on Growth) ──────────────────
-- SELECT s.user_id, s.org_name, o.name AS organization, o.slug, s.updated_at
-- FROM subscriptions s
-- LEFT JOIN organizations o ON o.owner_id = s.user_id
-- WHERE s.status = 'free' AND s.plan_tier = 'growth'
-- ORDER BY s.updated_at DESC;
--
-- ── Drop an audited account to Free ────────────────────────────────────────
-- UPDATE subscriptions SET
--     plan_tier = 'free', initiatives_limit = 1, team_members_limit = 2,
--     locations_limit = 3, storage_limit_bytes = 26843545600, ai_reports_per_day = 1
-- WHERE user_id = '<USER_UUID>';
--
-- Visibility (hiding extra initiatives, locking tags/groups, public filtering)
-- is enforced dynamically at read time from these columns — no other data is
-- touched, and re-upgrading restores everything instantly.
