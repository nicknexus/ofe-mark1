import { supabase } from './supabase'
import { SubscriptionStatus, Subscription } from '../types'
import { apiService } from './api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function getAuthHeaders() {
 const { data: { session } } = await supabase.auth.getSession()
 
 if (!session) {
 throw new Error('No authenticated session')
 }
 
 return {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${session.access_token}`
 }
}

export class SubscriptionService {
 /**
 * Get current subscription status and access rights.
 * Cached / deduped via apiService — App.tsx calls this on mount and on
 * org switches, and several components read from it. Without dedup we
 * were firing it 2-3x in parallel.
 */
 static async getStatus(): Promise<SubscriptionStatus> {
 return apiService.requestCached<SubscriptionStatus>('/subscription/status')
 }
 
 /**
 * After Stripe Checkout redirects back, persist the session so the app
 * gate does not wait on a delayed webhook.
 */
 static async confirmCheckout(sessionId: string): Promise<{
 success: boolean
 pending?: boolean
 }> {
 const headers = await getAuthHeaders()
 const response = await fetch(`${API_BASE_URL}/api/subscription/confirm-checkout`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ sessionId }),
 })
 if (!response.ok) {
 const error = await response.json().catch(() => ({}))
 throw new Error(error.error || 'Failed to confirm checkout')
 }
 apiService.clearCache('/subscription')
 return response.json()
 }

 /**
 * Get detailed subscription info (for account page)
 */
 static async getDetails(): Promise<{
 subscription: Subscription
 remainingTrialDays: number | null
 features: { name: string; included: boolean }[]
 }> {
 return apiService.requestCached('/subscription/details')
 }

 /**
 * Create a Stripe checkout session. Pass a tier + interval for self-serve
 * Growth/Pro checkout, or an explicit priceId for legacy/offer links.
 */
 static async createCheckoutSession(
 opts?: { tier?: 'growth' | 'pro'; interval?: 'monthly' | 'annual'; priceId?: string } | string
 ): Promise<{
 sessionId: string
 url: string
 }> {
 const headers = await getAuthHeaders()

 // Back-compat: a bare string is treated as a priceId.
 const body = typeof opts === 'string' ? { priceId: opts } : (opts || {})

 const response = await fetch(`${API_BASE_URL}/api/subscription/create-checkout-session`, {
 method: 'POST',
 headers,
 body: JSON.stringify(body)
 })
 
 if (!response.ok) {
 const error = await response.json().catch(() => ({}))
 // 409 = already subscribed; callers send these users to billing management.
 const err = new Error(
 response.status === 409
 ? 'You already have an active plan. Opening billing.'
 : "Couldn't open checkout. Please try again.",
 ) as Error & { usePortal?: boolean }
 err.usePortal = !!error.usePortal
 throw err
 }
 
 return response.json()
 }

 /**
 * Send the browser to Stripe Checkout for a tier. If the account already has
 * a live subscription, open billing management instead. Throws only
 * client-safe messages.
 */
 static async startCheckout(tier: 'growth' | 'pro', interval: 'monthly' | 'annual'): Promise<void> {
 try {
 const { url } = await SubscriptionService.createCheckoutSession({ tier, interval })
 if (!url) throw new Error("Couldn't open checkout. Please try again.")
 window.location.href = url
 } catch (error) {
 if ((error as { usePortal?: boolean }).usePortal) {
 const { url } = await SubscriptionService.createPortalSession()
 window.location.href = url
 return
 }
 throw error
 }
 }

 /**
 * Get initiatives usage (current count vs limit)
 */
 static async getInitiativesUsage(): Promise<{
 current: number
 limit: number | null
 canCreate: boolean
 }> {
 return apiService.requestCached('/subscription/initiatives-usage')
 }

 /**
 * Feature access for the active org (tier + which features are unlocked).
 * Used to render tags / beneficiary groups in a locked state on Free.
 */
 static async getFeatures(): Promise<{
 tier: 'free' | 'growth' | 'pro'
 tags: boolean
 beneficiaryGroups: boolean
 contentStudio: boolean
 }> {
 return apiService.requestCached('/subscription/features')
 }

 /**
 * Create a Stripe customer portal session for managing subscription
 */
 static async createPortalSession(): Promise<{ url: string }> {
 const headers = await getAuthHeaders()
 
 const response = await fetch(`${API_BASE_URL}/api/subscription/create-portal-session`, {
 method: 'POST',
 headers
 })
 
 if (!response.ok) {
 throw new Error("Couldn't open billing. Please try again.")
 }
 
 return response.json()
 }
}

