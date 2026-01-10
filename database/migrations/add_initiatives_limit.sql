-- Migration: Add initiatives_limit to subscriptions
-- Date: 2026-01-08
-- Description: Adds initiative limit column for paid subscription tiers

-- Add initiatives_limit column to subscriptions table
-- NULL = unlimited (trial/enterprise), number = limit for paid tiers
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS initiatives_limit INTEGER DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.initiatives_limit IS 'Maximum number of initiatives allowed. NULL means unlimited.';

