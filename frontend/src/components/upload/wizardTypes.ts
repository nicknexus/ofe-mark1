import { Evidence } from '../../types'

export type WizardKind = 'evidence' | 'claim' | 'both'

export type WizardStepId = 'type' | 'mode' | 'metric' | 'scope' | 'claim' | 'evidence' | 'review'

export interface WizardFile {
 /** uploadId from the upload manager. */
 id: string
 name: string
 size: number
 status: 'uploading' | 'done' | 'error'
 progress: number
 url?: string
 uploadedSize?: number
 error?: string
 /** Local object URL for image thumbnails while uploading. */
 previewUrl?: string
 /** Edit mode: a file already attached to the record. Removable; storage
  *  cleanup happens on save, not on cancel. */
 existing?: boolean
 /** Local File kept so a failed tile can be retried without re-picking. */
 raw?: File
 /** Per-file evidence type. Files are grouped by this on save so each type
  *  becomes its own evidence record (max one per type). */
 type?: Evidence['type']
}

/** One optional claim per metric in the "both" flow's stacked claims step. */
export interface ClaimEntry {
 value: string
 label: string
 note: string
}

export interface WizardState {
 kind: WizardKind | null
 /** Edit mode: the wizard is updating an existing record, not creating one. */
 editing?: boolean

 // Claim (single — the claim-only flow)
 claimKpiId: string | null
 claimValue: string
 claimLabel: string
 /** Maps to kpi_updates.note — the claim's description. */
 claimNote: string
 /** "Both" flow: optional claim per metric, keyed by kpi id. */
 claimEntries: Record<string, ClaimEntry>

 // Evidence
 evidenceTitle: string
 evidenceType: Evidence['type']
 evidenceDescription: string
 files: WizardFile[]
 /** Evidence-only: which metrics this evidence supports ("All" = every id). */
 evidenceKpiIds: string[]

 // Shared scope (Where & When)
 locationIds: string[]
 dateMode: 'single' | 'range'
 dateSingle: string
 dateStart: string
 dateEnd: string
 tagIds: string[]
 beneficiaryGroupIds: string[]
}

export const INITIAL_WIZARD_STATE: WizardState = {
 kind: null,
 claimKpiId: null,
 claimValue: '',
 claimLabel: '',
 claimNote: '',
 claimEntries: {},
 evidenceTitle: '',
 evidenceType: 'visual_proof',
 evidenceDescription: '',
 files: [],
 evidenceKpiIds: [],
 locationIds: [],
 dateMode: 'single',
 dateSingle: '',
 dateStart: '',
 dateEnd: '',
 tagIds: [],
 beneficiaryGroupIds: [],
}

export const includesClaim = (kind: WizardKind | null) => kind === 'claim' || kind === 'both'
export const includesEvidence = (kind: WizardKind | null) => kind === 'evidence' || kind === 'both'

/** True when the metric has every selected tag (claims require the tag on the parent metric). */
export function kpiHasTags(kpi: { tag_ids?: string[] }, tagIds: string[]): boolean {
  if (tagIds.length === 0) return true
  const have = new Set(kpi.tag_ids || [])
  return tagIds.every(id => have.has(id))
}

/** Canonical order for the four evidence types (drives the per-file picker
 *  and the deterministic order buckets are created in). */
export const EVIDENCE_TYPE_ORDER: Evidence['type'][] = ['visual_proof', 'documentation', 'financials', 'testimony']

/** Human labels used when a multi-type upload splits into several records. */
export const EVIDENCE_TYPE_LABELS: Record<Evidence['type'], string> = {
 visual_proof: 'Photos / Videos',
 documentation: 'Documents',
 financials: 'Financials',
 testimony: 'Testimonies',
}

/** Best-guess evidence type from a file's name/mime so the user rarely has to
 *  change it. Financials can't be sniffed, so anything document-ish defaults to
 *  Documents and the user re-tags receipts/statements. */
export function inferEvidenceType(name: string, mime?: string): Evidence['type'] {
 const ext = name.split('.').pop()?.toLowerCase() || ''
 const m = (mime || '').toLowerCase()
 if (m.startsWith('image/') || m.startsWith('video/') ||
  ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'svg', 'bmp', 'tiff', 'mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v'].includes(ext))
  return 'visual_proof'
 if (m.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac'].includes(ext))
  return 'testimony'
 return 'documentation'
}

