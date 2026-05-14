import { GroupMetadata } from '../types'

function sortedKey(arr: string[] | undefined): string {
    return [...(arr || [])].sort().join('|')
}

function dateKey(m: GroupMetadata): string {
    if (m.date_range_start && m.date_range_end) return `r:${m.date_range_start}~${m.date_range_end}`
    if (m.date_represented) return `s:${m.date_represented}`
    return 'none'
}

// Canonical hash for grouping. Title is included now that it's the single source
// of truth for the evidence row name — if a user changes only a file's title,
// that file should split off into its own group rather than silently inherit
// the column's title. Description is intentionally excluded (low-signal noise).
export function groupingHash(m: GroupMetadata): string {
    return [
        (m.title || '').trim().toLowerCase(),
        sortedKey(m.location_ids),
        sortedKey(m.kpi_ids),
        sortedKey(m.tag_ids),
        sortedKey(m.beneficiary_group_ids),
        dateKey(m),
        m.type,
    ].join('::')
}

export function metadataEqual(a: GroupMetadata, b: GroupMetadata): boolean {
    return groupingHash(a) === groupingHash(b)
}
