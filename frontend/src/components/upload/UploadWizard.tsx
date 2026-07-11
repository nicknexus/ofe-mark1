import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowLeft, ArrowRight, Check, TrendingUp, FileText, Layers } from 'lucide-react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useUploadManager } from '../../context/UploadContext'
import {
 BeneficiaryGroup,
 CreateEvidenceForm,
 CreateKPIUpdateForm,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineEvidence,
} from '../../types'
import { viewSwap } from '../timeline/motion'
import {
 INITIAL_WIZARD_STATE,
 WizardKind,
 WizardState,
 WizardStepId,
 includesClaim,
 includesEvidence,
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
import WizardEvidenceStep from './WizardEvidenceStep'
import WizardReviewStep from './WizardReviewStep'

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
 onClose: () => void
 onCreated: () => void
}

const STEP_META: Record<WizardStepId, { label: string; title: (s: WizardState) => string; subtitle: (s: WizardState) => string }> = {
 type: {
 label: 'Type',
 title: () => 'What would you like to add?',
 subtitle: () => 'Everything ends up in one Timeline either way',
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
 subtitle: () => 'This decides what gets connected automatically — matching scope means an automatic link',
 },
 claim: {
 label: 'Result',
 title: () => 'Claim the result',
 subtitle: () => 'The number you achieved in that place and time',
 },
 evidence: {
 label: 'Evidence',
 title: () => 'Add the proof',
 subtitle: () => 'Upload the files that back this up',
 },
 review: {
 label: 'Review',
 title: () => 'Review & save',
 subtitle: () => 'Check what will be created and what it will connect to',
 },
}

