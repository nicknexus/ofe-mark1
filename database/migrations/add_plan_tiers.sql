-- Migration: Free / Growth / Pro plan tiers
-- Run this in the Supabase SQL editor (Step 1 of the rollout — see the chat summary).
--
-- Adds the per-tier limit columns the app now enforces, a daily AI-report log,
-- and the new 'free' subscription status. Safe to re-run (IF NOT EXISTS).
-- This file only adds structure; the data conversion (existing users → Free,
-- grandfathered starter → growth) is in convert_to_plan_tiers.sql (Step 2).

-- 1. New limit columns on subscriptions (initiatives_limit & team_members_limit already exist)
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS locations_limit      INTEGER DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS storage_limit_bytes  BIGINT  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS ai_reports_per_day   INTEGER DEFAULT NULL;

COMMENT ON COLUMN subscriptions.locations_limit     IS 'Max locations for the org. NULL = unlimited.';
COMMENT ON COLUMN subscriptions.storage_limit_bytes IS 'Max storage bytes for the org. NULL = unlimited.';
COMMENT ON COLUMN subscriptions.ai_reports_per_day  IS 'Max AI report generations per day. NULL = unlimited.';

-- 2. Daily AI-report usage log (one row per generated report; counted per UTC day)
CREATE TABLE IF NOT EXISTS ai_report_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id         UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_report_log_org_day
    ON ai_report_log (organization_id, created_at);

-- 3. Widen the CHECK constraints to allow the new values (this DB has them):
--      status         + 'free'
--      plan_tier      + 'free','growth','pro'  (legacy values kept until convert runs)
--      billing_interval + 'annual'
--    Non-breaking: every value the live app currently writes stays allowed.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
    CHECK (status::text = ANY (ARRAY[
        'none','free','trial','active','past_due','cancelled','expired'
    ]::text[]));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_tier_check
    CHECK (plan_tier IS NULL OR plan_tier::text = ANY (ARRAY[
        'free','growth','pro','starter','professional','enterprise'
    ]::text[]));

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_billing_interval_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_billing_interval_check
    CHECK (billing_interval IS NULL OR billing_interval::text = ANY (ARRAY[
        'monthly','annual','yearly','lifetime'
    ]::text[]));
