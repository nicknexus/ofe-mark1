import { TimelineClaim, TimelineEvidence } from '../types'

/**
 * Pure helpers for the initiative Timeline tab: URL-param codec, filtering,
 * status derivation, and package grouping. Kept free of React so the view
 * components stay thin and this logic is unit-testable.
 */

export type TimelineView = 'claims' | 'evidence' | 'connections'
export type ConnectionStatus = 'connected' | 'not_connected'
/**
 * Which date the results are ordered by / the date-range filter applies to.
 * `activity` = when the impact happened (date_represented / range);
 * `upload` = when the record was created (created_at).
 */
export type OrderMode = 'activity' | 'upload'

export interface TimelineFilters {
 q: string
 metrics: string[]
 locations: string[]
 beneficiaryGroups: string[]
 tags: string[]
 contributors: string[]
 evidenceTypes: string[]
 status: ConnectionStatus | null
 /** Single "period of inspection" range, YYYY-MM-DD. Applies to the field
  * chosen by `orderMode` (activity vs upload). */
 dateFrom: string | null
 dateTo: string | null
 /** Ordering / date-range basis. Persistent so the user always knows how the
  * list is arranged. */
 orderMode: OrderMode
}

export const EMPTY_TIMELINE_FILTERS: TimelineFilters = {
 q: '',
 metrics: [],
 locations: [],
 beneficiaryGroups: [],
 tags: [],
 contributors: [],
 evidenceTypes: [],
 status: null,
 dateFrom: null,
 dateTo: null,
 orderMode: 'upload',
}

const CSV_KEYS = {
 metrics: 'metric',
 locations: 'loc',
 beneficiaryGroups: 'bg',
 tags: 'tag',
 contributors: 'by',
 evidenceTypes: 'type',
} as const

/** Read timeline filters out of the current URLSearchParams. */
export function filtersFromParams(params: URLSearchParams): TimelineFilters {
 const csv = (key: string) => {
 const raw = params.get(key)
 return raw ? raw.split(',').filter(Boolean) : []
 }
 const status = params.get('status')
 const order = params.get('order')
 return {
 q: params.get('q') || '',
 metrics: csv(CSV_KEYS.metrics),
 locations: csv(CSV_KEYS.locations),
 beneficiaryGroups: csv(CSV_KEYS.beneficiaryGroups),
 tags: csv(CSV_KEYS.tags),
 contributors: csv(CSV_KEYS.contributors),
 evidenceTypes: csv(CSV_KEYS.evidenceTypes),
 status: status === 'connected' || status === 'not_connected' ? status : null,
 dateFrom: params.get('from'),
 dateTo: params.get('to'),
 orderMode: order === 'activity' ? 'activity' : 'upload',
 }
}

/** Write timeline filters into a URLSearchParams (mutates a copy the caller owns). */
export function applyFiltersToParams(params: URLSearchParams, filters: TimelineFilters): void {
 const setOrDelete = (key: string, value: string | null) => {
 if (value) params.set(key, value)
 else params.delete(key)
 }
 setOrDelete('q', filters.q.trim() || null)
 setOrDelete(CSV_KEYS.metrics, filters.metrics.join(',') || null)
 setOrDelete(CSV_KEYS.locations, filters.locations.join(',') || null)
 setOrDelete(CSV_KEYS.beneficiaryGroups, filters.beneficiaryGroups.join(',') || null)
 setOrDelete(CSV_KEYS.tags, filters.tags.join(',') || null)
 setOrDelete(CSV_KEYS.contributors, filters.contributors.join(',') || null)
 setOrDelete(CSV_KEYS.evidenceTypes, filters.evidenceTypes.join(',') || null)
 setOrDelete('status', filters.status)
 setOrDelete('from', filters.dateFrom)
 setOrDelete('to', filters.dateTo)
 setOrDelete('order', filters.orderMode === 'activity' ? 'activity' : null)
}

export function hasActiveFilters(filters: TimelineFilters): boolean {
 return Boolean(
 filters.q.trim() ||
 filters.metrics.length ||
 filters.locations.length ||
 filters.beneficiaryGroups.length ||
 filters.tags.length ||
 filters.contributors.length ||
 filters.evidenceTypes.length ||
 filters.status ||
 filters.dateFrom ||
 filters.dateTo
 )
}

export function deriveClaimStatus(claim: TimelineClaim): ConnectionStatus {
 return claim.evidence_count > 0 ? 'connected' : 'not_connected'
}

