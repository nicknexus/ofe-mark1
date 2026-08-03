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

export type DemoGenerationStatus = 'draft' | 'generating' | 'ready' | 'failed' | null

export interface DemoOrg extends Omit<Organization, 'id' | 'name' | 'slug'> {
 id: string
 name: string
 slug: string
 is_demo: true
 demo_folder?: string | null
 demo_generation_status?: DemoGenerationStatus
}

export interface CreateDemoInput {
 name: string
 brand_color?: string
 description?: string
 demo_folder?: string
}

export interface CreateDemoShellInput {
 name: string
 demo_folder?: string
 website_url?: string
 brand_color?: string
}

export interface GenerateDemoFromWebsiteInput {
 website_url: string
 name?: string
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
 demo_folder?: string | null
}

export interface AdminOrgSubscription {
 status?: string | null
 plan_tier?: string | null
 team_members_limit?: number | null
 initiatives_limit?: number | null
 locations_limit?: number | null
 storage_limit_bytes?: number | null
 ai_reports_per_day?: number | null
 trial_ends_at?: string | null
 stripe_customer_id?: string | null
 stripe_subscription_id?: string | null
}

/** Where a customer's plan came from — paid, comped by us, or neither. */
export type PlanSource = 'stripe' | 'admin' | 'code' | 'free' | 'none'

export type PlanTier = 'free' | 'growth' | 'pro'

export interface AdminOrg {
 id: string
 name: string
 slug: string
 is_public: boolean
 created_at: string
 logo_url: string | null
 brand_color: string | null
 owner: { id: string | null; email?: string; name?: string; last_sign_in_at?: string | null }
 subscription: AdminOrgSubscription | null
 plan_source: PlanSource
 limits_overridden: boolean
 usage: {
 team_members: number
 initiatives: number
 locations: number
 storage_used_bytes: number
 }
}

export interface PlanLimits {
 initiatives_limit: number | null
 team_members_limit: number | null
 locations_limit: number | null
 storage_limit_bytes: number | null
 ai_reports_per_day: number | null
}

export interface AdminBilling {
 available: boolean
 reason?: string
 message?: string
 status?: string | null
 cancel_at_period_end?: boolean
 current_period_end?: string | null
 price?: { nickname: string | null; amount: number | null; currency: string | null; interval: string | null } | null
 card?: { brand: string; last4: string; exp_month: number; exp_year: number } | null
 discount?: {
 code: string | null
 name: string | null
 percent_off: number | null
 amount_off: number | null
 currency: string | null
 duration: string | null
 duration_in_months: number | null
 ends_at: string | null
 } | null
 stripe_customer_id?: string | null
 stripe_subscription_id?: string | null
}

export interface AdminAccount {
 org: {
 id: string
 name: string
 slug: string
 description?: string | null
 is_public: boolean
 is_demo: boolean
 created_at: string
 logo_url?: string | null
 brand_color?: string | null
 website_url?: string | null
 donation_url?: string | null
 }
 owner: {
 id: string | null
 email: string | null
 name: string | null
 created_at: string | null
 last_sign_in_at: string | null
 email_confirmed: boolean
 }
 plan: {
 tier: PlanTier
 name: string
 status: string
 source: PlanSource
 trial_ends_at: string | null
 catalog_limits: PlanLimits
 effective_limits: PlanLimits
 overridden_fields: string[]
 features: { tags: boolean; beneficiaryGroups: boolean }
 }
 billing: AdminBilling | null
 access_code: { code: string | null; days_granted: number | null; description: string | null; redeemed_at: string } | null
 usage: {
 initiatives: number
 team_members: number
 locations: number
 storage_used_bytes: number
 ai_reports_today: number
 pending_invites: number
 }
 team: {
 id: string
 user_id: string
 email: string | null
 name: string | null
 member_type: string | null
 joined_at: string | null
 }[]
 activity: {
 id: string
 admin_email?: string | null
 action: string
 detail?: Record<string, unknown> | null
 created_at: string
 }[]
}

export interface PatchOrgLimitsInput {
 team_members_limit?: number | null
 initiatives_limit?: number | null
 locations_limit?: number | null
 trial_ends_at?: string | null
}

export interface AdminMe {
 id: string
 email?: string
 role: 'super' | 'support' | null
}

export interface SupportAgent {
 user_id: string
 email?: string
 name?: string
 last_sign_in_at?: string | null
 orgs: { id: string; name: string }[]
}

