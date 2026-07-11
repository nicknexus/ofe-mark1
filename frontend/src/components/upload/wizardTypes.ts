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
}

export interface WizardState {
 kind: WizardKind | null

 // Claim
 claimKpiId: string | null
 claimValue: string
 claimLabel: string

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

export function validateClaimStep(state: WizardState): string | null {
 if (!state.claimValue.trim() || Number.isNaN(Number(state.claimValue))) return 'Enter the number you\'re claiming'
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
export function validateAll(state: WizardState): string | null {
 const metricError = validateMetricStep(state)
 if (metricError) return metricError
 if (includesClaim(state.kind)) {
 const claimError = validateClaimStep(state)
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
