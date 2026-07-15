import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apiService } from '../../services/api'
import {
 BeneficiaryGroup,
 CreateKPIUpdateForm,
 Evidence,
 KPI,
 Location,
 MetricTag,
 TimelineClaim,
 TimelineEvidence,
 TimelineResponse,
} from '../../types'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { SectionLoader, EmptyState } from '../ui'
import { AlertCircle, Plus, Search } from 'lucide-react'
import {
 TimelineFilters,
 TimelineView,
 applyFiltersToParams,
 filtersFromParams,
} from '../../utils/timeline'
import { viewSwap } from '../timeline/motion'
import TimelineStatCards from '../timeline/TimelineStatCards'
import TimelineFilterBar from '../timeline/TimelineFilterBar'
import UploadWizard from '../upload/UploadWizard'
import ClaimsView from '../timeline/ClaimsView'
import EvidenceView from '../timeline/EvidenceView'
import ConnectionsView from '../timeline/ConnectionsView'
import ConnectEvidenceDialog from '../timeline/ConnectEvidenceDialog'
import AddEvidenceToClaimDialog from '../timeline/AddEvidenceToClaimDialog'
import EvidenceDetailModal from '../timeline/EvidenceDetailModal'
import ClaimDetailModal from '../timeline/ClaimDetailModal'
import EditEvidenceModal from '../timeline/EditEvidenceModal'
import AddKPIUpdateModal from '../AddKPIUpdateModal'
import ConfirmDialog from '../ConfirmDialog'
import ImpactClaimUploadModal from '../impactClaims/ImpactClaimUploadModal'
import EvidenceUploadModal from '../evidence/EvidenceUploadModal'

const VIEWS: Array<{ id: TimelineView; label: string }> = [
 { id: 'connections', label: 'Connections' },
 { id: 'claims', label: 'Claims' },
 { id: 'evidence', label: 'Evidence' },
]

interface TimelineTabProps {
 initiativeId: string
 onRefresh?: () => void
 /** When set, the logs are locked to this metric: all views/filters/counts are
  * scoped to it and the Metric filter is hidden. Used by the metric detail page. */
 lockedMetricId?: string
 /** Renders inside another page (metric detail) rather than as a full-screen tab:
  * drops the fixed height + big title so the parent page owns scrolling. */
 embedded?: boolean
}

/**
 * Logs — unified operational view over the initiative's impact claims,
 * evidence, and their connections. Sub-view and every filter live in URL
 * params so filtered views can be deep-linked, refreshed, and navigated with
 * browser controls (?tab=logs&view=...&metric=...).
 */
