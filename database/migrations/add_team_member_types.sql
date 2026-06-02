-- Owner / Admin / Team member model (backwards compatible)
-- Owners: organizations.owner_id only (never member_type on owners).
-- Existing team_members → admin. Legacy boolean columns kept.

-- ---------------------------------------------------------------------------
-- member_type on team_members + team_invitations
-- ---------------------------------------------------------------------------
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS member_type TEXT
    CHECK (member_type IS NULL OR member_type IN ('admin', 'team_member'));

ALTER TABLE team_invitations
    ADD COLUMN IF NOT EXISTS member_type TEXT
    CHECK (member_type IS NULL OR member_type IN ('admin', 'team_member'));

CREATE INDEX IF NOT EXISTS idx_team_members_member_type ON team_members(member_type);

-- ---------------------------------------------------------------------------
-- Per-member permission matrix (team_member only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_member_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT team_member_permissions_unique UNIQUE (team_member_id, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_team_member_permissions_member
    ON team_member_permissions(team_member_id);

-- ---------------------------------------------------------------------------
-- Invitation permission snapshot (copied on accept)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_invitation_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id UUID NOT NULL REFERENCES team_invitations(id) ON DELETE CASCADE,
    resource TEXT NOT NULL,
    action TEXT NOT NULL,
    allowed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT team_invitation_permissions_unique UNIQUE (invitation_id, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_team_invitation_permissions_invite
    ON team_invitation_permissions(invitation_id);

-- ---------------------------------------------------------------------------
-- Optional scope (team_member with limited initiatives/locations)
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

CREATE TABLE IF NOT EXISTS team_invitation_initiatives (
    invitation_id UUID NOT NULL REFERENCES team_invitations(id) ON DELETE CASCADE,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (invitation_id, initiative_id)
);

CREATE TABLE IF NOT EXISTS team_invitation_locations (
    invitation_id UUID NOT NULL REFERENCES team_invitations(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (invitation_id, location_id)
);

-- ---------------------------------------------------------------------------
-- Backfill: every existing team member becomes admin (same effective access)
-- ---------------------------------------------------------------------------
UPDATE team_members
SET member_type = 'admin'
WHERE member_type IS NULL;

-- Pending invites without type stay NULL → accepted as team_member in app code
COMMENT ON COLUMN team_members.member_type IS 'admin | team_member. Owners use organizations.owner_id.';
COMMENT ON TABLE team_member_permissions IS 'Granular grants for member_type = team_member only.';

-- After verification in production:
-- ALTER TABLE team_members ALTER COLUMN member_type SET NOT NULL;
-- ALTER TABLE team_members ADD CONSTRAINT team_members_member_type_check
--   CHECK (member_type IN ('admin', 'team_member'));