export interface AuditEntry {
 id: string
 admin_user_id: string
 admin_email?: string | null
 organization_id?: string | null
 organization_name?: string | null
 action: string
 detail?: Record<string, unknown> | null
 created_at: string
}

export class AdminApi {
 static async getMe(): Promise<AdminMe> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/me`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to load admin profile')
 return resp.json()
 }

 static async logSupportSession(orgId: string): Promise<void> {
 const headers = await getAuthHeaders()
 await fetch(`${API_BASE_URL}/api/admin/audit/support-session`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ organization_id: orgId }),
 })
 }

 static async listAgents(): Promise<SupportAgent[]> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to list agents')
 return resp.json()
 }

 static async createAgent(email: string, mode: 'create' | 'promote'): Promise<{ user_id: string; emailSent: boolean; setupLink?: string }> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/agents`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ email, mode }),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to add agent')
 return resp.json()
 }

 static async revokeAgent(userId: string): Promise<void> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/agents/${userId}`, { method: 'DELETE', headers })
 if (!resp.ok && resp.status !== 204) throw new Error((await resp.json()).error || 'Failed to revoke agent')
 }

 static async assignOrg(userId: string, orgId: string): Promise<void> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/agents/${userId}/orgs`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ organization_id: orgId }),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to assign org')
 }

 static async unassignOrg(userId: string, orgId: string): Promise<void> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/agents/${userId}/orgs/${orgId}`, { method: 'DELETE', headers })
 if (!resp.ok && resp.status !== 204) throw new Error((await resp.json()).error || 'Failed to unassign org')
 }

 static async listAudit(): Promise<AuditEntry[]> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/audit`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to load audit log')
 return resp.json()
 }

 static async listOrgs(search?: string): Promise<AdminOrg[]> {
 const headers = await getAuthHeaders()
 const qs = search ? `?search=${encodeURIComponent(search)}` : ''
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs${qs}`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to list organizations')
 return resp.json()
 }

 static async getOrg(id: string): Promise<AdminOrg> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs/${id}`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to load organization')
 return resp.json()
 }

 /** Full support view of one account (owner, plan, billing, usage, team, activity). */
 static async getOrgAccount(id: string): Promise<AdminAccount> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs/${id}/account`, { headers })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to load account')
 return resp.json()
 }

 /**
 * Move an org onto a plan without payment. Throws with code 'paying_customer'
 * when the customer has a live Stripe subscription — that must be changed in
 * Stripe so billing and access stay in sync.
 */
 static async changePlan(id: string, tier: PlanTier, reason?: string): Promise<AdminOrgSubscription> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs/${id}/plan`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ tier, reason }),
 })
 if (!resp.ok) {
 const body = await resp.json().catch(() => ({}))
 const err = new Error(body.error || 'Failed to change plan')
 ;(err as Error & { code?: string }).code = body.code
 throw err
 }
 return resp.json()
 }

 /** Discard custom limits, returning the org to its tier's defaults. */
 static async resetLimits(id: string): Promise<AdminOrgSubscription> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs/${id}/limits/reset`, {
 method: 'POST',
 headers,
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to reset limits')
 return resp.json()
 }

 static async patchOrgLimits(id: string, updates: PatchOrgLimitsInput): Promise<AdminOrgSubscription> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/orgs/${id}/limits`, {
 method: 'PATCH',
 headers,
 body: JSON.stringify(updates),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to update limits')
 return resp.json()
 }

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

 static async createDemoFromWebsite(input: GenerateDemoFromWebsiteInput): Promise<DemoOrg> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/demos/generate-from-url`, {
 method: 'POST',
 headers,
 body: JSON.stringify(input),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to generate demo')
 return resp.json()
 }

 /** Create an empty demo shell immediately (so it + its folder exist before generation). */
 static async createDemoShell(input: CreateDemoShellInput): Promise<DemoOrg> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/demos/shell`, {
 method: 'POST',
 headers,
 body: JSON.stringify(input),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to create demo')
 return resp.json()
 }

 /** Run website generation into an existing demo shell. */
 static async generateInto(id: string, input: GenerateDemoFromWebsiteInput): Promise<DemoOrg> {
 const headers = await getAuthHeaders()
 const resp = await fetch(`${API_BASE_URL}/api/admin/demos/${id}/generate`, {
 method: 'POST',
 headers,
 body: JSON.stringify(input),
 })
 if (!resp.ok) throw new Error((await resp.json()).error || 'Failed to generate demo')
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
