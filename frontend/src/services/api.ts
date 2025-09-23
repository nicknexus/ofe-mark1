import { supabase } from './supabase'
import {
    Initiative,
    KPI,
    KPIWithEvidence,
    KPIUpdate,
    Evidence,
    BeneficiaryGroup,
    InitiativeDashboard,
    CreateInitiativeForm,
    CreateKPIForm,
    CreateKPIUpdateForm,
    CreateEvidenceForm
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
    private requestCache = new Map<string, { promise: Promise<any>, timestamp: number }>()
    private readonly CACHE_DURATION = 60000 // 1 minute for GET requests (better performance)
    private readonly REQUEST_DELAY = 100 // Minimum delay between requests

    private async getAuthHeaders() {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            throw new Error('No authenticated session')
        }

        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        }
    }

    private getCacheKey(endpoint: string, options: RequestInit = {}): string {
        return `${options.method || 'GET'}:${endpoint}:${JSON.stringify(options.body || {})}`
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
                    error.message?.includes('429') ||
                    (error.response && error.response.status === 429)

                const isNetworkError = error.message?.includes('Network error') ||
                    error.message?.includes('Failed to fetch')

                // Only retry on 429 (rate limit) or network errors
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
    isDataCached(endpoint: string, options: RequestInit = {}): boolean {
        const cacheKey = this.getCacheKey(endpoint, options)
        const cached = this.requestCache.get(cacheKey)
        const now = Date.now()

        return !!(cached && (now - cached.timestamp) < this.CACHE_DURATION)
    }

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const cacheKey = this.getCacheKey(endpoint, options)
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

                if (response.status === 429) {
                    errorMessage = 'Too Many Requests'
                } else {
                    try {
                        const error = await response.json()
                        errorMessage = error.error || error.message || `HTTP ${response.status}`
                    } catch {
                        errorMessage = `HTTP ${response.status} - ${response.statusText}`
                    }
                }

                throw new Error(errorMessage)
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
                    // KPI changes also affect initiative dashboards
                    this.clearCacheByPattern('/initiatives')
                }
                if (endpoint.includes('/evidence')) {
                    this.clearCacheByPattern('/evidence')
                    // Evidence changes also affect KPIs and initiative dashboards
                    this.clearCacheByPattern('/kpis')
                    this.clearCacheByPattern('/initiatives')
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
        return this.request<Initiative[]>('/initiatives')
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
        return this.request<KPI[]>(`/kpis${params}`)
    }

    async getKPI(id: string): Promise<KPI> {
        return this.request<KPI>(`/kpis/${id}`)
    }

    async getKPIsWithEvidence(initiativeId?: string): Promise<KPIWithEvidence[]> {
        const params = initiativeId ? `?initiative_id=${initiativeId}` : ''
        return this.request<KPIWithEvidence[]>(`/kpis/with-evidence${params}`)
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

    // KPI Updates
    async getKPIUpdates(kpiId: string): Promise<KPIUpdate[]> {
        return this.request<KPIUpdate[]>(`/kpis/${kpiId}/updates`)
    }

    async getKPIEvidenceByDates(kpiId: string): Promise<any[]> {
        return this.request<any[]>(`/kpis/${kpiId}/evidence-by-dates`)
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
        return this.request<Evidence[]>(`/evidence${queryString ? `?${queryString}` : ''}`)
    }

    async getEvidenceItem(id: string): Promise<Evidence> {
        return this.request<Evidence>(`/evidence/${id}`)
    }

    // Evidence endpoints
    async uploadFile(file: File): Promise<{ file_url: string }> {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            throw new Error('No authenticated session')
        }

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

        return response.json()
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
        return this.request<void>(`/evidence/${id}`, {
            method: 'DELETE'
        })
    }

    // Beneficiary Groups
    async getBeneficiaryGroups(initiativeId?: string): Promise<BeneficiaryGroup[]> {
        const params = new URLSearchParams()
        if (initiativeId) params.append('initiative_id', initiativeId)
        const qs = params.toString()
        return this.request<BeneficiaryGroup[]>(`/beneficiaries${qs ? `?${qs}` : ''}`)
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

    // Load initiatives first for immediate display
    async loadInitiativesOnly(): Promise<Initiative[]> {
        console.log('Loading initiatives...')
        const initiatives = await this.getInitiatives()
        console.log('Loaded initiatives:', initiatives.length)
        return initiatives
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
}

export const apiService = new ApiService() 