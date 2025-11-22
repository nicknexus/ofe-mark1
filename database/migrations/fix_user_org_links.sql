-- Fix users that are incorrectly linked to other users' organizations
-- This ensures each user only has their own organization
-- Run this in Supabase SQL Editor

-- Find users that don't have their own organization but are linked to someone else's
-- Remove incorrect user_organizations entries
DELETE FROM user_organizations uo
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.id = uo.organization_id 
    AND o.owner_id = uo.user_id
);

-- Create organizations for users that don't have one
INSERT INTO organizations (name, slug, is_public, owner_id)
SELECT 
    COALESCE((raw_user_meta_data->>'organization'), 'Organization ' || id::text) as name,
    LOWER(REPLACE(COALESCE((raw_user_meta_data->>'organization'), 'org-' || id::text), ' ', '-')) as slug,
    FALSE as is_public,
    id as owner_id
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o WHERE o.owner_id = u.id
)
ON CONFLICT (slug) DO UPDATE SET owner_id = EXCLUDED.owner_id;

-- Re-add users to their own organizations
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT o.owner_id, o.id, 'owner'
FROM organizations o
WHERE NOT EXISTS (
    SELECT 1 FROM user_organizations uo 
    WHERE uo.organization_id = o.id 
    AND uo.user_id = o.owner_id
);








