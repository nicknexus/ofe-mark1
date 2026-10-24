import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, Check, TrendingUp, FileText, Clock } from 'lucide-react'
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
 wizardHasClaims,
 wizardHasEvidence,
 wizardClaims,
 wizardEvidenceMetricIds,
} from './wizardTypes'
import LogEntryStep from './LogEntryStep'
import LogReviewStep from './LogReviewStep'
import { buildLogPlan, newLogRow, saveLogPlan } from './logDraft'
import WizardMetricStep from './WizardMetricStep'
import WizardScopeStep from './WizardScopeStep'
import WizardClaimStep from './WizardClaimStep'
import WizardClaimsStep from './WizardClaimsStep'
import WizardEvidenceStep from './WizardEvidenceStep'
import WizardReviewStep from './WizardReviewStep'
import CreateKPIModal from '../CreateKPIModal'
import LocationModal from '../LocationModal'
import { getLocalDateString } from '../../utils'
import type { CreateKPIForm } from '../../types'

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

interface UploadWizardProps {
 initiativeId: string
 programTitle?: string
 canCreateClaim: boolean
 canCreateEvidence: boolean
 /** Everything the wizard needs to preview connections; from the Timeline payload. */
 kpis: KPI[]
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
  /** Allow "+ New metric / location / tag" inside the wizard (admins/editors). */
  canManageStructure?: boolean
  /** Fired after anything is created inline so the parent can refresh its lists. */
  onStructureChanged?: () => void
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
      claimNote: editClaim.note || '',
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
    tagIds: claim.tag_id ? [claim.tag_id] : [],
    beneficiaryGroupIds: claim.beneficiary_group_ids || [],
    dateMode: isRange ? 'range' : 'single',
    dateSingle: isRange ? '' : (claim.date_represented || ''),
    dateStart: claim.date_range_start || '',
    dateEnd: claim.date_range_end || '',
  }
}

