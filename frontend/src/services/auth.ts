import { supabase } from './supabase'
import { User } from '../types'

export class AuthService {
    static async signUp(email: string, password: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`
            }
        })

        if (error) throw error
        return data
    }

    static async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) throw error
        return data
    }

    static async signOut() {
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