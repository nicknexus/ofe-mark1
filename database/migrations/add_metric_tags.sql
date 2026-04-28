-- Metric Tags v1
-- Org-global tags that can be attached to KPIs (multi) and KPI updates (single).
-- Additive: only adds new tables, no changes to existing tables.
--
-- Cascade behavior:
--   - Deleting a tag drops all kpi/claim links automatically.
--   - Removing a tag from a metric (kpi_metric_tags row delete) does NOT
--     cascade to claims at the DB level. The application layer handles that:
--     when a metric's tag links change, kpi_update_metric_tags rows pointing
--     to tags no longer attached to the parent metric are deleted.

CREATE TABLE IF NOT EXISTS metric_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    -- Reserved columns for future iterations (color, grouping, public exposure).
    -- Kept nullable / optional so v1 ignores them and v2 can light them up.
    color TEXT,
    parent_id UUID REFERENCES metric_tags(id) ON DELETE SET NULL,
    is_public BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Case-insensitive uniqueness within an org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_metric_tags_org_name_unique
    ON metric_tags(organization_id, lower(name));

CREATE INDEX IF NOT EXISTS idx_metric_tags_org_id ON metric_tags(organization_id);

-- KPI <-> tag (many-to-many).
CREATE TABLE IF NOT EXISTS kpi_metric_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metric_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (kpi_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_metric_tags_kpi_id ON kpi_metric_tags(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_metric_tags_tag_id ON kpi_metric_tags(tag_id);

-- KPI update <-> tag. Single-tag constraint enforced via UNIQUE (kpi_update_id).
CREATE TABLE IF NOT EXISTS kpi_update_metric_tags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kpi_update_id UUID NOT NULL REFERENCES kpi_updates(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES metric_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (kpi_update_id)
);

CREATE INDEX IF NOT EXISTS idx_kpi_update_metric_tags_update_id ON kpi_update_metric_tags(kpi_update_id);
CREATE INDEX IF NOT EXISTS idx_kpi_update_metric_tags_tag_id ON kpi_update_metric_tags(tag_id);

-- RLS. Backend uses the service role and bypasses these. Policies are in
-- place so the schema is sensible if/when frontend hits Supabase directly.
ALTER TABLE metric_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_metric_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_update_metric_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view metric tags"
    ON metric_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = metric_tags.organization_id
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

CREATE POLICY "Org members can manage metric tags"
    ON metric_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM organizations o
            WHERE o.id = metric_tags.organization_id
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

CREATE POLICY "Org members can manage kpi_metric_tags"
    ON kpi_metric_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kpis k
            JOIN initiatives i ON i.id = k.initiative_id
            JOIN organizations o ON o.id = i.organization_id
            WHERE k.id = kpi_metric_tags.kpi_id
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

CREATE POLICY "Org members can manage kpi_update_metric_tags"
    ON kpi_update_metric_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM kpi_updates u
            JOIN kpis k ON k.id = u.kpi_id
            JOIN initiatives i ON i.id = k.initiative_id
            JOIN organizations o ON o.id = i.organization_id
            WHERE u.id = kpi_update_metric_tags.kpi_update_id
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

COMMENT ON TABLE metric_tags IS 'Org-global tags (sub-metrics) attachable to KPIs and KPI updates.';
COMMENT ON TABLE kpi_metric_tags IS 'M2M link: which tags are available on which KPIs.';
COMMENT ON TABLE kpi_update_metric_tags IS 'M2M link constrained to single tag per claim (UNIQUE on kpi_update_id).';
