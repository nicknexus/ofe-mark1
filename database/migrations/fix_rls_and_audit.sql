-- Fix RLS and audit log to work with service role
-- Run this in Supabase SQL Editor

-- Update audit trigger to handle service role (auth.uid() is NULL)
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- For tables without user_id (like organizations), use auth.uid()
    -- For tables with user_id, use the record's user_id
    IF TG_TABLE_NAME = 'organizations' OR TG_TABLE_NAME = 'user_organizations' THEN
        v_user_id := auth.uid();
    ELSE
        -- Tables with user_id column - use the record's user_id
        IF TG_OP = 'DELETE' THEN
            v_user_id := OLD.user_id;
        ELSE
            v_user_id := NEW.user_id;
        END IF;
    END IF;

    -- Only insert audit log if user_id is not NULL
    -- When using service role, auth.uid() is NULL, so we skip audit logging for orgs
    -- But for initiatives/etc, we use NEW.user_id which should exist
    IF v_user_id IS NOT NULL THEN
        IF TG_OP = 'DELETE' THEN
            INSERT INTO audit_log(table_name, record_id, action, old_values, user_id)
            VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), v_user_id);
            RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
            INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, user_id)
            VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), v_user_id);
            RETURN NEW;
        ELSIF TG_OP = 'INSERT' THEN
            INSERT INTO audit_log(table_name, record_id, action, new_values, user_id)
            VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), v_user_id);
            RETURN NEW;
        END IF;
    ELSE
        -- If user_id is NULL (service role for orgs), skip audit log
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Drop existing initiative policies
DROP POLICY IF EXISTS "Users can view their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can insert their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can update their own initiatives" ON initiatives;
DROP POLICY IF EXISTS "Users can delete their own initiatives" ON initiatives;

-- Recreate policies - allow if user_id matches OR if auth.uid() is NULL (service role context)
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

-- Fix organization policies
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

-- Fix audit_log RLS to allow inserts from service role (backend)
-- Drop existing audit_log policies
DROP POLICY IF EXISTS "Users can view their own audit logs" ON audit_log;

-- Recreate SELECT policy
CREATE POLICY "Users can view their own audit logs" ON audit_log 
    FOR SELECT 
    USING (auth.uid() = user_id OR auth.uid() IS NULL OR user_id IS NULL);

-- Add INSERT policy to allow service role and triggers
CREATE POLICY "Service role can insert audit logs" ON audit_log
    FOR INSERT
    WITH CHECK (auth.uid() IS NULL OR auth.uid() = user_id OR user_id IS NULL);

