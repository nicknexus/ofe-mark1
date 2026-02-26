-- Migration: Add story_locations junction table
-- Description: Allows stories to be linked to multiple locations instead of single location_id

CREATE TABLE IF NOT EXISTS story_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(story_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_story_locations_story_id ON story_locations(story_id);
CREATE INDEX IF NOT EXISTS idx_story_locations_location_id ON story_locations(location_id);

ALTER TABLE story_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own story_locations"
    ON story_locations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own story_locations"
    ON story_locations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own story_locations"
    ON story_locations FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own story_locations"
    ON story_locations FOR DELETE
    USING (user_id = auth.uid());

-- Migrate existing location_id data to junction table
INSERT INTO story_locations (story_id, location_id, user_id)
SELECT id, location_id, user_id
FROM stories
WHERE location_id IS NOT NULL
ON CONFLICT (story_id, location_id) DO NOTHING;
