-- Migration: Migrate Existing Data to Organizations
-- Run this AFTER create_organizations.sql if you have existing users/initiatives
-- Date: 2025-01-XX

-- Step 1: Create organizations from existing user metadata
-- This creates organizations for users who have organization names in their metadata
INSERT INTO organizations (name, slug, is_public)
SELECT DISTINCT
    COALESCE((raw_user_meta_data->>'organization'), 'Default Organization ' || user_id::text) as name,
    LOWER(REPLACE(COALESCE((raw_user_meta_data->>'organization'), 'default-org-' || user_id::text), ' ', '-')) as slug,
    FALSE as is_public
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.name = COALESCE((raw_user_meta_data->>'organization'), 'Default Organization ' || user_id::text)
)
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

-- Step 2: Link users to organizations
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT 
    u.id as user_id,
    o.id as organization_id,
    'owner' as role
FROM auth.users u
LEFT JOIN organizations o ON o.name = COALESCE((u.raw_user_meta_data->>'organization'), 'Default Organization ' || u.id::text)
WHERE o.id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- Step 3: Link existing initiatives to organizations (via user_id -> organization_id)
UPDATE initiatives i
SET organization_id = uo.organization_id
FROM user_organizations uo
WHERE i.user_id = uo.user_id
AND i.organization_id IS NULL;

-- Step 4: Handle any orphaned initiatives (create default org if needed)
-- If there are initiatives without users or users without orgs, create default org
DO $$
DECLARE
    default_org_id UUID;
BEGIN
    -- Create a default organization if there are orphaned initiatives
    IF EXISTS (SELECT 1 FROM initiatives WHERE organization_id IS NULL) THEN
        INSERT INTO organizations (name, slug, is_public)
        VALUES ('Unassigned Organization', 'unassigned', FALSE)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id INTO default_org_id;
        
        -- If default org was created, assign orphaned initiatives
        IF default_org_id IS NOT NULL THEN
            UPDATE initiatives 
            SET organization_id = default_org_id
            WHERE organization_id IS NULL;
        END IF;
    END IF;
END $$;









