-- Junction table linking evidence to beneficiary groups (many-to-many)
-- Mirrors the pattern used by story_beneficiaries

CREATE TABLE IF NOT EXISTS evidence_beneficiary_groups (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    beneficiary_group_id UUID NOT NULL REFERENCES beneficiary_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evidence_id, beneficiary_group_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_beneficiary_groups_evidence_id ON evidence_beneficiary_groups(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_beneficiary_groups_bg_id ON evidence_beneficiary_groups(beneficiary_group_id);

ALTER TABLE evidence_beneficiary_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence beneficiary groups"
    ON evidence_beneficiary_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evidence
            WHERE evidence.id = evidence_beneficiary_groups.evidence_id
            AND evidence.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert evidence beneficiary groups"
    ON evidence_beneficiary_groups FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM evidence
            WHERE evidence.id = evidence_beneficiary_groups.evidence_id
            AND evidence.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete evidence beneficiary groups"
    ON evidence_beneficiary_groups FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM evidence
            WHERE evidence.id = evidence_beneficiary_groups.evidence_id
            AND evidence.user_id = auth.uid()
        )
    );

-- Public read access for public initiatives
CREATE POLICY "Public can view evidence_beneficiary_groups of public initiatives"
    ON evidence_beneficiary_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evidence e
            WHERE e.id = evidence_beneficiary_groups.evidence_id
            AND is_initiative_public(e.initiative_id)
        )
    );

COMMENT ON TABLE evidence_beneficiary_groups IS 'Junction table linking evidence to beneficiary groups (many-to-many relationship).';
