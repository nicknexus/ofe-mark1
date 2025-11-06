-- Migration: Add display_order column to kpis, locations, and beneficiary_groups tables
-- Date: 2025-01-27
-- Description: Adds display_order column for custom sorting/ranking of items

-- Add display_order to kpis table
ALTER TABLE kpis 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order to locations table
ALTER TABLE locations 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Add display_order to beneficiary_groups table
ALTER TABLE beneficiary_groups 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Set initial display_order values based on created_at for existing records
-- This ensures existing items have a proper order
UPDATE kpis 
SET display_order = subquery.row_number
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY initiative_id ORDER BY created_at ASC) as row_number
    FROM kpis
) AS subquery
WHERE kpis.id = subquery.id;

UPDATE locations 
SET display_order = subquery.row_number
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY initiative_id ORDER BY created_at ASC) as row_number
    FROM locations
) AS subquery
WHERE locations.id = subquery.id;

UPDATE beneficiary_groups 
SET display_order = subquery.row_number
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY initiative_id ORDER BY created_at ASC) as row_number
    FROM beneficiary_groups
) AS subquery
WHERE beneficiary_groups.id = subquery.id;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpis_display_order ON kpis(initiative_id, display_order);
CREATE INDEX IF NOT EXISTS idx_locations_display_order ON locations(initiative_id, display_order);
CREATE INDEX IF NOT EXISTS idx_beneficiary_groups_display_order ON beneficiary_groups(initiative_id, display_order);

