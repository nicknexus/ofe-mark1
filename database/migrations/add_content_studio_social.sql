-- Content Studio social publishing. Additive. Safe to re-run.
-- Not used while UPLOAD_POST_MUTATIONS is off. No profiles are created by the app.

BEGIN;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles';

CREATE TABLE IF NOT EXISTS org_social_profiles (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    profile_username TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS content_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    package_id UUID NOT NULL REFERENCES content_packages(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin')),
    status TEXT NOT NULL CHECK (status IN ('submitting', 'accepted', 'scheduled', 'published', 'failed', 'canceled')),
    scheduled_at TIMESTAMPTZ,
    timezone TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    idempotency_key TEXT NOT NULL UNIQUE,
    request_id TEXT NOT NULL,
    upload_post_request_id TEXT,
    job_id TEXT,
    platform_post_id TEXT,
    post_url TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS content_publications_one_open
    ON content_publications (package_id, platform)
    WHERE status IN ('submitting', 'accepted', 'scheduled');

CREATE INDEX IF NOT EXISTS idx_content_publications_org
    ON content_publications (organization_id, created_at DESC);

ALTER TABLE org_social_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_publications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to org social profiles" ON org_social_profiles;
CREATE POLICY "Service role full access to org social profiles"
    ON org_social_profiles FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role full access to content publications" ON content_publications;
CREATE POLICY "Service role full access to content publications"
    ON content_publications FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMIT;
