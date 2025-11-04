-- Fix RLS policies to allow service role (backend) to bypass checks
-- Run this in Supabase SQL Editor

-- Drop existing initiative policies
DROP POLICY IF EXISTS "Users can view their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can insert their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can update their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can delete their own initiatives" ON initiatives;

-- Recreate with service role bypass
CREATE POLICY "Users can view their own initiatives" ON initiatives 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can insert their own initiatives" ON initiatives 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can update their own initiatives" ON initiatives 
    FOR UPDATE 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Users can delete their own initiatives" ON initiatives 
    FOR DELETE 
    USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Fix organization policies to allow service role
DROP POLICY IF EXISTS "Users can view their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;

CREATE POLICY "Users can view their own organizations" ON organizations
    FOR SELECT
    USING (
        auth.role() = 'service_role' OR
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
    WITH CHECK (auth.role() = 'service_role' OR owner_id = auth.uid());

CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE
    USING (
        auth.role() = 'service_role' OR
        owner_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM user_organizations 
            WHERE user_organizations.organization_id = organizations.id 
            AND user_organizations.user_id = auth.uid()
            AND user_organizations.role IN ('owner', 'admin')
        )
    );

