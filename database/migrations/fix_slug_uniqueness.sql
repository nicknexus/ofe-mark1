-- Fix slug uniqueness constraints for public URLs
-- Run this in Supabase SQL Editor

-- ============================================
-- PART 1: Organization slugs - must be globally unique
-- ============================================

-- First, find and fix any duplicate org slugs
DO $$
DECLARE
    dup_record RECORD;
    counter INTEGER;
BEGIN
    -- Find organizations with duplicate slugs
    FOR dup_record IN 
        SELECT slug, array_agg(id ORDER BY created_at) as ids
        FROM organizations 
        WHERE slug IS NOT NULL
        GROUP BY slug 
        HAVING COUNT(*) > 1
    LOOP
        counter := 1;
        -- Skip the first one (oldest), rename the rest
        FOR i IN 2..array_length(dup_record.ids, 1)
        LOOP
            UPDATE organizations 
            SET slug = dup_record.slug || '-' || counter
            WHERE id = dup_record.ids[i];
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Now add the unique constraint on organization slugs
ALTER TABLE organizations 
DROP CONSTRAINT IF EXISTS organizations_slug_unique;

ALTER TABLE organizations 
ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);

-- ============================================
-- PART 2: Initiative slugs - unique per organization (not globally)
-- ============================================

-- First, find and fix any duplicate slugs within the same organization
DO $$
DECLARE
    dup_record RECORD;
    counter INTEGER;
BEGIN
    -- Find initiatives with duplicate slugs within the same org
    FOR dup_record IN 
        SELECT organization_id, slug, array_agg(id ORDER BY created_at) as ids
        FROM initiatives 
        WHERE slug IS NOT NULL AND organization_id IS NOT NULL
        GROUP BY organization_id, slug 
        HAVING COUNT(*) > 1
    LOOP
        counter := 1;
        -- Skip the first one (oldest), rename the rest
        FOR i IN 2..array_length(dup_record.ids, 1)
        LOOP
            UPDATE initiatives 
            SET slug = dup_record.slug || '-' || counter
            WHERE id = dup_record.ids[i];
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Drop any existing global unique constraint on initiative slugs (if it exists)
ALTER TABLE initiatives 
DROP CONSTRAINT IF EXISTS initiatives_slug_key;

ALTER TABLE initiatives 
DROP CONSTRAINT IF EXISTS initiatives_slug_unique;

-- Add composite unique constraint: slug must be unique within each organization
ALTER TABLE initiatives 
DROP CONSTRAINT IF EXISTS initiatives_org_slug_unique;

ALTER TABLE initiatives 
ADD CONSTRAINT initiatives_org_slug_unique UNIQUE (organization_id, slug);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check org slugs are unique
DO $$
BEGIN
    IF EXISTS (
        SELECT slug FROM organizations 
        WHERE slug IS NOT NULL
        GROUP BY slug HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate organization slugs still exist!';
    END IF;
END $$;

-- Check initiative slugs are unique per org
DO $$
BEGIN
    IF EXISTS (
        SELECT organization_id, slug FROM initiatives 
        WHERE slug IS NOT NULL AND organization_id IS NOT NULL
        GROUP BY organization_id, slug HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate initiative slugs within organizations still exist!';
    END IF;
END $$;

-- Success message
DO $$ BEGIN RAISE NOTICE 'Slug uniqueness constraints applied successfully!'; END $$;
