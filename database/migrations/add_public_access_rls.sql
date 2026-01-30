-- Add RLS Policies for Public Read Access
-- Run this in Supabase SQL Editor
-- This allows unauthenticated users to read data from public organizations/initiatives

-- ============================================
-- HELPER FUNCTION: Check if initiative is public
-- ============================================

CREATE OR REPLACE FUNCTION is_initiative_public(init_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM initiatives i
        JOIN organizations o ON i.organization_id = o.id
        WHERE i.id = init_id 
        AND i.is_public = TRUE 
        AND o.is_public = TRUE
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- INITIATIVES: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view public initiatives" ON initiatives;
CREATE POLICY "Public can view public initiatives" ON initiatives
    FOR SELECT
    USING (
        is_public = TRUE 
        AND EXISTS (
            SELECT 1 FROM organizations o 
            WHERE o.id = initiatives.organization_id 
            AND o.is_public = TRUE
        )
    );

-- ============================================
-- KPIS: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view KPIs of public initiatives" ON kpis;
CREATE POLICY "Public can view KPIs of public initiatives" ON kpis
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- KPI_UPDATES: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view KPI updates of public initiatives" ON kpi_updates;
CREATE POLICY "Public can view KPI updates of public initiatives" ON kpi_updates
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kpis k
            WHERE k.id = kpi_updates.kpi_id
            AND is_initiative_public(k.initiative_id)
        )
    );

-- ============================================
-- EVIDENCE: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view evidence of public initiatives" ON evidence;
CREATE POLICY "Public can view evidence of public initiatives" ON evidence
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- EVIDENCE_FILES: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view evidence files of public initiatives" ON evidence_files;
CREATE POLICY "Public can view evidence files of public initiatives" ON evidence_files
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evidence e
            WHERE e.id = evidence_files.evidence_id
            AND is_initiative_public(e.initiative_id)
        )
    );

-- ============================================
-- STORIES: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view stories of public initiatives" ON stories;
CREATE POLICY "Public can view stories of public initiatives" ON stories
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- LOCATIONS: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view locations of public initiatives" ON locations;
CREATE POLICY "Public can view locations of public initiatives" ON locations
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- BENEFICIARY_GROUPS: Public read access
-- ============================================

DROP POLICY IF EXISTS "Public can view beneficiary groups of public initiatives" ON beneficiary_groups;
CREATE POLICY "Public can view beneficiary groups of public initiatives" ON beneficiary_groups
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- JUNCTION TABLES: Public read access
-- ============================================

-- evidence_locations
DROP POLICY IF EXISTS "Public can view evidence_locations of public initiatives" ON evidence_locations;
CREATE POLICY "Public can view evidence_locations of public initiatives" ON evidence_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evidence e
            WHERE e.id = evidence_locations.evidence_id
            AND is_initiative_public(e.initiative_id)
        )
    );

-- evidence_kpis
DROP POLICY IF EXISTS "Public can view evidence_kpis of public initiatives" ON evidence_kpis;
CREATE POLICY "Public can view evidence_kpis of public initiatives" ON evidence_kpis
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evidence e
            WHERE e.id = evidence_kpis.evidence_id
            AND is_initiative_public(e.initiative_id)
        )
    );

-- kpi_locations
DROP POLICY IF EXISTS "Public can view kpi_locations of public initiatives" ON kpi_locations;
CREATE POLICY "Public can view kpi_locations of public initiatives" ON kpi_locations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM kpis k
            WHERE k.id = kpi_locations.kpi_id
            AND is_initiative_public(k.initiative_id)
        )
    );

-- story_beneficiaries
DROP POLICY IF EXISTS "Public can view story_beneficiaries of public initiatives" ON story_beneficiaries;
CREATE POLICY "Public can view story_beneficiaries of public initiatives" ON story_beneficiaries
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM stories s
            WHERE s.id = story_beneficiaries.story_id
            AND is_initiative_public(s.initiative_id)
        )
    );

-- kpi_update_beneficiary_groups (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_update_beneficiary_groups') THEN
        EXECUTE 'DROP POLICY IF EXISTS "Public can view kpi_update_beneficiary_groups of public initiatives" ON kpi_update_beneficiary_groups';
        EXECUTE '
            CREATE POLICY "Public can view kpi_update_beneficiary_groups of public initiatives" ON kpi_update_beneficiary_groups
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM kpi_updates ku
                    JOIN kpis k ON ku.kpi_id = k.id
                    WHERE ku.id = kpi_update_beneficiary_groups.kpi_update_id
                    AND is_initiative_public(k.initiative_id)
                )
            )
        ';
    END IF;
END $$;

-- ============================================
-- UMBRELLA_KPIS: Public read access (if used)
-- ============================================

DROP POLICY IF EXISTS "Public can view umbrella KPIs of public initiatives" ON umbrella_kpis;
CREATE POLICY "Public can view umbrella KPIs of public initiatives" ON umbrella_kpis
    FOR SELECT
    USING (is_initiative_public(initiative_id));

-- ============================================
-- SET EXISTING DATA TO PUBLIC
-- ============================================

-- Make all existing organizations public
UPDATE organizations SET is_public = TRUE WHERE is_public = FALSE OR is_public IS NULL;

-- Make all existing initiatives public
UPDATE initiatives SET is_public = TRUE WHERE is_public = FALSE OR is_public IS NULL;

-- ============================================
-- VERIFICATION
-- ============================================

DO $$ 
BEGIN 
    RAISE NOTICE 'Public access RLS policies created successfully!';
    RAISE NOTICE 'All organizations set to is_public = TRUE';
    RAISE NOTICE 'All initiatives set to is_public = TRUE';
END $$;
