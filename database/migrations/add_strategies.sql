-- Strategies section on organization_context.
-- Each strategy: { id: string, title: string, description: string }

ALTER TABLE organization_context
    ADD COLUMN IF NOT EXISTS strategies JSONB DEFAULT '[]'::jsonb;

UPDATE organization_context
    SET strategies = '[]'::jsonb
    WHERE strategies IS NULL;

ALTER TABLE organization_context
    DROP CONSTRAINT IF EXISTS organization_context_strategies_is_array;
ALTER TABLE organization_context
    ADD CONSTRAINT organization_context_strategies_is_array
    CHECK (strategies IS NULL OR jsonb_typeof(strategies) = 'array');
