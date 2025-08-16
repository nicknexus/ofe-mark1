-- Migration: Add date range indexes for KPI Evidence Upload Section
-- Date: 2024

-- Add indexes for date range queries on KPI updates
CREATE INDEX IF NOT EXISTS idx_kpi_updates_date_range_start ON kpi_updates(date_range_start);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_date_range_end ON kpi_updates(date_range_end);

-- Add indexes for date range queries on evidence  
CREATE INDEX IF NOT EXISTS idx_evidence_date_range_start ON evidence(date_range_start);
CREATE INDEX IF NOT EXISTS idx_evidence_date_range_end ON evidence(date_range_end);

-- Add composite indexes for common filtering patterns
-- This will optimize queries that filter by KPI and date together
CREATE INDEX IF NOT EXISTS idx_kpi_updates_kpi_date_range ON kpi_updates(kpi_id, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_kpi_updates_kpi_date_represented ON kpi_updates(kpi_id, date_represented);

-- Add composite index for evidence filtering by initiative and date
CREATE INDEX IF NOT EXISTS idx_evidence_initiative_date_range ON evidence(initiative_id, date_range_start, date_range_end);
CREATE INDEX IF NOT EXISTS idx_evidence_initiative_date_represented ON evidence(initiative_id, date_represented);

-- Improve evidence_kpis junction table RLS policy security
-- Drop existing policy and create more secure one
DROP POLICY IF EXISTS "Users can insert evidence-KPI links for their data" ON evidence_kpis;
DROP POLICY IF EXISTS "Users can delete evidence-KPI links for their data" ON evidence_kpis;

-- New secure policies that check both evidence AND KPI ownership
CREATE POLICY "Users can insert evidence-KPI links for their data" ON evidence_kpis FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM evidence WHERE evidence.id = evidence_kpis.evidence_id AND evidence.user_id = auth.uid())
    AND
    EXISTS (SELECT 1 FROM kpis WHERE kpis.id = evidence_kpis.kpi_id AND kpis.user_id = auth.uid())
);

CREATE POLICY "Users can delete evidence-KPI links for their data" ON evidence_kpis FOR DELETE USING (
    EXISTS (SELECT 1 FROM evidence WHERE evidence.id = evidence_kpis.evidence_id AND evidence.user_id = auth.uid())
    AND  
    EXISTS (SELECT 1 FROM kpis WHERE kpis.id = evidence_kpis.kpi_id AND kpis.user_id = auth.uid())
); 