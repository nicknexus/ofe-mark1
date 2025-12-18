-- Migration: Add Donors and Donor Credits Tables
-- Date: 2025-01-27
-- Description: Creates donors table and donor_credits table for tracking donor contributions to metrics

-- Drop tables if they exist (to start fresh)
DROP TABLE IF EXISTS donor_credits CASCADE;
DROP TABLE IF EXISTS donors CASCADE;

-- Create donors table
CREATE TABLE donors (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    initiative_id UUID NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    organization VARCHAR(255),
    notes TEXT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_donor_email_per_initiative UNIQUE(initiative_id, email)
);

-- Create donor_credits table
CREATE TABLE donor_credits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    donor_id UUID NOT NULL REFERENCES donors(id) ON DELETE CASCADE,
    kpi_id UUID NOT NULL REFERENCES kpis(id) ON DELETE CASCADE,
    kpi_update_id UUID REFERENCES kpi_updates(id) ON DELETE CASCADE, -- Optional: credit specific claim
    credited_value DECIMAL(15, 2) NOT NULL, -- The numeric value credited to this donor
    credited_percentage DECIMAL(5, 2), -- Optional: percentage of total metric value
    date_range_start DATE, -- Optional: date range for this credit
    date_range_end DATE, -- Optional: date range for this credit
    notes TEXT, -- Optional notes about this credit
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_date_range CHECK (date_range_end IS NULL OR date_range_start IS NULL OR date_range_end >= date_range_start),
    CONSTRAINT valid_percentage CHECK (credited_percentage IS NULL OR (credited_percentage >= 0 AND credited_percentage <= 100))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_donors_initiative_id ON donors(initiative_id);
CREATE INDEX IF NOT EXISTS idx_donors_user_id ON donors(user_id);
CREATE INDEX IF NOT EXISTS idx_donor_credits_donor_id ON donor_credits(donor_id);
CREATE INDEX IF NOT EXISTS idx_donor_credits_kpi_id ON donor_credits(kpi_id);
CREATE INDEX IF NOT EXISTS idx_donor_credits_kpi_update_id ON donor_credits(kpi_update_id);
CREATE INDEX IF NOT EXISTS idx_donor_credits_user_id ON donor_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_donor_credits_date_range ON donor_credits(date_range_start, date_range_end);

-- Add updated_at trigger for donors table
CREATE TRIGGER update_donors_updated_at 
BEFORE UPDATE ON donors 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add updated_at trigger for donor_credits table
CREATE TRIGGER update_donor_credits_updated_at 
BEFORE UPDATE ON donor_credits 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE donors ENABLE ROW LEVEL SECURITY;
ALTER TABLE donor_credits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donors table
CREATE POLICY "Users can view their own donors"
    ON donors FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own donors"
    ON donors FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own donors"
    ON donors FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own donors"
    ON donors FOR DELETE
    USING (auth.uid() = user_id);

-- RLS Policies for donor_credits table
CREATE POLICY "Users can view their own donor credits"
    ON donor_credits FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own donor credits"
    ON donor_credits FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own donor credits"
    ON donor_credits FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own donor credits"
    ON donor_credits FOR DELETE
    USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE donors IS 'Donors who contribute to initiatives. Each donor belongs to one initiative and has contact information.';
COMMENT ON TABLE donor_credits IS 'Credits linking donors to metrics/claims. Tracks which portion of a metric value is credited to which donor.';
COMMENT ON COLUMN donor_credits.kpi_update_id IS 'Optional: If specified, credits a specific impact claim. If NULL, credits apply to the entire metric.';
COMMENT ON COLUMN donor_credits.credited_value IS 'The numeric value from the metric that is credited to this donor.';
COMMENT ON COLUMN donor_credits.credited_percentage IS 'Optional percentage of the total metric value credited to this donor.';










