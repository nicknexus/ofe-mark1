-- Migration: Add 'text' media type to stories
-- Date: 2025-01-27
-- Description: Updates the stories_media_type_check constraint to include 'text' as a valid media type

-- Drop any existing CHECK constraint on media_type column
-- This handles cases where PostgreSQL auto-generated a different constraint name
DO $$ 
DECLARE
    constraint_name_var TEXT;
BEGIN
    -- Find the constraint name for the CHECK constraint on media_type
    SELECT conname INTO constraint_name_var
    FROM pg_constraint
    WHERE conrelid = 'stories'::regclass
    AND contype = 'c'
    AND conname LIKE '%media_type%'
    LIMIT 1;
    
    -- Drop the constraint if found
    IF constraint_name_var IS NOT NULL THEN
        EXECUTE 'ALTER TABLE stories DROP CONSTRAINT ' || quote_ident(constraint_name_var);
    END IF;
END $$;

-- Add the updated check constraint that includes 'text'
ALTER TABLE stories ADD CONSTRAINT stories_media_type_check 
    CHECK (media_type IN ('photo', 'video', 'recording', 'text'));

-- Update comment for documentation
COMMENT ON COLUMN stories.media_type IS 'Type of media: photo, video, recording, or text. Text stories do not require a media_url.';

