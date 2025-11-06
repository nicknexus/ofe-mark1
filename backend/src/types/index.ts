export interface Organization {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    is_public?: boolean;
    owner_id?: string; // Single owner user (cascades delete when user is deleted)
    created_at?: string;
    updated_at?: string;
    role?: 'owner' | 'admin' | 'member'; // User's role in organization (when fetched via user_organizations)
}

export interface Initiative {
    id?: string;
    title: string;
    description: string;
    region?: string;
    location?: string;
    slug?: string;
    is_public?: boolean;
    coordinates?: {
        lat: number;
        lng: number;
    }[];
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface UmbrellaKPI {
    id?: string;
    title: string;
    description?: string;
    initiative_id?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface KPI {
    id?: string;
    title: string;
    description: string;
    metric_type: 'number' | 'percentage';
    unit_of_measurement: string;
    category: 'input' | 'output' | 'impact';
    initiative_id?: string;
    umbrella_kpi_id?: string;
    display_order?: number;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface Location {
    id?: string;
    initiative_id: string;
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    display_order?: number;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface KPIUpdate {
    id?: string;
    kpi_id: string;
    value: number;
    date_represented: string;
    date_range_start?: string;
    date_range_end?: string;
    note?: string;
    label?: string;
    location_id?: string;
    coordinates?: {
        lat: number;
        lng: number;
    }[];
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface BeneficiaryGroup {
    id?: string;
    initiative_id: string;
    name: string;
    description?: string;
    criteria?: Record<string, any> | null;
    location_id: string; // Mandatory location
    age_range_start?: number | null; // Optional minimum age
    age_range_end?: number | null; // Optional maximum age
    total_number?: number | null; // Total number of beneficiaries in the group
    display_order?: number;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface Evidence {
    id?: string;
    title: string;
    description?: string;
    type: 'visual_proof' | 'documentation' | 'testimony' | 'financials';
    file_url?: string;
    file_type?: string;
    date_represented: string;
    date_range_start?: string;
    date_range_end?: string;
    location_id?: string;
    coordinates?: {
        lat: number;
        lng: number;
    }[];
    // Legacy KPI-level evidence link (kept for existing flows)
    kpi_ids?: string[];
    // New precise linkage to specific KPI updates
    kpi_update_ids?: string[];
    initiative_id?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface DashboardStats {
    total_kpis: number;
    evidence_coverage_percentage: number;
    most_active_initiative?: string;
    recent_updates: number;
}

export interface KPIWithEvidence extends KPI {
    evidence_count: number;
    evidence_percentage: number;
    latest_update?: KPIUpdate;
    total_updates: number;
    total_value: number;
    evidence_types: Array<{
        type: string;
        count: number;
        percentage: number;
        label: string;
    }>;
}

export interface EvidenceType {
    visual_proof: number;
    documentation: number;
    testimony: number;
    financials: number;
}

export interface User {
    id: string;
    email: string;
    name?: string;
    organization?: string;
} 