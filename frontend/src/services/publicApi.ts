/**
 * Public API Service - No authentication required
 * For accessing public organization and initiative data
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ============================================
// Types
// ============================================

export interface PublicOrganization {
    id: string
    name: string
    slug: string
    description?: string
    logo_url?: string
    created_at?: string
}

export interface PublicInitiative {
    id: string
    title: string
    description: string
    region?: string
    location?: string
    slug: string
    coordinates?: { lat: number; lng: number }[]
    created_at?: string
    organization_id: string
    org_slug?: string
    organization_name?: string
    organization_logo_url?: string
}

export interface PublicKPI {
    id: string
    title: string
    description: string
    metric_type: 'number' | 'percentage'
    unit_of_measurement: string
    category: 'input' | 'output' | 'impact'
    display_order?: number
    target_value?: number
    initiative_id: string
    initiative_slug?: string
    initiative_title?: string
    org_slug?: string
    updates?: PublicKPIUpdate[]
    total_value?: number
    update_count?: number
    evidence_count?: number
    evidence_percentage?: number
}

export interface PublicKPIUpdate {
    id: string
    value: number
    date_represented: string
    date_range_start?: string
    date_range_end?: string
    location_id?: string
    location?: PublicLocation
    note?: string
    label?: string
}

export interface PublicLocation {
    id: string
    name: string
    description?: string
    latitude: number
    longitude: number
    initiative_id?: string
    initiative_slug?: string
    initiative_title?: string
    org_slug?: string
}

export interface PublicStory {
    id: string
    title: string
    description?: string
    media_url?: string
    media_type: 'photo' | 'video' | 'recording' | 'text'
    date_represented: string
    location_id?: string
    location_name?: string
    location?: PublicLocation
    initiative_id: string
    initiative_slug?: string
    initiative_title?: string
    org_slug?: string
    beneficiary_groups?: PublicBeneficiaryGroup[]
    created_at?: string
}

export interface PublicEvidenceFile {
    id: string
    file_url: string
    file_name: string
    file_type: string
    display_order: number
}

export interface PublicEvidence {
    id: string
    title: string
    description?: string
    type: 'visual_proof' | 'documentation' | 'testimony' | 'financials'
    file_url?: string
    files?: PublicEvidenceFile[]
    date_represented: string
    date_range_start?: string
    date_range_end?: string
    initiative_id?: string
    initiative_slug?: string
    initiative_title?: string
    org_slug?: string
    locations?: { id: string; name: string }[]
    kpis?: { id: string; title: string }[]
    created_at?: string
}

export interface PublicBeneficiaryGroup {
    id: string
    name: string
    description?: string
    location_id?: string
    location?: PublicLocation
    age_range_start?: number
    age_range_end?: number
    total_number?: number
    display_order?: number
}

export interface SearchResult {
    organizations: PublicOrganization[]
    initiatives: (PublicInitiative & { organization_name: string })[]
    locationMatches: {
        location: PublicLocation
        initiative: PublicInitiative
        organization: PublicOrganization
    }[]
}

export interface OrganizationStats {
    initiatives: number
    locations: number
    stories: number
    kpis: number
}

export interface InitiativeDashboard {
    initiative: PublicInitiative
    kpis: PublicKPI[]
    locations: PublicLocation[]
    stats: {
        kpis: number
        evidence: number
        stories: number
        locations: number
    }
}

// ============================================
// API Service
// ============================================

class PublicApiService {
    private async request<T>(endpoint: string): Promise<T> {
        const response = await fetch(`${API_BASE_URL}/api/public${endpoint}`)

        if (!response.ok) {
            const contentType = response.headers.get('content-type')
            let errorMessage = `HTTP ${response.status}`

            if (contentType?.includes('application/json')) {
                try {
                    const error = await response.json()
                    errorMessage = error.error || error.message || errorMessage
                } catch {
                    // Ignore parse errors
                }
            }

            throw new Error(errorMessage)
        }

        return response.json()
    }

    // ============================================
    // Search
    // ============================================

    async search(query: string): Promise<SearchResult> {
        if (!query.trim()) {
            return { organizations: [], initiatives: [], locationMatches: [] }
        }
        return this.request<SearchResult>(`/search?q=${encodeURIComponent(query)}`)
    }

    // ============================================
    // Organizations
    // ============================================

    async getOrganizations(): Promise<PublicOrganization[]> {
        return this.request<PublicOrganization[]>('/organizations')
    }

    async getOrganization(slug: string): Promise<{
        organization: PublicOrganization
        stats: OrganizationStats
    }> {
        return this.request(`/organizations/${slug}`)
    }

    async getOrganizationInitiatives(orgSlug: string): Promise<PublicInitiative[]> {
        return this.request<PublicInitiative[]>(`/organizations/${orgSlug}/initiatives`)
    }

    async getOrganizationMetrics(orgSlug: string): Promise<PublicKPI[]> {
        return this.request<PublicKPI[]>(`/organizations/${orgSlug}/metrics`)
    }

    async getOrganizationStories(orgSlug: string, limit?: number): Promise<PublicStory[]> {
        const params = limit ? `?limit=${limit}` : ''
        return this.request<PublicStory[]>(`/organizations/${orgSlug}/stories${params}`)
    }

    async getOrganizationLocations(orgSlug: string): Promise<PublicLocation[]> {
        return this.request<PublicLocation[]>(`/organizations/${orgSlug}/locations`)
    }

    async getOrganizationEvidence(orgSlug: string, limit?: number): Promise<PublicEvidence[]> {
        const params = limit ? `?limit=${limit}` : ''
        return this.request<PublicEvidence[]>(`/organizations/${orgSlug}/evidence${params}`)
    }

    // ============================================
    // Initiatives (Advanced View)
    // ============================================

    async getInitiative(orgSlug: string, initiativeSlug: string): Promise<PublicInitiative> {
        return this.request<PublicInitiative>(`/initiatives/${orgSlug}/${initiativeSlug}`)
    }

    async getInitiativeDashboard(orgSlug: string, initiativeSlug: string): Promise<InitiativeDashboard> {
        return this.request<InitiativeDashboard>(`/initiatives/${orgSlug}/${initiativeSlug}/dashboard`)
    }

    async getInitiativeKPIs(orgSlug: string, initiativeSlug: string): Promise<PublicKPI[]> {
        return this.request<PublicKPI[]>(`/initiatives/${orgSlug}/${initiativeSlug}/kpis`)
    }

    async getInitiativeStories(orgSlug: string, initiativeSlug: string): Promise<PublicStory[]> {
        return this.request<PublicStory[]>(`/initiatives/${orgSlug}/${initiativeSlug}/stories`)
    }

    async getInitiativeLocations(orgSlug: string, initiativeSlug: string): Promise<PublicLocation[]> {
        return this.request<PublicLocation[]>(`/initiatives/${orgSlug}/${initiativeSlug}/locations`)
    }

    async getInitiativeEvidence(orgSlug: string, initiativeSlug: string): Promise<PublicEvidence[]> {
        return this.request<PublicEvidence[]>(`/initiatives/${orgSlug}/${initiativeSlug}/evidence`)
    }

    async getInitiativeBeneficiaries(orgSlug: string, initiativeSlug: string): Promise<PublicBeneficiaryGroup[]> {
        return this.request<PublicBeneficiaryGroup[]>(`/initiatives/${orgSlug}/${initiativeSlug}/beneficiaries`)
    }
}

export const publicApi = new PublicApiService()
