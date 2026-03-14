-- Migration: Update metrics_with_context to use direct ben group links
-- Date: 2026-03-13
-- Description: Changes beneficiary group join from indirect (via location_id)
-- to direct (via kpi_update_beneficiary_groups junction table)

DROP VIEW IF EXISTS metrics_with_context CASCADE;

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
    -- Beneficiary group context (via direct junction table)
    bg.id AS beneficiary_group_id,
    bg.name AS beneficiary_group_name,
    bg.description AS beneficiary_group_description
FROM kpi_updates ku
INNER JOIN kpis k ON ku.kpi_id = k.id
LEFT JOIN locations l ON ku.location_id = l.id
LEFT JOIN kpi_update_beneficiary_groups kubg ON ku.id = kubg.kpi_update_id
LEFT JOIN beneficiary_groups bg ON kubg.beneficiary_group_id = bg.id;

COMMENT ON VIEW metrics_with_context IS 'Provides kpi_updates with full context: KPI details, location info, and associated beneficiary groups via direct links. A single kpi_update may appear multiple times if it has multiple beneficiary groups.';
