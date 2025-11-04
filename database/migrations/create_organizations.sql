-- Migration: Create Organizations Table
-- Date: 2025-01-XX
-- Description: Creates organizations table and links users and initiatives to organizations

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add organization_id to users (via auth.users metadata or create user_organizations table)
-- Since we can't directly modify auth.users, we'll create a user_organizations junction table
CREATE TABLE IF NOT EXISTS user_organizations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, organization_id)
);

-- Add organization_id to initiatives
ALTER TABLE initiatives 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_is_public ON organizations(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_org_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_initiatives_organization_id ON initiatives(organization_id);

-- Add updated_at trigger for organizations
CREATE TRIGGER update_organizations_updated_at 
BEFORE UPDATE ON organizations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add audit trigger for organizations
CREATE TRIGGER audit_organizations 
AFTER INSERT OR UPDATE OR DELETE ON organizations 
FOR EACH ROW 
EXECUTE FUNCTION create_audit_log();

-- Row Level Security for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_organizations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations (public read if is_public = true, full access for members)
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

-- RLS Policies for user_organizations
CREATE POLICY "Users can view their own organization memberships" ON user_organizations
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create organization memberships" ON user_organizations
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Comments
COMMENT ON TABLE organizations IS 'Organizations that users belong to and initiatives are associated with';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier for public pages (e.g., charity-name)';
COMMENT ON COLUMN organizations.is_public IS 'Whether this organization is published and accessible via public URL';

