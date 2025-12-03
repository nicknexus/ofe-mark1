import { supabase } from '../utils/supabase'
import { Donor } from '../types'

export class DonorService {
    static async getAll(userId: string, initiativeId: string): Promise<Donor[]> {
        const { data, error } = await supabase
            .from('donors')
            .select('*')
            .eq('user_id', userId)
            .eq('initiative_id', initiativeId)
            .order('created_at', { ascending: false })

        if (error) throw new Error(`Failed to fetch donors: ${error.message}`)
        return data || []
    }

    static async getById(id: string, userId: string): Promise<Donor> {
        const { data, error } = await supabase
            .from('donors')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (error) throw new Error(`Failed to fetch donor: ${error.message}`)
        return data
    }

    static async create(donor: Partial<Donor>, userId: string): Promise<Donor> {
        const { data, error } = await supabase
            .from('donors')
            .insert([{ ...donor, user_id: userId }])
            .select()
            .single()

        if (error) throw new Error(`Failed to create donor: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<Donor>, userId: string): Promise<Donor> {
        const { data, error } = await supabase
            .from('donors')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(`Failed to update donor: ${error.message}`)
        return data
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('donors')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw new Error(`Failed to delete donor: ${error.message}`)
    }
}


