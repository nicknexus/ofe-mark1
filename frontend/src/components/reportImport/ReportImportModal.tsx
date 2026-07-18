import React, { useCallback, useRef, useState } from 'react'
import { FileUp, Loader2, Sparkles, Check, AlertCircle, FileText, ArrowRight } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody, ModalFooter } from '../ModalFrame'
import { useTeam } from '../../context/TeamContext'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { ExtractedSuggestions } from '../../types'
import ReportReview from './ReportReview'
import {
  ReviewState, buildReviewState, toApplyInput, countSelected,
} from './reviewModel'
import { applyImport, ApplyResult } from './applyImport'

type Phase = 'upload' | 'processing' | 'review' | 'applying' | 'done' | 'error'

interface Props {
  onClose: () => void
  /** Called after suggestions are applied so callers can refresh their data. */
  onApplied?: () => void
  /**
   * 'organization' (default): full import used during onboarding.
   * 'initiative': metrics, groups and locations only, attached to `initiativeId`.
   */
  scope?: 'organization' | 'initiative'
  initiativeId?: string
  initiativeTitle?: string
}

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export default function ReportImportModal({ onClose, onApplied, scope = 'organization', initiativeId, initiativeTitle }: Props) {
  const { ownedOrganization, activeOrganization } = useTeam()
  const org = ownedOrganization || activeOrganization
  const orgId = org?.id ?? null
  const isInitiativeScope = scope === 'initiative'

  const [phase, setPhase] = useState<Phase>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [review, setReview] = useState<ReviewState | null>(null)
  const [existingInitiatives, setExistingInitiatives] = useState<{ id: string; title: string }[]>([])
  const [summary, setSummary] = useState('')
  const [result, setResult] = useState<ApplyResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const startExtraction = useCallback(async (file: File) => {
    if (!orgId) { notify.error('No organization selected'); return }
    if (file.type !== 'application/pdf') { notify.error('Please upload a PDF file'); return }
    if (file.size > MAX_SIZE) { notify.error('File is too large (max 50MB)'); return }

    setFileName(file.name)
    setErrorMsg('')
    setPhase('processing')

    try {
      // 1. Upload the PDF directly to storage (bypasses serverless body limits).
      const { file_url } = await apiService.uploadFile(file)

      // 2. Kick off extraction (this can take a while for large reports) and,
      //    in parallel, load what already exists so we don't clobber it.
      const [imported, existingContext, initiatives] = await Promise.all([
        apiService.createReportImport({ file_name: file.name, file_url }),
        isInitiativeScope ? Promise.resolve(null) : apiService.getOrgContext(orgId).catch(() => null),
        apiService.getInitiatives().catch(() => []),
      ])

      if (imported.status === 'failed') {
        throw new Error(imported.error || 'Extraction failed')
      }

      const existing = initiatives
        .filter(i => !!i.id)
        .map(i => ({ id: i.id as string, title: i.title }))
      setExistingInitiatives(existing)

      const suggestions: ExtractedSuggestions = imported.extracted || {}
      setSummary(suggestions.summary || '')
      setReview(buildReviewState(suggestions, {
        org: org ? {
          statement: org.statement,
          website_url: org.website_url, donation_url: org.donation_url,
        } : undefined,
        context: existingContext,
        initiatives: existing,
      }, { scope, initiativeId }))
      setPhase('review')
    } catch (e: any) {
      const code = e?.code
      setErrorMsg(
        code === 'insufficient_quota' ? 'The AI service is out of quota. Please try again later or contact support.'
        : code === 'rate_limit' ? 'The AI service is busy right now. Please try again in a moment.'
        : e?.message || 'Something went wrong while reading your report.'
      )
      setPhase('error')
    }
  }, [orgId, org, scope, initiativeId])

  const onFileChosen = (files: FileList | null) => {
    const file = files?.[0]
    if (file) startExtraction(file)
  }

  const handleApply = async () => {
    if (!review || !orgId) return
    setPhase('applying')
    try {
      const res = await applyImport(toApplyInput(review, orgId, existingInitiatives, { scope, initiativeId }))
      setResult(res)
      setPhase('done')
      const total = Object.values(res.counts).reduce((a, b) => a + b, 0)
      if (total > 0) notify.success('Imported details from your report')
      onApplied?.()
    } catch (e: any) {
      setErrorMsg(e?.message || 'Failed to apply the imported data.')
      setPhase('error')
    }
  }

  const selectedCount = review ? countSelected(review) : 0

  return (
    <ModalFrame size="lg" zIndexClass="z-[90]">
      <ModalHeader
        title="Import from your annual report"
        subtitle={isInitiativeScope
          ? `Pull metrics, groups and locations into ${initiativeTitle || 'this initiative'}`
          : "Upload a PDF and we'll suggest details to fill in"}
        icon={Sparkles}
        onClose={phase === 'processing' || phase === 'applying' ? undefined : onClose}
      />

      <ModalBody>
        {phase === 'upload' && (
          <div className="app-modal-rail">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); onFileChosen(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center text-center rounded-xl border-2 border-dashed py-12 px-6 cursor-pointer transition ${
                dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
              }`}
            >
              <div className="app-icon-tile app-icon-tile-accent mb-3">
                <FileUp className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-secondary-900">Drop your annual report here</p>
              <p className="text-[13px] text-secondary-500 mt-1">or click to browse — PDF up to 50MB</p>
              <input ref={inputRef} type="file" accept="application/pdf" className="hidden"
                onChange={e => onFileChosen(e.target.files)} />
            </div>
            <p className="text-[12px] text-secondary-400 mt-3 leading-relaxed">
              We read the whole document — including charts and images — and suggest{' '}
              {isInitiativeScope
                ? 'metrics, beneficiary groups and locations for this initiative'
                : 'your organization details, initiatives, metrics and more'}.
              You review and edit everything before anything is saved.
            </p>
          </div>
        )}

        {phase === 'processing' && (
          <div className="app-modal-rail flex flex-col items-center justify-center text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
            <p className="text-sm font-semibold text-secondary-900">Reading {fileName || 'your report'}…</p>
            <p className="text-[13px] text-secondary-500 mt-1 max-w-sm">
              This can take up to a minute for a large report. We're pulling out your details, programs and key numbers.
            </p>
          </div>
        )}

        {phase === 'review' && review && (
          <div className="space-y-4">
            <div className="app-modal-rail">
              <div className="flex items-start gap-2.5 rounded-lg bg-primary-50 border border-primary-100 p-3">
                <FileText className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-secondary-900">Here's what we found in {fileName}</p>
                  {summary && <p className="text-[12px] text-secondary-500 mt-0.5">{summary}</p>}
                  <p className="text-[12px] text-secondary-500 mt-0.5">
                    Untick anything you don't want, edit the rest, then add it{isInitiativeScope ? ' to this initiative' : ' to your account'}.
                  </p>
                </div>
              </div>
            </div>
            <ReportReview value={review} onChange={setReview} existingInitiatives={existingInitiatives} scope={scope} />
          </div>
        )}

        {phase === 'applying' && (
          <div className="app-modal-rail flex flex-col items-center justify-center text-center py-12">
            <Loader2 className="w-8 h-8 text-primary-500 animate-spin mb-4" />
            <p className="text-sm font-semibold text-secondary-900">Adding everything to your account…</p>
          </div>
        )}

        {phase === 'done' && result && (
          <div className="app-modal-rail flex flex-col items-center text-center py-10">
            <div className="app-icon-tile app-icon-tile-accent mb-3">
              <Check className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-secondary-900">All done!</p>
            <p className="text-[13px] text-secondary-500 mt-1">Here's what we added from your report:</p>
            <ul className="text-[13px] text-secondary-700 mt-3 space-y-1">
              {result.counts.organization > 0 && <li>Organization profile updated</li>}
              {result.counts.context > 0 && <li>About &amp; impact details added</li>}
              {result.counts.initiatives > 0 && <li>{result.counts.initiatives} initiative(s)</li>}
              {result.counts.metrics > 0 && <li>{result.counts.metrics} metric(s){result.counts.dataPoints > 0 ? ` with ${result.counts.dataPoints} data point(s)` : ''}</li>}
              {result.counts.groups > 0 && <li>{result.counts.groups} beneficiary group(s)</li>}
              {result.counts.locations > 0 && <li>{result.counts.locations} location(s)</li>}
            </ul>
            {result.errors.length > 0 && (
              <div className="mt-4 text-left text-[12px] text-amber-600 max-w-md">
                <p className="font-medium">A few items couldn't be added automatically:</p>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  {result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
                  {result.errors.length > 6 && <li>…and {result.errors.length - 6} more</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="app-modal-rail flex flex-col items-center text-center py-10">
            <div className="app-icon-tile mb-3 bg-red-50 text-red-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-secondary-900">We hit a snag</p>
            <p className="text-[13px] text-secondary-500 mt-1 max-w-sm">{errorMsg}</p>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {phase === 'review' && (
          <>
            <button type="button" onClick={onClose} className="app-btn app-btn-ghost app-btn-sm text-secondary-500">
              Cancel
            </button>
            <button type="button" onClick={handleApply} disabled={selectedCount === 0}
              className="app-btn app-btn-primary app-btn-sm flex-1 disabled:opacity-50">
              <Check className="w-4 h-4" /> Add {selectedCount} item{selectedCount === 1 ? '' : 's'}{isInitiativeScope ? ' to this initiative' : ' to my account'}
            </button>
          </>
        )}
        {phase === 'done' && (
          <button type="button" onClick={onClose} className="app-btn app-btn-primary app-btn-sm flex-1">
            Done <ArrowRight className="w-4 h-4" />
          </button>
        )}
        {phase === 'error' && (
          <>
            <button type="button" onClick={onClose} className="app-btn app-btn-ghost app-btn-sm text-secondary-500">
              Close
            </button>
            <button type="button" onClick={() => { setPhase('upload'); setErrorMsg('') }}
              className="app-btn app-btn-primary app-btn-sm flex-1">
              Try again
            </button>
          </>
        )}
        {phase === 'upload' && (
          <button type="button" onClick={onClose} className="app-btn app-btn-ghost app-btn-sm text-secondary-500">
            Cancel
          </button>
        )}
      </ModalFooter>
    </ModalFrame>
  )
}
