import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, Check, TrendingUp, FileText, Layers, Clock } from 'lucide-react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useUploadManager } from '../../context/UploadContext'
import { useTeam } from '../../context/TeamContext'
import {
 BeneficiaryGroup,
 CreateEvidenceForm,
 CreateKPIUpdateForm,
 Evidence,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineEvidence,
} from '../../types'
import { viewSwap } from '../timeline/motion'
import { type DateRangePickerHandle } from '../DateRangePicker'
import {
 INITIAL_WIZARD_STATE,
 WizardKind,
 WizardState,
 WizardStepId,
 filledClaimEntries,
 includesClaim,
 includesEvidence,
 inferEvidenceType,
 evidenceBuckets,
 EVIDENCE_TYPE_LABELS,
 validateAll,
 validateClaimStep,
 validateEvidenceStep,
 validateMetricStep,
 validateScopeStep,
 wizardDates,
} from './wizardTypes'
import WizardMetricStep from './WizardMetricStep'
import WizardScopeStep from './WizardScopeStep'
import WizardClaimStep from './WizardClaimStep'
import WizardClaimsStep from './WizardClaimsStep'
import WizardEvidenceStep from './WizardEvidenceStep'
import WizardReviewStep from './WizardReviewStep'

/**
 * Step branding: claim territory is blue, evidence territory is the brand
 * green, so it's always obvious which of the two you're adding. Single-kind
 * flows are tinted end-to-end; the "both" flow switches color as you move
 * from the claims step to the evidence step.
 */
type StepAccent = 'claim' | 'evidence' | null

const ACCENT_STYLES = {
 claim: {
 badge: 'bg-claim-100 text-claim-700',
 title: 'text-claim-700',
 backdrop: 'bg-gradient-to-br from-claim-100/80 via-transparent to-claim-50/70',
 stepDot: 'bg-claim-500',
 button: 'bg-claim-500 hover:bg-claim-600 text-white shadow-lg shadow-claim-500/25',
 tile: 'bg-claim-100',
 tileIcon: 'text-claim-700',
 solidBadge: 'bg-claim-500',
 hoverBorder: 'hover:border-claim-300',
 label: 'Impact claims',
 icon: TrendingUp,
 },
 evidence: {
 badge: 'bg-primary-100 text-primary-800',
 title: 'text-primary-800',
 backdrop: 'bg-gradient-to-br from-primary-100/80 via-transparent to-primary-50/70',
 stepDot: 'bg-primary-600',
 button: 'app-btn-primary',
 tile: 'bg-primary-100',
 tileIcon: 'text-primary-800',
 solidBadge: 'bg-primary-500',
 hoverBorder: 'hover:border-primary-300',
 label: 'Evidence',
 icon: FileText,
 },
} as const

// "Both" leads: recording the result together with its proof is the flow we
// want most users to take — they connect automatically.
const KIND_OPTIONS: Array<{ kind: WizardKind; label: string; description: string; icon: typeof TrendingUp; badge?: string }> = [
 {
 kind: 'both',
 label: 'Claim + Evidence',
 description: 'Record a result and upload its proof in one go. They\'re connected automatically.',
 icon: Layers,
 badge: 'Recommended',
 },
 {
 kind: 'evidence',
 label: 'Evidence only',
 description: 'Upload photos, documents, receipts or testimonies. They connect to matching claims.',
 icon: FileText,
 },
 {
 kind: 'claim',
 label: 'Impact claim only',
 description: 'Record a measured result for one of your metrics. Evidence can be added later.',
 icon: TrendingUp,
 },
]

interface UploadWizardProps {
 initiativeId: string
 canCreateClaim: boolean
 canCreateEvidence: boolean
 /** When provided, claim-only gets a Simple/Advanced choice; Advanced closes the wizard and opens the claim board. */
 onAdvancedClaim?: () => void
 /** When provided, evidence-only gets a Simple/Advanced choice; Advanced closes the wizard and opens the batch organizer. */
 onAdvancedEvidence?: () => void
 /** Everything the wizard needs to preview connections; from the Timeline payload. */
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
  existingClaims: TimelineClaim[]
  existingEvidence: TimelineEvidence[]
  /** Start on a specific kind and skip the "What would you like to add?" step. */
  initialKind?: WizardKind
  /** Pre-scope to one metric and skip the metric-picker step (used by the Metrics dashboard's per-metric add). */
  lockedMetricId?: string
  /** Edit mode: update this existing claim instead of creating records. */
  editClaim?: TimelineClaim
  /** Edit mode: update this existing evidence record instead of creating. */
  editEvidence?: Evidence
  /** Add-evidence-for-a-claim: force evidence kind, lock the claim's metric,
   *  and prefill the claim's scope so the new evidence auto-connects to it. */
  evidenceForClaim?: TimelineClaim
  onClose: () => void
  onCreated: () => void
}

