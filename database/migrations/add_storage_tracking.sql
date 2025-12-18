-- ============================================
-- STORAGE TRACKING MIGRATION (PHASE 1)
-- Run this SQL in Supabase SQL Editor
-- This adds storage usage tracking per organization
-- 
-- PHASE 1: Tracking only - NO limits enforced
-- PHASE 2 (TODO - after Stripe integration):
--   - Add storage_limit_bytes BIGINT to organizations
--   - Add plan_tier VARCHAR(50) to organizations  
--   - Add stripe_subscription_id TEXT to organizations
--   - Enforce limits based on Stripe plan
-- ============================================

-- Step 1: Add storage_used_bytes to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT NOT NULL DEFAULT 0;

-- Step 2: Make file_size NOT NULL on evidence_files (backfill first)
-- First, update any NULL file_size values to 0 (shouldn't exist but just in case)
UPDATE evidence_files 
SET file_size = 0 
WHERE file_size IS NULL;

-- Now make the column NOT NULL with default 0
ALTER TABLE evidence_files 
ALTER COLUMN file_size SET NOT NULL,
ALTER COLUMN file_size SET DEFAULT 0;

-- Step 3: Create index for storage queries
CREATE INDEX IF NOT EXISTS idx_organizations_storage_used ON organizations(storage_used_bytes);

-- Step 4: Create a function to recalculate storage for an organization
-- This is useful for initial backfill and consistency checks
CREATE OR REPLACE FUNCTION recalculate_organization_storage(org_id UUID)
RETURNS BIGINT AS $$
DECLARE
    total_bytes BIGINT;
BEGIN
    SELECT COALESCE(SUM(ef.file_size), 0)
    INTO total_bytes
    FROM evidence_files ef
    INNER JOIN evidence e ON e.id = ef.evidence_id
    INNER JOIN initiatives i ON i.id = e.initiative_id
    WHERE i.organization_id = org_id;
    
    UPDATE organizations
    SET storage_used_bytes = total_bytes
    WHERE id = org_id;
    
    RETURN total_bytes;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Backfill storage_used_bytes for all existing organizations
DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM organizations LOOP
        PERFORM recalculate_organization_storage(org.id);
    END LOOP;
END $$;

-- Step 6: Add helpful comments
COMMENT ON COLUMN organizations.storage_used_bytes IS 'Total storage used by this organization in bytes. Tracked for usage monitoring. Phase 2 will add limits tied to Stripe plans.';
COMMENT ON COLUMN evidence_files.file_size IS 'File size in bytes. Required for accurate storage tracking.';
COMMENT ON FUNCTION recalculate_organization_storage IS 'Recalculates total storage for an organization from evidence_files. Use for consistency checks or manual corrections.';

-- ============================================
-- VERIFICATION (run to check results)
-- ============================================
-- SELECT id, name, storage_used_bytes, 
--        pg_size_pretty(storage_used_bytes) as human_readable
-- FROM organizations;

-- ============================================
-- PHASE 2 TODO (after Stripe integration):
-- ============================================
-- ALTER TABLE organizations ADD COLUMN storage_limit_bytes BIGINT;
-- ALTER TABLE organizations ADD COLUMN plan_tier VARCHAR(50) DEFAULT 'free';
-- ALTER TABLE organizations ADD COLUMN stripe_subscription_id TEXT;
-- ALTER TABLE organizations ADD COLUMN stripe_customer_id TEXT;
-- 
-- Plan limits (example):
-- free: 5 GB (5368709120 bytes)
-- starter: 50 GB (53687091200 bytes)
-- pro: 250 GB (268435456000 bytes)
-- enterprise: unlimited (NULL or very large number)





