import { supabase } from './supabase'
import { User } from '../types'
import { apiService } from './api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export class AuthService {
    static async signUp(email: string, password: string, name: string, organizationName: string) {
        if (!organizationName || organizationName.trim() === '') {
            throw new Error('Organization name is required')
        }

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
                organizationName
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

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error

        // Clear cache again after signin to ensure fresh data
        apiService.clearCache()

        return data
    }

    static async signOut() {
        // Clear cache on sign out
        apiService.clearCache()
        
        const { error } = await supabase.auth.signOut()
        if (error) throw error
    }

    static async getCurrentUser(): Promise<User | null> {
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) return null

        return {
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name,
            organization: user.user_metadata?.organization
        }
    }

    static async updateProfile(updates: { name?: string; organization?: string }) {
        const { data, error } = await supabase.auth.updateUser({
            data: updates
        })

        if (error) throw error
        return data
    }

    static onAuthStateChange(callback: (user: User | null) => void) {
        return supabase.auth.onAuthStateChange(async (event, session) => {
            // Clear cache on auth state changes (sign in, sign out, token refresh)
            if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
                apiService.clearCache()
            }

            if (session?.user) {
                const user: User = {
                    id: session.user.id,
                    email: session.user.email || '',
                    name: session.user.user_metadata?.name,
                    organization: session.user.user_metadata?.organization
                }
                callback(user)
            } else {
                callback(null)
            }
        })
    }
} 