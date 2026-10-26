-- Content journeys: a folder that follows a person, class, or community over time.
-- Updates are content_packages with journey_id set (story_type = 'journey').
-- Additive. Safe to re-run. Requires add_content_engine_v1.sql.

BEGIN;

CREATE TABLE IF NOT EXISTS content_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_journeys_org_updated
    ON content_journeys (organization_id, updated_at DESC);

ALTER TABLE content_packages
    ADD COLUMN IF NOT EXISTS journey_id UUID REFERENCES content_journeys(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_content_packages_journey
    ON content_packages (journey_id, created_at DESC);

-- Ordered photos for carousel posts: [{ source_type, source_id, image_url, title }].
-- visual_source_* stays the cover (first item).
ALTER TABLE content_packages
    ADD COLUMN IF NOT EXISTS media JSONB NOT NULL DEFAULT '[]'::jsonb;

DROP TRIGGER IF EXISTS trg_content_journeys_updated_at ON content_journeys;
CREATE TRIGGER trg_content_journeys_updated_at
    BEFORE UPDATE ON content_journeys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE content_journeys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to content journeys" ON content_journeys;
CREATE POLICY "Service role full access to content journeys"
    ON content_journeys
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE content_journeys IS
    'Content folders that collect updates (content_packages.journey_id) over time.';

COMMIT;
