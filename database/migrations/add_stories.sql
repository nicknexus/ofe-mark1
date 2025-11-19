-- Migration: Add Stories Table
-- Date: 2025-01-27
-- Description: Creates stories table for showcasing impacts with photos/videos/recordings
-- Stories can be linked to locations and beneficiary groups for filtering

-- Drop tables if they exist (to start fresh) - this will cascade and remove policies/triggers
DROP TABLE IF EXISTS story_beneficiaries CASCADE;
DROP TABLE IF EXISTS stories CASCADE;

-- Create stories table
CREATE TABLE stories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    media_url TEXT, -- URL to photo/video/recording file (optional)
    media_type VARCHAR(20) NOT NULL CHECK (media_type IN ('photo', 'video', 'recording')),
    date_represented DATE NOT NULL, -- Mandatory date for filtering
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL, -- Optional location link
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create junction table for many-to-many relationship between stories and beneficiary groups
CREATE TABLE story_beneficiaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
    beneficiary_group_id UUID NOT NULL REFERENCES beneficiary_groups(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(story_id, beneficiary_group_id) -- Prevent duplicate links
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stories_initiative_id ON stories(initiative_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_location_id ON stories(location_id);
CREATE INDEX IF NOT EXISTS idx_stories_date_represented ON stories(date_represented);
CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at);
CREATE INDEX IF NOT EXISTS idx_story_beneficiaries_story_id ON story_beneficiaries(story_id);
CREATE INDEX IF NOT EXISTS idx_story_beneficiaries_beneficiary_group_id ON story_beneficiaries(beneficiary_group_id);

-- Add updated_at trigger for stories table
CREATE TRIGGER update_stories_updated_at 
BEFORE UPDATE ON stories 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_beneficiaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stories table
CREATE POLICY "Users can view their own stories"
    ON stories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stories"
    ON stories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stories"
    ON stories FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories"
    ON stories FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for story_beneficiaries table
-- Users can only manage story_beneficiaries for stories they own
CREATE POLICY "Users can view story beneficiaries"
    ON story_beneficiaries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM stories 
            WHERE stories.id = story_beneficiaries.story_id 
            AND stories.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert story beneficiaries"
    ON story_beneficiaries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM stories 
            WHERE stories.id = story_beneficiaries.story_id 
            AND stories.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete story beneficiaries"
    ON story_beneficiaries FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM stories 
            WHERE stories.id = story_beneficiaries.story_id 
            AND stories.user_id = auth.uid()
        )
    );

-- Add comment for documentation
COMMENT ON TABLE stories IS 'Stories showcase impacts with photos/videos/recordings. Each story has a mandatory date and optional links to locations and beneficiary groups for filtering.';
COMMENT ON TABLE story_beneficiaries IS 'Junction table linking stories to beneficiary groups (many-to-many relationship).';

