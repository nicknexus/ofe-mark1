-- Allow duplicate organization names and slugs
-- Organizations are identified by their UUID, not by name or slug
-- Multiple organizations can legitimately have the same or similar names

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_name_key;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_slug_key;

-- Verify the constraints were dropped
-- SELECT constraint_name FROM information_schema.table_constraints 
-- WHERE table_name = 'organizations' AND constraint_type = 'UNIQUE';
