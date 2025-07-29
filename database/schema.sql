-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Initiatives table
CREATE TABLE initiatives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    region VARCHAR(255),
    location VARCHAR(255),
    coordinates JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Umbrella KPIs table (optional grouping)
CREATE TABLE umbrella_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPIs table
CREATE TABLE kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    metric_type VARCHAR(20) CHECK (metric_type IN ('number', 'percentage')) NOT NULL,
    unit_of_measurement VARCHAR(100) NOT NULL,
    category VARCHAR(20) CHECK (category IN ('input', 'output', 'impact')) NOT NULL,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE CASCADE,
    umbrella_kpi_id UUID REFERENCES umbrella_kpis(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KPI Updates table
CREATE TABLE kpi_updates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    value NUMERIC NOT NULL,
    date_represented DATE NOT NULL,
    date_range_start DATE,
    date_range_end DATE,
    note TEXT,
    label VARCHAR(255),
    coordinates JSONB,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence table
CREATE TABLE evidence (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) CHECK (type IN ('visual_proof', 'documentation', 'testimony', 'financials')) NOT NULL,
    file_url TEXT,
    file_type VARCHAR(100),
    date_represented DATE NOT NULL,
    date_range_start DATE,
    date_range_end DATE,
    coordinates JSONB,
    initiative_id UUID REFERENCES initiatives(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Evidence-KPI junction table (many-to-many relationship)
CREATE TABLE evidence_kpis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    evidence_id UUID REFERENCES evidence(id) ON DELETE CASCADE,
    kpi_id UUID REFERENCES kpis(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(evidence_id, kpi_id)
);

-- Audit log for transparency
CREATE TABLE audit_log (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_initiatives_user_id ON initiatives(user_id);
CREATE INDEX idx_umbrella_kpis_user_id ON umbrella_kpis(user_id);
CREATE INDEX idx_umbrella_kpis_initiative_id ON umbrella_kpis(initiative_id);
CREATE INDEX idx_kpis_user_id ON kpis(user_id);
CREATE INDEX idx_kpis_initiative_id ON kpis(initiative_id);
CREATE INDEX idx_kpis_umbrella_kpi_id ON kpis(umbrella_kpi_id);
CREATE INDEX idx_kpi_updates_user_id ON kpi_updates(user_id);
CREATE INDEX idx_kpi_updates_kpi_id ON kpi_updates(kpi_id);
CREATE INDEX idx_kpi_updates_date_represented ON kpi_updates(date_represented);
CREATE INDEX idx_evidence_user_id ON evidence(user_id);
CREATE INDEX idx_evidence_initiative_id ON evidence(initiative_id);
CREATE INDEX idx_evidence_date_represented ON evidence(date_represented);
CREATE INDEX idx_evidence_kpis_evidence_id ON evidence_kpis(evidence_id);
CREATE INDEX idx_evidence_kpis_kpi_id ON evidence_kpis(kpi_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_initiatives_updated_at BEFORE UPDATE ON initiatives FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_umbrella_kpis_updated_at BEFORE UPDATE ON umbrella_kpis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpis_updated_at BEFORE UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kpi_updates_updated_at BEFORE UPDATE ON kpi_updates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evidence_updated_at BEFORE UPDATE ON evidence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
ALTER TABLE initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE umbrella_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies for initiatives
CREATE POLICY "Users can view their own initiatives" ON initiatives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own initiatives" ON initiatives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own initiatives" ON initiatives FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own initiatives" ON initiatives FOR DELETE USING (auth.uid() = user_id);

-- Policies for umbrella_kpis
CREATE POLICY "Users can view their own umbrella KPIs" ON umbrella_kpis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own umbrella KPIs" ON umbrella_kpis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own umbrella KPIs" ON umbrella_kpis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own umbrella KPIs" ON umbrella_kpis FOR DELETE USING (auth.uid() = user_id);

-- Policies for kpis
CREATE POLICY "Users can view their own KPIs" ON kpis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KPIs" ON kpis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KPIs" ON kpis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own KPIs" ON kpis FOR DELETE USING (auth.uid() = user_id);

-- Policies for kpi_updates
CREATE POLICY "Users can view their own KPI updates" ON kpi_updates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own KPI updates" ON kpi_updates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own KPI updates" ON kpi_updates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own KPI updates" ON kpi_updates FOR DELETE USING (auth.uid() = user_id);

-- Policies for evidence
CREATE POLICY "Users can view their own evidence" ON evidence FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own evidence" ON evidence FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own evidence" ON evidence FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own evidence" ON evidence FOR DELETE USING (auth.uid() = user_id);

-- Policies for evidence_kpis (junction table)
CREATE POLICY "Users can view evidence-KPI links for their data" ON evidence_kpis FOR SELECT USING (
    EXISTS (SELECT 1 FROM evidence WHERE evidence.id = evidence_kpis.evidence_id AND evidence.user_id = auth.uid())
);
CREATE POLICY "Users can insert evidence-KPI links for their data" ON evidence_kpis FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM evidence WHERE evidence.id = evidence_kpis.evidence_id AND evidence.user_id = auth.uid())
);
CREATE POLICY "Users can delete evidence-KPI links for their data" ON evidence_kpis FOR DELETE USING (
    EXISTS (SELECT 1 FROM evidence WHERE evidence.id = evidence_kpis.evidence_id AND evidence.user_id = auth.uid())
);

-- Policies for audit_log
CREATE POLICY "Users can view their own audit logs" ON audit_log FOR SELECT USING (auth.uid() = user_id);

-- Create audit trigger function
CREATE OR REPLACE FUNCTION create_audit_log()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log(table_name, record_id, action, old_values, user_id)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), OLD.user_id);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log(table_name, record_id, action, old_values, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), NEW.user_id);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log(table_name, record_id, action, new_values, user_id)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NEW.user_id);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Add audit triggers
CREATE TRIGGER audit_initiatives AFTER INSERT OR UPDATE OR DELETE ON initiatives FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_umbrella_kpis AFTER INSERT OR UPDATE OR DELETE ON umbrella_kpis FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_kpis AFTER INSERT OR UPDATE OR DELETE ON kpis FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_kpi_updates AFTER INSERT OR UPDATE OR DELETE ON kpi_updates FOR EACH ROW EXECUTE FUNCTION create_audit_log();
CREATE TRIGGER audit_evidence AFTER INSERT OR UPDATE OR DELETE ON evidence FOR EACH ROW EXECUTE FUNCTION create_audit_log(); 