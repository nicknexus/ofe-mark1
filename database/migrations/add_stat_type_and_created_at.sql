-- Add type/value/created_at to each stat card in organization_context.stats_and_statements.
-- Existing cards default to type='statement' and inherit NOW() as created_at.
--
-- Run AFTER add_stats_cards_to_context.sql.

UPDATE organization_context
SET stats_and_statements = (
    SELECT jsonb_agg(
        jsonb_build_object(
            'id',          COALESCE(NULLIF(item->>'id', ''), gen_random_uuid()::text),
            'type',        COALESCE(NULLIF(item->>'type', ''), 'statement'),
            'value',       COALESCE(item->>'value', ''),
            'title',       COALESCE(item->>'title', ''),
            'description', COALESCE(item->>'description', ''),
            'source',      COALESCE(item->>'source', ''),
            'created_at',  COALESCE(NULLIF(item->>'created_at', ''), NOW()::text)
        )
    )
    FROM jsonb_array_elements(stats_and_statements) AS item
)
WHERE jsonb_typeof(stats_and_statements) = 'array'
  AND jsonb_array_length(stats_and_statements) > 0;
