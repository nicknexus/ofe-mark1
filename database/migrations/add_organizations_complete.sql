-- ============================================
-- ORGANIZATION SYSTEM MIGRATION
-- Run this SQL in Supabase SQL Editor
-- This is safe to run on existing tables (uses IF NOT EXISTS)
-- ============================================

-- Step 1: Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 2: Create user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Step 3: Add organization_id to initiatives (if it doesn't exist)
ALTER TABLE initiatives 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Step 4: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_public ON organizations(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_organization_id ON initiatives(organization_id);

-- Step 5: Add updated_at trigger for organizations (function should already exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at'
    ) THEN
        CREATE TRIGGER update_organizations_updated_at 
        BEFORE UPDATE ON organizations 
        FOR EACH ROW 
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Step 6: Update audit function to handle tables without user_id (like organizations)
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
        -- Tables with user_id column
        IF TG_OP = 'DELETE' THEN
            v_user_id := OLD.user_id;
        ELSE
            v_user_id := NEW.user_id;
        END IF;
    END IF;

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
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Step 6b: Add audit trigger for organizations
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'audit_organizations'
    ) THEN
        CREATE TRIGGER audit_organizations 
        AFTER INSERT OR UPDATE OR DELETE ON organizations 
        FOR EACH ROW 
        EXECUTE FUNCTION create_audit_log();
    END IF;
END $$;

-- Step 7: Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS Policies (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Organizations are viewable by everyone if public" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can update their own organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their own organization memberships" ON user_organizations;
DROP POLICY IF EXISTS "Users can create organization memberships" ON user_organizations;

CREATE POLICY "Organizations are viewable by everyone if public" ON organizations
    FOR SELECT
    USING (is_public = TRUE OR 
           EXISTS (
               SELECT 1 FROM user_organizations 
               WHERE user_organizations.organization_id = organizations.id 
               AND user_organizations.user_id = auth.uid()
           ));

CREATE POLICY "Users can create organizations" ON organizations
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Users can update their own organizations" ON organizations
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM user_organizations 
        WHERE user_organizations.organization_id = organizations.id 
        AND user_organizations.user_id = auth.uid()
        AND user_organizations.role IN ('owner', 'admin')
    ));

CREATE POLICY "Users can view their own organization memberships" ON user_organizations
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create organization memberships" ON user_organizations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Step 9: Migrate existing data (only if you have existing users/initiatives)
-- This creates organizations from existing user metadata and links everything

-- 9a: Create organizations from user metadata
INSERT INTO organizations (name, slug, is_public)
SELECT DISTINCT
    COALESCE((raw_user_meta_data->>'organization'), 'Default Organization ' || id::text) as name,
    LOWER(REPLACE(COALESCE((raw_user_meta_data->>'organization'), 'default-org-' || id::text), ' ', '-')) as slug,
    FALSE as is_public
FROM auth.users
WHERE NOT EXISTS (
    SELECT 1 FROM organizations o 
    WHERE o.name = COALESCE((raw_user_meta_data->>'organization'), 'Default Organization ' || id::text)
)
ON CONFLICT (slug) DO NOTHING;

-- 9b: Link users to organizations
INSERT INTO user_organizations (user_id, organization_id, role)
SELECT 
    u.id as user_id,
    o.id as organization_id,
    'owner' as role
FROM auth.users u
LEFT JOIN organizations o ON o.name = COALESCE((u.raw_user_meta_data->>'organization'), 'Default Organization ' || u.id::text)
WHERE o.id IS NOT NULL
ON CONFLICT (user_id, organization_id) DO NOTHING;

-- 9c: Link existing initiatives to organizations (via user_id -> organization_id)
UPDATE initiatives i
SET organization_id = uo.organization_id
FROM user_organizations uo
WHERE i.user_id = uo.user_id
AND i.organization_id IS NULL;

-- 9d: Handle any orphaned initiatives (create default org if needed)
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
        ELSE
            -- If org already exists, get its ID
            SELECT id INTO default_org_id FROM organizations WHERE slug = 'unassigned';
            IF default_org_id IS NOT NULL THEN
                UPDATE initiatives 
                SET organization_id = default_org_id
                WHERE organization_id IS NULL;
            END IF;
        END IF;
    END IF;
END $$;

-- Step 10: Add helpful comments
COMMENT ON TABLE organizations IS 'Organizations that users belong to and initiatives are associated with';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for public pages (e.g., charity-name)';
COMMENT ON COLUMN organizations.is_public IS 'Whether this organization is published and accessible via public URL';

-- ============================================
-- VERIFICATION (optional - run this to check)
-- ============================================
-- SELECT COUNT(*) as total_organizations FROM organizations;
-- SELECT COUNT(*) as total_user_orgs FROM user_organizations;
-- SELECT COUNT(*) as initiatives_with_org FROM initiatives WHERE organization_id IS NOT NULL;
-- SELECT COUNT(*) as initiatives_without_org FROM initiatives WHERE organization_id IS NULL;

