-- Migration: Add Locations Table and Link to KPI Updates and Evidence
-- Date: 2025-01-22
-- Description: Creates locations table and adds location_id foreign keys to kpi_updates and evidence tables

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own locations" ON locations;
DROP POLICY IF EXISTS "Users can insert their own locations" ON locations;
DROP POLICY IF EXISTS "Users can update their own locations" ON locations;
DROP POLICY IF EXISTS "Users can delete their own locations" ON locations;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_locations_updated_at ON locations;
DROP TRIGGER IF EXISTS audit_locations ON locations;

-- Drop table if it exists (to start fresh)
DROP TABLE IF EXISTS locations CASCADE;

-- Create locations table
CREATE TABLE locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    latitude NUMERIC(10, 8) NOT NULL,
    longitude NUMERIC(11, 8) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add location_id column to kpi_updates table
ALTER TABLE kpi_updates 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Add location_id column to evidence table
ALTER TABLE evidence 
ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_initiative_id ON locations(initiative_id);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_location_id ON kpi_updates(location_id);
CREATE INDEX IF NOT EXISTS idx_evidence_location_id ON evidence(location_id);

-- Add updated_at trigger for locations table
CREATE TRIGGER update_locations_updated_at 
BEFORE UPDATE ON locations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security for locations table
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for locations table
CREATE POLICY "Users can view their own locations" 
ON locations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations" 
ON locations FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations" 
ON locations FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations" 
ON locations FOR DELETE 
USING (auth.uid() = user_id);

-- Add audit trigger for locations table
CREATE TRIGGER audit_locations 
AFTER INSERT OR UPDATE OR DELETE ON locations 
FOR EACH ROW 
EXECUTE FUNCTION create_audit_log();

