-- DEPRECATED: use add_team_member_types.sql instead (owner/admin/team_member model).
-- Team roles & permissions (backwards-compatible Phase 2)
-- Owners remain on organizations.owner_id — never team_members.role_id.
-- Existing can_add_impact_claims / can_edit_evidence columns are kept.

-- ---------------------------------------------------------------------------
-- organization_roles: system templates (organization_id NULL) + per-org custom
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organization_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT organization_roles_slug_org_unique UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_organization_roles_org_id ON organization_roles(organization_id);

-- ---------------------------------------------------------------------------
-- role_permissions: granular matrix (used in later phases; seeded for admin/custom)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES organization_roles(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'organization',
    allowed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT role_permissions_unique UNIQUE (role_id, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);

-- ---------------------------------------------------------------------------
-- team_members.role_id (nullable until backfill verified)
-- ---------------------------------------------------------------------------
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES organization_roles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_role_id ON team_members(role_id);

-- ---------------------------------------------------------------------------
-- Scoped assignments (Phase 6+)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_member_initiatives (
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_member_id, initiative_id)
);

CREATE TABLE IF NOT EXISTS team_member_locations (
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (team_member_id, location_id)
);

-- ---------------------------------------------------------------------------
-- Optional audit trail for permission denials / sensitive actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permission_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    actor_user_id UUID,
    kind TEXT NOT NULL,
    resource TEXT,
    action TEXT,
    resource_id TEXT,
    reason TEXT NOT NULL,
    detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_permission_audit_logs_org_created
    ON permission_audit_logs(organization_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Seed system roles (global templates)
-- ---------------------------------------------------------------------------
INSERT INTO organization_roles (organization_id, slug, name, is_system, description)
VALUES
    (NULL, 'member_full_access', 'Member (full access)', true,
     'Phase 1 baseline: operational access equivalent to pre-roles team members.'),
    (NULL, 'admin', 'Admin', true,
     'Full operational access; no billing, ownership, or org deletion.')
ON CONFLICT (organization_id, slug) DO NOTHING;

-- Backfill every existing team member to member_full_access
UPDATE team_members tm
SET role_id = r.id
FROM organization_roles r
WHERE r.slug = 'member_full_access'
  AND r.organization_id IS NULL
  AND tm.role_id IS NULL;

-- After deploy verification, run manually:
-- ALTER TABLE team_members ALTER COLUMN role_id SET NOT NULL;

COMMENT ON TABLE organization_roles IS 'Role presets per org; owners use organizations.owner_id, not role_id.';
COMMENT ON COLUMN team_members.role_id IS 'Nullable during migration; defaults to member_full_access for existing rows.';
