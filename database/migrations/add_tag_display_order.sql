-- Add display_order to metric_tags (org-wide order) and kpi_metric_tags
-- (per-metric override). Both columns are additive and have safe defaults so
-- the existing app keeps working until backend/frontend pick them up.
--
-- Rollback:
--   ALTER TABLE metric_tags DROP COLUMN display_order;
--   ALTER TABLE kpi_metric_tags DROP COLUMN display_order;

BEGIN;

-- ─── Org-wide tag order ──────────────────────────────────────────────────
ALTER TABLE metric_tags
    ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

-- Backfill: oldest first per organization, so existing users see the same
-- list they're used to (just numbered now).
WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY organization_id ORDER BY created_at) AS rn
    FROM metric_tags
)
UPDATE metric_tags mt
SET display_order = ranked.rn
FROM ranked
WHERE mt.id = ranked.id;

CREATE INDEX IF NOT EXISTS idx_metric_tags_org_order
    ON metric_tags(organization_id, display_order);

-- ─── Per-metric tag order (overrides org order on a single metric) ───────
ALTER TABLE kpi_metric_tags
    ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0;

-- Backfill: each kpi's tags get an initial order matching the global order
-- so users don't see surprising reshuffles.
WITH ranked AS (
    SELECT km.kpi_id, km.tag_id,
           ROW_NUMBER() OVER (
             PARTITION BY km.kpi_id
             ORDER BY mt.display_order, mt.created_at
           ) AS rn
    FROM kpi_metric_tags km
    JOIN metric_tags mt ON mt.id = km.tag_id
)
UPDATE kpi_metric_tags k
SET display_order = ranked.rn
FROM ranked
WHERE k.kpi_id = ranked.kpi_id
  AND k.tag_id = ranked.tag_id;

CREATE INDEX IF NOT EXISTS idx_kpi_metric_tags_kpi_order
    ON kpi_metric_tags(kpi_id, display_order);

COMMENT ON COLUMN metric_tags.display_order IS 'Org-wide order for tag pickers, list views, and dashboard.';
COMMENT ON COLUMN kpi_metric_tags.display_order IS 'Per-metric override order for the tag breakdown strip.';

NOTIFY pgrst, 'reload schema';

COMMIT;
