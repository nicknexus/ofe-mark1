-- Add logo_url column to organizations table
-- Run this in Supabase SQL Editor

-- Add the column
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add comment
COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo image stored in Supabase Storage';

-- Success message
DO $$ BEGIN RAISE NOTICE 'logo_url column added to organizations table'; END $$;
