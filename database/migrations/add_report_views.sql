-- Migration: Add Report Generator Views
-- Date: 2025-01-28
-- Description: Creates helper views for the AI report generator

DROP VIEW IF EXISTS metrics_with_context CASCADE;
DROP VIEW IF EXISTS stories_with_context CASCADE;

-- View: metrics_with_context
-- Joins kpi_updates with kpis, locations, and beneficiary groups
-- This view provides all context needed for filtering and aggregating metrics
CREATE OR REPLACE VIEW metrics_with_context AS
SELECT
    ku.id,
    ku.kpi_id,
    ku.value,
    ku.date_represented,
    ku.date_range_start,
    ku.date_range_end,
    ku.note,
    ku.label,
    ku.coordinates,
    ku.location_id,
    ku.user_id,
    ku.created_at,
    ku.updated_at,
    -- KPI context
    k.title AS kpi_title,
    k.description AS kpi_description,
    k.unit_of_measurement,
    k.metric_type,
    k.category,
    k.initiative_id,
    -- Location context (optional)
    l.name AS location_name,
    l.description AS location_description,
    l.latitude AS location_latitude,
    l.longitude AS location_longitude,
    -- Beneficiary group context (via location)
    bg.id AS beneficiary_group_id,
    bg.name AS beneficiary_group_name,
    bg.description AS beneficiary_group_description
FROM kpi_updates ku
INNER JOIN kpis k ON ku.kpi_id = k.id
LEFT JOIN locations l ON ku.location_id = l.id
LEFT JOIN beneficiary_groups bg ON l.id = bg.location_id;

-- View: stories_with_context
-- Joins stories with locations
-- This view provides location context for stories
CREATE OR REPLACE VIEW stories_with_context AS
SELECT
    s.id,
    s.title,
    s.description,
    s.media_url,
    s.media_type,
    s.date_represented,
    s.location_id,
    s.initiative_id,
    s.user_id,
    s.created_at,
    s.updated_at,
    -- Location context (optional)
    l.name AS location_name,
    l.description AS location_description,
    l.latitude AS location_latitude,
    l.longitude AS location_longitude
FROM stories s
LEFT JOIN locations l ON s.location_id = l.id;

-- Create indexes on underlying tables if they don't exist (for view performance)
-- These should already exist from previous migrations, but adding IF NOT EXISTS for safety
CREATE INDEX IF NOT EXISTS idx_kpi_updates_kpi_id ON kpi_updates(kpi_id);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_date_represented ON kpi_updates(date_represented);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_location_id ON kpi_updates(location_id);
CREATE INDEX IF NOT EXISTS idx_kpis_initiative_id ON kpis(initiative_id);
CREATE INDEX IF NOT EXISTS idx_locations_id ON locations(id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_groups_location_id ON beneficiary_groups(location_id);
CREATE INDEX IF NOT EXISTS idx_stories_initiative_id ON stories(initiative_id);
CREATE INDEX IF NOT EXISTS idx_stories_date_represented ON stories(date_represented);
CREATE INDEX IF NOT EXISTS idx_stories_location_id ON stories(location_id);

-- Add comments for documentation
COMMENT ON VIEW metrics_with_context IS 'Provides kpi_updates with full context: KPI details, location info, and associated beneficiary groups. Note: A single kpi_update may appear multiple times if its location has multiple beneficiary groups.';
COMMENT ON VIEW stories_with_context IS 'Provides stories with location context for filtering and display in reports.';

