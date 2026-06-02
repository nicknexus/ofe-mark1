-- DEFERRED CLEANUP — DO NOT RUN until the new backend + frontend are deployed
-- and verified in production (permissions JSONB confirmed authoritative).
--
-- Running this earlier WILL break the currently-deployed backend, which still
-- reads team_member_permissions / can_add_impact_claims / can_edit_evidence.
--
-- Order matters; each block is independent and idempotent.

-- ---------------------------------------------------------------------------
-- 1. Matrix tables (replaced by team_members.permissions / team_invitations.permissions)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS team_member_permissions CASCADE;
DROP TABLE IF EXISTS team_invitation_permissions CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Legacy capability booleans (now inside permissions.grants)
-- ---------------------------------------------------------------------------
ALTER TABLE team_members      DROP COLUMN IF EXISTS can_add_impact_claims;
ALTER TABLE team_members      DROP COLUMN IF EXISTS can_edit_evidence;
ALTER TABLE team_invitations  DROP COLUMN IF EXISTS can_add_impact_claims;
ALTER TABLE team_invitations  DROP COLUMN IF EXISTS can_edit_evidence;

-- ---------------------------------------------------------------------------
-- 3. Old scope tables (now inside permissions.scope)
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS team_member_initiatives CASCADE;
DROP TABLE IF EXISTS team_member_locations CASCADE;
DROP TABLE IF EXISTS team_invitation_initiatives CASCADE;
DROP TABLE IF EXISTS team_invitation_locations CASCADE;

-- ---------------------------------------------------------------------------
-- 4. Deprecated custom-role model (from add_team_roles_and_permissions.sql,
--    which should never have been run; guarded with IF EXISTS).
-- ---------------------------------------------------------------------------
ALTER TABLE team_members DROP COLUMN IF EXISTS role_id;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS organization_roles CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Lock the model down once new code is the only writer.
-- ---------------------------------------------------------------------------
ALTER TABLE team_members ALTER COLUMN member_type SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 6. (Optional, separate change-window) retire vestigial user_organizations.
--    Verify subscriptionService no longer reads it first.
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS user_organizations CASCADE;
