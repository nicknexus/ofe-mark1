-- Evidence approval workflow: per-team-member "requires evidence approval"
-- flag + an approval status on evidence itself.
--
-- ADDITIVE ONLY — safe to run against production while the OLD backend is
-- still deployed: old code never reads these columns, every column has a
-- default (or is nullable), so old INSERTs keep working. Nothing is dropped.
--
-- Semantics:
--   evidence.approval_status
--     'approved' (default) — normal evidence; connects and counts everywhere.
--     'pending'            — uploaded by a member flagged for review. The row
--                            (and its files) exist, but it gets NO
--                            evidence_kpi_updates links, so it never connects
--                            to claims and never counts in any aggregate.
--                            Public pages additionally filter it out of
--                            visual lists.
--   team_members.requires_evidence_approval
--     Only meaningful for member_type = 'team_member' (admins/owners are
--     never gated). Set by an admin when inviting or editing a member.

-- ---------------------------------------------------------------------------
-- 1. Evidence status + review audit trail
-- ---------------------------------------------------------------------------
ALTER TABLE evidence
    ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (approval_status IN ('approved', 'pending'));
    
ALTER TABLE evidence
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;

ALTER TABLE evidence
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- The Logs approval queue filters on this per initiative.
CREATE INDEX IF NOT EXISTS idx_evidence_approval_status
    ON evidence (initiative_id, approval_status)
    WHERE approval_status <> 'approved';

-- ---------------------------------------------------------------------------
-- 2. Per-member review flag (mirrored on invitations so it can be set at
--    invite time and copied over on accept)
-- ---------------------------------------------------------------------------
ALTER TABLE team_members
    ADD COLUMN IF NOT EXISTS requires_evidence_approval BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE team_invitations
    ADD COLUMN IF NOT EXISTS requires_evidence_approval BOOLEAN NOT NULL DEFAULT false;