/** Prefill the wizard state from the record being edited. */
function stateFromEdit(editClaim?: TimelineClaim, editEvidence?: Evidence): Partial<WizardState> {
  const record: any = editClaim || editEvidence
  if (!record) return {}
  const shared: Partial<WizardState> = {
    editing: true,
    dateMode: record.date_range_start && record.date_range_end ? 'range' : 'single',
    dateSingle: record.date_range_start && record.date_range_end ? '' : (record.date_represented || ''),
    dateStart: record.date_range_start || '',
    dateEnd: record.date_range_end || '',
    beneficiaryGroupIds: record.beneficiary_group_ids || [],
  }
  if (editClaim) {
    return {
      ...shared,
      kind: 'claim',
      claimKpiId: editClaim.kpi_id,
      claimValue: String(editClaim.value ?? ''),
      claimLabel: (editClaim as any).label || '',
      locationIds: editClaim.location_id ? [editClaim.location_id] : [],
      tagIds: (editClaim as any).tag_id ? [(editClaim as any).tag_id] : [],
    }
  }
  const ev = editEvidence!
  const fileEntries = ev.files?.length
    ? ev.files.map(f => ({ url: f.file_url, name: f.file_name || f.file_url.split('/').pop() || 'Attached file' }))
    : ev.file_url ? [{ url: ev.file_url, name: ev.file_url.split('/').pop() || 'Attached file' }] : []
  return {
    ...shared,
    kind: 'evidence',
    evidenceKpiIds: ev.kpi_ids || [],
    evidenceTitle: ev.title || '',
    evidenceType: ev.type,
    evidenceDescription: ev.description || '',
    locationIds: ev.location_ids?.length ? ev.location_ids : ev.location_id ? [ev.location_id] : [],
    tagIds: ev.tag_ids || [],
    files: fileEntries.map((f, i) => ({
      id: `existing-${i}`,
      name: f.name,
      size: 0,
      status: 'done' as const,
      progress: 100,
      url: f.url,
      existing: true,
    })),
  }
}

/** Prefill evidence scope from a claim so the new evidence auto-connects to it
 *  (same scope-copy trick the old quick-add dialog used). */
function stateFromClaimScope(claim?: TimelineClaim): Partial<WizardState> {
  if (!claim) return {}
  const isRange = !!(claim.date_range_start && claim.date_range_end)
  return {
    kind: 'evidence',
    evidenceKpiIds: claim.kpi_id ? [claim.kpi_id] : [],
    locationIds: claim.location_id ? [claim.location_id] : [],
    tagIds: (claim as any).tag_id ? [(claim as any).tag_id] : [],
    beneficiaryGroupIds: claim.beneficiary_group_ids || [],
    dateMode: isRange ? 'range' : 'single',
    dateSingle: isRange ? '' : (claim.date_represented || ''),
    dateStart: claim.date_range_start || '',
    dateEnd: claim.date_range_end || '',
  }
}

