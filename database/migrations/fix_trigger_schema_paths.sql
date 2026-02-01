-- ============================================
-- FIX TRIGGER SCHEMA PATHS
-- Run this SQL in Supabase SQL Editor
-- Fixes: Auth service user deletion failing because triggers
-- couldn't find tables (different search_path)
-- ============================================

-- Fix the audit log trigger to use fully qualified table names
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID := NULL;
    v_record JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_record := row_to_json(OLD)::jsonb;
        IF v_record ? 'user_id' AND v_record->>'user_id' IS NOT NULL THEN
            SELECT id INTO v_user_id FROM auth.users WHERE id = (v_record->>'user_id')::uuid;
        ELSIF v_record ? 'owner_id' AND v_record->>'owner_id' IS NOT NULL THEN
            SELECT id INTO v_user_id FROM auth.users WHERE id = (v_record->>'owner_id')::uuid;
        END IF;
        
        INSERT INTO public.audit_log(table_name, record_id, action, old_values, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, v_record, v_user_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        v_record := row_to_json(NEW)::jsonb;
        IF v_record ? 'user_id' THEN
            v_user_id := (v_record->>'user_id')::uuid;
        ELSIF v_record ? 'owner_id' THEN
            v_user_id := (v_record->>'owner_id')::uuid;
        END IF;
        
        INSERT INTO public.audit_log(table_name, record_id, action, old_values, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), v_record, v_user_id);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        v_record := row_to_json(NEW)::jsonb;
        IF v_record ? 'user_id' THEN
            v_user_id := (v_record->>'user_id')::uuid;
        ELSIF v_record ? 'owner_id' THEN
            v_user_id := (v_record->>'owner_id')::uuid;
        END IF;
        
        INSERT INTO public.audit_log(table_name, record_id, action, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, v_record, v_user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix the storage cleanup trigger to use fully qualified table names
CREATE OR REPLACE FUNCTION cleanup_evidence_storage_file()
RETURNS TRIGGER AS $$
DECLARE
    file_path TEXT;
    bucket_name TEXT := 'evidence-files';
BEGIN
    IF OLD.file_url IS NOT NULL AND OLD.file_url LIKE '%/storage/v1/object/public/evidence-files/%' THEN
        file_path := substring(OLD.file_url from '/evidence-files/(.+)$');
        
        IF file_path IS NOT NULL THEN
            INSERT INTO public.storage_cleanup_queue (file_path, bucket_name, deleted_at)
            VALUES (file_path, bucket_name, NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
