-- ============================================
-- EVIDENCE STORAGE CLEANUP TRIGGER
-- Run this SQL in Supabase SQL Editor
-- This ensures Storage files are deleted when evidence is deleted
-- ============================================

-- Create a function to clean up Storage files when evidence is deleted
-- Note: This uses Supabase's storage admin API via pg_net extension
CREATE OR REPLACE FUNCTION cleanup_evidence_storage_file()
RETURNS TRIGGER AS $$
DECLARE
    file_path TEXT;
    bucket_name TEXT := 'evidence-files';
BEGIN
    -- Only proceed if file_url exists and looks like a Supabase Storage URL
    IF OLD.file_url IS NOT NULL AND OLD.file_url LIKE '%/storage/v1/object/public/evidence-files/%' THEN
        -- Extract file path from URL
        -- URL format: https://{project}.supabase.co/storage/v1/object/public/evidence-files/evidence/{userId}/{filename}
        file_path := substring(OLD.file_url from '/evidence-files/(.+)$');
        
        IF file_path IS NOT NULL THEN
            -- Use Supabase's storage admin API to delete the file
            -- This requires the pg_net extension and proper configuration
            -- For now, we'll log it to a cleanup queue table that can be processed by backend
            
            -- Insert into cleanup queue (we'll create this table)
            INSERT INTO storage_cleanup_queue (file_path, bucket_name, deleted_at)
            VALUES (file_path, bucket_name, NOW())
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create cleanup queue table to track files that need deletion
CREATE TABLE IF NOT EXISTS storage_cleanup_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    file_path TEXT NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'evidence-files',
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    UNIQUE(file_path, bucket_name)
);

-- Create index for faster processing
CREATE INDEX IF NOT EXISTS idx_storage_cleanup_queue_unprocessed 
ON storage_cleanup_queue(processed_at) 
WHERE processed_at IS NULL;

-- Create trigger that fires BEFORE evidence deletion
-- This ensures we capture the file_url before the record is gone
DROP TRIGGER IF EXISTS cleanup_evidence_storage ON evidence;

CREATE TRIGGER cleanup_evidence_storage
BEFORE DELETE ON evidence
FOR EACH ROW
EXECUTE FUNCTION cleanup_evidence_storage_file();

-- Comment
COMMENT ON TABLE storage_cleanup_queue IS 'Queue for tracking files that need to be deleted from Supabase Storage';
COMMENT ON FUNCTION cleanup_evidence_storage_file() IS 'Trigger function that queues Storage file cleanup when evidence is deleted';

