-- Add slug and is_public columns to initiatives table if they don't exist
-- Run this in Supabase SQL Editor

-- Add slug column if it doesn't exist
ALTER TABLE initiatives 
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- Add is_public column if it doesn't exist
ALTER TABLE initiatives 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create index for slug lookups
CREATE INDEX IF NOT EXISTS idx_initiatives_slug ON initiatives(slug);

-- Generate slugs for existing initiatives that don't have one
-- Use regexp_replace to handle special characters properly
UPDATE initiatives 
SET slug = LOWER(
    REGEXP_REPLACE(
        REGEXP_REPLACE(
            REGEXP_REPLACE(title, '[^a-z0-9\s-]', '', 'gi'),
            '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
    )
)
WHERE slug IS NULL OR slug = '';

-- Handle any remaining null slugs (shouldn't happen but just in case)
UPDATE initiatives 
SET slug = 'initiative-' || id::text
WHERE slug IS NULL OR slug = '';


