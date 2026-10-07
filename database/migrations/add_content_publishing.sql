-- Content publishing: masters (moments, journey updates) are public-page posts.
-- Social channel versions (content_posts) stay optional extensions of a master.
-- Requires add_content_journeys.sql. Safe to re-run.
--
-- content_packages.published_at: NULL = draft, set = on the public page.
-- content_packages.edited_at: last master edit, so channel versions can be flagged stale.
-- content_journeys.published_at: journey visibility. Auto-set when an update is published.
-- content_journeys.status: progress, ongoing | completed (replaces active | archived).

BEGIN;

ALTER TABLE content_packages ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE content_packages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE content_journeys ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_content_packages_org_published
    ON content_packages (organization_id, published_at DESC)
    WHERE published_at IS NOT NULL;

ALTER TABLE content_journeys DROP CONSTRAINT IF EXISTS content_journeys_status_check;
UPDATE content_journeys SET status = 'ongoing' WHERE status = 'active';
UPDATE content_journeys SET status = 'completed' WHERE status = 'archived';
ALTER TABLE content_journeys ALTER COLUMN status SET DEFAULT 'ongoing';
ALTER TABLE content_journeys
    ADD CONSTRAINT content_journeys_status_check CHECK (status IN ('ongoing', 'completed'));

COMMIT;
