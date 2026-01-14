import { supabase } from './supabase'
import {
    Initiative,
    KPI,
    KPIWithEvidence,
    KPIUpdate,
    Evidence,
    BeneficiaryGroup,
    Location,
    InitiativeDashboard,
    CreateInitiativeForm,
    CreateKPIForm,
    CreateKPIUpdateForm,
    CreateEvidenceForm,
    CreateStoryForm,
    Story,
    Organization,
    Donor,
    DonorCredit
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
    private requestCache = new Map<string, { promise: Promise<any>, timestamp: number }>()
    private readonly CACHE_DURATION = 60000 // 1 minute for GET requests (better performance)
    private readonly REQUEST_DELAY = 100 // Minimum delay between requests

    private async getAuthHeaders() {
        // Try to get session immediately (fast path for cached sessions)
        let { data: { session } } = await supabase.auth.getSession()

        // If no session, wait a bit and retry (session might be restoring from localStorage)
        if (!session) {
            await this.sleep(100)
            const retryResult = await supabase.auth.getSession()
            session = retryResult.data.session
        }

        // If still no session, try getUser() which waits for session restoration
        if (!session) {
            const { data: { user }, error } = await supabase.auth.getUser()
            if (error || !user) {
                throw new Error('No authenticated session')
            }
            // getUser() doesn't return session directly, so get it again
            const finalResult = await supabase.auth.getSession()
            session = finalResult.data.session
        }

        if (!session) {
            throw new Error('No authenticated session')
        }

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        }
    }

    private async getCacheKey(endpoint: string, options: RequestInit = {}): Promise<string> {
        // Get user ID to include in cache key so different users don't share cache
        const { data: { session } } = await supabase.auth.getSession()
        const userId = session?.user?.id || 'anonymous'

        return `${userId}:${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || {})}`
    }

    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    private async retryWithBackoff<T>(
        requestFn: () => Promise<T>,
        maxRetries: number = 3,
        baseDelay: number = 1000
    ): Promise<T> {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await requestFn()
            } catch (error: any) {
                const is429Error = error.message?.includes('Too Many Requests') ||
                    error.message?.includes('Rate Limit Exceeded') ||
                    error.message?.includes('429') ||
                    error.status === 429 ||
                    (error.response && error.response.status === 429)

                // Connection refused (server not running) - don't retry
                const isConnectionRefused = error.message?.includes('Failed to fetch') &&
                    (error.name === 'TypeError' || error.constructor?.name === 'TypeError')

                // If connection refused, throw immediately with helpful message
                if (isConnectionRefused && attempt === 0) {
                    throw new Error('Backend server is not running. Please start the server at http://localhost:3001')
                }

                const isNetworkError = !isConnectionRefused && (
                    error.message?.includes('Network error') ||
                    error.message?.includes('Failed to fetch')
                )

                // Only retry on 429 (rate limit) or transient network errors
                // Don't retry on connection refused (server not running)
                if (attempt === maxRetries || (!is429Error && !isNetworkError)) {
                    throw error
                }

                const delay = baseDelay * Math.pow(2, attempt) // Exponential backoff
                console.log(`Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`)
                await this.sleep(delay)
            }
        }
        throw new Error('Max retries exceeded')
    }

    private clearCacheByPattern(pattern: string) {
        const keysToDelete: string[] = []
        for (const key of this.requestCache.keys()) {
            if (key.includes(pattern)) {
                keysToDelete.push(key)
            }
        }
        keysToDelete.forEach(key => this.requestCache.delete(key))
    }

    // Check if data is cached for an endpoint
    async isDataCached(endpoint: string, options: RequestInit = {}): Promise<boolean> {
        const cacheKey = await this.getCacheKey(endpoint, options)
        const cached = this.requestCache.get(cacheKey)
        const now = Date.now()

        return !!(cached && (now - cached.timestamp) < this.CACHE_DURATION)
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const cacheKey = await this.getCacheKey(endpoint, options)
        const method = options.method || 'GET'
        const now = Date.now()

        // For GET requests, check cache
        if (method === 'GET') {
            const cached = this.requestCache.get(cacheKey)
            if (cached && (now - cached.timestamp) < this.CACHE_DURATION) {
                console.log(`Using cached result for: ${cacheKey}`)
                return cached.promise
            }
        }

        // Check if the same request is already in flight
        const inFlight = this.requestCache.get(cacheKey)
        if (inFlight && (now - inFlight.timestamp) < 5000) { // 5 second deduplication window
            console.log(`Request already in flight: ${cacheKey}`)
            return inFlight.promise
        }

        const requestPromise = this.retryWithBackoff(async () => {
            const headers = await this.getAuthHeaders()

            const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
                ...options,
                headers: {
                    ...headers,
                    ...options.headers
                }
            })

            if (!response.ok) {
                let errorMessage = 'API request failed'
                const contentType = response.headers.get('content-type')

                // Read response as text first to avoid consuming the body
                const responseText = await response.text()

                // Try to parse as JSON if content-type indicates JSON
                if (contentType?.includes('application/json') && responseText.trim()) {
                    try {
                        const error = JSON.parse(responseText)
                        errorMessage = error.message || error.error || `HTTP ${response.status}`
                        
                        // Preserve error code and additional data for specific handling
                        const errorWithCode = new Error(errorMessage) as any
                        errorWithCode.code = error.code
                        errorWithCode.status = response.status
                        errorWithCode.usage = error.usage // For initiative limit errors
                        throw errorWithCode
                    } catch (parseError: any) {
                        // If it's our custom error, re-throw it
                        if (parseError.code || parseError.usage) {
                            throw parseError
                        }
                        // If JSON parsing fails, fall through to status-based handling
                    }
                }

                // Handle specific status codes
                if (response.status === 429) {
                    throw new Error('Rate Limit Exceeded')
                } else if (response.status === 402) {
                    throw new Error('OpenAI Quota Exceeded')
                } else {
                    // Use response text if available, otherwise use status text
                    const message = responseText.trim() || response.statusText
                    throw new Error(`HTTP ${response.status} - ${message}`)
                }
            }

            // Handle empty responses (common for DELETE operations)
            const contentType = response.headers.get('content-type')
            const contentLength = response.headers.get('content-length')

            // If response is empty or has no content, return null
            if (contentLength === '0' || response.status === 204 || !contentType?.includes('application/json')) {
                return null
            }

            // Try to parse JSON, but handle empty responses gracefully
            const text = await response.text()
            if (!text.trim()) {
                return null
            }

            try {
                return JSON.parse(text)
            } catch (error) {
                console.warn('Failed to parse response as JSON:', text)
                return null
            }
        })

        // Cache the promise with timestamp
        this.requestCache.set(cacheKey, { promise: requestPromise, timestamp: now })

        // For mutating operations, clear related cache entries after completion
        requestPromise.finally(() => {
            if (method !== 'GET') {
                // Clear cache for related GET requests
                if (endpoint.includes('/initiatives')) {
                    this.clearCacheByPattern('/initiatives')
                }
                if (endpoint.includes('/kpis')) {
                    this.clearCacheByPattern('/kpis')
                    // KPI changes also affect initiative dashboards, locations, and evidence
                    // (backend auto-links evidence to new impact claims)
                    this.clearCacheByPattern('/initiatives')
                    this.clearCacheByPattern('/locations')
                    this.clearCacheByPattern('/evidence')
                }
                if (endpoint.includes('/evidence')) {
                    this.clearCacheByPattern('/evidence')
                    // Evidence changes also affect KPIs, initiative dashboards, and locations
                    this.clearCacheByPattern('/kpis')
                    this.clearCacheByPattern('/initiatives')
                    this.clearCacheByPattern('/locations')
                }
                if (endpoint.includes('/beneficiaries')) {
                    this.clearCacheByPattern('/beneficiaries')
                    // Beneficiary changes may affect KPI data point counts
                    this.clearCacheByPattern('/kpis')
                }
                if (endpoint.includes('/locations')) {
                    this.clearCacheByPattern('/locations')
                }

                // Remove the mutating request from cache immediately
                setTimeout(() => {
                    this.requestCache.delete(cacheKey)
                }, 100)
            }
        })

        return requestPromise
    }

    // Public method to clear cache for specific patterns (useful for components)
    public clearCache(pattern?: string) {
        if (pattern) {
            this.clearCacheByPattern(pattern)
        } else {
            // Clear all cache
            this.requestCache.clear()
        }
    }

    // Initiatives
    async getInitiatives(): Promise<Initiative[]> {
        const result = await this.request<Initiative[]>('/initiatives')
        return result || []
    }

    async getInitiative(id: string): Promise<Initiative> {
        return this.request<Initiative>(`/initiatives/${id}`)
    }

    async createInitiative(data: CreateInitiativeForm): Promise<Initiative> {
        return this.request<Initiative>('/initiatives', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateInitiative(id: string, data: Partial<CreateInitiativeForm>): Promise<Initiative> {
        return this.request<Initiative>(`/initiatives/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteInitiative(id: string): Promise<void> {
        return this.request<void>(`/initiatives/${id}`, {
            method: 'DELETE'
        })
    }

    async getInitiativeDashboard(id: string): Promise<InitiativeDashboard> {
        return this.request<InitiativeDashboard>(`/initiatives/${id}/dashboard`)
    }

    // KPIs
    async getKPIs(initiativeId?: string): Promise<KPI[]> {
        const params = initiativeId ? `?initiative_id=${initiativeId}` : ''
        const result = await this.request<KPI[]>(`/kpis${params}`)
        return result || []
    }

    async getKPI(id: string): Promise<KPI> {
        return this.request<KPI>(`/kpis/${id}`)
    }

    async getKPIsWithEvidence(initiativeId?: string): Promise<KPIWithEvidence[]> {
        const params = initiativeId ? `?initiative_id=${initiativeId}` : ''
        const result = await this.request<KPIWithEvidence[]>(`/kpis/with-evidence${params}`)
        return result || []
    }

    async createKPI(data: CreateKPIForm): Promise<KPI> {
        return this.request<KPI>('/kpis', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateKPI(id: string, data: Partial<CreateKPIForm>): Promise<KPI> {
        return this.request<KPI>(`/kpis/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteKPI(id: string): Promise<void> {
        return this.request<void>(`/kpis/${id}`, {
            method: 'DELETE'
        })
    }

    async updateKPIOrder(order: Array<{ id: string; display_order: number }>): Promise<void> {
        return this.request<void>('/kpis/update-order', {
            method: 'POST',
            body: JSON.stringify({ order })
        })
    }

    // KPI Updates
    async getKPIUpdates(kpiId: string): Promise<KPIUpdate[]> {
        const result = await this.request<KPIUpdate[]>(`/kpis/${kpiId}/updates`)
        return result || []
    }

    async getKPIEvidenceByDates(kpiId: string): Promise<any[]> {
        const result = await this.request<any[]>(`/kpis/${kpiId}/evidence-by-dates`)
        return result || []
    }

    async createKPIUpdate(kpiId: string, data: CreateKPIUpdateForm): Promise<KPIUpdate> {
        return this.request<KPIUpdate>(`/kpis/${kpiId}/updates`, {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateKPIUpdate(updateId: string, data: Partial<CreateKPIUpdateForm>): Promise<KPIUpdate> {
        return this.request<KPIUpdate>(`/kpis/updates/${updateId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteKPIUpdate(updateId: string): Promise<void> {
        return this.request<void>(`/kpis/updates/${updateId}`, {
            method: 'DELETE'
        })
    }

    // Evidence
    async getEvidence(initiativeId?: string, kpiId?: string): Promise<Evidence[]> {
        const params = new URLSearchParams()
        if (initiativeId) params.append('initiative_id', initiativeId)
        if (kpiId) params.append('kpi_id', kpiId)

        const queryString = params.toString()
        const result = await this.request<Evidence[]>(`/evidence${queryString ? `?${queryString}` : ''}`)
        return result || []
    }

    async getEvidenceItem(id: string): Promise<Evidence> {
        return this.request<Evidence>(`/evidence/${id}`)
    }

    async getEvidenceFiles(evidenceId: string): Promise<{ id: string; file_url: string; file_name: string; file_type: string; display_order: number }[]> {
        return this.request<any[]>(`/evidence/${evidenceId}/files`)
    }

    // Evidence endpoints - Direct upload to Supabase (bypasses Vercel size limits)
    async uploadFile(file: File): Promise<{ file_url: string; size: number }> {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            throw new Error('No authenticated session')
        }

        try {
            // Step 1: Get signed upload URL from backend
            const signedUrlResponse = await fetch(`${API_BASE_URL}/api/upload/signed-url`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type
                })
            })

            if (!signedUrlResponse.ok) {
                const errorData = await signedUrlResponse.json()
                throw new Error(errorData.error || 'Failed to get upload URL')
            }

            const { signedUrl, filePath, publicUrl } = await signedUrlResponse.json()

            // Step 2: Upload directly to Supabase Storage (bypasses Vercel!)
            const uploadResponse = await fetch(signedUrl, {
                method: 'PUT',
                headers: {
                    'Content-Type': file.type
                },
                body: file
            })

            if (!uploadResponse.ok) {
                throw new Error('Direct upload to storage failed')
            }

            // Step 3: Confirm upload with backend (for storage tracking)
            await fetch(`${API_BASE_URL}/api/upload/confirm`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    filePath,
                    fileSize: file.size
                })
            })

            // Trigger storage refresh after successful upload
            window.dispatchEvent(new Event('storage-updated'))

            return { file_url: publicUrl, size: file.size }
        } catch (error) {
            // Fallback: try the old endpoint for small files (backwards compatibility)
            console.warn('Direct upload failed, trying fallback:', error)
            
            const formData = new FormData()
            formData.append('file', file)

            const response = await fetch(`${API_BASE_URL}/api/upload/file`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: formData
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'File upload failed')
            }

            const result = await response.json()
            window.dispatchEvent(new Event('storage-updated'))
            return result
        }
    }

    async createEvidence(evidence: CreateEvidenceForm): Promise<Evidence> {
        return this.request<Evidence>('/evidence', {
            method: 'POST',
            body: JSON.stringify(evidence)
        })
    }

    async updateEvidence(id: string, data: Partial<CreateEvidenceForm>): Promise<Evidence> {
        return this.request<Evidence>(`/evidence/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteEvidence(id: string): Promise<void> {
        const result = await this.request<void>(`/evidence/${id}`, {
            method: 'DELETE'
        })
        
        // Trigger storage refresh after deletion
        window.dispatchEvent(new Event('storage-updated'))
        
        return result
    }

    async getEvidenceForDataPoint(updateId: string): Promise<Evidence[]> {
        return this.request<Evidence[]>(`/evidence/for-kpi-update/${updateId}`)
    }

    async getDataPointsForEvidence(evidenceId: string): Promise<any[]> {
        return this.request<any[]>(`/evidence/${evidenceId}/data-points`)
    }

    // Beneficiary Groups
    async getBeneficiaryGroups(initiativeId?: string): Promise<BeneficiaryGroup[]> {
        const params = new URLSearchParams()
        if (initiativeId) params.append('initiative_id', initiativeId)
        const qs = params.toString()
        const result = await this.request<BeneficiaryGroup[]>(`/beneficiaries${qs ? `?${qs}` : ''}`)
        return result || []
    }

    async createBeneficiaryGroup(payload: any) {
        return this.request('/beneficiaries', {
            method: 'POST',
            body: JSON.stringify(payload)
        })
    }

    async updateBeneficiaryGroup(id: string, payload: any) {
        return this.request(`/beneficiaries/${id}`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        })
    }

    async deleteBeneficiaryGroup(id: string) {
        return this.request(`/beneficiaries/${id}`, {
            method: 'DELETE'
        })
    }

    async updateBeneficiaryGroupOrder(order: Array<{ id: string; display_order: number }>): Promise<void> {
        return this.request<void>('/beneficiaries/update-order', {
            method: 'POST',
            body: JSON.stringify({ order })
        })
    }

    async replaceKPIUpdateBeneficiaries(kpiUpdateId: string, groupIds: string[]) {
        return this.request('/beneficiaries/link-kpi-update', {
            method: 'POST',
            body: JSON.stringify({ kpi_update_id: kpiUpdateId, beneficiary_group_ids: groupIds })
        })
    }

    async getBeneficiaryGroupsForUpdate(updateId: string) {
        return this.request(`/beneficiaries/for-kpi-update/${updateId}`)
    }

    async getKPIUpdatesForBeneficiaryGroup(groupId: string) {
        return this.request(`/beneficiaries/${groupId}/kpi-updates`)
    }

    async getBulkDataPointCounts(groupIds: string[]) {
        return this.request('/beneficiaries/bulk-data-point-counts', {
            method: 'POST',
            body: JSON.stringify({ group_ids: groupIds })
        })
    }

    // Organizations
    async getOrganizations(): Promise<Organization[]> {
        const result = await this.request<Organization[]>('/organizations')
        return result || []
    }

    async getOrganization(id: string): Promise<Organization> {
        return this.request<Organization>(`/organizations/${id}`)
    }

    async updateOrganization(id: string, data: Partial<Organization>): Promise<Organization> {
        return this.request<Organization>(`/organizations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    // Locations
    async getLocations(initiativeId?: string): Promise<Location[]> {
        const params = initiativeId ? `?initiative_id=${initiativeId}` : ''
        const result = await this.request<Location[]>(`/locations${params}`)
        return result || []
    }

    async getLocation(id: string): Promise<Location> {
        return this.request<Location>(`/locations/${id}`)
    }

    async createLocation(data: Partial<Location>): Promise<Location> {
        return this.request<Location>('/locations', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateLocation(id: string, data: Partial<Location>): Promise<Location> {
        return this.request<Location>(`/locations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteLocation(id: string): Promise<void> {
        return this.request<void>(`/locations/${id}`, {
            method: 'DELETE'
        })
    }

    async updateLocationOrder(order: Array<{ id: string; display_order: number }>): Promise<void> {
        return this.request<void>('/locations/update-order', {
            method: 'POST',
            body: JSON.stringify({ order })
        })
    }

    async getLocationKPIUpdates(locationId: string): Promise<KPIUpdate[]> {
        return this.request<KPIUpdate[]>(`/locations/${locationId}/kpi-updates`)
    }

    async getLocationEvidence(locationId: string): Promise<Evidence[]> {
        return this.request<Evidence[]>(`/locations/${locationId}/evidence`)
    }

    // Stories
    async getStories(initiativeId: string, filters?: {
        locationIds?: string[];
        beneficiaryGroupIds?: string[];
        startDate?: string;
        endDate?: string;
        search?: string;
    }): Promise<Story[]> {
        const params = new URLSearchParams()
        params.append('initiative_id', initiativeId)
        if (filters?.locationIds?.length) {
            filters.locationIds.forEach(id => params.append('location_id', id))
        }
        if (filters?.beneficiaryGroupIds?.length) {
            filters.beneficiaryGroupIds.forEach(id => params.append('beneficiary_group_id', id))
        }
        if (filters?.startDate) {
            params.append('start_date', filters.startDate)
        }
        if (filters?.endDate) {
            params.append('end_date', filters.endDate)
        }
        if (filters?.search) {
            params.append('search', filters.search)
        }
        const result = await this.request<Story[]>(`/stories?${params.toString()}`)
        return result || []
    }

    async getStory(id: string): Promise<Story> {
        return this.request<Story>(`/stories/${id}`)
    }

    async createStory(story: CreateStoryForm): Promise<Story> {
        return this.request<Story>('/stories', {
            method: 'POST',
            body: JSON.stringify(story)
        })
    }

    async updateStory(id: string, data: Partial<CreateStoryForm>): Promise<Story> {
        return this.request<Story>(`/stories/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteStory(id: string): Promise<void> {
        return this.request<void>(`/stories/${id}`, {
            method: 'DELETE'
        })
    }

    // Load initiatives first for immediate display
    async loadInitiativesOnly(): Promise<Initiative[]> {
        console.log('Loading initiatives...')
        const initiatives = await this.getInitiatives()
        console.log('Loaded initiatives:', initiatives.length)
        return initiatives
    }

    // Donors
    async getDonors(initiativeId: string): Promise<Donor[]> {
        return this.request<Donor[]>(`/donors?initiative_id=${initiativeId}`)
    }

    async getDonor(id: string): Promise<Donor> {
        return this.request<Donor>(`/donors/${id}`)
    }

    async createDonor(donor: Partial<Donor>): Promise<Donor> {
        return this.request<Donor>('/donors', {
            method: 'POST',
            body: JSON.stringify(donor)
        })
    }

    async updateDonor(id: string, data: Partial<Donor>): Promise<Donor> {
        return this.request<Donor>(`/donors/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteDonor(id: string): Promise<void> {
        return this.request<void>(`/donors/${id}`, {
            method: 'DELETE'
        })
    }

    async getDonorCredits(donorId: string): Promise<DonorCredit[]> {
        return this.request<DonorCredit[]>(`/donors/${donorId}/credits`)
    }

    // Donor Credits
    async getCreditsForMetric(kpiId: string): Promise<DonorCredit[]> {
        return this.request<DonorCredit[]>(`/donor-credits/by-metric/${kpiId}`)
    }

    async getTotalCreditedForMetric(kpiId: string, kpiUpdateId?: string): Promise<number> {
        const params = kpiUpdateId ? `?kpi_update_id=${kpiUpdateId}` : ''
        const result = await this.request<{ total: number }>(`/donor-credits/total/${kpiId}${params}`)
        return result.total
    }

    async createDonorCredit(credit: Partial<DonorCredit>): Promise<DonorCredit> {
        return this.request<DonorCredit>('/donor-credits', {
            method: 'POST',
            body: JSON.stringify(credit)
        })
    }

    async updateDonorCredit(id: string, data: Partial<DonorCredit>): Promise<DonorCredit> {
        return this.request<DonorCredit>(`/donor-credits/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteDonorCredit(id: string): Promise<void> {
        return this.request<void>(`/donor-credits/${id}`, {
            method: 'DELETE'
        })
    }

    // Load KPIs and evidence in parallel for background updates
    async loadKPIsAndEvidence(): Promise<{
        kpis: KPI[]
        evidence: Evidence[]
    }> {
        console.log('Loading KPIs and evidence in parallel...')

        // Load both in parallel since they're independent
        const [kpis, evidence] = await Promise.all([
            this.getKPIs(),
            this.getEvidence()
        ])

        console.log('Loaded KPIs:', kpis.length, 'Evidence:', evidence.length)
        return { kpis, evidence }
    }

    // Legacy method for backward compatibility - now just calls the new methods
    async loadDashboardData(): Promise<{
        initiatives: Initiative[]
        kpis: KPI[]
        evidence: Evidence[]
    }> {
        console.log('Loading dashboard data...')

        const initiatives = await this.loadInitiativesOnly()
        const { kpis, evidence } = await this.loadKPIsAndEvidence()

        return { initiatives, kpis, evidence }
    }

    // Reports
    async getReportData(filters: {
        initiativeId: string
        dateStart?: string
        dateEnd?: string
        kpiIds?: string[]
        locationIds?: string[]
        beneficiaryGroupIds?: string[]
        donorId?: string
    }): Promise<{
        metrics: Array<{
            id: string
            kpi_id: string
            kpi_title: string
            kpi_description: string
            value: number
            unit_of_measurement: string
            date_represented: string
            location_id?: string
            location_name?: string
        }>
        totals: Array<{
            kpi_id: string
            kpi_title: string
            kpi_description: string
            unit_of_measurement: string
            total_value: number
            count: number
        }>
        locations: Array<{
            id: string
            name: string
            description?: string
            latitude: number
            longitude: number
        }>
        stories: Array<{
            id: string
            title: string
            description?: string
            date_represented: string
            location_id?: string
            location_name?: string
        }>
        mapPoints: Array<{
            lat: number
            lng: number
            name: string
            type: 'location' | 'story'
        }>
    }> {
        return this.request('/reports/report-data', {
            method: 'POST',
            body: JSON.stringify(filters)
        })
    }

    async generateReport(data: {
        initiativeId: string
        initiativeTitle: string
        dateRange: { start: string; end: string }
        totals: any[]
        rawMetrics: any[]
        selectedStory: any
        locations: any[]
        beneficiaryGroups: any[]
        donor?: Donor
        deepLink?: string
    }): Promise<{ reportText: string }> {
        return this.request<{ reportText: string }>('/reports/generate-report', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    // Storage - Phase 1: Tracking Only
    // TODO Phase 2: Add upgrade flows when limits are enforced
    async getStorageUsage(): Promise<{
        storage_used_bytes: number
        used_gb: number
        used_percentage: number
        placeholder_max_bytes: number
        placeholder_max_gb: number
    }> {
        return this.request('/storage/usage')
    }
}

export const apiService = new ApiService() 