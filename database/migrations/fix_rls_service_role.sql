-- Fix RLS policies - service role key should bypass RLS, but if policies check auth.uid() when it's NULL, it might fail
-- Instead, we'll make policies more permissive for backend operations
-- Run this in Supabase SQL Editor

-- Drop existing initiative policies
DROP POLICY IF EXISTS "Users can view their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can insert their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can update their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can delete their own initiatives" ON initiatives;

-- Recreate policies - allow if user_id matches OR if auth.uid() is NULL (service role context)
-- In service role context, auth.uid() returns NULL, so we check for that
CREATE POLICY "Users can view their own initiatives" ON initiatives 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can insert their own initiatives" ON initiatives 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can update their own initiatives" ON initiatives 
    FOR UPDATE 
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Users can delete their own initiatives" ON initiatives 
    FOR DELETE 
    USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- Fix organization policies similarly
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Organizations are viewable by everyone if public" ON organizations;

CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT
    USING (
        auth.uid() IS NULL OR  -- Service role
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

CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (auth.uid() IS NULL OR owner_id = auth.uid());

CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE
    USING (
        auth.uid() IS NULL OR  -- Service role
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_organizations 
            WHERE user_organizations.organization_id = organizations.id 
            AND user_organizations.user_id = auth.uid()
            AND user_organizations.role IN ('owner', 'admin')
        )
    );