const STEP_META: Record<WizardStepId, { label: string | ((s: WizardState) => string); title: (s: WizardState) => string; subtitle: (s: WizardState) => string }> = {
 entry: {
 label: 'Add log',
 title: () => 'Add log',
 subtitle: () => 'Add results, evidence, or both. Either can be saved on its own.',
 },
 metric: {
 label: 'Metric',
 title: (s) => includesClaim(s.kind) ? 'Which metric is this result for?' : 'Which metrics does this evidence support?',
 subtitle: (s) => includesClaim(s.kind)
 ? 'Pick the thing you\'re measuring'
 : 'Pick one, several, or all. Broad documents like annual reports can support everything',
 },
 scope: {
 label: 'Where & when',
 title: () => 'Where and when did this happen?',
 subtitle: (s) => s.kind === 'both'
 ? 'Set the scope once. Every claim and all evidence in this log will share it'
 : 'This decides what gets connected automatically: matching scope means an automatic link',
 },
 claim: {
 label: s => s.kind === 'both' ? 'Claims' : 'Result',
 title: (s) => s.kind === 'both' ? 'Add your impact claims' : 'Claim the result',
 subtitle: (s) => s.kind === 'both'
 ? 'Enter a result for any metric this work touched. Leave the rest blank'
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
 * Capture results, evidence, or both, then review. Existing records
 * retain their focused edit steps and the same server matching rules.
 */
export default function UploadWizard({
 initiativeId,
 programTitle,
 canCreateClaim,
 canCreateEvidence,
  kpis: kpisProp,
  locations: locationsProp,
  tags: tagsProp,
  beneficiaryGroups,
  canManageStructure = false,
  onStructureChanged,
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

  // Local copies so inline creation can append without a full parent reload.
  const [kpis, setKpis] = useState<KPI[]>(kpisProp)
  const [locations, setLocations] = useState<Location[]>(locationsProp)
  const [tags, setTags] = useState<MetricTag[]>(tagsProp)
  useEffect(() => setKpis(kpisProp), [kpisProp])
  useEffect(() => setLocations(locationsProp), [locationsProp])
  useEffect(() => setTags(tagsProp), [tagsProp])

  // Add-evidence-for-a-claim implies evidence kind + the claim's metric locked.
  const startKind = initialKind ?? (evidenceForClaim ? 'evidence' : undefined)
  const lockedMetric = lockedMetricId ?? evidenceForClaim?.kpi_id

  const [state, setState] = useState<WizardState>(() => ({
    ...INITIAL_WIZARD_STATE,
    // A caller-provided kind (Metrics dashboard) or single-capability users
    // skip the type step entirely.
    kind: startKind ?? (canCreateEvidence ? 'evidence' : 'claim'),
    entryMode: !isEdit,
    logRows: isEdit ? undefined : (lockedMetric ? [{ ...newLogRow(lockedMetric), keepForEvidence: true }] : kpisProp.length === 1 && kpisProp[0].id ? [{ ...newLogRow(kpisProp[0].id), keepForEvidence: true }] : []),
    // Smart defaults: today, and the only location / metric when there is
    // exactly one. Every one of these is still editable on its step.
    dateMode: 'single',
    dateSingle: getLocalDateString(new Date()),
    locationIds: locationsProp.length === 1 && locationsProp[0].id ? [locationsProp[0].id] : [],
    // Pre-scope to the metric the user added from, so we can skip the picker.
    claimKpiId: lockedMetric ?? (kpisProp.length === 1 ? kpisProp[0].id ?? null : null),
    evidenceKpiIds: lockedMetric ? [lockedMetric] : kpisProp.length === 1 && kpisProp[0].id ? [kpisProp[0].id] : [],
    // Add-evidence-for-a-claim: prefill the claim's scope so it auto-connects.
    ...stateFromClaimScope(evidenceForClaim),
    // Edit mode: everything prefilled from the record being edited.
    ...stateFromEdit(editClaim, editEvidence),
  }))
 const [stepIndex, setStepIndex] = useState(0)
 const [stepError, setStepError] = useState<string | null>(null)
 const [submitting, setSubmitting] = useState(false)
 const [saveProgress, setSaveProgress] = useState({ saved: 0, total: 0 })
 const [savedResult, setSavedResult] = useState<{ claims: number; evidence: number } | null>(null)
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
 const savedClaimsRef = useRef(new Map<string, string>())
 const savedEvidenceKeysRef = useRef(new Set<string>())
 const ownedUploadUrlsRef = useRef(new Set<string>())
 const hasPartialSave = savedClaimsRef.current.size > 0 || savedEvidenceKeysRef.current.size > 0
 const discardOrphanUploads = useCallback(() => {
   if (cleanedRef.current || savedRef.current) return
   cleanedRef.current = true
   for (const f of stateRef.current.files) {
     // Files already attached to the record being edited are not orphans.
     if (f.existing || (f.url && ownedUploadUrlsRef.current.has(f.url))) continue
     if (f.status === 'uploading') cancelUpload(f.id)
     if (f.previewUrl) URL.revokeObjectURL(f.previewUrl)
     if (f.url) void apiService.deleteUploadedFile(f.url, f.uploadedSize)
   }
 }, [cancelUpload])

 const handleClose = useCallback(() => {
   discardOrphanUploads()
   if (savedRef.current || savedClaimsRef.current.size || savedEvidenceKeysRef.current.size) onCreated()
   onClose()
 }, [discardOrphanUploads, onClose, onCreated])

 // Safety net for any teardown path that doesn't route through handleClose.
 useEffect(() => () => discardOrphanUploads(), [discardOrphanUploads])

 const steps: WizardStepId[] = editClaim
  ? ['scope', 'claim', 'review']
  : editEvidence ? ['metric', 'scope', 'evidence', 'review'] : ['entry', 'review']

  const step = steps[Math.min(stepIndex, steps.length - 1)]

  // Which side of the log we're in right now (drives the teal/green theme).
  // Single-kind flows are branded end-to-end (including Simple/Advanced);
  // the "both" flow switches color on its claim and evidence steps.
  const accent: StepAccent =
    state.entryMode ? null
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

 useEffect(() => {
 if (!submitting) return
 const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
 window.addEventListener('beforeunload', warn)
 return () => window.removeEventListener('beforeunload', warn)
 }, [submitting])

 const update = (patch: Partial<WizardState>) => {
 setState(prev => {
 const next = { ...prev, ...patch }
 stateRef.current = next
 return next
 })
 setStepError(null)
 }

 const handleAddFiles = (files: File[], retry?: { rowIds?: string[]; type?: Evidence['type'] }) => {
 if (!stateRef.current.evidenceTitle.trim() && files.length > 0) {
  update({ evidenceTitle: files[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') })
 }
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
 type: retry?.type || inferEvidenceType(file.name, file.type),
 rowIds: retry?.rowIds,
 raw: file,
 }],
 }))
 }
 setStepError(null)
 }

 const handleRetryFile = (fileId: string) => {
 const current = stateRef.current.files.find(f => f.id === fileId)
 if (!current?.raw) return
 const file = current.raw
 if (current.previewUrl) URL.revokeObjectURL(current.previewUrl)
 setState(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }))
 handleAddFiles([file], current)
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
 if (file?.status === 'uploading') cancelUpload(fileId)
 if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
 // Existing attachments stay in storage until Save syncs the file set.
 // Newly picked files are orphans the moment they're removed.
 if (file?.url && !file.existing) void apiService.deleteUploadedFile(file.url, file.uploadedSize)
 setState(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }))
 }

 // ── Inline structure creation ─────────────────────────────────────────
 const [kpiModalOpen, setKpiModalOpen] = useState(false)
 const [locationModalOpen, setLocationModalOpen] = useState(false)

 const handleInlineCreateKpi = async (data: CreateKPIForm) => {
   const created = await apiService.createKPI({ ...data, initiative_id: initiativeId } as CreateKPIForm)
   apiService.clearCache('/kpis')
   setKpis(prev => [...prev, created])
   // Select it where it makes sense so the user doesn't have to hunt for it.
   setState(prev => {
     const next: WizardState = { ...prev }
     if (prev.logRows && created.id) next.logRows = [...prev.logRows, newLogRow(created.id)]
     if (includesEvidence(prev.kind) && prev.kind !== 'both' && created.id) {
       next.evidenceKpiIds = [...prev.evidenceKpiIds, created.id]
     }
     if (prev.kind === 'claim' && created.id) next.claimKpiId = created.id
     stateRef.current = next
     return next
   })
   setKpiModalOpen(false)
   notify.success('Metric added')
   onStructureChanged?.()
 }

 const handleInlineCreateLocation = async (data: Partial<Location>) => {
   try {
     const created = await apiService.createLocation({ ...data, initiative_id: initiativeId })
     apiService.clearCache('/locations')
     setLocations(prev => [...prev, created])
     if (created.id) {
       const single = wizardHasClaims(stateRef.current)
       update({ locationIds: single ? [created.id] : [...stateRef.current.locationIds, created.id] })
     }
     setLocationModalOpen(false)
     notify.success('Location added')
     onStructureChanged?.()
   } catch (e: any) {
     if (e?.code === 'LOCATION_LIMIT_REACHED') {
       notify.error('Location limit reached on your plan.')
       setLocationModalOpen(false)
       return
     }
     throw e
   }
 }

 const handleInlineCreateTag = async (name: string) => {
   try {
     const created = await apiService.createMetricTag(name)
     apiService.clearCache('/metric-tags')
     setTags(prev => prev.some(t => t.id === created.id) ? prev : [...prev, created])
     const single = !stateRef.current.logRows && wizardHasClaims(stateRef.current)
     update({ tagIds: single ? [created.id] : [...stateRef.current.tagIds, created.id] })
     notify.success('Tag added')
     onStructureChanged?.()
   } catch (e) {
     notify.error((e as Error).message || 'Could not create tag')
     throw e
   }
 }

 const validateCurrent = (): string | null => {
 const snapshot = stateRef.current
 switch (step) {
 case 'entry': return validateAll(snapshot, kpis)
 case 'metric': return validateMetricStep(snapshot)
 case 'scope': return validateScopeStep(snapshot)
 case 'claim': return validateClaimStep(snapshot, kpis)
 case 'evidence': return validateEvidenceStep(snapshot)
 default: return null
 }
 }

 const advance = () => {
 setStepError(null)
 setStepIndex(i => Math.min(i + 1, steps.length - 1))
 }

 const goNext = () => {
 if (step === 'scope' || step === 'entry') scopeDatePickerRef.current?.applyPending()
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

 const handleSubmit = async () => {
 if (submitting) return
 const error = validateAll(state, kpis)
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
 note: state.claimNote.trim() || undefined,
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
 const originalUrls = editEvidence.files?.length
  ? editEvidence.files.map(f => f.file_url)
  : editEvidence.file_url ? [editEvidence.file_url] : []
 const currentFiles = state.files.filter(f => f.url)
 const currentUrls = currentFiles.map(f => f.url!)
 const filesChanged = originalUrls.length !== currentUrls.length
  || originalUrls.some((u, i) => u !== currentUrls[i])
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
 if (filesChanged) {
 evidenceUpdate.file_url = currentUrls[0]
 evidenceUpdate.file_urls = currentUrls
 evidenceUpdate.file_sizes = currentFiles.map(f => f.existing ? 0 : (f.uploadedSize ?? 0))
 }
 await apiService.updateEvidence(editEvidence.id, evidenceUpdate)
 notify.success('Evidence updated')
 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 onCreated()
 onClose()
 return
 }

 if (state.logRows) {
 const plan = buildLogPlan(state, initiativeId)
 await saveLogPlan(plan, apiService, {
  claims: savedClaimsRef.current,
  evidence: savedEvidenceKeysRef.current,
  ownedUrls: ownedUploadUrlsRef.current,
 }, (saved, total) => setSaveProgress({ saved, total }), evidenceForClaim?.id)
 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 setSavedResult({ claims: plan.claims.length, evidence: plan.evidence.length })
 return
 }

 // One claim per filled metric in the "both" flow; a single claim in
 // the claim-only flow. All share the scope from step one.
 const createdClaimIds: string[] = []
 const sharedClaimFields = {
 ...dateFields,
 location_id: state.locationIds[0],
 tag_id: state.tagIds[0] || null,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 }
 if (state.entryMode || state.kind === 'both') {
 for (const [kpiId, entry] of filledClaimEntries(state, kpis)) {
 const savedId = savedClaimsRef.current.get(kpiId)
 if (savedId) {
  createdClaimIds.push(savedId)
  continue
 }
 const claimPayload: CreateKPIUpdateForm = {
 value: Number(entry.value),
 label: entry.label.trim() || undefined,
 note: (entry.note || '').trim() || undefined,
 ...sharedClaimFields,
 }
 const created = await apiService.createKPIUpdate(kpiId, claimPayload)
 if (!created?.id) throw new Error('The result could not be confirmed as saved')
 createdClaimIds.push(created.id)
 savedClaimsRef.current.set(kpiId, created.id)
 }
 } else if (includesClaim(state.kind)) {
 const claimPayload: CreateKPIUpdateForm = {
 value: Number(state.claimValue),
 label: state.claimLabel.trim() || undefined,
 note: state.claimNote.trim() || undefined,
 ...sharedClaimFields,
 }
 const created = await apiService.createKPIUpdate(state.claimKpiId!, claimPayload)
 if (created?.id) createdClaimIds.push(created.id)
 }

 let evidenceRecordCount = 0
 if (wizardHasEvidence(state)) {
 // Split the uploaded files into one evidence record per type (max four).
 const buckets = evidenceBuckets(state.files)
 const multi = buckets.length > 1
 const baseTitle = state.evidenceTitle.trim()
 for (const bucket of buckets) {
 if (savedEvidenceKeysRef.current.has(bucket.type)) {
  evidenceRecordCount++
  continue
 }
 const fileUrls = bucket.files.map(f => f.url!)
 const fileSizes = bucket.files.map(f => f.uploadedSize ?? 0)
 const evidencePayload: CreateEvidenceForm = {
 title: multi ? `${baseTitle} - ${EVIDENCE_TYPE_LABELS[bucket.type]}` : baseTitle,
 description: state.evidenceDescription.trim() || undefined,
 type: bucket.type,
 ...dateFields,
 initiative_id: initiativeId,
 location_ids: state.locationIds,
 kpi_ids: wizardEvidenceMetricIds(state),
 // Pin a claim when this wizard was opened from "Add evidence" on it.
 // Explicit links to claims created in this save (both-mode).
 kpi_update_ids: [
   ...(evidenceForClaim?.id ? [evidenceForClaim.id] : []),
   ...createdClaimIds,
 ].filter((id, i, all) => all.indexOf(id) === i),
 tag_ids: [
   ...state.tagIds,
   ...(evidenceForClaim?.tag_id ? [evidenceForClaim.tag_id] : []),
 ].filter((id, i, all) => all.indexOf(id) === i),
 beneficiary_group_ids: [
   ...state.beneficiaryGroupIds,
   ...(evidenceForClaim?.beneficiary_group_ids || []),
 ].filter((id, i, all) => all.indexOf(id) === i),
 file_url: fileUrls[0],
 file_urls: fileUrls,
 file_sizes: fileSizes,
 }
 await apiService.createEvidence(evidencePayload)
 savedEvidenceKeysRef.current.add(bucket.type)
 fileUrls.forEach(url => ownedUploadUrlsRef.current.add(url))
 evidenceRecordCount++
 }
 }

 savedRef.current = true
 state.files.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl))
 setSavedResult({ claims: createdClaimIds.length, evidence: evidenceRecordCount })
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to save'
 if (savedClaimsRef.current.size || savedEvidenceKeysRef.current.size) {
  setStepError('Some items were saved. Retry saving to finish the remaining items, or close to view what was saved.')
 }
 notify.error(message)
 } finally {
 setSubmitting(false)
 }
 }

 const ReviewComponent = state.logRows ? LogReviewStep : WizardReviewStep
 const isLastStep = stepIndex === steps.length - 1
 const meta = STEP_META[step]
 const subtitle = step !== 'entry'
 ? meta.subtitle(state)
 : evidenceForClaim || !canCreateClaim
 ? 'Upload photos or documents. Add the details you know now.'
 : !canCreateEvidence
 ? 'Record results for your metrics. Evidence can be added later.'
 : meta.subtitle(state)
 const workspaceStep = step === 'entry'
 const kpiTotals = useMemo(() => {
   const totals: Record<string, number> = {}
   for (const claim of existingClaims) {
     if (!claim.kpi_id) continue
     totals[claim.kpi_id] = (totals[claim.kpi_id] || 0) + (Number(claim.value) || 0)
   }
   return totals
 }, [existingClaims])
 const wideStep = step === 'scope' || step === 'metric' || (step === 'claim' && state.kind === 'both')

 if (savedResult) return (
 <div className="fixed inset-0 z-[100] bg-page flex items-center justify-center p-4">
  <div className="app-card p-6 sm:p-8 max-w-lg w-full">
   <div className="app-icon-tile mb-4"><Check className="w-6 h-6 text-primary-700" /></div>
   <h1 className="app-page-title">Saved to {programTitle || 'this program'}</h1>
   <p className="app-page-subtitle mt-2">You can find these items in Logs and add details later.</p>
   <div className="space-y-2 mt-5">
    {savedResult.evidence > 0 && <p className="text-sm text-secondary-700">{state.evidenceTitle} · {state.files.length} file{state.files.length === 1 ? '' : 's'}</p>}
    {wizardClaims(state).map((c, index) => <p key={`${c.kpiId}-${index}`} className="text-sm text-secondary-700">{c.value} {kpis.find(k => k.id === c.kpiId)?.title}</p>)}
    {savedResult.evidence > 0 && requiresEvidenceApproval && <p className="text-sm text-secondary-500">Your evidence is waiting for approval.</p>}
    {savedResult.evidence > 0 && wizardEvidenceMetricIds(state).length === 0 && <p className="text-sm text-secondary-500">A metric can be assigned from the evidence details.</p>}
   </div>
   <button type="button" onClick={handleClose} className="app-btn app-btn-primary w-full mt-6">Done</button>
  </div>
 </div>
 )

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
 style={accentStyle || state.entryMode ? undefined : {
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
 <span className={`text-xs font-medium ${isCurrent ? 'text-gray-800' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
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
 <div className={workspaceStep ? 'w-full px-4 sm:px-6 py-4' : wideStep ? 'w-full px-4 sm:px-6 lg:px-10 py-4 md:py-5' : 'max-w-3xl mx-auto px-5 md:px-8 py-8'}>
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
 {programTitle && <p className="text-xs font-medium text-secondary-500 mb-1">{programTitle}</p>}
 <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${accentStyle ? accentStyle.title : 'text-gray-800'} `}>
 {meta.title(state)}
 </h1>
 {workspaceStep ? <div className="mb-3" /> : <p className={`text-sm text-gray-500 mt-1.5 ${wideStep ? 'mb-4' : 'mb-6'}`}>{subtitle}</p>}

 {step === 'entry' && (
 <LogEntryStep
 state={state} update={update} kpis={kpis} locations={locations} tags={tags}
 beneficiaryGroups={beneficiaryGroups} canCreateClaim={canCreateClaim}
 canCreateEvidence={canCreateEvidence} lockedMetricId={lockedMetric}
 evidenceForClaim={evidenceForClaim} datePickerRef={scopeDatePickerRef}
 onAddFiles={handleAddFiles} onRemoveFile={handleRemoveFile} onRetryFile={handleRetryFile}
 onSetFileType={handleSetFileType} onSetAllTypes={handleSetAllFileTypes}
 onCreateMetric={canManageStructure ? () => setKpiModalOpen(true) : undefined}
 onCreateLocation={canManageStructure ? () => setLocationModalOpen(true) : undefined}
 onCreateTag={canManageStructure ? handleInlineCreateTag : undefined}
 />
 )}

 {step === 'metric' && (
 <WizardMetricStep
 state={state}
 update={update}
 kpis={kpis}
 kpiTotals={kpiTotals}
 onAutoAdvance={advance}
 onCreateMetric={canManageStructure && !isEdit ? () => setKpiModalOpen(true) : undefined}
 />
 )}

 {step === 'scope' && (
 <WizardScopeStep
 state={state}
 update={update}
 locations={locations}
 tags={tags}
 kpis={kpis}
 beneficiaryGroups={beneficiaryGroups}
 datePickerRef={scopeDatePickerRef}
 onCreateLocation={canManageStructure ? () => setLocationModalOpen(true) : undefined}
 onCreateTag={canManageStructure ? handleInlineCreateTag : undefined}
 />
 )}

 {step === 'claim' && (
 state.kind === 'both' ? (
 <WizardClaimsStep
 state={state}
 update={update}
 kpis={kpis}
 tags={tags}
 lockedMetricId={lockedMetricId}
 onCreateMetric={canManageStructure ? () => setKpiModalOpen(true) : undefined}
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
 onRetryFile={handleRetryFile}
 onSetFileType={handleSetFileType}
 onSetAllTypes={handleSetAllFileTypes}
 />
 )}

 {step === 'review' && (
 <>
 {/* Review gate: flagged members' evidence goes to the approval queue */}
 {requiresEvidenceApproval && wizardHasEvidence(state) && !isEdit && (
 <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-3 mb-4 max-w-2xl">
 <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-amber-700">
 <span className="font-semibold text-amber-800">Submitted for approval:</span>{' '}
 your evidence is saved right away, but it won't connect to claims or count in any totals until an admin approves it.
 </p>
 </div>
 )}
 <ReviewComponent
 state={state}
 initiativeId={initiativeId}
 kpis={kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={existingClaims}
 existingEvidence={existingEvidence}
 pinClaim={evidenceForClaim}
 evidenceNeedsApproval={requiresEvidenceApproval && !isEdit}
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
 {stepError && <p role="alert" className="text-xs text-red-600">{stepError}</p>}
 {submitting && <p role="status" className="text-xs text-secondary-600">Saving {saveProgress.saved} of {saveProgress.total} items. Keep this window open.</p>}
 {!stepError && !submitting && state.logRows && <p className="text-xs text-secondary-500">{buildLogPlan(state).claims.length} results · {state.files.length} files</p>}
 </div>
 <div className="flex items-center gap-2 flex-shrink-0">
 {stepIndex > 0 && (
 <button onClick={goBack} disabled={submitting || hasPartialSave} className="app-btn app-btn-secondary app-btn-sm">
 <ArrowLeft className="w-4 h-4" />
 Back
 </button>
 )}
 {!isLastStep ? (
 <button onClick={goNext} className={`app-btn app-btn-sm ${accentStyle ? accentStyle.button : 'app-btn-primary'}`}>
 {step === 'entry' ? 'Review log' : 'Next'}
 <ArrowRight className="w-4 h-4" />
 </button>
 ) : (
 <button onClick={handleSubmit} disabled={submitting} className="app-btn app-btn-primary app-btn-sm">
 <Check className="w-4 h-4" />
 {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Save log'}
 </button>
 )}
 </div>
 </div>

 {kpiModalOpen && (
 <CreateKPIModal
 isOpen
 onClose={() => setKpiModalOpen(false)}
 onSubmit={handleInlineCreateKpi}
 initiativeId={initiativeId}
 />
 )}
 {locationModalOpen && (
 <LocationModal
 isOpen
 onClose={() => setLocationModalOpen(false)}
 onSubmit={handleInlineCreateLocation}
 initiativeId={initiativeId}
 />
 )}
 </div>
 )
}