const STEP_META: Record<WizardStepId, { label: string | ((s: WizardState) => string); title: (s: WizardState) => string; subtitle: (s: WizardState) => string }> = {
 type: {
 label: 'Type',
 title: () => 'What does this log contain?',
 subtitle: () => 'A log is one record of work — claims, evidence, or both together',
 },
 mode: {
 label: 'How',
 title: (s) => s.kind === 'claim' ? 'How do you want to add claims?' : 'How do you want to upload evidence?',
 subtitle: () => 'Simple walks you through step by step; Advanced is the power tool for bulk work',
 },
 metric: {
 label: 'Metric',
 title: (s) => includesClaim(s.kind) ? 'Which metric is this result for?' : 'Which metrics does this evidence support?',
 subtitle: (s) => includesClaim(s.kind)
 ? 'Pick the thing you\'re measuring'
 : 'Pick one, several, or all — broad documents like annual reports can support everything',
 },
 scope: {
 label: 'Where & when',
 title: () => 'Where and when did this happen?',
 subtitle: (s) => s.kind === 'both'
 ? 'Set the scope once — every claim and all evidence in this log will share it'
 : 'This decides what gets connected automatically — matching scope means an automatic link',
 },
 claim: {
 label: s => s.kind === 'both' ? 'Claims' : 'Result',
 title: (s) => s.kind === 'both' ? 'Add your impact claims' : 'Claim the result',
 subtitle: (s) => s.kind === 'both'
 ? 'Enter a result for any metric this work touched — leave the rest blank'
 : 'The number you achieved in that place and time',
 },
 evidence: {
 label: () => 'Evidence',
 title: (s) => s.kind === 'both' ? 'Now add the evidence' : 'Add the proof',
 subtitle: (s) => s.kind === 'both'
 ? 'These files will connect to every claim you just entered'
 : 'Upload the files that back this up',
 },
 review: {
 label: 'Review',
 title: (s) => s.editing ? 'Review & save changes' : 'Review & save',
 subtitle: (s) => s.editing
 ? 'Check the updated details before saving'
 : 'Check what will be created and what it will connect to',
 },
}

/**
 * Full-screen guided "Add Log" flow — one log can hold evidence, an impact
 * claim, or both. Small, clearly-named steps: choose type → choose metric(s)
 * → where & when → claim the result → add the proof → review. One shared
 * Where & When scope means claim + evidence logged together always
 * auto-link, and the review step previews every connection before anything
 * is saved.
 */