export function deriveEvidenceStatus(evidence: TimelineEvidence): ConnectionStatus {
 return evidence.claim_count > 0 ? 'connected' : 'not_connected'
}

/** Does the record's activity date (or range) intersect [from, to]? */
function activityDateInRange(
 record: { date_represented: string; date_range_start?: string; date_range_end?: string },
 from: string | null,
 to: string | null
): boolean {
 if (!from && !to) return true
 const start = record.date_range_start || record.date_represented
 const end = record.date_range_end || record.date_represented
 if (!start) return false
 if (from && end < from) return false
 if (to && start > to) return false
 return true
}

/** created_at is an ISO timestamp; compare on its YYYY-MM-DD prefix. */
function uploadDateInRange(createdAt: string | undefined, from: string | null, to: string | null): boolean {
 if (!from && !to) return true
 const day = (createdAt || '').slice(0, 10)
 if (!day) return false
 if (from && day < from) return false
 if (to && day > to) return false
 return true
}

/** Range check on whichever date the current order mode inspects. */
function dateInRange(
 record: { date_represented: string; date_range_start?: string; date_range_end?: string; created_at?: string },
 filters: TimelineFilters
): boolean {
 return filters.orderMode === 'activity'
 ? activityDateInRange(record, filters.dateFrom, filters.dateTo)
 : uploadDateInRange(record.created_at, filters.dateFrom, filters.dateTo)
}

export function filterClaims(claims: TimelineClaim[], filters: TimelineFilters): TimelineClaim[] {
 const q = filters.q.trim().toLowerCase()
 return claims.filter(claim => {
 if (q && !`${claim.label || ''} ${claim.note || ''}`.toLowerCase().includes(q)) return false
 if (filters.metrics.length && !filters.metrics.includes(claim.kpi_id)) return false
 if (filters.locations.length && !(claim.location_id && filters.locations.includes(claim.location_id))) return false
 if (filters.beneficiaryGroups.length && !(claim.beneficiary_group_ids || []).some(id => filters.beneficiaryGroups.includes(id))) return false
 if (filters.tags.length && !(claim.tag_id && filters.tags.includes(claim.tag_id))) return false
 if (filters.contributors.length && !(claim.user_id && filters.contributors.includes(claim.user_id))) return false
 if (filters.status && deriveClaimStatus(claim) !== filters.status) return false
 if (!dateInRange(claim, filters)) return false
 return true
 })
}

export function filterEvidence(evidence: TimelineEvidence[], filters: TimelineFilters): TimelineEvidence[] {
 const q = filters.q.trim().toLowerCase()
 return evidence.filter(ev => {
 if (q && !`${ev.title || ''} ${ev.description || ''}`.toLowerCase().includes(q)) return false
 if (filters.metrics.length && !(ev.kpi_ids || []).some(id => filters.metrics.includes(id))) return false
 if (filters.locations.length) {
 const locationIds = ev.location_ids || (ev.location_id ? [ev.location_id] : [])
 if (!locationIds.some(id => filters.locations.includes(id))) return false
 }
 if (filters.beneficiaryGroups.length && !(ev.beneficiary_group_ids || []).some(id => filters.beneficiaryGroups.includes(id))) return false
 if (filters.tags.length && !(ev.tag_ids || []).some(id => filters.tags.includes(id))) return false
 if (filters.contributors.length && !(ev.user_id && filters.contributors.includes(ev.user_id))) return false
 if (filters.evidenceTypes.length && !filters.evidenceTypes.includes(ev.type)) return false
 if (filters.status && deriveEvidenceStatus(ev) !== filters.status) return false
 if (!dateInRange(ev, filters)) return false
 return true
 })
}

