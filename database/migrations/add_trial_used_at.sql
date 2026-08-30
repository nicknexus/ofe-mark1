-- One Stripe trial per account. Set on the first Checkout that includes a trial
-- (or any first paid Checkout). Never cleared. Growth → Pro and re-subscribe
-- read this and skip trial_period_days.
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN subscriptions.trial_used_at IS
    'When this account consumed its one Stripe trial. NULL = still eligible.';
