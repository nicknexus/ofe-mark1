-- Fix RLS Policy for Organizations
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Create a more permissive insert policy
-- This allows anyone to create organizations (backend uses service role key, but this ensures it works)
CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (true);

-- Also ensure the public search route can access public organizations
-- The SELECT policy should already handle this, but let's verify it exists
DROP POLICY IF EXISTS "Organizations are viewable by everyone if public" ON organizations;
CREATE POLICY "Organizations are viewable by everyone if public" ON organizations
    FOR SELECT
    USING (
        is_public = TRUE 
        OR 
        EXISTS (
            SELECT 1 FROM user_organizations 
            WHERE user_organizations.organization_id = organizations.id 
            AND user_organizations.user_id = auth.uid()
        )
        OR
        -- Allow service role (backend) to see all
        auth.role() = 'service_role'
    );






