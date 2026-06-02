-- Collapse team permissions into a single JSONB column per row (+ scope).
-- ADDITIVE ONLY — safe to run against production while the OLD backend is still
-- deployed: old code never reads `permissions`, and the column has a default so
-- old INSERTs keep working. No columns/tables are dropped here.
--
-- New JSONB shape (team_members.permissions / team_invitations.permissions):
-- {
--   "grants": [ { "resource": "evidence", "action": "create", "allowed": true }, ... ],
--   "scope":  { "allInitiatives": true, "initiativeIds": [], "locationIds": [] }
-- }
-- Admin rows ignore `permissions` entirely (capabilities are fixed in code).
-- Owners are organizations.owner_id and never appear in team_members.

-- ---------------------------------------------------------------------------
-- 1. Columns (NOT NULL with default → old inserts unaffected)
-- ---------------------------------------------------------------------------
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE team_invitations
    ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Backfill team_members from existing matrix rows (team_member only).
--    Existing rows were backfilled to 'admin' previously, so this is mostly a
--    no-op today, but it is correct for any team_member rows that exist.
--    Default scope = full org access (allInitiatives) to preserve current behavior.
-- ---------------------------------------------------------------------------
UPDATE team_members tm
SET permissions = jsonb_build_object(
    'grants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'resource', p.resource,
            'action', p.action,
            'allowed', true
        ))
        FROM team_member_permissions p
        WHERE p.team_member_id = tm.id AND p.allowed = true
    ), '[]'::jsonb),
    'scope', jsonb_build_object(
        'allInitiatives', true,
        'initiativeIds', '[]'::jsonb,
        'locationIds', '[]'::jsonb
    )
)
WHERE tm.member_type = 'team_member'
  AND (tm.permissions = '{}'::jsonb OR tm.permissions IS NULL);

-- ---------------------------------------------------------------------------
-- 3. Backfill pending team_invitations the same way.
-- ---------------------------------------------------------------------------
UPDATE team_invitations ti
SET permissions = jsonb_build_object(
    'grants', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'resource', p.resource,
            'action', p.action,
            'allowed', true
        ))
        FROM team_invitation_permissions p
        WHERE p.invitation_id = ti.id AND p.allowed = true
    ), '[]'::jsonb),
    'scope', jsonb_build_object(
        'allInitiatives', true,
        'initiativeIds', '[]'::jsonb,
        'locationIds', '[]'::jsonb
    )
)
WHERE (ti.member_type IS NULL OR ti.member_type = 'team_member')
  AND ti.status = 'pending'
  AND (ti.permissions = '{}'::jsonb OR ti.permissions IS NULL);

COMMENT ON COLUMN team_members.permissions IS
    'team_member only: { grants: [{resource,action,allowed}], scope: {allInitiatives,initiativeIds,locationIds} }. Admin/owner ignore this.';
COMMENT ON COLUMN team_invitations.permissions IS
    'Snapshot of grants+scope copied to team_members.permissions on accept.';
