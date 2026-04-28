-- Evidence ↔ Metric Tags v1
-- Lets evidence be tagged with one or more metric tags. Independent of the
-- evidence ↔ claim support graph: tags are a discovery/filter dimension, not
-- a coverage signal.
--
-- Cascade behavior:
--   - Tag deleted → links removed automatically.
--   - Evidence deleted → links removed automatically.
--   - Tag removed from a metric (kpi_metric_tags row deleted) → evidence stays
--     tagged. Independent of metric->tag links by design.

CREATE TABLE IF NOT EXISTS evidence_metric_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metric_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (evidence_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_metric_tags_evidence_id ON evidence_metric_tags(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_metric_tags_tag_id ON evidence_metric_tags(tag_id);

ALTER TABLE evidence_metric_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage evidence_metric_tags"
    ON evidence_metric_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM evidence e
            JOIN initiatives i ON i.id = e.initiative_id
            JOIN organizations o ON o.id = i.organization_id
            WHERE e.id = evidence_metric_tags.evidence_id
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

COMMENT ON TABLE evidence_metric_tags IS 'M2M link: which tags are attached to which evidence. Multi-tag.';

NOTIFY pgrst, 'reload schema';
