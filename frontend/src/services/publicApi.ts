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
    statement?: string
    logo_url?: string
    brand_color?: string
    created_at?: string
    is_demo?: boolean
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
    organization_brand_color?: string
}

export interface PublicMetricTag {
    id: string
    name: string
    color?: string | null
    display_order?: number
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
    tag_ids?: string[]
}

export interface PublicKPIUpdate {
    id: string
    value: number
    date_represented: string
    date_range_start?: string
    date_range_end?: string
    location_id?: string
    location?: PublicLocation
    beneficiary_groups?: { id: string; name: string }[]
    note?: string
    label?: string
    tag_id?: string | null
}

export interface PublicLocation {
    id: string
    name: string
    description?: string
    latitude: number
    longitude: number
    country?: string
    initiative_id?: string
    initiative_ids?: string[]
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
    location_ids?: string[]
    location_name?: string
    location?: PublicLocation
    locations?: PublicLocation[]
    initiative_id: string
    initiative_slug?: string
    initiative_title?: string
    org_slug?: string
    beneficiary_groups?: PublicBeneficiaryGroup[]
    created_at?: string
    tag_ids?: string[]
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
    beneficiary_groups?: { id: string; name: string }[]
    kpis?: { id: string; title: string; category?: string; unit_of_measurement?: string }[]
    impact_claims?: { id: string; value: number; date_represented?: string; date_range_start?: string; date_range_end?: string; kpi_id?: string; kpis?: { id: string; title: string; unit_of_measurement?: string }; tag_id?: string | null }[]
    created_at?: string
    tag_ids?: string[]
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

export interface PublicBeneficiaryGroupDetail {
    id: string
    name: string
    description?: string
    total_number?: number
    age_range_start?: number
    age_range_end?: number
    location?: PublicLocation
    claims: {
        id: string
        value: number
        date_represented: string
        date_range_start?: string
        date_range_end?: string
        label?: string
        note?: string
        tag_id?: string | null
        kpi?: { id: string; title: string; unit_of_measurement: string; category: string }
    }[]
    evidence: (PublicEvidence & { files?: { id: string; file_url: string; file_name: string; file_type: string; display_order?: number }[] })[]
    stories: {
        id: string
        title: string
        description?: string
        media_url?: string
        media_type?: string
        date_represented: string
        locations?: { id: string; name: string }[]
        tag_ids?: string[]
    }[]
    locations: PublicLocation[]
    initiative: {
        id: string
        title: string
        slug: string
        org_slug?: string
        org_name?: string
        brand_color?: string
    }
}

export interface LocationDetail {
    location: PublicLocation
    stories: { id: string; title: string; description?: string; media_url?: string; media_type: string; date_represented: string; tag_ids?: string[] }[]
    evidence: PublicEvidence[]
    claims: {
        id: string; value: number; date_represented: string; date_range_start?: string; date_range_end?: string;
        note?: string; label?: string; metric_title: string; metric_slug: string; metric_unit: string; metric_category: string;
        tag_id?: string | null
    }[]
    metrics: {
        id: string; title: string; slug: string; unit_of_measurement: string; category: string;
        total_value: number; claim_count: number
    }[]
    initiative: { id: string; title: string; slug: string; org_slug: string }
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

export type PublicStatCardType = 'stat' | 'statement'

export interface PublicStatCard {
    id: string
    type: PublicStatCardType
    value?: string
    title: string
    description: string
    source?: string
    source_url?: string
    created_at: string
}

export interface PublicTheoryStage {
    id: string
    title: string
    description: string
}

export interface PublicStrategy {
    id: string
    title: string
    description: string
}

export interface PublicOrganizationContext {
    id: string
    organization_id: string
    problem_statement?: string
    stats_and_statements?: PublicStatCard[] | null
    theory_of_change?: string
    theory_of_change_stages?: PublicTheoryStage[] | null
    strategies?: PublicStrategy[] | null
    additional_info?: string
    created_at?: string
    updated_at?: string
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
// API Service with Caching
// ============================================

class PublicApiService {
    private cache: Map<string, any> = new Map()
    private currentOrgSlug: string | null = null

    /**
     * Clear cache when entering a new organization (fresh load)
     * Call this when navigating to an org from the explore page
     */
    clearCacheForOrg(orgSlug: string): void {
        if (this.currentOrgSlug !== orgSlug) {
            this.cache.clear()
            this.currentOrgSlug = orgSlug
        }
    }

    /**
     * Clear all cache (useful for testing or forced refresh)
     */
    clearAllCache(): void {
        this.cache.clear()
        this.currentOrgSlug = null
    }

