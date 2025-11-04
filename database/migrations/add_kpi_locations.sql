-- Migration: Add KPI-Locations Junction Table
-- Date: 2025-01-23
-- Description: Creates kpi_locations junction table to link KPIs to multiple locations

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view KPI-location links for their data" ON kpi_locations;
DROP POLICY IF EXISTS "Users can insert KPI-location links for their data" ON kpi_locations;
DROP POLICY IF EXISTS "Users can delete KPI-location links for their data" ON kpi_locations;

-- Drop table if it exists (to start fresh)
DROP TABLE IF EXISTS kpi_locations CASCADE;

-- Create kpi_locations junction table (many-to-many relationship)
CREATE TABLE kpi_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(kpi_id, location_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_kpi_locations_kpi_id ON kpi_locations(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_locations_location_id ON kpi_locations(location_id);

-- Enable Row Level Security
ALTER TABLE kpi_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for kpi_locations (similar to evidence_kpis pattern)
CREATE POLICY "Users can view KPI-location links for their data" 
ON kpi_locations FOR SELECT 
USING (
    EXISTS (SELECT 1 FROM kpis WHERE kpis.id = kpi_locations.kpi_id AND kpis.user_id = auth.uid())
);

CREATE POLICY "Users can insert KPI-location links for their data" 
ON kpi_locations FOR INSERT 
WITH CHECK (
    EXISTS (SELECT 1 FROM kpis WHERE kpis.id = kpi_locations.kpi_id AND kpis.user_id = auth.uid())
);

CREATE POLICY "Users can delete KPI-location links for their data" 
ON kpi_locations FOR DELETE 
USING (
    EXISTS (SELECT 1 FROM kpis WHERE kpis.id = kpi_locations.kpi_id AND kpis.user_id = auth.uid())
);

