-- ============================================
-- ADD EVIDENCE FILES TABLE FOR MULTIPLE FILES
-- Run this SQL in Supabase SQL Editor
-- This allows one evidence item to have multiple file attachments
-- ============================================

-- Create evidence_files table for multiple files per evidence
CREATE TABLE IF NOT EXISTS evidence_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE NOT NULL,
    file_url TEXT NOT NULL,
    file_name VARCHAR(255),
    file_type VARCHAR(100),
    file_size BIGINT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_evidence_files_evidence_id ON evidence_files(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_files_display_order ON evidence_files(evidence_id, display_order);

-- Enable RLS
ALTER TABLE evidence_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for evidence_files
CREATE POLICY "Users can view evidence files for their evidence" ON evidence_files FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM evidence 
        WHERE evidence.id = evidence_files.evidence_id 
        AND evidence.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert evidence files for their evidence" ON evidence_files FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM evidence 
        WHERE evidence.id = evidence_files.evidence_id 
        AND evidence.user_id = auth.uid()
    )
);

CREATE POLICY "Users can update evidence files for their evidence" ON evidence_files FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM evidence 
        WHERE evidence.id = evidence_files.evidence_id 
        AND evidence.user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete evidence files for their evidence" ON evidence_files FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM evidence 
        WHERE evidence.id = evidence_files.evidence_id 
        AND evidence.user_id = auth.uid()
    )
);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_evidence_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_evidence_files_updated_at
BEFORE UPDATE ON evidence_files
FOR EACH ROW
EXECUTE FUNCTION update_evidence_files_updated_at();

-- Migrate existing file_url data to evidence_files table
-- This preserves existing single-file evidence items
INSERT INTO evidence_files (evidence_id, file_url, file_name, file_type, display_order)
SELECT 
    id as evidence_id,
    file_url,
    CASE 
        WHEN file_url IS NOT NULL THEN 
            substring(file_url from '/([^/]+)$')
        ELSE NULL
    END as file_name,
    file_type,
    0 as display_order
FROM evidence
WHERE file_url IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM evidence_files 
    WHERE evidence_files.evidence_id = evidence.id
)
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON TABLE evidence_files IS 'Stores multiple file attachments for evidence items. The original file_url column in evidence table is kept for backward compatibility but new files should use this table.';



