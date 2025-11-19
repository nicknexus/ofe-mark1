-- Part 3: Create stories_with_context view
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

