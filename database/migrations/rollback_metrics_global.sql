-- ROLLBACK for make_metrics_global.sql + move_metric_tags_to_definitions.sql
-- Date: 2026-08-03
--
-- Returns the schema to exactly its pre-migration shape.
--
-- ORDER MATTERS: revert the application code FIRST. The new backend selects
-- kpis.definition_id and filters on kpis.archived_at — drop those columns
-- while the new code is live and every metrics query starts failing.
--
-- WHAT SURVIVES: every kpis row, every impact claim, every evidence link, and
-- all tags. Tags are safe because the migration dual-wrote them — kpi_metric_tags
-- was kept authoritative-compatible throughout, so dropping the definition-level
-- table loses nothing. Metrics added to an initiative via "Add existing" stay as
-- ordinary independent metrics with their claims intact. Renames already
-- mirrored down onto kpis and persist.
--
-- WHAT IS LOST: metrics created on /metrics that were never attached to an
-- initiative. Those exist only as metric_definitions rows with no kpis row
-- behind them, so this drops them for good. Archive state is also lost —
-- anything archived out of an initiative becomes visible again (its claims
-- were never deleted, so nothing is destroyed, it just reappears).
--
-- Run before using the new UI and this is completely lossless.

BEGIN;

-- 1. Triggers and the sync function first, so nothing fires mid-teardown.
DROP TRIGGER IF EXISTS sync_kpis_from_definition_trigger ON metric_definitions;
DROP TRIGGER IF EXISTS update_metric_definitions_updated_at ON metric_definitions;
DROP FUNCTION IF EXISTS sync_kpis_from_definition();

-- 2. Columns on kpis. Dropping these also drops the indexes that depend on
-- them (idx_kpis_definition_id, idx_kpis_archived_at,
-- idx_kpis_definition_initiative) and the FK to metric_definitions.
-- The kpis rows themselves are untouched.
ALTER TABLE kpis DROP COLUMN IF EXISTS definition_id;
ALTER TABLE kpis DROP COLUMN IF EXISTS archived_at;

-- 3. The definition-level tables. metric_definition_tags first (it references
-- metric_definitions). kpi_metric_tags is NOT touched — it still holds every
-- tag link, which is why tags survive this rollback.
DROP TABLE IF EXISTS metric_definition_tags;
DROP TABLE IF EXISTS metric_definitions;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Not reversed: the audit_log rows the backfill wrote (one per metric).
-- Harmless history. To clear them anyway, inspect before deleting:
--   SELECT id, record_id, created_at FROM audit_log
--   WHERE table_name = 'kpis' AND action = 'UPDATE'
--     AND created_at BETWEEN '<migration start>' AND '<migration end>';
