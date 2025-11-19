-- Part 2: Create metrics_with_context view
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

