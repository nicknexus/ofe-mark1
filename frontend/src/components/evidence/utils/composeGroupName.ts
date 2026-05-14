import { GroupMetadata } from '../types'
import { Location, KPI, MetricTag, BeneficiaryGroup } from '../../../types'

interface NameContext {
    locations: Location[]
    kpis: Pick<KPI, 'id' | 'title'>[]
    tags: MetricTag[]
    beneficiaryGroups?: BeneficiaryGroup[]
}

function lookup<T extends { id?: string; name?: string; title?: string }>(
    arr: T[] | undefined,
    ids: string[] | undefined,
    field: 'name' | 'title',
): string[] {
    if (!arr?.length || !ids?.length) return []
    return ids
        .map(id => arr.find(x => x.id === id))
        .filter(Boolean)
        .map(x => (x as any)[field] as string)
        .filter(Boolean)
}

// Auto-name for a group, used as the column header when the user hasn't
// set a title. Composes "<Metric> — <Location> — <Tag>".
export function composeGroupName(metadata: GroupMetadata, ctx: NameContext): string {
    const parts: string[] = []
    const metrics = lookup(ctx.kpis as any, metadata.kpi_ids, 'title')
    const locs = lookup(ctx.locations, metadata.location_ids, 'name')
    const tags = lookup(ctx.tags, metadata.tag_ids, 'name')
    if (metrics.length) parts.push(metrics.length > 1 ? `${metrics[0]} +${metrics.length - 1}` : metrics[0])
    if (locs.length) parts.push(locs.length > 1 ? `${locs[0]} +${locs.length - 1}` : locs[0])
    if (tags.length) parts.push(tags.length > 1 ? `${tags[0]} +${tags.length - 1}` : tags[0])
    return parts.length ? parts.join(' · ') : 'Untitled evidence group'
}