/** Group uploaded files into one bucket per evidence type (max four), in a
 *  stable order. Only files that finished uploading (have a url) are included. */
export function evidenceBuckets(files: WizardFile[]): Array<{ type: Evidence['type']; files: WizardFile[] }> {
 const map = new Map<Evidence['type'], WizardFile[]>()
 for (const f of files) {
  if (!f.url) continue
  const t = f.type || 'documentation'
  const arr = map.get(t) || []
  arr.push(f)
  map.set(t, arr)
 }
 return EVIDENCE_TYPE_ORDER.filter(t => map.has(t)).map(t => ({ type: t, files: map.get(t)! }))
}

/** Effective activity-date range from the scope step (start, end). */
export function wizardDates(state: WizardState): { start: string; end: string } {
 if (state.dateMode === 'range') {
 return { start: state.dateStart, end: state.dateEnd || state.dateStart }
 }
 return { start: state.dateSingle, end: state.dateSingle }
}

export function validateMetricStep(state: WizardState): string | null {
 if (includesClaim(state.kind)) {
 return state.claimKpiId ? null : 'Choose the metric this result belongs to'
 }
 return state.evidenceKpiIds.length > 0 ? null : 'Choose at least one metric this evidence supports'
}

/** The metrics that actually got a claim in the "both" flow's stacked step. */
export function filledClaimEntries(
  state: WizardState,
  kpis?: Array<{ id?: string; tag_ids?: string[] }>,
): Array<[string, ClaimEntry]> {
  let entries = Object.entries(state.claimEntries).filter(([, entry]) => entry.value.trim() !== '')
  if (kpis && state.tagIds.length > 0) {
    const allowed = new Set(kpis.filter(k => kpiHasTags(k, state.tagIds)).map(k => k.id!).filter(Boolean))
    entries = entries.filter(([id]) => allowed.has(id))
  }
  return entries
}

export function validateClaimStep(
  state: WizardState,
  kpis?: Array<{ id?: string; tag_ids?: string[] }>,
): string | null {
 if (state.kind === 'both') {
 const filled = filledClaimEntries(state, kpis)
 if (filled.length === 0) {
   if (state.tagIds.length > 0 && kpis && !kpis.some(k => kpiHasTags(k, state.tagIds))) {
     return 'No metrics have the tags you picked — go back and clear the tag, or add it to a metric'
   }
   return 'Enter a result for at least one metric'
 }
 if (filled.some(([, entry]) => Number.isNaN(Number(entry.value)))) return 'Claim values must be numbers'
 return null
 }
 if (!state.claimValue.trim() || Number.isNaN(Number(state.claimValue))) return 'Enter the number you\'re claiming'
 // Metric-first claim: selected tag must live on that metric.
 if (state.claimKpiId && state.tagIds.length > 0 && kpis) {
   const kpi = kpis.find(k => k.id === state.claimKpiId)
   if (kpi && !kpiHasTags(kpi, state.tagIds)) {
     return 'That tag isn’t on the chosen metric — pick a tag from the metric, or clear it'
   }
 }
 return null
}

export function validateEvidenceStep(state: WizardState): string | null {
 if (state.files.length === 0) return 'Add at least one file'
 if (state.files.some(f => f.status === 'uploading')) return 'Wait for uploads to finish'
 if (state.files.some(f => f.status === 'error')) return 'Remove or retry failed uploads'
 if (!state.evidenceTitle.trim()) return 'Give the evidence a short title'
 return null
}

/** All record-level validation, used as the final gate before saving. */
export function validateAll(
  state: WizardState,
  kpis?: Array<{ id?: string; tag_ids?: string[] }>,
): string | null {
 // The "both" flow has no metric step — its metrics come from the claims list.
 if (state.kind !== 'both') {
 const metricError = validateMetricStep(state)
 if (metricError) return metricError
 }
 if (includesClaim(state.kind)) {
 const claimError = validateClaimStep(state, kpis)
 if (claimError) return claimError
 }
 if (includesEvidence(state.kind)) {
 const evidenceError = validateEvidenceStep(state)
 if (evidenceError) return evidenceError
 }
 return validateScopeStep(state)
}

export function validateScopeStep(state: WizardState): string | null {
 if (state.locationIds.length === 0) return 'Choose at least one location'
 const { start } = wizardDates(state)
 if (!start) return 'Choose the activity date'
 if (state.dateMode === 'range' && state.dateEnd && state.dateStart > state.dateEnd) return 'The date range is reversed'
 return null
}
