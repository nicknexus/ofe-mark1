-- Organization Context & Challenges feature
-- Run this in the Supabase SQL editor.
--
-- One row per organization. Stores long-form text fields that describe the
-- problem the org is tackling, its theory of change, and supporting stats.
-- Edited by org owner on the private side; shown on public /org/:slug/context.

CREATE TABLE IF NOT EXISTS organization_context (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
    problem_statement TEXT,
    stats_and_statements TEXT,
    theory_of_change TEXT,
    additional_info TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_context_org_id
    ON organization_context(organization_id);

-- Reuse the existing trigger fn defined earlier in the schema
DROP TRIGGER IF EXISTS trg_org_context_updated_at ON organization_context;
CREATE TRIGGER trg_org_context_updated_at
BEFORE UPDATE ON organization_context
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security
-- Backend uses the service role key (RLS bypassed) and enforces ownership in
-- code. These policies are defense-in-depth for anon/authed client access.
-- ============================================
ALTER TABLE organization_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read context of public orgs" ON organization_context;
CREATE POLICY "Public can read context of public orgs"
    ON organization_context FOR SELECT
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.is_public = TRUE
        )
    );

DROP POLICY IF EXISTS "Owner can read own context" ON organization_context;
CREATE POLICY "Owner can read own context"
    ON organization_context FOR SELECT
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can insert own context" ON organization_context;
CREATE POLICY "Owner can insert own context"
    ON organization_context FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can update own context" ON organization_context;
CREATE POLICY "Owner can update own context"
    ON organization_context FOR UPDATE
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can delete own context" ON organization_context;
CREATE POLICY "Owner can delete own context"
    ON organization_context FOR DELETE
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );
