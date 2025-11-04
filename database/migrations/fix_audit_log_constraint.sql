-- Fix audit_log foreign key constraint to allow user deletion
-- Run this in Supabase SQL Editor

-- Drop the existing constraint
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_user_id_fkey;

-- Recreate it with ON DELETE SET NULL
-- This means when a user is deleted, audit_log entries will have user_id set to NULL
-- (audit logs are historical records, so we keep them but just remove the user reference)
ALTER TABLE audit_log 
ADD CONSTRAINT audit_log_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

