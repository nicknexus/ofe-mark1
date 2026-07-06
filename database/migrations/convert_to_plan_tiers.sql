-- Migration: convert existing subscriptions to Free / Growth / Pro (Step 2)
-- Run AFTER add_plan_tiers.sql, in the Supabase SQL editor.
--
-- Policy (agreed):
--  * Grandfather: active/past_due "starter" (and NULL-tier paid) subscriptions
--    become Growth — they get Growth limits but KEEP their existing Stripe price
--    and amount (we never touch stripe_* columns here).
--  * professional -> pro, enterprise -> pro (active/past_due).
--  * Everyone else (none / trial / expired / cancelled) moves to the always-free
--    plan with Free limits. No data is deleted.
--
-- Limit values mirror backend/src/config/planCatalog.ts. Keep them in sync.
--   free:   1 init,  2 team,  3 loc,  25 GB,  1 AI/day   (25*1024^3   = 26843545600)
--   growth:10 init, 10 team, 15 loc, 300 GB, unlimited AI (300*1024^3 = 322122547200)
--   pro:   25 init, 20 team, 30 loc,   1 TB, unlimited AI (1024^4     = 1099511627776)

-- ── DRY RUN (run this first to preview what will change) ───────────────────────
-- SELECT status, plan_tier, count(*)
-- FROM subscriptions
-- GROUP BY status, plan_tier
-- ORDER BY status, plan_tier;

BEGIN;

-- A) Grandfather paid starter (and paid rows with no tier set) → Growth
UPDATE subscriptions SET
    plan_tier           = 'growth',
    initiatives_limit   = 10,
    team_members_limit  = 10,
    locations_limit     = 15,
    storage_limit_bytes = 322122547200,
    ai_reports_per_day  = NULL
WHERE status IN ('active', 'past_due')
  AND (plan_tier = 'starter' OR plan_tier IS NULL);

-- B) professional / enterprise → Pro
UPDATE subscriptions SET
    plan_tier           = 'pro',
    initiatives_limit   = 25,
    team_members_limit  = 20,
    locations_limit     = 30,
    storage_limit_bytes = 1099511627776,
    ai_reports_per_day  = NULL
WHERE status IN ('active', 'past_due')
  AND plan_tier IN ('professional', 'enterprise');

-- C) Everyone not on a live paid subscription → always-free plan
UPDATE subscriptions SET
    status              = 'free',
    plan_tier           = 'free',
    initiatives_limit   = 1,
    team_members_limit  = 2,
    locations_limit     = 3,
    storage_limit_bytes = 26843545600,
    ai_reports_per_day  = 1
WHERE status NOT IN ('active', 'past_due');

COMMIT;

-- NOTE: No initiative hiding is needed here. Over-limit initiatives, tags, and
-- beneficiary groups are hidden/locked dynamically at read time from the plan
-- limits set above (EntitlementService) — nothing in user data is mutated, and
-- everything reappears automatically if an org upgrades again.