export default function UploadWizard({
 initiativeId,
 canCreateClaim,
 canCreateEvidence,
 onAdvancedClaim,
 onAdvancedEvidence,
  kpis,
  locations,
  tags,
  beneficiaryGroups,
  existingClaims,
  existingEvidence,
  initialKind,
  lockedMetricId,
  editClaim,
  editEvidence,
  evidenceForClaim,
  onClose,
  onCreated,
}: UploadWizardProps) {
  const { queueUpload, cancelUpload, setPanelSuppressed } = useUploadManager()
  const { requiresEvidenceApproval } = useTeam()
  const isEdit = !!editClaim || !!editEvidence

  // Add-evidence-for-a-claim implies evidence kind + the claim's metric locked.
  const startKind = initialKind ?? (evidenceForClaim ? 'evidence' : undefined)
  const lockedMetric = lockedMetricId ?? evidenceForClaim?.kpi_id

  const availableKinds = KIND_OPTIONS.filter(o =>
    o.kind === 'evidence' ? canCreateEvidence
      : o.kind === 'claim' ? canCreateClaim
        : canCreateClaim && canCreateEvidence
  )

  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_WIZARD_STATE,
    // A caller-provided kind (Metrics dashboard) or single-capability users
    // skip the type step entirely.
    kind: startKind ?? (availableKinds.length === 1 ? availableKinds[0].kind : null),
    // Pre-scope to the metric the user added from, so we can skip the picker.
    claimKpiId: lockedMetric ?? null,
    evidenceKpiIds: lockedMetric ? [lockedMetric] : [],
    // Add-evidence-for-a-claim: prefill the claim's scope so it auto-connects.
    ...stateFromClaimScope(evidenceForClaim),
    // Edit mode: everything prefilled from the record being edited.
    ...stateFromEdit(editClaim, editEvidence),
  }))
 const [stepIndex, setStepIndex] = useState(0)
 const [stepError, setStepError] = useState<string | null>(null)
 const [submitting, setSubmitting] = useState(false)
 const stateRef = useRef(state)
 const scopeDatePickerRef = useRef<DateRangePickerHandle>(null)
 const bodyScrollRef = useRef<HTMLDivElement>(null)
 stateRef.current = state

 // Next/Back (and kind-card advance) always land at the top of the step body.
 useEffect(() => {
   const el = bodyScrollRef.current
   if (!el) return
   el.scrollTop = 0
 }, [stepIndex])

 // Files upload to storage the moment they're picked, but the evidence row is
 // only written on Save. If the user bails out, delete those orphaned uploads
 // so they don't linger in the bucket (and count against storage). Guarded so
 // it runs at most once, and skipped entirely once a log is saved (the files
 // are now owned by real evidence).
 const cleanedRef = useRef(false)
 const savedRef = useRef(false)
 const discardOrphanUploads = useCallback(() => {
   if (cleanedRef.current || savedRef.current) return
   cleanedRef.current = true
   for (const f of stateRef.current.files) {
     // Files already attached to the record being edited are not orphans.
     if (f.existing) continue
     if (f.status === 'uploading') cancelUpload(f.id)
     if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
     if (f.url) void apiService.deleteUploadedFile(f.url, f.uploadedSize)
   }
 }, [cancelUpload])

 const handleClose = useCallback(() => {
   discardOrphanUploads()
   onClose()
 }, [discardOrphanUploads, onClose])

 // Safety net for any teardown path that doesn't route through handleClose.
 useEffect(() => () => discardOrphanUploads(), [discardOrphanUploads])

 // Phone: skip Simple/Advanced — always the guided wizard. Desktop unchanged.
 const [isPhone, setIsPhone] = useState(
   () => typeof window !== 'undefined' && window.innerWidth < 768,
 )
 useEffect(() => {
   const onResize = () => setIsPhone(window.innerWidth < 768)
   window.addEventListener('resize', onResize)
   return () => window.removeEventListener('resize', onResize)
 }, [])

 const hasModeChoice =
   !isPhone &&
   ((state.kind === 'claim' && !!onAdvancedClaim) ||
     (state.kind === 'evidence' && !!onAdvancedEvidence))

  const steps: WizardStepId[] = useMemo(() => {
    // Edit mode: same steps as adding, minus the choices that are already
    // made (type/mode; a claim's metric can't be moved).
    if (editClaim) return ['scope', 'claim', 'review']
    if (editEvidence) return ['metric', 'scope', 'evidence', 'review']
    const list: WizardStepId[] = []
    if (availableKinds.length > 1 && !startKind) list.push('type')
    if (hasModeChoice) list.push('mode')
    if (state.kind === 'both') {
      // Scope comes first and is shared by everything; claims are entered
      // per-metric in a stacked list, so there is no separate metric step.
      list.push('scope', 'claim', 'evidence')
    } else {
      if (!lockedMetric) list.push('metric')
      list.push('scope')
      if (includesClaim(state.kind)) list.push('claim')
      if (includesEvidence(state.kind)) list.push('evidence')
    }
    list.push('review')
    return list
  }, [availableKinds.length, state.kind, hasModeChoice, startKind, lockedMetric, editClaim, editEvidence])

  const step = steps[Math.min(stepIndex, steps.length - 1)]

  // Which side of the log we're in right now (drives the teal/green theme).
  // Single-kind flows are branded end-to-end (including Simple/Advanced);
  // the "both" flow switches color on its claim and evidence steps.
  const accent: StepAccent =
    step === 'type' ? null
      : state.kind === 'claim' ? 'claim'
        : state.kind === 'evidence' ? 'evidence'
          : step === 'claim' ? 'claim'
            : step === 'evidence' ? 'evidence'
              : null
  const accentStyle = accent ? ACCENT_STYLES[accent] : null

 // The wizard shows its own upload progress; hide the floating panel.
 useEffect(() => {
 setPanelSuppressed(true)
 return () => setPanelSuppressed(false)
 }, [setPanelSuppressed])

 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && !submitting) handleClose()
 }
 window.addEventListener('keydown', onKey)
 return () => window.removeEventListener('keydown', onKey)
 }, [handleClose, submitting])

 const update = (patch: Partial<WizardState>) => {
 setState(prev => {
 const next = { ...prev, ...patch }
 stateRef.current = next
 return next
 })
 setStepError(null)
 }

 const handleAddFiles = (files: File[]) => {
 for (const file of files) {
 const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
 const uploadId = queueUpload({
 file,
 onComplete: (result) => {
 setState(prev => ({
 ...prev,
 files: prev.files.map(f => f.id === uploadId
 ? { ...f, status: 'done', progress: 100, url: result.file_url, uploadedSize: result.size }
 : f),
 }))
 },
 onError: (error) => {
 setState(prev => ({
 ...prev,
 files: prev.files.map(f => f.id === uploadId
 ? { ...f, status: 'error', error: error.message }
 : f),
 }))
 },
 })
 setState(prev => ({
 ...prev,
 files: [...prev.files, {
 id: uploadId,
 name: file.name,
 size: file.size,
 status: 'uploading',
 progress: 0,
 previewUrl,
 type: inferEvidenceType(file.name, file.type),
 }],
 }))
 }
 setStepError(null)
 }

 const handleSetFileType = (fileId: string, type: Evidence['type']) => {
 setState(prev => ({ ...prev, files: prev.files.map(f => f.id === fileId ? { ...f, type } : f) }))
 setStepError(null)
 }

 const handleSetAllFileTypes = (type: Evidence['type']) => {
 setState(prev => ({ ...prev, files: prev.files.map(f => f.existing ? f : { ...f, type }) }))
 setStepError(null)
 }

 const handleRemoveFile = (fileId: string) => {
 const file = stateRef.current.files.find(f => f.id === fileId)
 // Files already attached to the edited record can't be removed here.
 if (file?.existing) return
 if (file?.status === 'uploading') cancelUpload(fileId)
 if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
 // Already landed in storage — drop it so it doesn't orphan.
 if (file?.url) void apiService.deleteUploadedFile(file.url, file.uploadedSize)
 setState(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }))
 }

 const validateCurrent = (): string | null => {
 const snapshot = stateRef.current
 switch (step) {
 case 'type': return snapshot.kind ? null : 'Choose what you want to add'
 case 'mode': return null
 case 'metric': return validateMetricStep(snapshot)
 case 'scope': return validateScopeStep(snapshot)
 case 'claim': return validateClaimStep(snapshot)
 case 'evidence': return validateEvidenceStep(snapshot)
 default: return null
 }
 }

 const advance = () => {
 setStepError(null)
 setStepIndex(i => Math.min(i + 1, steps.length - 1))
 }

 const goNext = () => {
 if (step === 'scope') scopeDatePickerRef.current?.applyPending()
 const error = validateCurrent()
 if (error) {
 setStepError(error)
 return
 }
 advance()
 }

 const goBack = () => {
 setStepError(null)
 setStepIndex(i => Math.max(i - 1, 0))
 }

 const handleChooseKind = (kind: WizardKind) => {
 update({ kind })
 // Picking a card is the answer — go straight to the next step.
 advance()
 }

 const handleSubmit = async () => {
 const error = validateAll(state)
 if (error) {
 setStepError(error)
 return
 }
 setSubmitting(true)
 try {
 const { start, end } = wizardDates(state)
 const isRange = state.dateMode === 'range' && end !== start
 const dateFields = {
 date_represented: start,
 date_range_start: isRange ? start : undefined,
 date_range_end: isRange ? end : undefined,
 }

 // Edit mode — update the existing record and stop; nothing new is created.
 if (editClaim?.id) {
 await apiService.updateKPIUpdate(editClaim.id, {
 value: Number(state.claimValue),
 label: state.claimLabel.trim() || undefined,
 ...dateFields,
 location_id: state.locationIds[0],
 tag_id: state.tagIds[0] || null,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 })
 notify.success('Impact claim updated')
 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 onCreated()
 onClose()
 return
 }
 if (editEvidence?.id) {
 const newFiles = state.files.filter(f => !f.existing && f.url)
 const evidenceUpdate: Partial<CreateEvidenceForm> = {
 title: state.evidenceTitle.trim(),
 description: state.evidenceDescription.trim() || undefined,
 type: state.evidenceType,
 ...dateFields,
 location_ids: state.locationIds,
 kpi_ids: state.evidenceKpiIds,
 tag_ids: state.tagIds,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 }
 // Only touch the file set when files were actually added — otherwise
 // the existing attachments stay exactly as they are.
 if (newFiles.length > 0) {
 const allUrls = state.files.filter(f => f.url).map(f => f.url!)
 evidenceUpdate.file_url = allUrls[0]
 evidenceUpdate.file_urls = allUrls
 evidenceUpdate.file_sizes = state.files.filter(f => f.url).map(f => f.existing ? 0 : (f.uploadedSize ?? 0))
 }
 await apiService.updateEvidence(editEvidence.id, evidenceUpdate)
 notify.success('Evidence updated')
 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 onCreated()
 onClose()
 return
 }

 // One claim per filled metric in the "both" flow; a single claim in
 // the claim-only flow. All share the scope from step one.
 const createdClaimIds: string[] = []
 const claimedKpiIds: string[] = []
 const sharedClaimFields = {
 ...dateFields,
 location_id: state.locationIds[0],
 tag_id: state.tagIds[0] || null,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 }
 if (state.kind === 'both') {
 for (const [kpiId, entry] of filledClaimEntries(state)) {
 const claimPayload: CreateKPIUpdateForm = {
 value: Number(entry.value),
 label: entry.label.trim() || undefined,
 ...sharedClaimFields,
 }
 const created = await apiService.createKPIUpdate(kpiId, claimPayload)
 if (created?.id) createdClaimIds.push(created.id)
 claimedKpiIds.push(kpiId)
 }
 } else if (includesClaim(state.kind)) {
 const claimPayload: CreateKPIUpdateForm = {
 value: Number(state.claimValue),
 label: state.claimLabel.trim() || undefined,
 ...sharedClaimFields,
 }
 const created = await apiService.createKPIUpdate(state.claimKpiId!, claimPayload)
 if (created?.id) createdClaimIds.push(created.id)
 if (state.claimKpiId) claimedKpiIds.push(state.claimKpiId)
 }

 let evidenceRecordCount = 0
 if (includesEvidence(state.kind)) {
 // Split the uploaded files into one evidence record per type (max four).
 const buckets = evidenceBuckets(state.files)
 const multi = buckets.length > 1
 const baseTitle = state.evidenceTitle.trim()
 for (const bucket of buckets) {
 const fileUrls = bucket.files.map(f => f.url!)
 const fileSizes = bucket.files.map(f => f.uploadedSize ?? 0)
 const evidencePayload: CreateEvidenceForm = {
 title: multi ? `${baseTitle} — ${EVIDENCE_TYPE_LABELS[bucket.type]}` : baseTitle,
 description: state.evidenceDescription.trim() || undefined,
 type: bucket.type,
 ...dateFields,
 initiative_id: initiativeId,
 location_ids: state.locationIds,
 kpi_ids: state.kind === 'both' ? claimedKpiIds : state.evidenceKpiIds,
 // Explicit links to the claims created moments ago (the auto-matcher
 // would also catch them — belt and braces against clock skew).
 kpi_update_ids: createdClaimIds.length > 0 ? createdClaimIds : undefined,
 tag_ids: state.tagIds,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 file_url: fileUrls[0],
 file_urls: fileUrls,
 file_sizes: fileSizes,
 }
 await apiService.createEvidence(evidencePayload)
 evidenceRecordCount++
 }
 }

 notify.success(
 state.kind === 'both'
 ? `Log saved — ${createdClaimIds.length} claim${createdClaimIds.length === 1 ? '' : 's'} and ${evidenceRecordCount} evidence record${evidenceRecordCount === 1 ? '' : 's'} connected automatically`
 : state.kind === 'claim' ? 'Log saved — impact claim added'
 : `Log saved — ${evidenceRecordCount} evidence record${evidenceRecordCount === 1 ? '' : 's'} uploaded`
 )
 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 onCreated()
 onClose()
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to save'
 notify.error(message)
 } finally {
 setSubmitting(false)
 }
 }

 const isLastStep = stepIndex === steps.length - 1
 const meta = STEP_META[step]
 const kpiTotals = useMemo(() => {
   const totals: Record<string, number> = {}
   for (const claim of existingClaims) {
     if (!claim.kpi_id) continue
     totals[claim.kpi_id] = (totals[claim.kpi_id] || 0) + (Number(claim.value) || 0)
   }
   return totals
 }, [existingClaims])
 const wideStep = step === 'scope' || step === 'metric' || (step === 'claim' && state.kind === 'both')

 return (
 <div className="fixed inset-0 z-[100] flex flex-col h-dvh overflow-hidden bg-page">
 {/* Backdrop tint — neutral by default, blue in claim territory, green in evidence territory */}
 <AnimatePresence>
 <motion.div
 key={accent ?? 'neutral'}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.35 }}
 className={`absolute inset-0 pointer-events-none ${accentStyle ? accentStyle.backdrop : ''}`}
 style={accentStyle ? undefined : {
 background: 'linear-gradient(160deg, rgba(192,223,161,0.14) 0%, rgba(255,255,255,0) 45%, rgba(130,163,161,0.10) 100%)',
 }}
 />
 </AnimatePresence>

 {/* Top bar — labeled stepper so users always know where they are */}
 <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 bg-white/80 backdrop-blur border-b border-gray-200/80">
 <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
 {steps.map((s, i) => {
 const isCurrent = i === stepIndex
 const isDone = i < stepIndex
 return (
 <React.Fragment key={s}>
 {i > 0 && <div className={`w-4 h-px flex-shrink-0 ${isDone || isCurrent ? 'bg-primary-300' : 'bg-gray-200'}`} />}
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${isCurrent
 ? `${accentStyle ? accentStyle.stepDot : 'bg-primary-500'} text-white`
 : isDone
 ? 'bg-primary-100 text-primary-800'
 : 'bg-gray-100 text-gray-400'
 }`}>
 {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
 </span>
 <span className={`text-xs font-medium hidden md:inline ${isCurrent ? 'text-gray-800' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
 {typeof STEP_META[s].label === 'function'
 ? (STEP_META[s].label as (st: WizardState) => string)(state)
 : (STEP_META[s].label as string)}
 </span>
 </div>
 </React.Fragment>
 )
 })}
 </div>
 <button
 onClick={handleClose}
 disabled={submitting}
 className="app-btn-icon rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-secondary-900 transition-colors flex items-center justify-center ml-3"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Body */}
 <div ref={bodyScrollRef} className="relative z-10 flex-1 min-h-0 overflow-y-auto">
 <div className={`${wideStep ? 'w-full px-4 sm:px-6 lg:px-10 py-4 md:py-5' : 'max-w-3xl mx-auto px-5 md:px-8 py-8'}`}>
 <AnimatePresence mode="wait">
 <motion.div
 key={step}
 initial={viewSwap.initial}
 animate={viewSwap.animate}
 exit={viewSwap.exit}
 >
 {/* Branded banner so it's unmistakable which side of the log this step is */}
 {accentStyle && (
 <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-3 ${accentStyle.badge}`}>
 <accentStyle.icon className="w-3.5 h-3.5" />
 {accentStyle.label}
 </span>
 )}
 <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${accentStyle ? accentStyle.title : 'text-gray-800'} ${step === 'type' ? 'text-center' : ''}`}>
 {meta.title(state)}
 </h1>
 <p className={`text-sm text-gray-500 mt-1.5 ${wideStep ? 'mb-4' : 'mb-6'} ${step === 'type' ? 'text-center mb-8' : ''}`}>{meta.subtitle(state)}</p>

 {step === 'type' && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 max-w-3xl mx-auto">
 {availableKinds.map(option => {
 const isSelected = state.kind === option.kind
 // Each card wears its side's color: claims teal, evidence
 // green, both a blend of the two.
 const cardStyle = option.kind === 'claim'
 ? {
 tile: 'bg-claim-100',
 icon: 'text-claim-700',
 card: isSelected
 ? 'border-claim-500 bg-claim-50 shadow-card'
 : 'border-gray-200 bg-white hover:border-claim-300',
 }
 : option.kind === 'evidence'
 ? {
 tile: 'bg-primary-100',
 icon: 'text-primary-800',
 card: isSelected
 ? 'border-primary-500 bg-primary-50 shadow-card'
 : 'border-gray-200 bg-white hover:border-primary-300',
 }
 : {
 tile: 'bg-gradient-to-br from-claim-100 to-primary-100',
 icon: 'text-secondary-700',
 card: isSelected
 ? 'border-primary-500 bg-gradient-to-br from-claim-50 to-primary-50 shadow-card'
 : 'border-gray-200 bg-white hover:border-primary-300',
 }
 return (
 <button
 key={option.kind}
 type="button"
 onClick={() => handleChooseKind(option.kind)}
 className={`relative text-left p-7 md:p-8 rounded-3xl border-2 transition-all hover:-translate-y-1 hover:shadow-card-hover ${cardStyle.card}`}
 >
 {option.badge && (
 <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-semibold uppercase tracking-wide">
 {option.badge}
 </span>
 )}
 <div className={`w-14 h-14 rounded-2xl ${cardStyle.tile} flex items-center justify-center mb-5`}>
 <option.icon className={`w-7 h-7 ${cardStyle.icon}`} />
 </div>
 <p className="text-lg font-semibold text-gray-800 mb-2">{option.label}</p>
 <p className="text-sm text-gray-500 leading-relaxed">{option.description}</p>
 </button>
 )
 })}
 </div>
 )}

 {step === 'mode' && (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
 <button
 type="button"
 onClick={advance}
 className={`relative text-left p-6 md:p-7 rounded-3xl border-2 border-gray-200 bg-white ${accentStyle?.hoverBorder || 'hover:border-primary-300'} hover:-translate-y-0.5 hover:shadow-card-hover transition-all`}
 >
 <span className={`absolute top-4 right-4 px-2 py-0.5 rounded-full ${accentStyle?.solidBadge || 'bg-primary-500'} text-white text-[10px] font-semibold uppercase tracking-wide`}>
 Recommended
 </span>
 <div className={`w-12 h-12 rounded-2xl ${accentStyle?.tile || 'bg-primary-100'} flex items-center justify-center mb-4`}>
 <Check className={`w-6 h-6 ${accentStyle?.tileIcon || 'text-primary-800'}`} />
 </div>
 <p className="text-base font-semibold text-gray-800 mb-1.5">Simple</p>
 <p className="text-sm text-gray-500 leading-relaxed">
 A guided flow, one question at a time. Best for adding one {state.kind === 'claim' ? 'result' : 'batch of files'}.
 </p>
 </button>
 <button
 type="button"
 // Parent decides whether to unmount the wizard — calling onClose here
 // would tear down self-fetching wrappers before they can swap modals.
 onClick={() => {
 if (state.kind === 'claim') onAdvancedClaim?.()
 else onAdvancedEvidence?.()
 }}
 className={`text-left p-6 md:p-7 rounded-3xl border-2 border-gray-200 bg-white ${accentStyle?.hoverBorder || 'hover:border-primary-300'} hover:-translate-y-0.5 hover:shadow-card-hover transition-all`}
 >
 <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
 <Layers className="w-6 h-6 text-gray-600" />
 </div>
 <p className="text-base font-semibold text-gray-800 mb-1.5">Advanced</p>
 <p className="text-sm text-gray-500 leading-relaxed">
 {state.kind === 'claim'
 ? 'The full claim board — add many claims across metrics at once.'
 : 'The batch organizer — sort many files into multiple evidence records.'}
 </p>
 </button>
 </div>
 )}

 {step === 'metric' && (
 <WizardMetricStep
 state={state}
 update={update}
 kpis={kpis}
 kpiTotals={kpiTotals}
 onAutoAdvance={advance}
 />
 )}

 {step === 'scope' && (
 <WizardScopeStep
 state={state}
 update={update}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 datePickerRef={scopeDatePickerRef}
 />
 )}

 {step === 'claim' && (
 state.kind === 'both' ? (
 <WizardClaimsStep
 state={state}
 update={update}
 kpis={kpis}
 lockedMetricId={lockedMetricId}
 />
 ) : (
 <WizardClaimStep state={state} update={update} kpis={kpis} />
 )
 )}

 {step === 'evidence' && (
 <WizardEvidenceStep
 state={state}
 update={update}
 onAddFiles={handleAddFiles}
 onRemoveFile={handleRemoveFile}
 onSetFileType={handleSetFileType}
 onSetAllTypes={handleSetAllFileTypes}
 />
 )}

 {step === 'review' && (
 <>
 {/* Review gate: flagged members' evidence goes to the approval queue */}
 {requiresEvidenceApproval && includesEvidence(state.kind) && !isEdit && (
 <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 mb-4 max-w-2xl">
 <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-amber-700">
 <span className="font-semibold text-amber-800">Submitted for approval:</span>{' '}
 your evidence is saved right away, but it won't connect to claims or count in any totals until an admin approves it.
 </p>
 </div>
 )}
 <WizardReviewStep
 state={state}
 kpis={kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={existingClaims}
 existingEvidence={existingEvidence}
 />
 </>
 )}
 </motion.div>
 </AnimatePresence>
 </div>
 </div>

 {/* Footer */}
 <div className="relative z-10 flex items-center justify-between px-5 py-3 flex-shrink-0 bg-white/80 backdrop-blur border-t border-gray-200/80">
 <div className="min-w-0 mr-4">
 {stepError && <p className="text-xs text-red-600 truncate">{stepError}</p>}
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {stepIndex > 0 && (
 <button onClick={goBack} disabled={submitting} className="app-btn app-btn-secondary app-btn-sm">
 <ArrowLeft className="w-4 h-4" />
 Back
 </button>
 )}
 {step === 'type' || step === 'mode' ? null : !isLastStep ? (
 <button onClick={goNext} className={`app-btn app-btn-sm ${accentStyle ? accentStyle.button : 'app-btn-primary'}`}>
 Next
 <ArrowRight className="w-4 h-4" />
 </button>
 ) : (
 <button onClick={handleSubmit} disabled={submitting} className="app-btn app-btn-primary app-btn-sm">
 <Check className="w-4 h-4" />
 {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save Log'}
 </button>
 )}
 </div>
 </div>
 </div>
 )
}