/** Sort newest upload first (created_at DESC); stable for equal timestamps. */
export function sortByUploadDate<T extends { created_at?: string }>(rows: T[]): T[] {
 return rows
 .slice()
 .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

/** Effective activity date for ordering (range end, else the single date). */
function activityDateOf(r: { date_represented?: string; date_range_end?: string; date_range_start?: string }): string {
 return r.date_range_end || r.date_represented || r.date_range_start || ''
}

/** Sort rows newest-first by whichever date the order mode selects. */
export function sortByMode<T extends { created_at?: string; date_represented?: string; date_range_start?: string; date_range_end?: string }>(
 rows: T[],
 orderMode: OrderMode
): T[] {
 if (orderMode === 'activity') {
 return rows.slice().sort((a, b) => activityDateOf(b).localeCompare(activityDateOf(a)))
 }
 return sortByUploadDate(rows)
}

/**
 * Client-side mirror of the backend auto-match gates, used by the upload
 * wizard to preview which existing claims a piece of evidence will connect
 * to before it's saved. Must stay in sync with the server rules
 * (evidenceService.autoLinkToMatchingUpdates / reconcileLinksForEvidence):
 *  - claim's metric ∈ evidence's linked metrics
 *  - claim's location ∈ evidence's locations
 *  - activity dates overlap
 *  - tag: untagged claim needs untagged evidence; tagged claim needs its tag
 *  - ben groups: both unscoped, or both scoped with an intersection
 */
export interface EvidenceScopePreview {
 kpiIds: string[]
 locationIds: string[]
 tagIds: string[]
 beneficiaryGroupIds: string[]
 dateStart: string
 dateEnd: string
}

export function previewMatchingClaims(claims: TimelineClaim[], scope: EvidenceScopePreview): TimelineClaim[] {
 if (!scope.dateStart || scope.kpiIds.length === 0 || scope.locationIds.length === 0) return []
 const dateEnd = scope.dateEnd || scope.dateStart
 return claims.filter(claim => {
 if (!scope.kpiIds.includes(claim.kpi_id)) return false
 if (!claim.location_id || !scope.locationIds.includes(claim.location_id)) return false
 const claimStart = claim.date_range_start || claim.date_represented
 const claimEnd = claim.date_range_end || claimStart
 if (!claimStart) return false
 if (!(scope.dateStart <= claimEnd && claimStart <= dateEnd)) return false
 if (claim.tag_id) {
 if (!scope.tagIds.includes(claim.tag_id)) return false
 } else if (scope.tagIds.length > 0) {
 return false
 }
 const claimGroups = claim.beneficiary_group_ids || []
 const claimScoped = claimGroups.length > 0
 const evidenceScoped = scope.beneficiaryGroupIds.length > 0
 if (claimScoped !== evidenceScoped) return false
 if (claimScoped && !claimGroups.some(id => scope.beneficiaryGroupIds.includes(id))) return false
 return true
 })
}

/** Mirror preview for a new claim: which existing evidence will auto-connect. */
export interface ClaimScopePreview {
 kpiId: string
 locationId: string
 tagId: string | null
 beneficiaryGroupIds: string[]
 dateStart: string
 dateEnd: string
}

export function previewMatchingEvidence(evidence: TimelineEvidence[], scope: ClaimScopePreview): TimelineEvidence[] {
 if (!scope.dateStart || !scope.kpiId || !scope.locationId) return []
 const dateEnd = scope.dateEnd || scope.dateStart
 return evidence.filter(ev => {
 if (!(ev.kpi_ids || []).includes(scope.kpiId)) return false
 const evLocations = ev.location_ids || (ev.location_id ? [ev.location_id] : [])
 if (!evLocations.includes(scope.locationId)) return false
 const evStart = ev.date_range_start || ev.date_represented
 const evEnd = ev.date_range_end || evStart
 if (!evStart) return false
 if (!(evStart <= dateEnd && scope.dateStart <= evEnd)) return false
 const evTags = ev.tag_ids || []
 if (scope.tagId) {
 if (!evTags.includes(scope.tagId)) return false
 } else if (evTags.length > 0) {
 return false
 }
 const evGroups = ev.beneficiary_group_ids || []
 const claimScoped = scope.beneficiaryGroupIds.length > 0
 const evidenceScoped = evGroups.length > 0
 if (claimScoped !== evidenceScoped) return false
 if (claimScoped && !scope.beneficiaryGroupIds.some(id => evGroups.includes(id))) return false
 return true
 })
}

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif']

function isImageLike(file: { file_url?: string; file_name?: string; file_type?: string }): boolean {
 if ((file.file_type || '').toLowerCase().startsWith('image/')) return true
 const extOf = (s?: string) => {
 if (!s) return ''
 const path = s.split('?')[0]
 const dot = path.lastIndexOf('.')
 return dot >= 0 ? path.slice(dot + 1).toLowerCase() : ''
 }
 return IMAGE_EXTENSIONS.includes(extOf(file.file_name)) || IMAGE_EXTENSIONS.includes(extOf(file.file_url))
}

/** First image URL across the legacy file_url and the gallery, for row thumbnails. */
export function getEvidenceImageUrl(evidence: TimelineEvidence): string | null {
 const candidates = [
 { file_url: evidence.file_url, file_type: evidence.file_type },
 ...(evidence.files || []),
 ].filter(f => !!f.file_url)
 const image = candidates.find(isImageLike)
 return image?.file_url || null
}

