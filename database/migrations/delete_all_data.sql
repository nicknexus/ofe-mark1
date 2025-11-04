-- ============================================
-- DELETE ALL DATA (Development Reset)
-- Run this in Supabase SQL Editor with service role
-- ⚠️ WARNING: This deletes EVERYTHING!
-- ============================================

-- Disable RLS temporarily for deletion
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_updates DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidence DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_kpis DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log DISABLE ROW LEVEL SECURITY;

-- Step 1: Drop foreign key constraint on audit_log temporarily
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;

-- Step 2: Delete audit_log (no foreign key constraint now)
DELETE FROM audit_log;
-- Or use TRUNCATE for speed
TRUNCATE TABLE audit_log;

-- Step 3: Delete all organizations (this cascades to initiatives via organization_id)
DELETE FROM organizations;

-- Step 4: Delete all users (this cascades to everything else)
-- This will delete:
--   - user_organizations
--   - initiatives (if any remain)
--   - kpis
--   - kpi_updates
--   - evidence
--   - locations
--   - umbrella_kpis
DELETE FROM auth.users;

-- Step 5: Clean up any remaining data (just in case)
DELETE FROM evidence_kpis;
DELETE FROM evidence;
DELETE FROM kpi_updates;
DELETE FROM kpis;
DELETE FROM umbrella_kpis;
DELETE FROM initiatives;
DELETE FROM locations;
DELETE FROM user_organizations;
DELETE FROM organizations;

-- Step 6: Recreate the foreign key constraint on audit_log
ALTER TABLE audit_log 
ADD CONSTRAINT audit_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Step 7: Re-enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Verify everything is deleted
SELECT 
    (SELECT COUNT(*) FROM auth.users) as users,
    (SELECT COUNT(*) FROM organizations) as organizations,
    (SELECT COUNT(*) FROM initiatives) as initiatives,
    (SELECT COUNT(*) FROM kpis) as kpis,
    (SELECT COUNT(*) FROM kpi_updates) as kpi_updates,
    (SELECT COUNT(*) FROM evidence) as evidence,
    (SELECT COUNT(*) FROM locations) as locations;