/**
 * Full-screen guided flow for adding evidence, an impact claim, or both.
 * Small, clearly-named steps: choose type → choose metric(s) → where & when
 * → claim the result → add the proof → review. One shared Where & When
 * scope means claim + evidence added together always auto-link, and the
 * review step previews every connection before anything is saved.
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
 onClose,
 onCreated,
}: UploadWizardProps) {
 const { queueUpload, cancelUpload, setPanelSuppressed } = useUploadManager()

 const availableKinds = KIND_OPTIONS.filter(o =>
 o.kind === 'evidence' ? canCreateEvidence
 : o.kind === 'claim' ? canCreateClaim
 : canCreateClaim && canCreateEvidence
 )

 const [state, setState] = useState<WizardState>(() => ({
 ...INITIAL_WIZARD_STATE,
 // Single-capability users skip the type step entirely.
 kind: availableKinds.length === 1 ? availableKinds[0].kind : null,
 }))
 const [stepIndex, setStepIndex] = useState(0)
 const [stepError, setStepError] = useState<string | null>(null)
 const [submitting, setSubmitting] = useState(false)
 const stateRef = useRef(state)
 stateRef.current = state

 const hasModeChoice = (state.kind === 'claim' && !!onAdvancedClaim) || (state.kind === 'evidence' && !!onAdvancedEvidence)

 const steps: WizardStepId[] = useMemo(() => {
 const list: WizardStepId[] = []
 if (availableKinds.length > 1) list.push('type')
 if (hasModeChoice) list.push('mode')
 list.push('metric', 'scope')
 if (includesClaim(state.kind)) list.push('claim')
 if (includesEvidence(state.kind)) list.push('evidence')
 list.push('review')
 return list
 }, [availableKinds.length, state.kind, hasModeChoice])

 const step = steps[Math.min(stepIndex, steps.length - 1)]

 // The wizard shows its own upload progress; hide the floating panel.
 useEffect(() => {
 setPanelSuppressed(true)
 return () => setPanelSuppressed(false)
 }, [setPanelSuppressed])

 useEffect(() => {
 const onKey = (e: KeyboardEvent) => {
 if (e.key === 'Escape' && !submitting) onClose()
 }
 window.addEventListener('keydown', onKey)
 return () => window.removeEventListener('keydown', onKey)
 }, [onClose, submitting])

 const update = (patch: Partial<WizardState>) => {
 setState(prev => ({ ...prev, ...patch }))
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
 }],
 }))
 }
 setStepError(null)
 }

 const handleRemoveFile = (fileId: string) => {
 const file = stateRef.current.files.find(f => f.id === fileId)
 if (file?.status === 'uploading') cancelUpload(fileId)
 if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl)
 setState(prev => ({ ...prev, files: prev.files.filter(f => f.id !== fileId) }))
 }

 const validateCurrent = (): string | null => {
 switch (step) {
 case 'type': return state.kind ? null : 'Choose what you want to add'
 case 'mode': return null
 case 'metric': return validateMetricStep(state)
 case 'scope': return validateScopeStep(state)
 case 'claim': return validateClaimStep(state)
 case 'evidence': return validateEvidenceStep(state)
 default: return null
 }
 }

 const advance = () => {
 setStepError(null)
 setStepIndex(i => Math.min(i + 1, steps.length - 1))
 }

 const goNext = () => {
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

 let createdClaimId: string | undefined
 if (includesClaim(state.kind)) {
 const claimPayload: CreateKPIUpdateForm = {
 value: Number(state.claimValue),
 ...dateFields,
 label: state.claimLabel.trim() || undefined,
 location_id: state.locationIds[0],
 tag_id: state.tagIds[0] || null,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 }
 const created = await apiService.createKPIUpdate(state.claimKpiId!, claimPayload)
 createdClaimId = created?.id
 }

 if (includesEvidence(state.kind)) {
 const fileUrls = state.files.filter(f => f.url).map(f => f.url!)
 const fileSizes = state.files.filter(f => f.url).map(f => f.uploadedSize ?? 0)
 const evidencePayload: CreateEvidenceForm = {
 title: state.evidenceTitle.trim(),
 description: state.evidenceDescription.trim() || undefined,
 type: state.evidenceType,
 ...dateFields,
 initiative_id: initiativeId,
 location_ids: state.locationIds,
 kpi_ids: state.kind === 'both'
 ? (state.claimKpiId ? [state.claimKpiId] : [])
 : state.evidenceKpiIds,
 // Explicit link to the claim created moments ago (the auto-matcher
 // would also catch it — belt and braces against clock skew).
 kpi_update_ids: createdClaimId ? [createdClaimId] : undefined,
 tag_ids: state.tagIds,
 beneficiary_group_ids: state.beneficiaryGroupIds,
 file_url: fileUrls[0],
 file_urls: fileUrls,
 file_sizes: fileSizes,
 }
 await apiService.createEvidence(evidencePayload)
 }

 notify.success(
 state.kind === 'both' ? 'Claim and evidence added — connected automatically'
 : state.kind === 'claim' ? 'Impact claim added'
 : 'Evidence uploaded'
 )
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

 return (
 <div className="fixed inset-0 z-[100] flex flex-col h-dvh overflow-hidden bg-page">
 {/* Soft brand backdrop */}
 <div className="absolute inset-0 pointer-events-none" style={{
 background: 'linear-gradient(160deg, rgba(192,223,161,0.14) 0%, rgba(255,255,255,0) 45%, rgba(130,163,161,0.10) 100%)',
 }} />

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
 ? 'bg-primary-500 text-white'
 : isDone
 ? 'bg-primary-100 text-primary-800'
 : 'bg-gray-100 text-gray-400'
 }`}>
 {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : i + 1}
 </span>
 <span className={`text-xs font-medium hidden md:inline ${isCurrent ? 'text-gray-800' : isDone ? 'text-gray-500' : 'text-gray-400'}`}>
 {STEP_META[s].label}
 </span>
 </div>
 </React.Fragment>
 )
 })}
 </div>
 <button
 onClick={onClose}
 disabled={submitting}
 className="app-btn-icon rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-secondary-900 transition-colors flex items-center justify-center ml-3"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Body */}
 <div className="relative z-10 flex-1 min-h-0 overflow-y-auto">
 <div className="max-w-3xl mx-auto px-5 md:px-8 py-8">
 <AnimatePresence mode="wait">
 <motion.div
 key={step}
 initial={viewSwap.initial}
 animate={viewSwap.animate}
 exit={viewSwap.exit}
 >
 <h1 className="text-xl md:text-2xl font-semibold text-gray-800">{meta.title(state)}</h1>
 <p className="text-sm text-gray-500 mt-1 mb-6">{meta.subtitle(state)}</p>

 {step === 'type' && (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {availableKinds.map(option => {
 const isSelected = state.kind === option.kind
 return (
 <button
 key={option.kind}
 type="button"
 onClick={() => handleChooseKind(option.kind)}
 className={`relative text-left p-6 md:p-7 rounded-3xl border-2 transition-all hover:-translate-y-0.5 hover:shadow-card-hover ${isSelected
 ? 'border-primary-500 bg-primary-50 shadow-card'
 : 'border-gray-200 bg-white hover:border-primary-300'
 }`}
 >
 {option.badge && (
 <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-semibold uppercase tracking-wide">
 {option.badge}
 </span>
 )}
 <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
 <option.icon className="w-6 h-6 text-primary-800" />
 </div>
 <p className="text-base font-semibold text-gray-800 mb-1.5">{option.label}</p>
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
 className="relative text-left p-6 md:p-7 rounded-3xl border-2 border-gray-200 bg-white hover:border-primary-300 hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
 >
 <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full bg-primary-500 text-white text-[10px] font-semibold uppercase tracking-wide">
 Recommended
 </span>
 <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center mb-4">
 <Check className="w-6 h-6 text-primary-800" />
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
 className="text-left p-6 md:p-7 rounded-3xl border-2 border-gray-200 bg-white hover:border-primary-300 hover:-translate-y-0.5 hover:shadow-card-hover transition-all"
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
 />
 )}

 {step === 'claim' && (
 <WizardClaimStep state={state} update={update} kpis={kpis} />
 )}

 {step === 'evidence' && (
 <WizardEvidenceStep
 state={state}
 update={update}
 onAddFiles={handleAddFiles}
 onRemoveFile={handleRemoveFile}
 />
 )}

 {step === 'review' && (
 <WizardReviewStep
 state={state}
 kpis={kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={existingClaims}
 existingEvidence={existingEvidence}
 />
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
 <button onClick={goNext} className="app-btn app-btn-primary app-btn-sm">
 Next
 <ArrowRight className="w-4 h-4" />
 </button>
 ) : (
 <button onClick={handleSubmit} disabled={submitting} className="app-btn app-btn-primary app-btn-sm">
 <Check className="w-4 h-4" />
 {submitting ? 'Saving…' : 'Save'}
 </button>
 )}
 </div>
 </div>
 </div>
 )
}
