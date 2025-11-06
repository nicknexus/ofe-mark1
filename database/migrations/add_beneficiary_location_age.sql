-- Add location_id, age range, and total_number fields to beneficiary_groups table
-- This migration adds:
-- 1. location_id (UUID) - mandatory location for each beneficiary group
-- 2. age_range_start (INTEGER) - optional minimum age
-- 3. age_range_end (INTEGER) - optional maximum age
-- 4. total_number (INTEGER) - total number of beneficiaries in the group

-- Step 1: Add columns (initially nullable for existing data)
ALTER TABLE beneficiary_groups 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE RESTRICT;

ALTER TABLE beneficiary_groups 
ADD COLUMN IF NOT EXISTS age_range_start INTEGER,
ADD COLUMN IF NOT EXISTS age_range_end INTEGER,
ADD COLUMN IF NOT EXISTS total_number INTEGER;

-- Step 2: Update existing rows - you may need to manually assign locations to existing beneficiary groups
-- For now, we'll leave them nullable, but new groups will require location_id
-- If you want to make it mandatory for existing rows too, run this after assigning locations:
-- ALTER TABLE beneficiary_groups ALTER COLUMN location_id SET NOT NULL;

-- Step 3: Create index for location_id for faster queries
CREATE INDEX IF NOT EXISTS idx_beneficiary_groups_location_id ON beneficiary_groups(location_id);

-- Step 4: Add constraint to ensure age_range_end >= age_range_start if both are provided
ALTER TABLE beneficiary_groups
DROP CONSTRAINT IF EXISTS check_age_range_valid;
ALTER TABLE beneficiary_groups
ADD CONSTRAINT check_age_range_valid 
CHECK (
    age_range_start IS NULL OR 
    age_range_end IS NULL OR 
    age_range_end >= age_range_start
);

-- Step 5: Add constraint to ensure total_number is positive if provided
ALTER TABLE beneficiary_groups
DROP CONSTRAINT IF EXISTS check_total_number_valid;
ALTER TABLE beneficiary_groups
ADD CONSTRAINT check_total_number_valid 
CHECK (
    total_number IS NULL OR 
    total_number >= 0
);

