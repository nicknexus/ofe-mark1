-- Fix RLS policies on organization_context to allow service role writes.
-- Matches the pattern used elsewhere in this schema (initiatives, organizations):
-- service role context is detected via `auth.uid() IS NULL` OR `auth.role() = 'service_role'`.
-- Run this in the Supabase SQL editor.

DROP POLICY IF EXISTS "Public can read context of public orgs" ON organization_context;
CREATE POLICY "Public can read context of public orgs"
    ON organization_context FOR SELECT
    USING (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.is_public = TRUE
        )
    );

DROP POLICY IF EXISTS "Owner can read own context" ON organization_context;
CREATE POLICY "Owner can read own context"
    ON organization_context FOR SELECT
    USING (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can insert own context" ON organization_context;
CREATE POLICY "Owner can insert own context"
    ON organization_context FOR INSERT
    WITH CHECK (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can update own context" ON organization_context;
CREATE POLICY "Owner can update own context"
    ON organization_context FOR UPDATE
    USING (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Owner can delete own context" ON organization_context;
CREATE POLICY "Owner can delete own context"
    ON organization_context FOR DELETE
    USING (
        auth.uid() IS NULL
        OR auth.role() = 'service_role'
        OR EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = organization_context.organization_id
              AND o.owner_id = auth.uid()
        )
    );
