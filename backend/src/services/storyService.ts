import { supabase } from '../utils/supabase'
import { Story } from '../types'
import { InitiativeService } from './initiativeService'

export class StoryService {
    /**
     * Verify the user has access to the initiative the story belongs to.
     * Returns the story row (without joins) when access is granted, otherwise
     * throws/returns null per useThrow.
     */
    private static async assertAccessByStoryId(
        storyId: string,
        userId: string,
        requestedOrgId?: string
    ): Promise<{ id: string; initiative_id: string; user_id: string } | null> {
        const { data: row, error } = await supabase
            .from('stories')
            .select('id, initiative_id, user_id')
            .eq('id', storyId)
            .maybeSingle()
        if (error) throw new Error(`Failed to fetch story: ${error.message}`)
        if (!row) return null
        const initiative = await InitiativeService.getById(row.initiative_id, userId, requestedOrgId)
        if (!initiative) return null
        return row
    }

    static async getAll(
        userId: string,
        initiativeId: string,
        filters?: {
            locationIds?: string[]
            beneficiaryGroupIds?: string[]
            startDate?: string
            endDate?: string
            search?: string
        },
        requestedOrgId?: string
    ): Promise<Story[]> {
        // Authorize via the initiative's org context.
        const initiative = await InitiativeService.getById(initiativeId, userId, requestedOrgId)
        if (!initiative) return []

        let query = supabase
            .from('stories')
            .select(`
                *,
                story_locations(location_id, locations(id, name, description, latitude, longitude)),
                story_beneficiaries(
                    beneficiary_groups(id, name, description, location_id)
                )
            `)
            .eq('initiative_id', initiativeId)
            .order('date_represented', { ascending: false })
            .order('created_at', { ascending: false })

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

        let stories = (data || []).map((story: any) => this.transformStory(story))

        // Filter by location via junction table (post-query since we can't do .in on nested join)
        if (filters?.locationIds && filters.locationIds.length > 0) {
            stories = stories.filter((story: Story) => {
                const storyLocationIds = story.location_ids || []
                return storyLocationIds.some(id => filters.locationIds!.includes(id))
            })
        }

        // Filter by beneficiary groups
        if (filters?.beneficiaryGroupIds && filters.beneficiaryGroupIds.length > 0) {
            stories = stories.filter((story: Story) => {
                const storyGroupIds = story.beneficiary_group_ids || []
                return storyGroupIds.some(id => filters.beneficiaryGroupIds!.includes(id))
            })
        }

        return stories
    }

    static async getById(id: string, userId: string, requestedOrgId?: string): Promise<Story> {
        const access = await this.assertAccessByStoryId(id, userId, requestedOrgId)
        if (!access) throw new Error('Story not found')

        const { data, error } = await supabase
            .from('stories')
            .select(`
                *,
                story_locations(location_id, locations(id, name, description, latitude, longitude)),
                story_beneficiaries(
                    beneficiary_groups(id, name, description, location_id)
                )
            `)
            .eq('id', id)
            .single()

        if (error) throw new Error(`Failed to fetch story: ${error.message}`)
        if (!data) throw new Error('Story not found')

        return this.transformStory(data)
    }

    private static transformStory(data: any): Story {
        const storyLocations = data.story_locations || []
        const locations = storyLocations
            .map((sl: any) => sl.locations)
            .filter(Boolean)
        const location_ids = storyLocations
            .map((sl: any) => sl.location_id)
            .filter(Boolean)

        const story: Story = {
            ...data,
            location_ids,
            locations,
            // Backward compat: populate legacy single location from first entry
            location: locations[0] || undefined,
            beneficiary_groups: data.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups).filter(Boolean) || [],
            beneficiary_group_ids: data.story_beneficiaries?.map((sb: any) => sb.beneficiary_groups?.id).filter(Boolean) || []
        }
        delete (story as any).story_locations
        delete (story as any).story_beneficiaries
        return story
    }

    static async create(story: Partial<Story>, userId: string, requestedOrgId?: string): Promise<Story> {
        const { beneficiary_group_ids, location_ids, locations: _locs, location, ...storyData } = story

        // Authorize: caller must have access to the initiative being written to.
        if (storyData.initiative_id) {
            const initiative = await InitiativeService.getById(storyData.initiative_id, userId, requestedOrgId)
            if (!initiative) throw new Error('Initiative not found or access denied')
        }

        const { data: storyRecord, error: storyError } = await supabase
            .from('stories')
            .insert([{ ...storyData, user_id: userId }])
            .select()
            .single()

        if (storyError) throw new Error(`Failed to create story: ${storyError.message}`)

        // Link locations via junction table
        if (location_ids && location_ids.length > 0) {
            const links = location_ids.map(locId => ({
                story_id: storyRecord.id,
                location_id: locId,
                user_id: userId
            }))

            const { error: locError } = await supabase
                .from('story_locations')
                .insert(links)

            if (locError) {
                await supabase.from('stories').delete().eq('id', storyRecord.id)
                throw new Error(`Failed to link locations: ${locError.message}`)
            }
        }

        // Link beneficiary groups
        if (beneficiary_group_ids && beneficiary_group_ids.length > 0) {
            const links = beneficiary_group_ids.map(bgId => ({
                story_id: storyRecord.id,
                beneficiary_group_id: bgId
            }))

            const { error: linkError } = await supabase
                .from('story_beneficiaries')
                .insert(links)

            if (linkError) {
                await supabase.from('stories').delete().eq('id', storyRecord.id)
                throw new Error(`Failed to link beneficiary groups: ${linkError.message}`)
            }
        }

        return this.getById(storyRecord.id, userId, requestedOrgId)
    }

    static async update(id: string, updates: Partial<Story>, userId: string, requestedOrgId?: string): Promise<Story> {
        const access = await this.assertAccessByStoryId(id, userId, requestedOrgId)
        if (!access) throw new Error('Story not found or access denied')

        const { beneficiary_group_ids, location_ids, locations: _locs, location, ...storyData } = updates

        const { error: storyError } = await supabase
            .from('stories')
            .update({ ...storyData, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (storyError) throw new Error(`Failed to update story: ${storyError.message}`)

        // Update location links if provided
        if (location_ids !== undefined) {
            await supabase
                .from('story_locations')
                .delete()
                .eq('story_id', id)

            if (location_ids.length > 0) {
                const links = location_ids.map(locId => ({
                    story_id: id,
                    location_id: locId,
                    user_id: userId
                }))

                const { error: locError } = await supabase
                    .from('story_locations')
                    .insert(links)

                if (locError) throw new Error(`Failed to update location links: ${locError.message}`)
            }
        }

        // Update beneficiary group links if provided
        if (beneficiary_group_ids !== undefined) {
            await supabase
                .from('story_beneficiaries')
                .delete()
                .eq('story_id', id)

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

        return this.getById(id, userId, requestedOrgId)
    }

    static async delete(id: string, userId: string, requestedOrgId?: string): Promise<void> {
        // Phase 1 (full-access baseline): any team member of the org can delete.
        const access = await this.assertAccessByStoryId(id, userId, requestedOrgId)
        if (!access) throw new Error('Story not found or access denied')

        const { error } = await supabase
            .from('stories')
            .delete()
            .eq('id', id)

        if (error) throw new Error(`Failed to delete story: ${error.message}`)
    }
}
