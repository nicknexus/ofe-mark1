-- Fix audit_log trigger to handle NULL user_id
-- Run this in Supabase SQL Editor

-- Update the audit trigger function to allow NULL user_id
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- For tables without user_id (like organizations), use auth.uid()
    -- For tables with user_id, use the record's user_id
    IF TG_TABLE_NAME = 'organizations' OR TG_TABLE_NAME = 'user_organizations' THEN
        v_user_id := auth.uid();
    ELSE
        -- Tables with user_id column
        IF TG_OP = 'DELETE' THEN
            v_user_id := OLD.user_id;
        ELSE
            v_user_id := NEW.user_id;
        END IF;
    END IF;

    -- Only insert audit log if user_id is not NULL (NULL is allowed by constraint)
    -- This prevents errors when deleting users whose audit logs are being created
    IF v_user_id IS NOT NULL THEN
        IF TG_OP = 'DELETE' THEN
            INSERT INTO audit_log(table_name, record_id, action, old_values, user_id)
            VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), v_user_id);
            RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
            INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, user_id)
            VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), v_user_id);
            RETURN NEW;
        ELSIF TG_OP = 'INSERT' THEN
            INSERT INTO audit_log(table_name, record_id, action, new_values, user_id)
            VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), v_user_id);
            RETURN NEW;
        END IF;
    ELSE
        -- If user_id is NULL, just return without logging (or log with NULL)
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        ELSE
            RETURN NEW;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';