    private async request<T>(endpoint: string, skipCache: boolean = false): Promise<T> {
        // Check cache first (unless skipCache is true)
        if (!skipCache && this.cache.has(endpoint)) {
            return this.cache.get(endpoint) as T
        }

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

        const data = await response.json()

        // Cache the result
        this.cache.set(endpoint, data)

        return data
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

    async getOrganizationContext(orgSlug: string): Promise<PublicOrganizationContext | null> {
        return this.request<PublicOrganizationContext | null>(`/organizations/${orgSlug}/context`)
    }

    async getOrganizationTags(orgSlug: string): Promise<PublicMetricTag[]> {
        return this.request<PublicMetricTag[]>(`/organizations/${orgSlug}/tags`)
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

    async getLocationDetail(orgSlug: string, initiativeSlug: string, locationId: string): Promise<LocationDetail> {
        return this.request<LocationDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/location/${locationId}`)
    }

    async getInitiativeEvidence(orgSlug: string, initiativeSlug: string): Promise<PublicEvidence[]> {
        return this.request<PublicEvidence[]>(`/initiatives/${orgSlug}/${initiativeSlug}/evidence`)
    }

    async getInitiativeBeneficiaries(orgSlug: string, initiativeSlug: string): Promise<PublicBeneficiaryGroup[]> {
        return this.request<PublicBeneficiaryGroup[]>(`/initiatives/${orgSlug}/${initiativeSlug}/beneficiaries`)
    }

    async getMetricDetail(orgSlug: string, initiativeSlug: string, metricSlug: string): Promise<PublicMetricDetail> {
        return this.request<PublicMetricDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/metric/${metricSlug}`)
    }

    async getStoryDetail(orgSlug: string, initiativeSlug: string, storyId: string): Promise<PublicStoryDetail> {
        return this.request<PublicStoryDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/story/${storyId}`)
    }

    async getEvidenceDetail(orgSlug: string, initiativeSlug: string, evidenceId: string): Promise<PublicEvidenceDetail> {
        return this.request<PublicEvidenceDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/evidence/${evidenceId}`)
    }

    async getImpactClaimDetail(orgSlug: string, initiativeSlug: string, claimId: string): Promise<PublicImpactClaimDetail> {
        return this.request<PublicImpactClaimDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/claim/${claimId}`)
    }

    async getBeneficiaryGroupDetail(orgSlug: string, initiativeSlug: string, groupId: string): Promise<PublicBeneficiaryGroupDetail> {
        return this.request<PublicBeneficiaryGroupDetail>(`/initiatives/${orgSlug}/${initiativeSlug}/beneficiary/${groupId}`)
    }
}

// Metric Detail types
export interface PublicMetricDetail {
    id: string
    title: string
    slug: string
    description?: string
    metric_type: 'number' | 'percentage'
    unit_of_measurement: string
    category: 'input' | 'output' | 'impact'
    display_order?: number
    total_value: number
    update_count: number
    tag_ids?: string[]
    updates: PublicKPIUpdate[]
    evidence: PublicEvidence[]
    evidence_count: number
    initiative: {
        id: string
        title: string
        slug: string
        org_slug?: string
        org_name?: string
        brand_color?: string
    }
}

// Story Detail types
export interface PublicStoryDetail {
    id: string
    title: string
    description?: string
    media_url?: string
    media_type: 'photo' | 'video' | 'recording' | 'text'
    date_represented: string
    created_at?: string
    location?: PublicLocation
    locations?: PublicLocation[]
    beneficiary_groups?: PublicBeneficiaryGroup[]
    tag_ids?: string[]
    initiative: {
        id: string
        title: string
        slug: string
        org_slug?: string
        org_name?: string
        brand_color?: string
    }
}

// Evidence Detail types
export interface PublicEvidenceDetail {
    id: string
    title: string
    description?: string
    type: string
    file_url?: string
    files: Array<{
        id: string
        file_url: string
        file_name: string
        file_type: string
        display_order?: number
    }>
    date_represented: string
    date_range_start?: string
    date_range_end?: string
    created_at?: string
    linked_kpis: Array<{
        id: string
        title: string
        description?: string
        unit_of_measurement: string
        category: 'input' | 'output' | 'impact'
    }>
    impact_claims?: Array<{
        id: string
        value: number
        date_represented?: string
        date_range_start?: string
        date_range_end?: string
        kpi_id?: string
        kpis?: { id: string; title: string; unit_of_measurement?: string }
        tag_id?: string | null
    }>
    tag_ids?: string[]
    initiative: {
        id: string
        title: string
        slug: string
        org_slug?: string
        org_name?: string
        brand_color?: string
    }
}

export interface PublicImpactClaimDetail {
    id: string
    value: number
    date_represented: string
    date_range_start?: string
    date_range_end?: string
    note?: string
    label?: string
    tag_id?: string | null
    location?: {
        id: string
        name: string
        description?: string
        latitude: number
        longitude: number
    }
    metric: {
        id: string
        title: string
        description?: string
        unit_of_measurement: string
        category: 'input' | 'output' | 'impact'
        slug: string
        tag_ids?: string[]
    }
    evidence: PublicEvidence[]
    evidence_count: number
    initiative: {
        id: string
        title: string
        slug: string
        org_slug?: string
        org_name?: string
        brand_color?: string
    }
}

export const publicApi = new PublicApiService()
