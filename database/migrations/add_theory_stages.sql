-- Add structured "stages" to the Theory of Change section.
-- `theory_of_change` TEXT column stays as the short description shown up top.
-- `theory_of_change_stages` JSONB array stores stage cards.
--
-- Each stage: { id: string, title: string, description: string }

ALTER TABLE organization_context
    ADD COLUMN IF NOT EXISTS theory_of_change_stages JSONB DEFAULT '[]'::jsonb;

UPDATE organization_context
    SET theory_of_change_stages = '[]'::jsonb
    WHERE theory_of_change_stages IS NULL;

ALTER TABLE organization_context
    DROP CONSTRAINT IF EXISTS organization_context_theory_stages_is_array;
ALTER TABLE organization_context
    ADD CONSTRAINT organization_context_theory_stages_is_array
    CHECK (theory_of_change_stages IS NULL OR jsonb_typeof(theory_of_change_stages) = 'array');
