-- Migration: Tags attach to the metric, not to the metric-in-an-initiative
-- Date: 2026-08-03
-- Depends on: make_metrics_global.sql
--
-- Tags become a property of the org-global metric, so tagging "Meals Provided"
-- with #nutrition tags it in every initiative at once.
--
-- ADDITIVE / DUAL-WRITE. `metric_definition_tags` becomes the source of truth
-- for writes, but the application keeps mirroring every change down into
-- `kpi_metric_tags`. That table therefore stays correct and every existing
-- reader of it — claim tag validation, the public payloads, TagsWidget,
-- tag detail pages — keeps working untouched, including code already deployed
-- to production. `kpi_metric_tags` can be dropped later as cleanup; nothing
-- requires it.

BEGIN;

CREATE TABLE IF NOT EXISTS metric_definition_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    definition_id UUID NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metric_tags(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (definition_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_metric_definition_tags_definition_id ON metric_definition_tags(definition_id);
CREATE INDEX IF NOT EXISTS idx_metric_definition_tags_tag_id ON metric_definition_tags(tag_id);

-- Roll existing per-instance tags up to the definition. The phase 1 backfill
-- is strictly 1:1 (one definition per pre-existing kpi), so this is lossless —
-- no two instances can disagree about their tag set yet.
INSERT INTO metric_definition_tags (definition_id, tag_id, display_order)
SELECT DISTINCT ON (k.definition_id, kmt.tag_id)
       k.definition_id, kmt.tag_id, COALESCE(kmt.display_order, 0)
FROM kpi_metric_tags kmt
JOIN kpis k ON k.id = kmt.kpi_id
WHERE k.definition_id IS NOT NULL
ORDER BY k.definition_id, kmt.tag_id, COALESCE(kmt.display_order, 0)
ON CONFLICT (definition_id, tag_id) DO NOTHING;

ALTER TABLE metric_definition_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can manage metric definition tags" ON metric_definition_tags;
CREATE POLICY "Org members can manage metric definition tags"
    ON metric_definition_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM metric_definitions md
            JOIN organizations o ON o.id = md.organization_id
            WHERE md.id = metric_definition_tags.definition_id
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

COMMENT ON TABLE metric_definition_tags IS 'Tags on the org-global metric. Source of truth; mirrored into kpi_metric_tags by MetricTagService so existing readers keep working.';

NOTIFY pgrst, 'reload schema';

COMMIT;
