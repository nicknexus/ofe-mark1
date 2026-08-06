-- Migration: Org-global metric definitions
-- Date: 2026-08-03
-- Description:
--   1. Creates metric_definitions — the org-level metric entity ("Meals Provided").
--   2. Adds kpis.definition_id (which definition this metric-in-an-initiative is)
--      and kpis.archived_at (removed from the initiative, claims preserved).
--   3. Backfills one definition per existing kpi row (1:1, no merging).
--   4. Adds a trigger that mirrors definition identity fields down onto every
--      kpis row using that definition.
--
-- FULLY ADDITIVE. Deployed code does not select the new columns, so this is a
-- no-op for the running site until the new code ships. Nothing is dropped,
-- renamed, or made NOT NULL.
--
-- Deliberately NOT enforced: unique title per org. Existing orgs have duplicate
-- metric titles across initiatives (that's the situation this feature fixes),
-- and suffixing them here would rename metrics that are live on public pages.
-- Uniqueness for new/renamed definitions is enforced in the API instead. The
-- slug IS unique because it is brand new — no URL depends on it yet.

BEGIN;

-- 1. The definition: one row per distinct metric an org tracks.
CREATE TABLE IF NOT EXISTS metric_definitions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    metric_type VARCHAR(20) CHECK (metric_type IN ('number', 'percentage')) NOT NULL,
    unit_of_measurement VARCHAR(100) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('input', 'output', 'impact')) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metric_definitions_org_id ON metric_definitions(organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_definitions_org_slug ON metric_definitions(organization_id, slug);

-- 2. Wire kpis to definitions. Both nullable — nothing enforced until the
-- new code is live and the backfill below has run.
ALTER TABLE kpis
    ADD COLUMN IF NOT EXISTS definition_id UUID REFERENCES metric_definitions(id) ON DELETE CASCADE;

-- Archive, not delete: removing a metric from an initiative hides the row and
-- its claims everywhere, but preserves them so re-adding restores the history.
ALTER TABLE kpis
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_kpis_definition_id ON kpis(definition_id);
CREATE INDEX IF NOT EXISTS idx_kpis_archived_at ON kpis(archived_at) WHERE archived_at IS NULL;

-- A definition can only be attached to a given initiative once. Archived rows
-- still occupy the slot — re-adding un-archives rather than inserting.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kpis_definition_initiative
    ON kpis(definition_id, initiative_id)
    WHERE definition_id IS NOT NULL AND initiative_id IS NOT NULL;

-- 3. Backfill: one definition per existing kpi. No merging of same-titled
-- metrics — units can differ, and silently merging would corrupt totals.
-- Slugs are disambiguated with a numeric suffix where titles collide.
--
-- The audit trigger on kpis fires once per row updated here, so the backfill
-- leaves one audit_log row per metric. That noise is deliberate: suppressing
-- it would mean ALTER TABLE ... DISABLE TRIGGER, which takes an ACCESS
-- EXCLUSIVE lock and would block every read of `kpis` for the whole
-- transaction. A few audit rows are cheaper than blocking the live site.
DO $$
DECLARE
    rec RECORD;
    new_def_id UUID;
    base_slug TEXT;
    candidate_slug TEXT;
    suffix INT;
BEGIN
    FOR rec IN
        SELECT k.id, k.title, k.description, k.metric_type, k.unit_of_measurement,
               k.category, k.user_id, k.created_at, i.organization_id
        FROM kpis k
        JOIN initiatives i ON i.id = k.initiative_id
        WHERE k.definition_id IS NULL
          AND i.organization_id IS NOT NULL
        ORDER BY k.created_at
    LOOP
        -- Same slug rule the app uses: lowercase, non-alphanumerics to hyphens.
        base_slug := trim(both '-' from regexp_replace(lower(rec.title), '[^a-z0-9]+', '-', 'g'));
        IF base_slug = '' OR base_slug IS NULL THEN
            base_slug := 'metric';
        END IF;

        candidate_slug := base_slug;
        suffix := 1;
        WHILE EXISTS (
            SELECT 1 FROM metric_definitions
            WHERE organization_id = rec.organization_id AND slug = candidate_slug
        ) LOOP
            suffix := suffix + 1;
            candidate_slug := base_slug || '-' || suffix;
        END LOOP;

        INSERT INTO metric_definitions (
            organization_id, title, slug, description, metric_type,
            unit_of_measurement, category, created_by, created_at
        ) VALUES (
            rec.organization_id, rec.title, candidate_slug, rec.description,
            rec.metric_type, rec.unit_of_measurement, rec.category,
            rec.user_id, rec.created_at
        )
        RETURNING id INTO new_def_id;

        UPDATE kpis SET definition_id = new_def_id WHERE id = rec.id;
    END LOOP;
END $$;

-- 4. Identity fields live on the definition. They stay mirrored onto kpis so
-- every existing query and frontend type keeps working unchanged — the kpis
-- columns are a read cache, and this trigger is their only writer.
CREATE OR REPLACE FUNCTION sync_kpis_from_definition()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS DISTINCT FROM OLD.title
        OR NEW.description IS DISTINCT FROM OLD.description
        OR NEW.metric_type IS DISTINCT FROM OLD.metric_type
        OR NEW.unit_of_measurement IS DISTINCT FROM OLD.unit_of_measurement
        OR NEW.category IS DISTINCT FROM OLD.category
    THEN
        UPDATE kpis
        SET title = NEW.title,
            description = NEW.description,
            metric_type = NEW.metric_type,
            unit_of_measurement = NEW.unit_of_measurement,
            category = NEW.category,
            updated_at = NOW()
        WHERE definition_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_kpis_from_definition_trigger ON metric_definitions;
CREATE TRIGGER sync_kpis_from_definition_trigger
    AFTER UPDATE ON metric_definitions
    FOR EACH ROW EXECUTE FUNCTION sync_kpis_from_definition();

DROP TRIGGER IF EXISTS update_metric_definitions_updated_at ON metric_definitions;
CREATE TRIGGER update_metric_definitions_updated_at
    BEFORE UPDATE ON metric_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS. Backend uses the service role and bypasses these; policies exist so
-- the schema is sensible if the frontend ever hits Supabase directly.
ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage metric definitions" ON metric_definitions;
CREATE POLICY "Org members can manage metric definitions"
    ON metric_definitions FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = metric_definitions.organization_id
              AND (
                o.owner_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM team_members tm
                    WHERE tm.organization_id = o.id
                      AND tm.user_id = auth.uid()
                )
              )
        )
    );

COMMENT ON TABLE metric_definitions IS 'Org-global metric entity. One row per distinct metric an org tracks; kpis rows are its per-initiative instances.';
COMMENT ON COLUMN kpis.definition_id IS 'The org-global metric this row instantiates. Identity fields on kpis mirror the definition and are written only by sync_kpis_from_definition().';
COMMENT ON COLUMN kpis.archived_at IS 'Set when the metric is removed from the initiative. Hides the row and its claims everywhere; claims and evidence links are preserved so re-adding restores them.';

NOTIFY pgrst, 'reload schema';

COMMIT;

-- ── Verification (run separately after COMMIT) ────────────────────────────
-- Every kpi mapped:            expect 0 rows
--   SELECT count(*) FROM kpis k JOIN initiatives i ON i.id = k.initiative_id
--   WHERE k.definition_id IS NULL;
-- Backfill is strictly 1:1:    expect 0 rows
--   SELECT definition_id, count(*) FROM kpis
--   WHERE definition_id IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
