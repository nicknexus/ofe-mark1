-- Migration: Add display_order column to initiatives table
-- Description: Lets each org reorder its own initiatives via drag-and-drop.
--   Order is reflected on both the private dashboard and the public org page.

ALTER TABLE initiatives
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Backfill: existing initiatives get sequential ordering by creation date,
-- partitioned per organization so each org has a clean 1..N sequence.
UPDATE initiatives
SET display_order = sub.row_number
FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at ASC) AS row_number
    FROM initiatives
) AS sub
WHERE initiatives.id = sub.id;

-- Composite index for fast org-scoped sorted queries.
CREATE INDEX IF NOT EXISTS idx_initiatives_display_order
    ON initiatives(organization_id, display_order);
