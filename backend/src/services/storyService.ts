import { supabase } from '../utils/supabase'
import { Story } from '../types'

export class StoryService {
    static async getAll(
        userId: string,
        initiativeId: string,
        filters?: {
            locationIds?: string[]
            beneficiaryGroupIds?: string[]
            startDate?: string
            endDate?: string
            search?: string
        }
    ): Promise<Story[]> {
        let query = supabase
            .from('stories')
            .select(`
                *,
                locations(id, name, description, latitude, longitude),
                story_beneficiaries(
                    beneficiary_groups(id, name, description, location_id)
                )
            `)
            .eq('user_id', userId)
            .eq('initiative_id', initiativeId)
            .order('date_represented', { ascending: false })
            .order('created_at', { ascending: false })

        // Apply filters
        if (filters?.locationIds && filters.locationIds.length > 0) {
            query = query.in('location_id', filters.locationIds)
        }

        if (filters?.startDate) {
            query = query.gte('date_represented', filters.startDate)
        }

        if (filters?.endDate) {
            query = query.lte('date_represented', filters.endDate)
        }

        if (filters?.search) {
            query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
        }

        const { data, error } = await query
        if (error) throw new Error(`Failed to fetch stories: ${error.message}`)

        // Transform data to include location and beneficiary groups
        const stories = (data || []).map((story: any) => {
            const transformed: Story = {
                ...story,
                location: story.locations || undefined,
                beneficiary_groups: story.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups).filter(Boolean) || [],
                beneficiary_group_ids: story.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups?.id).filter(Boolean) || []
            }
            delete (transformed as any).locations
            delete (transformed as any).story_beneficiaries
            return transformed
        })

        // Filter by beneficiary groups if specified
        if (filters?.beneficiaryGroupIds && filters.beneficiaryGroupIds.length > 0) {
            return stories.filter((story: Story) => {
                const storyGroupIds = story.beneficiary_group_ids || []
                return storyGroupIds.some(id => filters.beneficiaryGroupIds!.includes(id))
            })
        }

        return stories
    }

    static async getById(id: string, userId: string): Promise<Story> {
        const { data, error } = await supabase
            .from('stories')
            .select(`
                *,
                locations(id, name, description, latitude, longitude),
                story_beneficiaries(
                    beneficiary_groups(id, name, description, location_id)
                )
            `)
            .eq('id', id)
            .eq('user_id', userId)
            .single()

        if (error) throw new Error(`Failed to fetch story: ${error.message}`)
        if (!data) throw new Error('Story not found')

        const story: Story = {
            ...data,
            location: data.locations || undefined,
            beneficiary_groups: data.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups).filter(Boolean) || [],
            beneficiary_group_ids: data.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups?.id).filter(Boolean) || []
        }
        delete (story as any).locations
        delete (story as any).story_beneficiaries

        return story
    }

    static async create(story: Partial<Story>, userId: string): Promise<Story> {
        const { beneficiary_group_ids, ...storyData } = story

        // Insert story
        const { data: storyRecord, error: storyError } = await supabase
            .from('stories')
            .insert([{ ...storyData, user_id: userId }])
            .select()
            .single()

        if (storyError) throw new Error(`Failed to create story: ${storyError.message}`)

        // Link beneficiary groups if provided
        if (beneficiary_group_ids && beneficiary_group_ids.length > 0) {
            const links = beneficiary_group_ids.map(bgId => ({
                story_id: storyRecord.id,
                beneficiary_group_id: bgId
            }))

            const { error: linkError } = await supabase
                .from('story_beneficiaries')
                .insert(links)

            if (linkError) {
                // Rollback story creation if linking fails
                await supabase.from('stories').delete().eq('id', storyRecord.id)
                throw new Error(`Failed to link beneficiary groups: ${linkError.message}`)
            }
        }

        // Fetch complete story with relations
        return this.getById(storyRecord.id, userId)
    }

    static async update(id: string, updates: Partial<Story>, userId: string): Promise<Story> {
        const { beneficiary_group_ids, ...storyData } = updates

        // Update story
        const { error: storyError } = await supabase
            .from('stories')
            .update({ ...storyData, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)

        if (storyError) throw new Error(`Failed to update story: ${storyError.message}`)

        // Update beneficiary group links if provided
        if (beneficiary_group_ids !== undefined) {
            // Delete existing links
            await supabase
                .from('story_beneficiaries')
                .delete()
                .eq('story_id', id)

            // Insert new links
            if (beneficiary_group_ids.length > 0) {
                const links = beneficiary_group_ids.map(bgId => ({
                    story_id: id,
                    beneficiary_group_id: bgId
                }))

                const { error: linkError } = await supabase
                    .from('story_beneficiaries')
                    .insert(links)

                if (linkError) throw new Error(`Failed to update beneficiary group links: ${linkError.message}`)
            }
        }

        // Fetch updated story with relations
        return this.getById(id, userId)
    }

    static async delete(id: string, userId: string): Promise<void> {
        // Delete will cascade to story_beneficiaries due to ON DELETE CASCADE
        const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw new Error(`Failed to delete story: ${error.message}`)
    }
}





