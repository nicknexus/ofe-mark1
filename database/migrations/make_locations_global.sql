-- Migration: Make locations org-global + introduce initiative_locations junction
-- Date: 2026-04-22
-- Description:
--   1. Adds locations.organization_id and backfills it from each location's initiative.
--   2. Drops the ON DELETE CASCADE on locations.initiative_id and makes it nullable
--      so deleting an initiative no longer wipes its locations.
--   3. Creates initiative_locations (M2M) and backfills it from existing
--      locations.initiative_id so day-1 every initiative shows the same locations
--      it shows today.
--   4. Updates RLS to be org-scoped (was user_id-only).
--
-- Fully additive. No location UUIDs change. No junction rows touched
-- (evidence_locations, story_locations, kpi_locations, evidence.location_id,
-- kpi_updates.location_id all keep pointing at the same IDs).

BEGIN;

-- 1. Add organization_id column (nullable initially so backfill can run)
ALTER TABLE locations
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Backfill organization_id from each location's current initiative
UPDATE locations l
SET organization_id = i.organization_id
FROM initiatives i
WHERE l.initiative_id = i.id
  AND l.organization_id IS NULL;

-- For any orphan locations (no initiative_id), try the creator's owned org
UPDATE locations l
SET organization_id = o.id
FROM organizations o
WHERE l.organization_id IS NULL
  AND l.initiative_id IS NULL
  AND o.owner_id = l.user_id;

-- Drop locations that we cannot place into any organization (orphans whose
-- creator no longer owns an org). These were already inaccessible via the
-- API since RLS required auth.uid() = user_id and they had no initiative tie.
DELETE FROM locations WHERE organization_id IS NULL;

-- Now enforce NOT NULL
ALTER TABLE locations ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_locations_organization_id ON locations(organization_id);

-- 2. Drop CASCADE on initiative_id and make it nullable.
-- We need the FK constraint name. Drop whatever FK exists and re-add as SET NULL.
DO $$
DECLARE
    conname TEXT;
BEGIN
    SELECT tc.constraint_name INTO conname
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'locations'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'initiative_id'
    LIMIT 1;

    IF conname IS NOT NULL THEN
        EXECUTE format('ALTER TABLE locations DROP CONSTRAINT %I', conname);
    END IF;
END $$;

ALTER TABLE locations ALTER COLUMN initiative_id DROP NOT NULL;

ALTER TABLE locations
    ADD CONSTRAINT locations_initiative_id_fkey
    FOREIGN KEY (initiative_id) REFERENCES initiatives(id) ON DELETE SET NULL;

-- 3. Create initiative_locations junction table
CREATE TABLE IF NOT EXISTS initiative_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (initiative_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_initiative_locations_initiative_id ON initiative_locations(initiative_id);
CREATE INDEX IF NOT EXISTS idx_initiative_locations_location_id ON initiative_locations(location_id);

-- Backfill: every existing (location, initiative_id) pair becomes a junction row
INSERT INTO initiative_locations (initiative_id, location_id)
SELECT initiative_id, id
FROM locations
WHERE initiative_id IS NOT NULL
ON CONFLICT (initiative_id, location_id) DO NOTHING;

-- 4. RLS: org-scoped instead of user-scoped
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own locations" ON locations;
DROP POLICY IF EXISTS "Users can insert their own locations" ON locations;
DROP POLICY IF EXISTS "Users can update their own locations" ON locations;
DROP POLICY IF EXISTS "Users can delete their own locations" ON locations;

CREATE POLICY "Org members can manage locations"
    ON locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = locations.organization_id
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

ALTER TABLE initiative_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage initiative_locations"
    ON initiative_locations FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM initiatives i
            JOIN organizations o ON o.id = i.organization_id
            WHERE i.id = initiative_locations.initiative_id
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

COMMENT ON COLUMN locations.organization_id IS 'Org that owns this location. Locations are org-global.';
COMMENT ON COLUMN locations.initiative_id IS 'Legacy/origin initiative. Real linkage lives in initiative_locations. Kept nullable for back-compat.';
COMMENT ON TABLE initiative_locations IS 'M2M: which locations are added to which initiatives.';

NOTIFY pgrst, 'reload schema';

COMMIT;
