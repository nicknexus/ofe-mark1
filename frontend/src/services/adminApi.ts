import { supabase } from './supabase'
import { Organization } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function getAuthHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Not authenticated')
    return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
    }
}

export interface DemoOrg extends Omit<Organization, 'id' | 'name' | 'slug'> {
    id: string
    name: string
    slug: string
    is_demo: true
}

export interface CreateDemoInput {
    name: string
    brand_color?: string
    description?: string
}

export interface PatchDemoInput {
    name?: string
    description?: string
    statement?: string
    brand_color?: string
    logo_url?: string
    website_url?: string
    donation_url?: string
    demo_public_share?: boolean
}

export class AdminApi {
    static async listDemos(): Promise<DemoOrg[]> {
        const headers = await getAuthHeaders()
        const resp = await fetch(`${API_BASE_URL}/api/admin/demos`, { headers })
        if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to list demos')
        return resp.json()
    }

    static async createDemo(input: CreateDemoInput): Promise<DemoOrg> {
        const headers = await getAuthHeaders()
        const resp = await fetch(`${API_BASE_URL}/api/admin/demos`, {
            method: 'POST',
            headers,
            body: JSON.stringify(input),
        })
        if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to create demo')
        return resp.json()
    }

    static async patchDemo(id: string, updates: PatchDemoInput): Promise<DemoOrg> {
        const headers = await getAuthHeaders()
        const resp = await fetch(`${API_BASE_URL}/api/admin/demos/${id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify(updates),
        })
        if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to update demo')
        return resp.json()
    }

    static async deleteDemo(id: string): Promise<void> {
        const headers = await getAuthHeaders()
        const resp = await fetch(`${API_BASE_URL}/api/admin/demos/${id}`, {
            method: 'DELETE',
            headers,
        })
        if (!resp.ok && resp.status !== 204) {
            throw new Error((await resp.json()).error || 'Failed to delete demo')
        }
    }

    static async cloneDemo(id: string, name?: string): Promise<DemoOrg> {
        const headers = await getAuthHeaders()
        const resp = await fetch(`${API_BASE_URL}/api/admin/demos/${id}/clone`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ name }),
        })
        if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to clone demo')
        return resp.json()
    }
}
