-- Fix organization INSERT policy - MUST RUN THIS
-- The service role key should bypass RLS, but this ensures the policy allows inserts
-- Run this in Supabase SQL Editor

-- First, check if there are multiple policies (drop all)
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Service role can create organizations" ON organizations;
DROP POLICY IF EXISTS "Anyone can create organizations" ON organizations;

-- Create a single permissive INSERT policy
CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (true);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'organizations' AND cmd = 'INSERT';

