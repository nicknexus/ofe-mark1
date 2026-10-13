-- Stakeholder tagging for content ideas: the Impact Web shows one node per stakeholder
-- and each node opens a suggestion written for that stakeholder's stance.
-- Cards written after this migration use card v2 (questions with lenses, filming categories).
-- Card shape stays in the existing card JSONB column, versioned by card.v.
-- Additive. Safe to re-run. Requires add_content_ideas.sql.
--
-- Rollback:
--   DROP INDEX IF EXISTS idx_content_ideas_org_stakeholder;
--   ALTER TABLE content_ideas DROP COLUMN IF EXISTS stakeholder;

BEGIN;

ALTER TABLE content_ideas
    ADD COLUMN IF NOT EXISTS stakeholder TEXT;

-- Existing rows were all written from program and metric signals about the people served.
UPDATE content_ideas SET stakeholder = 'people_served' WHERE stakeholder IS NULL;

ALTER TABLE content_ideas
    DROP CONSTRAINT IF EXISTS content_ideas_stakeholder_check;
ALTER TABLE content_ideas
    ADD CONSTRAINT content_ideas_stakeholder_check
    CHECK (stakeholder IS NULL OR stakeholder IN ('people_served', 'staff', 'volunteers', 'community', 'donors'));

CREATE INDEX IF NOT EXISTS idx_content_ideas_org_stakeholder
    ON content_ideas (organization_id, stakeholder, status, created_at DESC);

COMMENT ON COLUMN content_ideas.stakeholder IS
    'Which circle of the Impact Web this idea belongs to: people_served, staff, volunteers, community, donors.';

COMMIT;
