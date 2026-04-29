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
     * Start the 30-day free trial
     */
    static async startTrial(): Promise<{
        success: boolean
        subscription: Subscription
        remainingTrialDays: number
        message: string
    }> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/start-trial`, {
            method: 'POST',
            headers
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to start trial')
        }
        
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

        return response.json()
    }

    /**
     * Create a Stripe checkout session for subscription
     */
    static async createCheckoutSession(priceId?: string): Promise<{
        sessionId: string
        url: string
    }> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/create-checkout-session`, {
            method: 'POST',
            headers,
            body: JSON.stringify(priceId ? { priceId } : {})
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

