import { supabase } from './supabase'
import { User } from '../types'
import { apiService } from './api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export class AuthService {
    static async signUp(email: string, password: string, name: string, organizationName?: string) {
        // Clear cache before signup to prevent showing old user's data
        apiService.clearCache()

        // Use backend signup endpoint which handles organization creation
        const response = await fetch(`${API_URL}/api/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                password,
                name,
                organizationName: organizationName || undefined // Only send if provided
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Signup failed')
        }

        const data = await response.json()

        // If backend returned a session, set it in the client
        if (data.session) {
            await supabase.auth.setSession({
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token
            })
        } else {
            // Fallback: sign in directly
            await supabase.auth.signInWithPassword({
                email,
                password
            })
        }

        // Clear cache again after signup to ensure fresh data
        apiService.clearCache()

        return data
    }

    static async signIn(email: string, password: string) {
        // Clear cache before signin to prevent showing old user's data
        apiService.clearCache()
        AuthService.invalidateUserCache()

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        // Clear cache again after signin to ensure fresh data
        apiService.clearCache()
        AuthService.invalidateUserCache()

        return data
    }

    static async resetPassword(email: string) {
        const baseUrl = import.meta.env.VITE_APP_URL || window.location.origin
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${baseUrl}/reset-password`
        })
        if (error) throw error
    }

    static async updatePassword(newPassword: string) {
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) throw error
    }

    static async signOut() {
        // Clear cache on sign out
        apiService.clearCache()
        AuthService.invalidateUserCache()

        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    /** No-op kept for backwards compatibility with sign-in/out flows. */
    static invalidateUserCache() {}

    static async getCurrentUser(): Promise<User | null> {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return null

        // Best-effort: fetch platform-admin flag from backend.
        // Fails silently (e.g. backend cold start, offline) — user is treated as non-admin.
        let isAdmin = false
        try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
                const resp = await fetch(`${API_URL}/api/auth/me`, {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                })
                if (resp.ok) {
                    const me = await resp.json()
                    isAdmin = !!me?.is_admin
                }
            }
        } catch (err) {
            console.warn('[AuthService] /me lookup failed:', err)
        }

        return {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name,
            organization: user.user_metadata?.organization,
            has_completed_tutorial: user.user_metadata?.has_completed_tutorial,
            accepted_terms_of_service: user.user_metadata?.accepted_terms_of_service,
            accepted_terms_of_service_at: user.user_metadata?.accepted_terms_of_service_at,
            is_admin: isAdmin,
        }
    }

    static async updateProfile(updates: { name?: string; organization?: string; has_completed_tutorial?: boolean; accepted_terms_of_service?: boolean; accepted_terms_of_service_at?: string }) {
        const { data, error } = await supabase.auth.updateUser({
            data: updates
        })

        if (error) throw error
        return data
    }

    static onAuthStateChange(callback: (user: User | null) => void) {
        return supabase.auth.onAuthStateChange(async (event, session) => {
            // Identity change → wipe data cache. Token refresh keeps the
            // same user, so we leave data cache intact (avoids a full refetch
            // every hour when the token quietly rotates).
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                apiService.clearCache()
            }

            if (session?.user) {
                // Fetch platform-admin flag best-effort.
                let isAdmin = false
                try {
                    const resp = await fetch(`${API_URL}/api/auth/me`, {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    if (resp.ok) {
                        const me = await resp.json()
                        isAdmin = !!me?.is_admin
                    }
                } catch (err) {
                    console.warn('[AuthService] /me lookup failed in authStateChange:', err)
                }

                const user: User = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata?.name,
                    organization: session.user.user_metadata?.organization,
                    has_completed_tutorial: session.user.user_metadata?.has_completed_tutorial,
                    accepted_terms_of_service: session.user.user_metadata?.accepted_terms_of_service,
                    accepted_terms_of_service_at: session.user.user_metadata?.accepted_terms_of_service_at,
                    is_admin: isAdmin,
                }
                callback(user)
            } else {
                callback(null)
            }
        })
    }

    /**
     * Delete the current user's account and all associated data
     * Requires typing "DELETE MY ACCOUNT" as confirmation
     */
    static async deleteAccount(confirmation: string): Promise<{ success: boolean; message: string }> {
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            throw new Error('You must be logged in to delete your account')
        }

        const response = await fetch(`${API_URL}/api/auth/account`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ confirmation })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Failed to delete account')
        }

        // Clear cache and sign out locally
        apiService.clearCache()
        await supabase.auth.signOut()

        return response.json()
    }
} 