export default function TimelineTab({ initiativeId, onRefresh, lockedMetricId, embedded }: TimelineTabProps) {
 const { canAddImpactClaims, canEditEvidence, canDelete } = useTeam()
 const [searchParams, setSearchParams] = useSearchParams()

 const [data, setData] = useState<TimelineResponse | null>(null)
 const [loading, setLoading] = useState(true)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [tags, setTags] = useState<MetricTag[]>([])

 // Detail + edit modal state
 const [selectedEvidence, setSelectedEvidence] = useState<TimelineEvidence | null>(null)
 const [selectedClaim, setSelectedClaim] = useState<{ claim: TimelineClaim; kpi: KPI | undefined } | null>(null)
 const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
 const [isEditModalOpen, setIsEditModalOpen] = useState(false)
 const [editingClaim, setEditingClaim] = useState<{ claim: TimelineClaim; kpi: KPI } | null>(null)
 const [deleteEvidence, setDeleteEvidence] = useState<Evidence | null>(null)
 // evidence set = evidence-first (pick a claim); evidence omitted = claim-first (pick from unconnected evidence)
 const [connectTarget, setConnectTarget] = useState<{ evidence?: TimelineEvidence; claimId?: string } | null>(null)
 const [addEvidenceTarget, setAddEvidenceTarget] = useState<{ claim: TimelineClaim; kpi: KPI | undefined } | null>(null)
 const [isWizardOpen, setIsWizardOpen] = useState(false)
 // Advanced flows picked from the wizard's Simple/Advanced step
 const [advancedUpload, setAdvancedUpload] = useState<'claim' | 'evidence' | null>(null)

 const rawView = searchParams.get('view')
 const view: TimelineView = rawView === 'evidence' || rawView === 'claims' ? rawView : 'connections'
 // When locked to a metric, force the metric filter so every view/count is scoped.
 const filters = useMemo(() => {
 const base = filtersFromParams(searchParams)
 return lockedMetricId ? { ...base, metrics: [lockedMetricId] } : base
 }, [searchParams, lockedMetricId])

 const setView = (next: TimelineView) => {
 const params = new URLSearchParams(searchParams)
 if (next === 'connections') params.delete('view')
 else params.set('view', next)
 setSearchParams(params, { replace: true })
 }

 const setFilters = (next: TimelineFilters) => {
 const params = new URLSearchParams(searchParams)
 applyFiltersToParams(params, next)
 setSearchParams(params, { replace: true })
 }

 const load = useCallback(async () => {
 if (!initiativeId) return
 try {
 const timeline = await apiService.getInitiativeTimeline(initiativeId)
 setData(timeline)
 } catch (error) {
 console.error('Error loading timeline:', error)
 notify.error('Failed to load timeline')
 setData(null)
 } finally {
 setLoading(false)
 }
 }, [initiativeId])

 useEffect(() => {
 setLoading(true)
 load()
 }, [load])

 useEffect(() => {
 if (!initiativeId) return
 Promise.all([
 apiService.getLocations(initiativeId),
 apiService.getBeneficiaryGroups(initiativeId),
 apiService.getMetricTags(),
 ]).then(([locs, groups, allTags]) => {
 setLocations(locs || [])
 setBeneficiaryGroups(groups || [])
 setTags(allTags || [])
 }).catch(() => {
 setLocations([])
 setBeneficiaryGroups([])
 setTags([])
 })
 }, [initiativeId])

 const refresh = useCallback(async () => {
 await load()
 onRefresh?.()
 }, [load, onRefresh])

 const handleOpenClaim = (claim: TimelineClaim, kpi: KPI | undefined) => {
 setSelectedEvidence(null)
 setSelectedClaim({ claim, kpi })
 }

 const handleOpenEvidence = (ev: TimelineEvidence) => {
 setSelectedClaim(null)
 setSelectedEvidence(ev)
 }

 const unlinkedEvidence = useMemo(
 () => (data?.evidence || []).filter(ev => ev.claim_count === 0),
 [data]
 )

 // Status counts: initiative-wide normally, but scoped to the metric when locked.
 const displayStats = useMemo(() => {
 if (!data) return null
 if (!lockedMetricId) return data.stats
 const mClaims = data.claims.filter(c => c.kpi_id === lockedMetricId)
 const mEvidence = data.evidence.filter(e => (e.kpi_ids || []).includes(lockedMetricId))
 const connected = mClaims.filter(c => c.evidence_count > 0).length + mEvidence.filter(e => e.claim_count > 0).length
 const total = mClaims.length + mEvidence.length
 return { total, connected, not_connected: total - connected, claims_total: mClaims.length, evidence_total: mEvidence.length }
 }, [data, lockedMetricId])


 const handleAddEvidenceToClaim = canEditEvidence
 ? (claim: TimelineClaim, kpi: KPI | undefined) => setAddEvidenceTarget({ claim, kpi })
 : undefined
 const handleConnectExistingToClaim = canEditEvidence && unlinkedEvidence.length > 0
 ? (claim: TimelineClaim) => setConnectTarget({ claimId: claim.id })
 : undefined

 const handleEditEvidence = async (ev: Evidence) => {
 setSelectedEvidence(null)
 try {
 const fullEvidence = await apiService.getEvidenceItem(ev.id!)
 setEditingEvidence(fullEvidence)
 setIsEditModalOpen(true)
 } catch (error) {
 console.error('Error loading evidence for edit:', error)
 notify.error('Failed to load evidence details')
 setEditingEvidence(ev)
 setIsEditModalOpen(true)
 }
 }

 const handleSaveEvidence = async (evidenceData: any) => {
 try {
 if (editingEvidence?.id) {
 await apiService.updateEvidence(editingEvidence.id, evidenceData)
 notify.success('Evidence updated successfully!')
 }
 await refresh()
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to save evidence'
 notify.error(message)
 throw error
 }
 }

 const handleUpdateClaim = async (data: CreateKPIUpdateForm) => {
 if (!editingClaim?.claim.id) return
 try {
 await apiService.updateKPIUpdate(editingClaim.claim.id, data)
 notify.success('Impact claim updated')
 setEditingClaim(null)
 await refresh()
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to update claim'
 notify.error(message)
 throw error
 }
 }

 const handleDeleteEvidence = async (ev: Evidence) => {
 if (!ev.id) return
 try {
 await apiService.deleteEvidence(ev.id)
 notify.success('Evidence deleted successfully')
 setDeleteEvidence(null)
 setSelectedEvidence(null)
 await refresh()
 } catch (error) {
 notify.error('Failed to delete evidence')
 }
 }

 return (
    <div className={embedded ? 'flex flex-col' : 'h-screen overflow-hidden flex flex-col mobile-content-padding'}>
      {/* Header + toolbar (kept compact so the list below is the focus) */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          {embedded ? (
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-800 leading-tight">Logs</h3>
              <p className="text-xs text-gray-500 hidden sm:block">Claims, evidence, and connections for this metric</p>
            </div>
          ) : (
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">Logs</h2>
              <p className="text-xs text-gray-500 hidden sm:block">
                Every logged claim, piece of evidence, and connection for this initiative
              </p>
            </div>
          )}
          {(canAddImpactClaims || canEditEvidence) && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className={`app-btn app-btn-primary shadow-sm flex-shrink-0 ${embedded ? 'app-btn-sm' : 'app-btn-lg'}`}
            >
              <Plus className={embedded ? 'w-4 h-4' : 'w-5 h-5'} />
              <span>Add Log</span>
            </button>
          )}
        </div>

        {/* Main filters */}
        <TimelineFilterBar
          view={view}
          filters={filters}
          onFiltersChange={setFilters}
          kpis={data?.kpis || []}
          hideMetric={!!lockedMetricId}
          locations={locations}
          beneficiaryGroups={beneficiaryGroups}
          tags={tags}
          contributors={data?.contributors || {}}
        />

        {/* Connection status filters + search + metrics control */}
        <div className="flex flex-wrap items-center gap-3">
          {data && displayStats && (
            <TimelineStatCards
              stats={displayStats}
              activeStatus={filters.status}
              onStatusClick={(status) => setFilters({ ...filters, status })}
            />
          )}

          {/* Search — inline with the status filters */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search claims and evidence…"
              className="w-full h-9 pl-10 pr-3 bg-white border border-gray-200 rounded-full text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* View switcher — full-width, equal, squared buttons above the rows */}
      <div className="px-4 sm:px-6 pt-4 pb-1 bg-gray-50 flex-shrink-0">
        <div className="grid grid-cols-3 gap-2">
          {VIEWS.map(v => {
            const isActive = view === v.id
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`inline-flex items-center justify-center h-10 rounded-lg border text-sm font-medium transition-colors ${isActive ? 'border-primary-300 bg-primary-50 ring-1 ring-primary-400 text-gray-900' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active view — primary focus of the page */}
      <div className={`px-4 sm:px-6 pb-4 sm:pb-6 pt-2 bg-gray-50 ${embedded ? '' : 'flex-1 overflow-y-auto'}`}>
        {loading ? (
          <SectionLoader className="h-64" />
        ) : !data ? (
          <div className="app-card md:p-8">
            <EmptyState
              icon={AlertCircle}
              title="Logs unavailable"
              description="Something went wrong loading this initiative's activity. Try refreshing the page."
            />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={viewSwap.initial}
              animate={viewSwap.animate}
              exit={viewSwap.exit}
            >
              {view === 'claims' ? (
                <ClaimsView
                  claims={data.claims}
                  kpis={data.kpis}
                  locations={locations}
                  evidence={data.evidence}
                  contributors={data.contributors}
                  filters={filters}
                  onOpenClaim={handleOpenClaim}
                  onAddEvidenceToClaim={handleAddEvidenceToClaim}
                  onConnectExistingToClaim={handleConnectExistingToClaim}
                />
              ) : view === 'evidence' ? (
                <EvidenceView
                  evidence={data.evidence}
                  kpis={data.kpis}
                  locations={locations}
                  contributors={data.contributors}
                  filters={filters}
                  onOpenEvidence={handleOpenEvidence}
                />
              ) : (
                <ConnectionsView
                  claims={data.claims}
                  evidence={data.evidence}
                  kpis={data.kpis}
                  locations={locations}
                  contributors={data.contributors}
                  filters={filters}
                  onOpenClaim={handleOpenClaim}
                  onOpenEvidence={handleOpenEvidence}
                  onAddEvidenceToClaim={handleAddEvidenceToClaim}
                  onConnectExistingToClaim={handleConnectExistingToClaim}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
 </div>

 {/* Full-screen add flow (evidence / claim / both) */}
 {isWizardOpen && data && (
 <UploadWizard
 initiativeId={initiativeId}
 canCreateClaim={canAddImpactClaims}
 canCreateEvidence={canEditEvidence}
 lockedMetricId={lockedMetricId}
 onAdvancedClaim={lockedMetricId ? undefined : () => { setIsWizardOpen(false); setAdvancedUpload('claim') }}
 onAdvancedEvidence={lockedMetricId ? undefined : () => { setIsWizardOpen(false); setAdvancedUpload('evidence') }}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={data.claims}
 existingEvidence={data.evidence}
 onClose={() => setIsWizardOpen(false)}
 onCreated={refresh}
 />
 )}

 {/* Advanced claim board (existing multi-claim flow) */}
 {advancedUpload === 'claim' && data && (
 <ImpactClaimUploadModal
 isOpen
 initialMode="advanced"
 initiativeId={initiativeId}
 availableKPIs={data.kpis}
 onClose={() => setAdvancedUpload(null)}
 onCreated={() => refresh()}
 />
 )}

 {/* Advanced evidence batch organizer (existing kanban flow) */}
 {advancedUpload === 'evidence' && (
 <EvidenceUploadModal
 isOpen
 initialMode="batch"
 initiativeId={initiativeId}
 onClose={() => setAdvancedUpload(null)}
 onCreated={() => refresh()}
 />
 )}

 {/* Connect evidence ↔ claim (re-scope + link), from either side */}
 {connectTarget && data && (
 <ConnectEvidenceDialog
 evidence={connectTarget.evidence}
 evidenceOptions={connectTarget.evidence ? undefined : unlinkedEvidence}
 claims={data.claims}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 preselectedClaimId={connectTarget.claimId}
 onClose={() => setConnectTarget(null)}
 onConnected={refresh}
 />
 )}

 {/* Quick evidence upload scoped to one claim */}
 {addEvidenceTarget && (
 <AddEvidenceToClaimDialog
 claim={addEvidenceTarget.claim}
 kpi={addEvidenceTarget.kpi}
 initiativeId={initiativeId}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 onClose={() => setAddEvidenceTarget(null)}
 onCreated={refresh}
 />
 )}

 {/* Evidence detail */}
 {selectedEvidence && data && (
 <EvidenceDetailModal
 evidence={selectedEvidence}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 contributors={data.contributors}
 connectedClaims={data.claims.filter(c => (selectedEvidence.kpi_update_ids || []).includes(c.id!))}
 onClose={() => setSelectedEvidence(null)}
 onOpenClaim={(claim) => handleOpenClaim(claim, data.kpis.find(k => k.id === claim.kpi_id))}
 onEdit={canEditEvidence ? () => handleEditEvidence(selectedEvidence) : undefined}
 onDelete={canDelete ? () => setDeleteEvidence(selectedEvidence) : undefined}
 />
 )}

 {/* Claim detail */}
 {selectedClaim && data && (
 <ClaimDetailModal
 claim={selectedClaim.claim}
 kpi={selectedClaim.kpi}
 evidence={data.evidence.filter(ev => (ev.kpi_update_ids || []).includes(selectedClaim.claim.id!))}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 contributors={data.contributors}
 onClose={() => setSelectedClaim(null)}
 onOpenEvidence={handleOpenEvidence}
 onEdit={canAddImpactClaims && selectedClaim.kpi
 ? () => {
 setEditingClaim({ claim: selectedClaim.claim, kpi: selectedClaim.kpi! })
 setSelectedClaim(null)
 }
 : undefined}
 onAddEvidence={canEditEvidence
 ? () => setAddEvidenceTarget({ claim: selectedClaim.claim, kpi: selectedClaim.kpi })
 : undefined}
 onConnectExisting={canEditEvidence && unlinkedEvidence.length > 0
 ? () => setConnectTarget({ claimId: selectedClaim.claim.id })
 : undefined}
 />
 )}

 {/* Edit evidence — modern details/scope editor (files stay untouched) */}
 {isEditModalOpen && editingEvidence && (
 <EditEvidenceModal
 evidence={editingEvidence}
 kpis={data?.kpis || []}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 onClose={() => {
 setIsEditModalOpen(false)
 setEditingEvidence(null)
 }}
 onSave={handleSaveEvidence}
 />
 )}

 {/* Edit claim — same form used across the app, in edit mode */}
 {editingClaim && (
 <AddKPIUpdateModal
 isOpen
 onClose={() => setEditingClaim(null)}
 onSubmit={handleUpdateClaim}
 kpiTitle={editingClaim.kpi.title}
 kpiId={editingClaim.kpi.id!}
 metricType={(editingClaim.kpi.metric_type as 'number' | 'percentage') || 'number'}
 unitOfMeasurement={editingClaim.kpi.unit_of_measurement || ''}
 initiativeId={initiativeId}
 kpiTagIds={(editingClaim.kpi as any).tag_ids || []}
 editData={editingClaim.claim}
 />
 )}

 {deleteEvidence && (
 <ConfirmDialog
 title="Delete Evidence"
 message={`Delete ${deleteEvidence.title || 'this evidence'}? This action cannot be undone.`}
 confirmLabel="Delete Evidence"
 tone="danger"
 onConfirm={() => handleDeleteEvidence(deleteEvidence)}
 onCancel={() => setDeleteEvidence(null)}
 />
 )}
 </div>
 )
}
