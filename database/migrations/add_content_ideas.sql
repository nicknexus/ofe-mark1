-- Content ideas: "what should we capture?" recommendations for the Content workspace.
-- Each row is one idea card written from a detected signal (signal_key dedupes repeats).
-- Status changes double as the learning log (accepted / dismissed / posted).
-- Additive. Safe to re-run. Requires add_content_journeys.sql.
--
-- Rollback:
--   ALTER TABLE content_packages DROP COLUMN IF EXISTS idea_id;
--   DROP TABLE IF EXISTS content_ideas;

BEGIN;

CREATE TABLE IF NOT EXISTS content_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    signal_key TEXT NOT NULL,
    angle TEXT NOT NULL,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE SET NULL,
    kpi_id UUID REFERENCES kpis(id) ON DELETE SET NULL,
    journey_id UUID REFERENCES content_journeys(id) ON DELETE SET NULL,
    card JSONB NOT NULL,
    facts JSONB NOT NULL DEFAULT '{}'::jsonb,
    rank INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested'
        CHECK (status IN ('suggested', 'accepted', 'dismissed', 'snoozed', 'posted', 'expired')),
    dismiss_reason TEXT,
    snoozed_until TIMESTAMPTZ,
    story_id UUID,
    package_id UUID REFERENCES content_packages(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    acted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_content_ideas_org_status
    ON content_ideas (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_ideas_org_signal
    ON content_ideas (organization_id, signal_key, created_at DESC);

ALTER TABLE content_packages
    ADD COLUMN IF NOT EXISTS idea_id UUID REFERENCES content_ideas(id) ON DELETE SET NULL;

ALTER TABLE content_ideas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to content ideas" ON content_ideas;
CREATE POLICY "Service role full access to content ideas"
    ON content_ideas
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE content_ideas IS
    'Capture recommendations (angle, who, what to ask, how to capture) generated from org signals.';

COMMIT;
