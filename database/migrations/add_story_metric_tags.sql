-- Stories ↔ Metric Tags v1
-- Lets stories be tagged with one or more metric tags. Independent of any
-- existing story relationships (locations, beneficiary groups, initiatives).
-- Tags are a discovery/filter dimension, not a coverage signal.
--
-- Cascade behavior:
--   - Tag deleted → links removed automatically.
--   - Story deleted → links removed automatically.

CREATE TABLE IF NOT EXISTS story_metric_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metric_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (story_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_story_metric_tags_story_id ON story_metric_tags(story_id);
CREATE INDEX IF NOT EXISTS idx_story_metric_tags_tag_id ON story_metric_tags(tag_id);

ALTER TABLE story_metric_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage story_metric_tags"
    ON story_metric_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM stories s
            JOIN initiatives i ON i.id = s.initiative_id
            JOIN organizations o ON o.id = i.organization_id
            WHERE s.id = story_metric_tags.story_id
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

COMMENT ON TABLE story_metric_tags IS 'M2M link: which tags are attached to which stories. Multi-tag.';

NOTIFY pgrst, 'reload schema';
