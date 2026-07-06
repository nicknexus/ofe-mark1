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
 * Activate the always-free plan (no card, no expiry).
 */
 static async activateFree(): Promise<{
 success: boolean
 subscription: Subscription
 remainingTrialDays: number
 message: string
 }> {
 const headers = await getAuthHeaders()
 
 const response = await fetch(`${API_BASE_URL}/api/subscription/activate-free`, {
 method: 'POST',
 headers
 })
 
 if (!response.ok) {
 const error = await response.json()
 throw new Error(error.error || 'Failed to activate free plan')
 }

 // Bust the cached /subscription/status so the app re-reads the new access
 // state immediately (otherwise the gate sticks until a manual reload).
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
 * Redeem an access code for extended trial
 */
 static async redeemCode(code: string): Promise<{
 success: boolean
 subscription: Subscription
 remainingTrialDays: number
 daysGranted: number
 message: string
 }> {
 const headers = await getAuthHeaders()
 
 const response = await fetch(`${API_BASE_URL}/api/subscription/redeem-code`, {
 method: 'POST',
 headers,
 body: JSON.stringify({ code })
 })
 
 if (!response.ok) {
 let message = 'Failed to redeem access code'
 try {
 const error = await response.json()
 if (error?.error && typeof error.error === 'string') message = error.error
 } catch {
 // non-JSON or empty body
 }
 throw new Error(message)
 }

 apiService.clearCache('/subscription')

 return response.json()
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
 const error = await response.json()
 throw new Error(error.error || 'Failed to create checkout session')
 }
 
 return response.json()
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
 const error = await response.json()
 throw new Error(error.error || 'Failed to create portal session')
 }
 
 return response.json()
 }
}

