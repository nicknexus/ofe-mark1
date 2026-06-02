-- Fix Supabase security advisor ERRORs (2026-06).
-- Clears these lints on the 5 flagged tables + 2 views:
--   0007 policy_exists_rls_disabled  -- policies exist but RLS is OFF (inert)
--   0013 rls_disabled_in_public      -- public table exposed without RLS
--   0010 security_definer_view       -- view runs as owner, bypassing caller RLS
--   0023 sensitive_columns_exposed   -- team_invitations.token exposed via API
--
-- SAFE because: the backend uses the SERVICE_ROLE key (backend/src/utils/supabase.ts),
-- which bypasses RLS entirely. The frontend reads only `team_invitations` directly
-- (by token, anon) -- covered by the existing "Allow public read of invitations by
-- token" policy. The two views are read only by the backend (reportService.ts).
-- All policies below already exist and are scoped to auth.uid()/owner_id/service_role;
-- they were simply inert because RLS was never enabled on the table.

-- 1) Enable RLS so the existing policies take effect.
ALTER TABLE public.organizations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations     ENABLE ROW LEVEL SECURITY;

-- 2) Make the views honor the querying user's RLS instead of the owner's.
--    Definitions are unchanged; only the security mode flips.
ALTER VIEW public.metrics_with_context SET (security_invoker = on);
ALTER VIEW public.stories_with_context SET (security_invoker = on);
