-- Annual report import jobs
-- Run this in the Supabase SQL editor.
--
-- One row per uploaded annual report. We store the source file location and the
-- AI-extracted suggestions (organization profile, context, initiatives, metrics,
-- beneficiary groups, locations) as a single JSONB blob. The user reviews and
-- edits these suggestions in the app, then applies the ones they want via the
-- existing create endpoints — nothing here writes directly to the core tables.

CREATE TABLE IF NOT EXISTS report_imports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Source file (lives in the evidence-files bucket, same as other uploads).
    file_name TEXT,
    file_path TEXT,                 -- path within the storage bucket
    file_url TEXT,                  -- public URL used to fetch the file for extraction
    -- pending → processing → completed | failed
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    -- Structured suggestions produced by the extraction model.
    extracted JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_imports_org_id
    ON report_imports(organization_id);
CREATE INDEX IF NOT EXISTS idx_report_imports_status
    ON report_imports(status);

-- Reuse the shared updated_at trigger fn defined earlier in the schema.
DROP TRIGGER IF EXISTS trg_report_imports_updated_at ON report_imports;
CREATE TRIGGER trg_report_imports_updated_at
BEFORE UPDATE ON report_imports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Row Level Security
-- Backend uses the service role key (RLS bypassed) and enforces org membership
-- in code (OrgAccessService). These policies are defense-in-depth for direct
-- anon/authed client access.
-- ============================================
ALTER TABLE report_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can read own org report imports" ON report_imports;
CREATE POLICY "Members can read own org report imports"
    ON report_imports FOR SELECT
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = report_imports.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can insert own org report imports" ON report_imports;
CREATE POLICY "Members can insert own org report imports"
    ON report_imports FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = report_imports.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can update own org report imports" ON report_imports;
CREATE POLICY "Members can update own org report imports"
    ON report_imports FOR UPDATE
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = report_imports.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Members can delete own org report imports" ON report_imports;
CREATE POLICY "Members can delete own org report imports"
    ON report_imports FOR DELETE
    USING (
        auth.role() = 'service_role' OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = report_imports.organization_id
              AND o.owner_id = auth.uid()
        )
    );
