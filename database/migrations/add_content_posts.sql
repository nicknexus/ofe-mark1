-- Migration: content_posts
-- Additive only. No ALTERs on existing tables.
-- Stores social/email drafts derived from evidence or stories.
-- Generated PNGs (later) go in the existing evidence-files bucket under
-- content/{orgId}/ so they count toward storage without a new bucket.
-- Backend uses the service role key (RLS bypassed) and enforces org access
-- in code. These policies are defense-in-depth: anon gets nothing.

BEGIN;

CREATE TABLE IF NOT EXISTS content_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('social', 'email')),
    format TEXT NOT NULL CHECK (format IN ('ig_square', 'linkedin', 'email')),
    source_type TEXT NOT NULL CHECK (source_type IN ('evidence', 'story')),
    -- Polymorphic on purpose: no FK to evidence/stories. Deleting a source
    -- must not cascade-delete a finished post (the PNG/caption still ship).
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

CREATE INDEX IF NOT EXISTS idx_content_posts_org_created
    ON content_posts (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_posts_org_source
    ON content_posts (organization_id, source_type, source_id);

DROP TRIGGER IF EXISTS trg_content_posts_updated_at ON content_posts;
CREATE TRIGGER trg_content_posts_updated_at
    BEFORE UPDATE ON content_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE content_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access to content posts" ON content_posts;
CREATE POLICY "Service role full access to content posts"
    ON content_posts
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE content_posts IS
    'Org-scoped social/email drafts built from tracked evidence or stories. Derivatives only; source rows stay canonical.';

COMMIT;
