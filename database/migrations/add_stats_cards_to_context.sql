-- Convert organization_context.stats_and_statements from TEXT to JSONB[]
-- so organizations can add multiple stat/statement cards.
--
-- Each card: { id: uuid-string, title: string, description: string, source: string }
--
-- Run in Supabase SQL editor AFTER add_organization_context.sql.

-- pgcrypto is usually enabled in Supabase; guard anyway.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE organization_context
    ALTER COLUMN stats_and_statements DROP DEFAULT;

-- Preserve any existing text as a single card (title left blank, description = old text).
ALTER TABLE organization_context
    ALTER COLUMN stats_and_statements TYPE JSONB
    USING (
        CASE
            WHEN stats_and_statements IS NULL OR btrim(stats_and_statements) = '' THEN '[]'::jsonb
            ELSE jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid()::text,
                    'title', '',
                    'description', stats_and_statements,
                    'source', ''
                )
            )
        END
    );

ALTER TABLE organization_context
    ALTER COLUMN stats_and_statements SET DEFAULT '[]'::jsonb;

-- Ensure it's always an array (defense-in-depth).
ALTER TABLE organization_context
    DROP CONSTRAINT IF EXISTS organization_context_stats_is_array;
ALTER TABLE organization_context
    ADD CONSTRAINT organization_context_stats_is_array
    CHECK (stats_and_statements IS NULL OR jsonb_typeof(stats_and_statements) = 'array');
