-- Make organizations belong to a single user (owner)
-- Run this in Supabase SQL Editor

-- Step 1: Add owner_id column to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Set owner_id for existing organizations (use first user in user_organizations)
UPDATE organizations o
SET owner_id = (
    SELECT uo.user_id 
    FROM user_organizations uo 
    WHERE uo.organization_id = o.id 
    AND uo.role = 'owner'
    LIMIT 1
);

-- Step 3: If no owner found, use any member
UPDATE organizations o
SET owner_id = (
    SELECT uo.user_id 
    FROM user_organizations uo 
    WHERE uo.organization_id = o.id 
    LIMIT 1
)
WHERE owner_id IS NULL;

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON organizations(owner_id);

-- Step 5: Drop the multi-user cleanup trigger (not needed anymore)
DROP TRIGGER IF EXISTS cleanup_organizations_on_user_delete ON user_organizations;
DROP FUNCTION IF EXISTS cleanup_orphaned_organizations();

-- Step 6: Update RLS policy to check owner_id instead of user_organizations
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;

CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT
    USING (
        is_public = TRUE 
        OR 
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_organizations 
            WHERE user_organizations.organization_id = organizations.id 
            AND user_organizations.user_id = auth.uid()
        )
    );

-- Step 7: Update insert policy to require owner_id
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- Step 8: Update update policy to check owner_id
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;

CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE
    USING (
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_organizations 
            WHERE user_organizations.organization_id = organizations.id 
            AND user_organizations.user_id = auth.uid()
            AND user_organizations.role IN ('owner', 'admin')
        )
    );









