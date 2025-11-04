-- Add trigger to delete organizations when all users are removed
-- Run this in Supabase SQL Editor

-- Create function to clean up orphaned organizations
CREATE OR REPLACE FUNCTION cleanup_orphaned_organizations()
RETURNS TRIGGER AS $$
BEGIN
    -- After deleting a user_organizations entry, check if organization has any members left
    -- If not, delete the organization
    DELETE FROM organizations
    WHERE id = OLD.organization_id
    AND NOT EXISTS (
        SELECT 1 FROM user_organizations 
        WHERE organization_id = OLD.organization_id
    );
    
    RETURN OLD;
END;
$$ language 'plpgsql';

-- Create trigger on user_organizations delete
DROP TRIGGER IF EXISTS cleanup_organizations_on_user_delete ON user_organizations;

CREATE TRIGGER cleanup_organizations_on_user_delete
AFTER DELETE ON user_organizations
FOR EACH ROW
EXECUTE FUNCTION cleanup_orphaned_organizations();

