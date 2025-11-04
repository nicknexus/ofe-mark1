-- Fix organization INSERT policy to allow service role (backend) inserts
-- This restores the permissive policy that was working before
-- Run this in Supabase SQL Editor

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Create the permissive INSERT policy that allows all inserts
-- The backend uses service role key which should bypass RLS, but this ensures it works
CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (true);


