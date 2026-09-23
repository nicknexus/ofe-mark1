import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { EmptyState, Skeleton } from '../ui'
import { AlertCircle, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import {
 TimelineFilters,
 TimelineView,
 applyFiltersToParams,
 filtersFromParams,
} from '../../utils/timeline'
import { readSWR, writeSWR } from '../../utils/swrCache'
import { tagsOnProgramMetrics } from '../../utils/programTags'
import { viewSwap } from '../timeline/motion'
import TimelineStatCards from '../timeline/TimelineStatCards'
import TimelineFilterBar from '../timeline/TimelineFilterBar'
import UploadWizard from '../upload/UploadWizard'
import ClaimsView from '../timeline/ClaimsView'
import EvidenceView from '../timeline/EvidenceView'
import EvidenceViewModeToggle from '../timeline/EvidenceViewModeToggle'
import type { EvidenceViewMode } from '../timeline/EvidenceViewModeToggle'
import ConnectionsView from '../timeline/ConnectionsView'
import ConnectEvidenceDialog from '../timeline/ConnectEvidenceDialog'
import EvidenceDetailModal from '../timeline/EvidenceDetailModal'
import ClaimDetailModal from '../timeline/ClaimDetailModal'
import ConfirmDialog from '../ConfirmDialog'
import ImpactClaimUploadModal from '../impactClaims/ImpactClaimUploadModal'
import EvidenceUploadModal from '../evidence/EvidenceUploadModal'

// Each view wears its side's brand color when active: connections are the
// impact green (the link color), claims are seafoam teal, evidence is the
// primary brand green — matching the Add Log wizard's branding.
const VIEWS: Array<{ id: TimelineView; label: string; activeClass: string }> = [
 { id: 'connections', label: 'Connections', activeClass: 'border-primary-300 bg-gradient-to-r from-claim-50 to-primary-50 text-gray-900' },
 { id: 'claims', label: 'Claims', activeClass: 'border-claim-300 bg-claim-50 text-gray-900' },
 { id: 'evidence', label: 'Evidence', activeClass: 'border-primary-300 bg-primary-50 text-gray-900' },
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
  /** Bump this counter to open the Add Log wizard from a parent (e.g. the
  * metric detail header button). */
 openAddLogSignal?: number
 /** The parent header already owns the "Logs" title and Add log button
  * (program page): drop our title row so the list gets the height. */
 hideHeader?: boolean
 /** Opens Quick setup when a program has no metric or location yet. */
 onQuickSetup?: () => void
 /** Live structure counts. The timeline payload lags behind adds. */
 knownMetricCount?: number
 knownLocationCount?: number | null
}

/** Dimension filters that live behind the Filters toggle (search + status
 * have their own always-visible controls). */
function countDimensionFilters(f: TimelineFilters): number {
 return (
 (f.metrics.length ? 1 : 0) +
 (f.locations.length ? 1 : 0) +
 (f.beneficiaryGroups.length ? 1 : 0) +
 (f.tags.length ? 1 : 0) +
 (f.contributors.length ? 1 : 0) +
 (f.evidenceTypes.length ? 1 : 0) +
 (f.dateFrom || f.dateTo ? 1 : 0)
 )
}

function LogsSkeleton() {
 return (
 <div className="space-y-2.5" aria-hidden>
 {Array.from({ length: 6 }).map((_, i) => (
 <div key={i} className="app-card p-3.5 flex items-center gap-3">
 <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
 <div className="flex-1 min-w-0 space-y-2">
 <Skeleton className="h-3.5 w-2/5" />
 <Skeleton className="h-3 w-3/5" />
 </div>
 <Skeleton className="h-5 w-16 rounded-full" />
 </div>
 ))}
 </div>
 )
}

/**
 * Logs — unified operational view over the initiative's impact claims,
 * evidence, and their connections. Sub-view and every filter live in URL
 * params so filtered views can be deep-linked, refreshed, and navigated with
 * browser controls (?tab=logs&view=...&metric=...).
 */
export default function TimelineTab({ initiativeId, onRefresh, lockedMetricId, embedded, openAddLogSignal, hideHeader, onQuickSetup, knownMetricCount, knownLocationCount }: TimelineTabProps) {
 const { canAddImpactClaims, canEditClaims, canAddEvidence, canEditEvidence, canDelete, canManageTeam, canEditMetrics } = useTeam()
 const [searchParams, setSearchParams] = useSearchParams()

 // Stale-while-revalidate: paint the last payload for this program instantly
 // (revisit / refresh), then the fresh fetch below overwrites it.
 const swrKey = `timeline:${initiativeId}`
 const [data, setData] = useState<TimelineResponse | null>(() => readSWR<TimelineResponse>(swrKey))
 const [loading, setLoading] = useState(() => !readSWR<TimelineResponse>(swrKey))
 const [filtersOpen, setFiltersOpen] = useState(false)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [tags, setTags] = useState<MetricTag[]>([])

 // Detail + edit modal state
 const [selectedEvidence, setSelectedEvidence] = useState<TimelineEvidence | null>(null)
 const [selectedClaim, setSelectedClaim] = useState<{ claim: TimelineClaim; kpi: KPI | undefined } | null>(null)
 const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
 const [editingClaim, setEditingClaim] = useState<{ claim: TimelineClaim; kpi: KPI } | null>(null)
 const [deleteEvidence, setDeleteEvidence] = useState<Evidence | null>(null)
 const [deleteClaim, setDeleteClaim] = useState<TimelineClaim | null>(null)
 // evidence set = evidence-first (pick a claim); evidence omitted = claim-first (pick from unconnected evidence)
 const [connectTarget, setConnectTarget] = useState<{ evidence?: TimelineEvidence; claimId?: string } | null>(null)
 const [addEvidenceTarget, setAddEvidenceTarget] = useState<{ claim: TimelineClaim; kpi: KPI | undefined } | null>(null)
 const [isWizardOpen, setIsWizardOpen] = useState(false)
 const listRef = useRef<HTMLDivElement>(null)
 const scrollAfterCreate = useRef(false)
 // Advanced flows picked from the wizard's Simple/Advanced step
 const [advancedUpload, setAdvancedUpload] = useState<'claim' | 'evidence' | null>(null)
 const [evidenceMode, setEvidenceMode] = useState<EvidenceViewMode>('list')

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
 // Normalise defensively: a backend older than this frontend (or a
 // cached/partial payload) may omit arrays, and every view assumes
 // they exist. Missing pieces degrade to empty instead of crashing.
 const normalised: TimelineResponse = {
 kpis: timeline?.kpis || [],
 claims: timeline?.claims || [],
 evidence: timeline?.evidence || [],
 connections: timeline?.connections || [],
 contributors: timeline?.contributors || {},
 stats: timeline?.stats || { total: 0, connected: 0, not_connected: 0, claims_total: 0, evidence_total: 0 },
 }
 setData(normalised)
 writeSWR(`timeline:${initiativeId}`, normalised)
 } catch (error) {
 console.error('Error loading timeline:', error)
 notify.error('Failed to load timeline')
 setData(null)
 } finally {
 setLoading(false)
 }
 }, [initiativeId])

 useEffect(() => {
 // Only show the skeleton when there is nothing cached to paint.
 if (!readSWR<TimelineResponse>(`timeline:${initiativeId}`)) setLoading(true)
 load()
 }, [load, initiativeId])

 // Dimension filters arriving via deep link should be visible, not hidden
 // behind a collapsed toggle.
 const dimensionFilterCount = countDimensionFilters(filters)
 useEffect(() => {
 if (dimensionFilterCount > 0) setFiltersOpen(true)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 // Parent-triggered "Add Log". The tab unmounts when you leave Logs, so a
 // leftover signal from an earlier click must not reopen the wizard on return.
 const seenAddLogSignal = useRef(openAddLogSignal)
 useEffect(() => {
 if (openAddLogSignal === seenAddLogSignal.current) return
 seenAddLogSignal.current = openAddLogSignal
 if (openAddLogSignal) setIsWizardOpen(true)
 }, [openAddLogSignal])

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
 // Post-mutation reload must not serve cached payloads — approval status,
 // connections, and aggregates would appear stale until the cache expired.
 apiService.clearCache(`/initiatives/${initiativeId}/timeline`)
 apiService.clearCache(`/initiatives/${initiativeId}/dashboard`)
 await load()
 onRefresh?.()
 }, [initiativeId, load, onRefresh])

 useEffect(() => {
 if (!scrollAfterCreate.current || loading) return
 scrollAfterCreate.current = false
 requestAnimationFrame(() => {
 const el = listRef.current
 if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
 })
 }, [data, loading])

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

 const programTags = useMemo(
   () => tagsOnProgramMetrics(tags, data?.kpis || []),
   [tags, data?.kpis]
 )


 const handleAddEvidenceToClaim = canAddEvidence
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
 } catch (error) {
 console.error('Error loading evidence for edit:', error)
 notify.error('Failed to load evidence details')
 setEditingEvidence(ev)
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

 // Review gate: approve pending evidence (creates connections) or send any
 // evidence back to the approval queue (strips connections).
 const handleSetApproval = async (ev: TimelineEvidence, status: 'approved' | 'pending') => {
 if (!ev.id) return
 try {
 await apiService.setEvidenceApproval(ev.id, status)
 notify.success(status === 'approved'
 ? 'Evidence approved — connections created'
 : 'Evidence marked as pending — it no longer connects or counts until re-approved')
 setSelectedEvidence(null)
 await refresh()
 } catch (error) {
 notify.error((error as Error).message || 'Failed to update approval status')
 }
 }

 const handleDeleteClaim = async (claim: TimelineClaim) => {
 if (!claim.id) return
 try {
 await apiService.deleteKPIUpdate(claim.id)
 notify.success('Impact claim deleted')
 setDeleteClaim(null)
 setSelectedClaim(null)
 await refresh()
 } catch (error) {
 notify.error('Failed to delete impact claim')
 }
 }

  const showTitleRow = !hideHeader
  const showAddButton = (canAddImpactClaims || canAddEvidence) && !hideHeader

  return (
    <div className={embedded ? 'flex flex-col' : 'h-full overflow-hidden flex flex-col'}>
      {/* Toolbar: one row (view · search · status · filters toggle), plus an
          optional second row of dimension filters. The list gets the rest. */}
      <div className={`px-4 sm:px-6 pt-2.5 pb-2 border-b border-gray-100 space-y-2 flex-shrink-0 ${embedded ? 'bg-gray-50' : 'bg-white'}`}>
        {showTitleRow && (
          <div className="flex items-center justify-between gap-3">
            {embedded ? (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-gray-800 leading-tight">Logs</h3>
                <p className="text-xs text-gray-500 hidden sm:block">Claims, evidence, and connections for this metric</p>
              </div>
            ) : (
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-900 leading-tight tracking-tight">Logs</h2>
              </div>
            )}
            {showAddButton && (
              <button
                onClick={() => setIsWizardOpen(true)}
                className={`app-btn app-btn-sm app-btn-primary shadow-sm flex-shrink-0 ${embedded ? '' : 'max-md:hidden'}`}
              >
                <Plus className="w-4 h-4" />
                <span>Add Log</span>
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 md:gap-2.5">
          {/* View switcher */}
          <div className="inline-flex items-center gap-1 rounded-lg bg-gray-100/90 p-0.5 flex-shrink-0" role="tablist" aria-label="Log view">
            {VIEWS.map(v => {
              const isActive = view === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setView(v.id)}
                  className={`inline-flex items-center justify-center h-8 px-3 rounded-md border text-xs md:text-sm font-semibold transition-colors ${isActive ? `${v.activeClass} shadow-card` : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/70'}`}
                >
                  {v.label}
                </button>
              )
            })}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[140px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Search logs"
              className="w-full h-8 pl-9 pr-8 bg-white border border-gray-200 rounded-full text-xs md:text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {filters.q && (
              <button
                type="button"
                onClick={() => setFilters({ ...filters, q: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {data && displayStats && (
              <TimelineStatCards
                stats={displayStats}
                activeStatus={filters.status}
                onStatusClick={(status) => {
                  // Pending items only render in the Evidence view, so the
                  // approval-queue filter jumps there from Connections.
                  const params = new URLSearchParams(searchParams)
                  applyFiltersToParams(params, { ...filters, status })
                  if (status === 'pending' && view === 'connections') params.set('view', 'evidence')
                  setSearchParams(params, { replace: true })
                }}
              />
            )}
            {view === 'evidence' && (
              <EvidenceViewModeToggle mode={evidenceMode} onChange={setEvidenceMode} />
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              aria-expanded={filtersOpen}
              className={`app-btn app-btn-sm ${filtersOpen || dimensionFilterCount > 0 ? 'app-btn-secondary border-primary-200 bg-primary-50 text-primary-900' : 'app-btn-ghost text-gray-600'}`}
              title="Filter by metric, location, group, tag, contributor, type, or date"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
              {dimensionFilterCount > 0 && (
                <span className="min-w-[1.1rem] px-1 py-px rounded-full bg-primary-600 text-white text-[10px] font-bold tabular-nums text-center">
                  {dimensionFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Dimension filters: collapsed by default, auto-open when a deep
            link carries one. */}
        <AnimatePresence initial={false}>
          {filtersOpen && (
            <motion.div
              key="filters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="pt-1">
                <TimelineFilterBar
                  view={view}
                  filters={filters}
                  onFiltersChange={setFilters}
                  kpis={data?.kpis || []}
                  hideMetric={!!lockedMetricId}
                  locations={locations}
                  beneficiaryGroups={beneficiaryGroups}
                  tags={programTags}
                  contributors={data?.contributors || {}}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Active view — fills remaining height down to the phone nav / desktop chrome */}
      <div ref={listRef} className={`px-4 sm:px-6 pb-2 md:pb-6 pt-2.5 bg-gray-50 min-h-0 ${embedded ? '' : 'flex-1 overflow-y-auto'}`}>
        {loading ? (
          <LogsSkeleton />
        ) : !data ? (
          <div className="app-card md:p-8">
            <EmptyState
              icon={AlertCircle}
              title="Logs unavailable"
              description="Something went wrong loading this program's activity. Try refreshing the page."
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
                  onQuickSetup={onQuickSetup}
                  knownMetricCount={knownMetricCount}
                  knownLocationCount={knownLocationCount}
                />
              ) : view === 'evidence' ? (
                <EvidenceView
                  evidence={data.evidence}
                  kpis={data.kpis}
                  locations={locations}
                  contributors={data.contributors}
                  filters={filters}
                  mode={evidenceMode}
                  onOpenEvidence={handleOpenEvidence}
                  onQuickSetup={onQuickSetup}
                  knownMetricCount={knownMetricCount}
                  knownLocationCount={knownLocationCount}
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
                  onAddLog={(canAddImpactClaims || canAddEvidence) ? () => setIsWizardOpen(true) : undefined}
                  onQuickSetup={onQuickSetup}
                  knownMetricCount={knownMetricCount}
                  knownLocationCount={knownLocationCount}
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
 canCreateEvidence={canAddEvidence}
 lockedMetricId={lockedMetricId}
 onAdvancedClaim={lockedMetricId ? undefined : () => { setIsWizardOpen(false); setAdvancedUpload('claim') }}
 onAdvancedEvidence={lockedMetricId ? undefined : () => { setIsWizardOpen(false); setAdvancedUpload('evidence') }}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 canManageStructure={canEditMetrics}
 onStructureChanged={refresh}
 existingClaims={data.claims}
 existingEvidence={data.evidence}
 onClose={() => setIsWizardOpen(false)}
 onCreated={() => { scrollAfterCreate.current = true; return refresh() }}
 />
 )}

 {/* Advanced claim board (existing multi-claim flow) */}
 {advancedUpload === 'claim' && data && (
 <ImpactClaimUploadModal
 isOpen
 initiativeId={initiativeId}
 onClose={() => setAdvancedUpload(null)}
 onCreated={() => { scrollAfterCreate.current = true; return refresh() }}
 />
 )}

 {/* Advanced evidence batch organizer (existing kanban flow) */}
 {advancedUpload === 'evidence' && (
 <EvidenceUploadModal
 isOpen
 initiativeId={initiativeId}
 onClose={() => setAdvancedUpload(null)}
 onCreated={() => { scrollAfterCreate.current = true; return refresh() }}
 />
 )}

 {/* Connect evidence ↔ claim (re-scope + link), from either side */}
 {connectTarget && data && (
 <ConnectEvidenceDialog
 zIndexClass="z-[90]"
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

 {/* Add evidence scoped to one claim — the full Add Log flow (evidence mode),
 prefilled with the claim's scope so it auto-connects. */}
 {addEvidenceTarget && data && (
 <UploadWizard
 initiativeId={initiativeId}
 canCreateClaim={canAddImpactClaims}
 canCreateEvidence={canAddEvidence}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={data.claims}
 existingEvidence={data.evidence}
 evidenceForClaim={addEvidenceTarget.claim}
 onClose={() => setAddEvidenceTarget(null)}
 onCreated={() => { scrollAfterCreate.current = true; return refresh() }}
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
 allClaims={data.claims}
 canReview={canManageTeam}
 onSetApproval={canManageTeam ? (status) => handleSetApproval(selectedEvidence, status) : undefined}
 onClose={() => setSelectedEvidence(null)}
 onOpenClaim={(claim) => handleOpenClaim(claim, data.kpis.find(k => k.id === claim.kpi_id))}
 onEdit={canEditEvidence ? () => handleEditEvidence(selectedEvidence) : undefined}
 onDelete={canDelete || (canManageTeam && selectedEvidence.approval_status === 'pending')
 ? () => setDeleteEvidence(selectedEvidence)
 : undefined}
 onConnect={canEditEvidence ? () => { setSelectedEvidence(null); setConnectTarget({ evidence: selectedEvidence }) } : undefined}
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
 onEdit={canEditClaims && selectedClaim.kpi
 ? () => {
 setEditingClaim({ claim: selectedClaim.claim, kpi: selectedClaim.kpi! })
 setSelectedClaim(null)
 }
 : undefined}
 onAddEvidence={canAddEvidence
 ? () => {
 setAddEvidenceTarget({ claim: selectedClaim.claim, kpi: selectedClaim.kpi })
 setSelectedClaim(null)
 }
 : undefined}
 onConnectExisting={canEditEvidence && unlinkedEvidence.length > 0
 ? () => setConnectTarget({ claimId: selectedClaim.claim.id })
 : undefined}
 onDelete={canDelete
 ? () => setDeleteClaim(selectedClaim.claim)
 : undefined}
 />
 )}

 {/* Edit claim / evidence — the same Add Log wizard, prefilled, so
 editing walks the exact same steps as adding */}
 {(editingEvidence || editingClaim) && data && (
 <UploadWizard
 initiativeId={initiativeId}
 canCreateClaim={canAddImpactClaims}
 canCreateEvidence={canAddEvidence}
 kpis={data.kpis}
 locations={locations}
 tags={tags}
 beneficiaryGroups={beneficiaryGroups}
 existingClaims={data.claims}
 existingEvidence={data.evidence}
 editClaim={editingClaim?.claim}
 editEvidence={editingEvidence ?? undefined}
 onClose={() => {
 setEditingEvidence(null)
 setEditingClaim(null)
 }}
 onCreated={refresh}
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

 {deleteClaim && (
 <ConfirmDialog
 title="Delete Impact Claim"
 message="Delete this impact claim? Connected evidence stays, but this claim and its connections will be removed. This action cannot be undone."
 confirmLabel="Delete Claim"
 tone="danger"
 onConfirm={() => handleDeleteClaim(deleteClaim)}
 onCancel={() => setDeleteClaim(null)}
 />
 )}
 </div>
 )
}
