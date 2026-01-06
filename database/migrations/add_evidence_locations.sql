-- Migration: Add evidence_locations junction table
-- Description: Allows evidence to be linked to multiple locations instead of single location_id

-- Create evidence_locations junction table
CREATE TABLE IF NOT EXISTS evidence_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(evidence_id, location_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_evidence_locations_evidence_id ON evidence_locations(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_locations_location_id ON evidence_locations(location_id);

-- Enable RLS
ALTER TABLE evidence_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own evidence_locations"
    ON evidence_locations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own evidence_locations"
    ON evidence_locations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own evidence_locations"
    ON evidence_locations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own evidence_locations"
    ON evidence_locations FOR DELETE
    USING (user_id = auth.uid());

-- Migrate existing location_id data to junction table
-- This will create entries in evidence_locations for any evidence that has a location_id set
INSERT INTO evidence_locations (evidence_id, location_id, user_id)
SELECT id, location_id, user_id
FROM evidence
WHERE location_id IS NOT NULL
ON CONFLICT (evidence_id, location_id) DO NOTHING;

-- Note: We keep the location_id column on evidence table for backward compatibility
-- It can be removed in a future migration after verifying the junction table works correctly




