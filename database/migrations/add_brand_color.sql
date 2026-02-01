-- Add brand_color column to organizations table
-- This allows organizations to customize their public page appearance

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS brand_color TEXT DEFAULT '#c0dfa1';

-- Comment for documentation
COMMENT ON COLUMN organizations.brand_color IS 'Hex color code for organization brand color used on public pages';

-- Notify completion
DO $$ BEGIN RAISE NOTICE 'brand_color column added to organizations table'; END $$;
