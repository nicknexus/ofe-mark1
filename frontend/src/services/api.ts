import { supabase } from './supabase'
import {
    Initiative,
    KPI,
    KPIWithEvidence,
    KPIUpdate,
    Evidence,
    InitiativeDashboard,
    CreateInitiativeForm,
    CreateKPIForm,
    CreateKPIUpdateForm,
    CreateEvidenceForm
} from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

class ApiService {
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

    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const headers = await this.getAuthHeaders()

        const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
            ...options,
            headers: {
                ...headers,
                ...options.headers
            }
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Network error' }))
            throw new Error(error.error || 'API request failed')
        }

        return response.json()
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
}

export const apiService = new ApiService() 