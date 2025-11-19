DROP VIEW IF EXISTS metrics_with_context CASCADE;
DROP VIEW IF EXISTS stories_with_context CASCADE;

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
    k.title AS kpi_title,
    k.description AS kpi_description,
    k.unit_of_measurement,
    k.metric_type,
    k.category,
    k.initiative_id,
    l.name AS location_name,
    l.description AS location_description,
    l.latitude AS location_latitude,
    l.longitude AS location_longitude,
    bg.id AS beneficiary_group_id,
    bg.name AS beneficiary_group_name,
    bg.description AS beneficiary_group_description
FROM kpi_updates ku
INNER JOIN kpis k ON ku.kpi_id = k.id
LEFT JOIN locations l ON ku.location_id = l.id
LEFT JOIN beneficiary_groups bg ON l.id = bg.location_id;

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
    l.name AS location_name,
    l.description AS location_description,
    l.latitude AS location_latitude,
    l.longitude AS location_longitude
FROM stories s
LEFT JOIN locations l ON s.location_id = l.id;

