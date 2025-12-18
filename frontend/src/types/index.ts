export interface Organization {
    id?: string;
    name: string;
    slug?: string;
    description?: string;
    is_public?: boolean;
    owner_id?: string; // Single owner user (cascades delete when user is deleted)
    created_at?: string;
    updated_at?: string;
    role?: 'owner' | 'admin' | 'member'; // User's role in organization
}

export interface Initiative {
    id?: string;
    title: string;
    description: string;
    region?: string;
    location?: string;
    slug?: string;
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
    location_id?: string; // Legacy single location (kept for backward compatibility)
    location_ids?: string[]; // New: multiple locations support
    coordinates?: {
        lat: number;
        lng: number;
    }[];
    // Legacy linkage (kept for backward compatibility in UI/API)
    kpi_ids?: string[];
    // New precise linkage to specific KPI updates (data points)
    kpi_update_ids?: string[];
    initiative_id?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface Story {
    id?: string;
    initiative_id: string;
    title: string;
    description?: string;
    media_url?: string; // Optional - can be null/empty
    media_type: 'photo' | 'video' | 'recording' | 'text';
    date_represented: string; // Mandatory date
    location_id?: string;
    location?: Location; // Populated when fetching
    beneficiary_group_ids?: string[]; // Array of linked beneficiary group IDs
    beneficiary_groups?: BeneficiaryGroup[]; // Populated when fetching
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface DashboardStats {
    total_kpis: number;
    evidence_coverage_percentage: number;
    most_active_initiative?: string;
    recent_updates: number;
    evidence_types?: EvidenceTypeStats;
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

export interface EvidenceTypeStats {
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
    has_completed_tutorial?: boolean;
}

export interface InitiativeDashboard {
    initiative: Initiative;
    kpis: KPIWithEvidence[];
    stats: {
        total_kpis: number;
        evidence_coverage_percentage: number;
        evidence_types: EvidenceTypeStats;
        recent_updates: number;
    };
}

// Form types
export interface CreateInitiativeForm {
    title: string;
    description: string;
    region?: string;
    location?: string;
}

export interface CreateKPIForm {
    title: string;
    description: string;
    metric_type: 'number' | 'percentage';
    unit_of_measurement: string;
    category: 'input' | 'output' | 'impact';
    initiative_id?: string;
    umbrella_kpi_id?: string;
}

export interface CreateKPIUpdateForm {
    value: number;
    date_represented: string;
    date_range_start?: string;
    date_range_end?: string;
    note?: string;
    label?: string;
    location_id?: string;
    // New: link data point to beneficiary groups at creation time
    beneficiary_group_ids?: string[];
}

export interface CreateEvidenceForm {
    title: string;
    description?: string;
    type: 'visual_proof' | 'documentation' | 'testimony' | 'financials';
    file_url?: string;
    file_urls?: string[]; // Array of file URLs for multiple files support
    file_sizes?: number[]; // File sizes in bytes (parallel to file_urls) for storage tracking
    date_represented: string;
    date_range_start?: string;
    date_range_end?: string;
    location_id?: string; // Legacy single location (kept for backward compatibility)
    location_ids?: string[]; // New: multiple locations support
    // Legacy: link evidence to KPIs (kept for backward compatibility)
    kpi_ids?: string[];
    // New: link evidence to specific KPI updates (data points)
    kpi_update_ids?: string[];
    initiative_id?: string;
}

export interface CreateStoryForm {
    title: string;
    description?: string;
    media_url?: string; // Optional
    media_type: 'photo' | 'video' | 'recording' | 'text';
    date_represented: string; // Mandatory date
    location_id?: string;
    beneficiary_group_ids?: string[]; // Optional array of beneficiary group IDs
    initiative_id: string;
}

// UI State types
export interface LoadingState {
    isLoading: boolean;
    error?: string;
}

export interface Donor {
    id?: string;
    initiative_id: string;
    name: string;
    email: string;
    organization?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
}

export interface DonorCredit {
    id?: string;
    donor_id: string;
    kpi_id: string;
    kpi_update_id?: string;
    credited_value: number;
    credited_percentage?: number;
    date_range_start?: string;
    date_range_end?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    // Populated when fetching
    donor?: Donor;
    kpi?: KPI;
    kpi_update?: KPIUpdate;
}

export interface EvidenceByDate {
    date: string;
    dateRange?: {
        start: string;
        end: string;
    };
    totalMetricImpact: number;
    dataPoints: KPIUpdate[];
    evidenceItems: Evidence[];
    completionPercentage: number;
    isFullyProven: boolean;
}

export interface ModalState {
    isOpen: boolean;
    type?: 'create' | 'edit' | 'view';
    data?: any;
} 