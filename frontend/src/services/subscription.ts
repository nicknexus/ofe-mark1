import { supabase } from './supabase'
import { SubscriptionStatus, Subscription } from '../types'

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
     * Get current subscription status and access rights
     */
    static async getStatus(): Promise<SubscriptionStatus> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/status`, {
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get subscription status')
        }
        
        return response.json()
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
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/details`, {
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get subscription details')
        }
        
        return response.json()
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
    static async createCheckoutSession(): Promise<{
        sessionId: string
        url: string
    }> {
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/create-checkout-session`, {
            method: 'POST',
            headers
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
        const headers = await getAuthHeaders()
        
        const response = await fetch(`${API_BASE_URL}/api/subscription/initiatives-usage`, {
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to get initiatives usage')
        }
        
        return response.json()
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

