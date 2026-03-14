import { supabase } from '../utils/supabase'
import { BeneficiaryGroup } from '../types'
import { InitiativeService } from './initiativeService'

export class BeneficiaryService {
    static async getAll(userId: string, initiativeId?: string): Promise<BeneficiaryGroup[]> {
        // If initiative_id provided, fetch directly (access controlled at route level)
        if (initiativeId) {
            const { data, error } = await supabase
                .from('beneficiary_groups')
                .select('*')
                .eq('initiative_id', initiativeId)
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });

            if (error) throw new Error(`Failed to fetch beneficiary groups: ${error.message}`);
            return data || [];
        }

        // No initiative - get all for user's accessible initiatives
        const initiatives = await InitiativeService.getAll(userId);
        if (initiatives.length === 0) {
            return [];
        }

        const initiativeIds = initiatives.map(i => i.id);
        const { data, error } = await supabase
            .from('beneficiary_groups')
            .select('*')
            .in('initiative_id', initiativeIds)
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch beneficiary groups: ${error.message}`);
        return data || [];
    }

    static async create(group: BeneficiaryGroup, userId: string): Promise<BeneficiaryGroup> {
        // Get max display_order for this initiative to set the new item at the end
        let maxOrder = 0
        if (group.initiative_id) {
            const { data: existingGroups } = await supabase
                .from('beneficiary_groups')
                .select('display_order')
                .eq('initiative_id', group.initiative_id)
                .eq('user_id', userId)
                .order('display_order', { ascending: false })
                .limit(1)
            
            if (existingGroups && existingGroups.length > 0) {
                maxOrder = (existingGroups[0].display_order ?? 0) + 1
            }
        }
        
        const { data, error } = await supabase
            .from('beneficiary_groups')
            .insert([{ ...group, user_id: userId, display_order: maxOrder }])
            .select()
            .single()

        if (error) throw new Error(`Failed to create beneficiary group: ${error.message}`)
        return data
    }

    static async update(id: string, updates: Partial<BeneficiaryGroup>, userId: string): Promise<BeneficiaryGroup> {
        const { data, error } = await supabase
            .from('beneficiary_groups')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('user_id', userId)
            .select()
            .single()

        if (error) throw new Error(`Failed to update beneficiary group: ${error.message}`)
        return data
    }

    static async delete(id: string, userId: string): Promise<void> {
        const { error } = await supabase
            .from('beneficiary_groups')
            .delete()
            .eq('id', id)
            .eq('user_id', userId)

        if (error) throw new Error(`Failed to delete beneficiary group: ${error.message}`)
    }

    /**
     * Checks if a claim and evidence are compatible based on their ben group scoping.
     * Both unscoped = match. Both scoped with overlap = match. Otherwise no match.
     */
    static beneficiaryGroupsMatch(claimGroupIds: string[], evidenceGroupIds: string[]): boolean {
        const claimScoped = claimGroupIds.length > 0
        const evidenceScoped = evidenceGroupIds.length > 0
        if (!claimScoped && !evidenceScoped) return true
        if (claimScoped !== evidenceScoped) return false
        return claimGroupIds.some(id => evidenceGroupIds.includes(id))
    }

    /**
     * Batch-fetch ben group IDs for a list of KPI update IDs.
     * Returns a map of updateId -> groupId[]
     */
    static async getBenGroupsForUpdates(updateIds: string[]): Promise<Record<string, string[]>> {
        if (updateIds.length === 0) return {}
        const { data } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select('kpi_update_id, beneficiary_group_id')
            .in('kpi_update_id', updateIds)
        const map: Record<string, string[]> = {}
        for (const row of (data || [])) {
            if (!map[row.kpi_update_id]) map[row.kpi_update_id] = []
            map[row.kpi_update_id].push(row.beneficiary_group_id)
        }
        return map
    }

    /**
     * Batch-fetch ben group IDs for a list of evidence IDs.
     * Returns a map of evidenceId -> groupId[]
     */
    static async getBenGroupsForEvidence(evidenceIds: string[]): Promise<Record<string, string[]>> {
        if (evidenceIds.length === 0) return {}
        const { data } = await supabase
            .from('evidence_beneficiary_groups')
            .select('evidence_id, beneficiary_group_id')
            .in('evidence_id', evidenceIds)
        const map: Record<string, string[]> = {}
        for (const row of (data || [])) {
            if (!map[row.evidence_id]) map[row.evidence_id] = []
            map[row.evidence_id].push(row.beneficiary_group_id)
        }
        return map
    }

    static async replaceLinksForUpdate(kpiUpdateId: string, groupIds: string[], userId: string) {
        // Delete existing
        await supabase
            .from('kpi_update_beneficiary_groups')
            .delete()
            .eq('kpi_update_id', kpiUpdateId)

        if (groupIds.length === 0) return { success: true }

        const links = groupIds.map(gid => ({ kpi_update_id: kpiUpdateId, beneficiary_group_id: gid, user_id: userId }))
        const { error } = await supabase
            .from('kpi_update_beneficiary_groups')
            .insert(links)

        if (error) throw new Error(`Failed to link data point to groups: ${error.message}`)
        return { success: true }
    }

    /**
     * Get derived location IDs for a ben group from its linked claims and evidence.
     */
    static async getDerivedLocations(groupId: string): Promise<string[]> {
        // Locations from linked impact claims
        const { data: claimLocs } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select('kpi_updates(location_id)')
            .eq('beneficiary_group_id', groupId)

        // Locations from linked evidence
        const { data: evidenceLinkData } = await supabase
            .from('evidence_beneficiary_groups')
            .select('evidence_id')
            .eq('beneficiary_group_id', groupId)

        const evidenceIds = (evidenceLinkData || []).map((l: any) => l.evidence_id).filter(Boolean)
        let evidenceLocIds: string[] = []
        if (evidenceIds.length > 0) {
            const { data: evLocs } = await supabase
                .from('evidence_locations')
                .select('location_id')
                .in('evidence_id', evidenceIds)
            evidenceLocIds = (evLocs || []).map((l: any) => l.location_id).filter(Boolean)
        }

        const claimLocIds = (claimLocs || [])
            .map((l: any) => (l.kpi_updates as any)?.location_id)
            .filter(Boolean)

        return [...new Set([...claimLocIds, ...evidenceLocIds])]
    }

    /**
     * Batch get derived locations for multiple ben groups.
     */
    static async getBulkDerivedLocations(groupIds: string[]): Promise<Record<string, string[]>> {
        if (groupIds.length === 0) return {}

        // Claim locations
        const { data: claimLinks } = await supabase
            .from('kpi_update_beneficiary_groups')
            .select('beneficiary_group_id, kpi_updates(location_id)')
            .in('beneficiary_group_id', groupIds)

        // Evidence locations
        const { data: evidenceLinks } = await supabase
            .from('evidence_beneficiary_groups')
            .select('beneficiary_group_id, evidence_id')
            .in('beneficiary_group_id', groupIds)

        const allEvidenceIds = [...new Set((evidenceLinks || []).map((l: any) => l.evidence_id).filter(Boolean))]
        let evidenceLocMap: Record<string, string[]> = {}
        if (allEvidenceIds.length > 0) {
            const { data: evLocs } = await supabase
                .from('evidence_locations')
                .select('evidence_id, location_id')
                .in('evidence_id', allEvidenceIds)
            for (const l of (evLocs || [])) {
                if (!evidenceLocMap[l.evidence_id]) evidenceLocMap[l.evidence_id] = []
                evidenceLocMap[l.evidence_id].push(l.location_id)
            }
        }

        const result: Record<string, string[]> = {}
        for (const gid of groupIds) result[gid] = []

        for (const link of (claimLinks || [])) {
            const locId = (link.kpi_updates as any)?.location_id
            if (locId && !result[link.beneficiary_group_id].includes(locId)) {
                result[link.beneficiary_group_id].push(locId)
            }
        }

        for (const link of (evidenceLinks || [])) {
            const locs = evidenceLocMap[link.evidence_id] || []
            for (const locId of locs) {
                if (!result[link.beneficiary_group_id].includes(locId)) {
                    result[link.beneficiary_group_id].push(locId)
                }
            }
        }

        return result
    }
}



