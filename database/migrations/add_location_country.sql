-- Migration: Add country column to locations table
-- Date: 2025-01-13
-- Description: Stores country name so we don't need to reverse geocode every time

-- Add country column
ALTER TABLE locations ADD COLUMN IF NOT EXISTS country VARCHAR(255);

-- Create index for potential filtering by country
CREATE INDEX IF NOT EXISTS idx_locations_country ON locations(country);
