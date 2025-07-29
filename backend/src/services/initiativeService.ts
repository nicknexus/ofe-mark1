import { supabase } from '../utils/supabase';
import { Initiative } from '../types';

export class InitiativeService {
    static async create(initiative: Initiative, userId: string): Promise<Initiative> {
        const { data, error } = await supabase
            .from('initiatives')
            .insert([{ ...initiative, user_id: userId }])
            .select()
            .single();

        if (error) throw new Error(`Failed to create initiative: ${error.message}`);
        return data;
    }

    static async getAll(userId: string): Promise<Initiative[]> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch initiatives: ${error.message}`);
        return data || [];
    }

    static async getById(id: string, userId: string): Promise<Initiative | null> {
        const { data, error } = await supabase
            .from('initiatives')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null;
            throw new Error(`Failed to fetch initiative: ${error.message}`);
        }
        return data;
    }

    static async update(id: string, updates: Partial<Initiative>, userId: string): Promise<Initiative> {
        const { data, error } = await supabase
            .from('initiatives')
            .update(updates)
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update initiative: ${error.message}`);
        return data;
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('initiatives')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(`Failed to delete initiative: ${error.message}`);
    }
} 