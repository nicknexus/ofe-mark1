-- ============================================
-- DEMO CHARITIES + PLATFORM ADMINS
-- Run this SQL in Supabase SQL Editor.
-- Safe / idempotent (uses IF NOT EXISTS everywhere).
-- Purely additive: no existing rows are modified, no existing
-- queries are affected until the accompanying code ships.
-- ============================================

BEGIN;

-- -----------------------------------------------------------------
-- 1. Flag columns on organizations
-- -----------------------------------------------------------------
-- is_demo:               this org is a sandbox / mock charity,
--                        hidden from /explore + public search.
-- demo_public_share:     when TRUE (and is_demo=TRUE), the org's
--                        public page is reachable via /org/:slug
--                        for share-link purposes, but is still
--                        excluded from listings.
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS is_demo            BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS demo_public_share  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_organizations_is_demo ON organizations(is_demo);

COMMENT ON COLUMN organizations.is_demo IS
    'TRUE if this org is a sandbox/mock charity created from the admin dashboard. Hidden from /explore and public search.';
COMMENT ON COLUMN organizations.demo_public_share IS
    'TRUE if the demo orgs public /org/:slug page should be reachable via direct link (still hidden from listings).';

-- -----------------------------------------------------------------
-- 2. Platform admins table
-- -----------------------------------------------------------------
-- Any user_id present here gets access to /api/admin/* endpoints
-- and the /admin/demos dashboard. Grant access by inserting a row.
CREATE TABLE IF NOT EXISTS platform_admins (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note       TEXT
);

COMMENT ON TABLE platform_admins IS
    'Users with platform-admin privileges. Bypass-via service role on the backend; not exposed via RLS.';

-- Keep platform_admins locked down — backend uses the service role key
-- and bypasses RLS. Enable RLS with no policies so a leaked anon key
-- cannot read/write this table.
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

COMMIT;
