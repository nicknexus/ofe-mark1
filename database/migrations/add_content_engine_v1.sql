-- Content Engine v1: packages (master story) + channel versions on content_posts.
-- Additive. Safe to re-run. Requires content_posts (see add_content_posts.sql).

BEGIN;

CREATE TABLE IF NOT EXISTS content_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('social', 'email')),
    format TEXT NOT NULL CHECK (format IN ('ig_square', 'linkedin', 'email')),
    source_type TEXT NOT NULL CHECK (source_type IN ('evidence', 'story')),
    source_id UUID NOT NULL,
    caption TEXT,
    email_subject TEXT,
    email_body TEXT,
    email_html TEXT,
    image_url TEXT,
    overlay JSONB,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    story_type TEXT NOT NULL CHECK (story_type IN ('glance', 'moment', 'journey')),
    hook TEXT,
    body TEXT,
    evidence_line TEXT,
    cta TEXT,
    why TEXT,
    visual_source_type TEXT CHECK (visual_source_type IN ('evidence', 'story')),
    visual_source_id UUID,
    layout TEXT NOT NULL DEFAULT 'clean' CHECK (layout IN ('clean', 'title', 'stats')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_packages_org_created
    ON content_packages (organization_id, created_at DESC);

ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES content_packages(id) ON DELETE CASCADE;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS channel TEXT;
ALTER TABLE content_posts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'content_posts_channel_check'
    ) THEN
        ALTER TABLE content_posts
            ADD CONSTRAINT content_posts_channel_check
            CHECK (channel IS NULL OR channel IN (
                'linkedin', 'instagram', 'facebook', 'donor_email', 'newsletter', 'sms'
            ));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'content_posts_status_check'
    ) THEN
        ALTER TABLE content_posts
            ADD CONSTRAINT content_posts_status_check
            CHECK (status IN ('draft', 'ready'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_content_posts_package
    ON content_posts (package_id);

CREATE INDEX IF NOT EXISTS idx_content_posts_org_source
    ON content_posts (organization_id, source_type, source_id);

DROP TRIGGER IF EXISTS trg_content_packages_updated_at ON content_packages;
CREATE TRIGGER trg_content_packages_updated_at
    BEFORE UPDATE ON content_packages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE content_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to content packages" ON content_packages;
CREATE POLICY "Service role full access to content packages"
    ON content_packages
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE content_packages IS
    'Master impact stories. Channel-ready versions live on content_posts.package_id.';

COMMIT;
