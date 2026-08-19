import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
 Plus,
 MapPin,
 Edit,
 Trash2,
 BarChart3,
  GripVertical,
  ChevronRight
} from 'lucide-react'
import {
 DndContext,
 closestCenter,
 MouseSensor,
 useSensor,
 useSensors,
 DragEndEvent,
} from '@dnd-kit/core'
import {
 arrayMove,
 SortableContext,
 useSortable,
 rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { motion } from 'framer-motion'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Location } from '../types'
import { formatDate, truncateText } from '../utils'
import { notify } from '../lib/notify'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import ModalFrame from '../components/ModalFrame'
import UpgradeModal from '../components/UpgradeModal'
import { SubscriptionService } from '../services/subscription'
import { Lock } from 'lucide-react'
import { useTutorial } from '../context/TutorialContext'
import { useOnboarding } from '../context/OnboardingContext'
import { useTeam } from '../context/TeamContext'
import { Button, PageLoader, InlineAlert, EmptyState, PageHeader } from '../components/ui'
import { InitiativesHelp } from '../components/tracking/TrackingHelp'
import { easeOut } from '../components/timeline/motion'
import { shouldHoldTutorialAutostart } from '../lib/layoutIntro'

// ============ Sortable initiative card ============
// Owner/team can drag-reorder initiatives on the dashboard. Order is persisted
// to the backend (display_order) and reflected on the public org page. Styled
// like the Metrics-tab cards: hairline border, crisp shadow, hover lift, and a
// chevron as the "this opens" affordance.
function SortableInitiativeCard({
 initiative,
 stats,
 canEditInitiatives,
 canDeleteInitiatives,
  openEditModal,
  openDeleteConfirm,
  locked = false,
  onLockedClick,
  orgLogoUrl,
}: {
  initiative: Initiative
  /** Per-initiative counts; null while background stats are still loading. */
  stats: { metrics: number; locations: number } | null
  canEditInitiatives: boolean
  canDeleteInitiatives: boolean
  openEditModal: (i: Initiative) => void
  openDeleteConfirm: (i: Initiative) => void
  locked?: boolean
  onLockedClick?: () => void
  /** Organization logo; falls back to the Nexus mark when absent. */
  orgLogoUrl?: string | null
}) {
 const {
 attributes,
 listeners,
 setNodeRef,
 transform,
 transition,
 isDragging,
 } = useSortable({ id: initiative.id! })

 const style = {
 transform: CSS.Transform.toString(transform),
 transition,
 opacity: isDragging ? 0.5 : 1,
 zIndex: isDragging ? 10 : 'auto' as const,
 }

  const inner = (
    <div className="p-4 h-full flex flex-col gap-2.5">
      <div className="flex items-start gap-3 pr-14">
        {locked ? (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ring-1 bg-amber-50 text-amber-600 ring-amber-100">
            <Lock className="w-4 h-4" />
          </div>
        ) : (
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-100 overflow-hidden">
            <img
              src={orgLogoUrl || '/Nexuslogo.png'}
              alt=""
              className="w-full h-full object-contain"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold leading-snug line-clamp-1 transition-colors ${locked ? 'text-gray-500' : 'text-gray-900'}`} title={initiative.title}>
            {initiative.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">
            {locked ? 'Locked — upgrade to unlock this initiative' : truncateText(initiative.description, 110)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3.5 mt-auto pt-2.5 border-t border-gray-100">
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <Lock className="w-3.5 h-3.5" />
            Locked
          </span>
        ) : stats ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <BarChart3 className="w-3.5 h-3.5" />
              {stats.metrics} metric{stats.metrics === 1 ? '' : 's'}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <MapPin className="w-3.5 h-3.5" />
              {stats.locations} location{stats.locations === 1 ? '' : 's'}
            </span>
            {initiative.updated_at && (
              <span className="ml-auto text-[11px] text-gray-400">
                {formatDate(initiative.updated_at)}
              </span>
            )}
          </>
        ) : (
          <span className="h-4 w-28 rounded bg-gray-100 animate-pulse" />
        )}
      </div>
    </div>
  )

 return (
 <div ref={setNodeRef} style={style} className="h-full">
 <div
 className={`group relative h-full bg-white rounded-2xl border shadow-card transition-all duration-200 ${locked
 ? 'border-gray-200/70 hover:border-amber-300/70 hover:shadow-card-hover'
 : 'border-gray-200/70 hover:border-primary-300/70 hover:shadow-card-hover hover:-translate-y-0.5'
 }`}
 >
 {locked ? (
 <button type="button" onClick={onLockedClick} className="block w-full h-full text-left">
 {inner}
 </button>
 ) : (
 <Link to={`/initiatives/${initiative.id}`} className="block h-full">
 {inner}
 </Link>
 )}

 {/* Top-right: hover actions (drag / edit / delete) + open indicator */}
 <div className="absolute top-3 right-3 flex items-center gap-0.5">
 {!locked && canEditInitiatives && (
 <button
 type="button"
 {...attributes}
 {...listeners}
 onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
 className="hidden md:flex p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing"
 title="Drag to reorder"
 aria-label="Drag to reorder initiative"
 >
 <GripVertical className="w-3.5 h-3.5" />
 </button>
 )}
 {!locked && canEditInitiatives && (
 <button
 onClick={(e) => {
 e.preventDefault()
 e.stopPropagation()
 openEditModal(initiative)
 }}
 className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
 title="Edit Initiative"
 >
 <Edit className="w-3.5 h-3.5" />
 </button>
 )}
 {!locked && canDeleteInitiatives && (
 <button
 onClick={(e) => {
 e.preventDefault()
 e.stopPropagation()
 openDeleteConfirm(initiative)
 }}
 className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
 title="Delete Initiative"
 >
 <Trash2 className="w-3.5 h-3.5" />
 </button>
 )}
 {locked
 ? <Lock className="w-4 h-4 text-amber-500" />
 : <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />}
 </div>
 </div>
 </div>
 )
}

export default function Dashboard() {
 const [searchParams, setSearchParams] = useSearchParams()
 const { startTutorial, needsTutorial, isActive: tutorialActive } = useTutorial()
 const { hasCompletedOnboarding, isActive: onboardingActive } = useOnboarding()
 const {
 isSharedMember,
 organizationName,
 ownedOrganization,
 activeOrganization,
 canCreateInitiatives,
 canEditInitiatives,
 canDelete,
 } = useTeam()
 // Team members see the full dashboard. Widgets read from activeOrganization
 // so a team member sees the org they're scoped into, not a missing
 // ownedOrganization.
 const dashboardOrg = activeOrganization || ownedOrganization
 // Granular gating: create / edit / delete are independent grants.
 // Account-level widgets (logo, branding, public toggle) remain owner-only.
 const canManageInitiatives = canEditInitiatives || canDelete || canCreateInitiatives
 const [initiatives, setInitiatives] = useState<Initiative[]>([])
 const [allKPIs, setAllKPIs] = useState<KPI[]>([])
 const [allLocations, setAllLocations] = useState<Location[]>([])
 // Organization info now comes from TeamContext
 const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
 const [isLoadingStats, setIsLoadingStats] = useState(true)
 const [showCreateModal, setShowCreateModal] = useState(false)
 const [showEditModal, setShowEditModal] = useState(false)
 const [deleteConfirmInitiative, setDeleteConfirmInitiative] = useState<Initiative | null>(null)
 const [deleteConfirmText, setDeleteConfirmText] = useState('')
 const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
 const [showUpgradeModal, setShowUpgradeModal] = useState(false)
 const [upgradeUsage, setUpgradeUsage] = useState<{ current: number; limit: number } | null>(null)
 // Plan initiative limit — used to lock over-limit initiatives after a downgrade.
 const [initiativesLimit, setInitiativesLimit] = useState<number | null>(null)

 // Add loading cache to prevent duplicate requests
 const [isLoadingData, setIsLoadingData] = useState(false)
 const loadingPromise = useRef<Promise<void> | null>(null)
 // Bumped on every load; an in-flight load whose token is no longer current
 // (e.g. superseded by an org switch) must not write its results into state.
 const loadTokenRef = useRef(0)

 useEffect(() => {
   if (searchParams.get('new') !== '1') return
   setShowCreateModal(true)
   const next = new URLSearchParams(searchParams)
   next.delete('new')
   setSearchParams(next, { replace: true })
 }, [searchParams, setSearchParams])

 // Trigger initial load AND re-trigger on org switch. dashboardOrg?.id
 // is the active org (or owner fallback) — switching orgs flips this and we
 // want a fresh data fetch under the new scope.
 useEffect(() => {
 if (!dashboardOrg?.id) return
 // Reset stale lists immediately so the UI doesn't show the previous
 // org's data while the new fetch is in flight.
 setInitiatives([])
 setAllKPIs([])
 setAllLocations([])
 setIsLoadingStats(true)
 // Drop any in-flight promise from the previous org so loadAllData's
 // dedupe guard doesn't return the old promise to the new effect.
 loadingPromise.current = null
 loadingPromise.current = loadAllData()
 }, [dashboardOrg?.id])

 // One-time backfill of evidence ↔ claim links per browser per org.
 // Catches up historical data created before the tag-gate rule (or other
 // matching changes) that wouldn't link until the user manually re-saved
 // either side. Idempotent on the backend; we use localStorage so it
 // really only runs once per browser/org rather than once per tab session.
 // To force a re-run (rare), delete the key in devtools.
 useEffect(() => {
 if (!dashboardOrg?.id) return
 const orgId = dashboardOrg.id
 const storageKey = `evidence-backfill-done:${orgId}`
 if (localStorage.getItem(storageKey)) return

 apiService.backfillEvidenceLinks()
 .then(result => {
 localStorage.setItem(storageKey, new Date().toISOString())
 if ((result.linksCreated > 0 || result.linksPruned > 0) && canManageInitiatives) {
 const created = result.linksCreated
 const pruned = result.linksPruned
 const parts: string[] = []
 if (created > 0) parts.push(`linked ${created} new evidence-claim pair${created === 1 ? '' : 's'}`)
 if (pruned > 0) parts.push(`removed ${pruned} stale link${pruned === 1 ? '' : 's'}`)
 notify.success(`Coverage refreshed: ${parts.join(', ')}.`, { duration: 4000 })
 apiService.clearCache('/kpis')
 apiService.clearCache('/initiatives')
 apiService.clearCache('/evidence')
 }
 })
 .catch(err => {
 console.warn('Evidence backfill failed (non-fatal):', err)
 })
 }, [dashboardOrg?.id, canManageInitiatives])

 useEffect(() => {
 const handleShowTutorial = () => {
 startTutorial()
 }
 window.addEventListener('show-tutorial', handleShowTutorial)
 return () => {
 window.removeEventListener('show-tutorial', handleShowTutorial)
 }
 }, [])

 // Auto-launch the (versioned) tutorial for returning users who haven't seen
 // the current version. Held until onboarding is done and its wizard is closed
 // so the two full-screen overlays never fight for the screen.
 useEffect(() => {
 if (!needsTutorial || tutorialActive) return
 if (!hasCompletedOnboarding || onboardingActive) return
 if (shouldHoldTutorialAutostart()) return
 const t = setTimeout(() => startTutorial(), 900)
 return () => clearTimeout(t)
 }, [needsTutorial, tutorialActive, hasCompletedOnboarding, onboardingActive, startTutorial])

 // Refresh dashboard data when the onboarding wizard closes — entities it
 // created (initiatives, locations, metrics) should appear without a manual
 // reload. Mutations already busted the apiService cache, so this just
 // re-pulls into component state.
 useEffect(() => {
 const handleOnboardingUpdated = () => {
 apiService.clearCache()
 loadingPromise.current = null
 loadingPromise.current = loadAllData()
 }
 window.addEventListener('onboarding-updated', handleOnboardingUpdated)
 return () => {
 window.removeEventListener('onboarding-updated', handleOnboardingUpdated)
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 const loadAllData = async (): Promise<void> => {
 // Ref-based dedupe only. `isLoadingData` is React state that lags a render
 // behind, so on a fast org switch it wrongly reported "still loading" and
 // silently dropped the new org's fetch. The effect nulls this ref before a
 // re-fetch, so a genuine org switch always proceeds.
 if (loadingPromise.current) {
 console.log('Load already in progress, skipping...')
 return loadingPromise.current
 }

 // Any results from a load older than this token are stale and ignored.
 const token = ++loadTokenRef.current
 const isStale = () => token !== loadTokenRef.current

 // Check if all data is already cached - if so, load from cache without API calls
 const [initiativesCached, kpisCached, evidenceCached] = await Promise.all([
 apiService.isDataCached('/initiatives'),
 apiService.isDataCached('/kpis'),
 apiService.isDataCached('/evidence')
 ])
 const hasCachedData = initiativesCached && kpisCached && evidenceCached

 if (hasCachedData) {
 console.log('All dashboard data is cached, loading from cache...')
 } else {
 console.log('Loading dashboard data...')
 }

 setIsLoadingData(true)
 setLoadingState({ isLoading: true })

 try {
 // Load initiatives - organization comes from TeamContext now
 const initiatives = await apiService.loadInitiativesOnly()
 if (isStale()) return
 setInitiatives(initiatives)
 setLoadingState({ isLoading: false }) // Show initiatives immediately

 // Fetch the plan's initiative limit so we can lock over-limit initiatives.
 SubscriptionService.getInitiativesUsage()
 .then(u => { if (!isStale()) setInitiativesLimit(u.limit) })
 .catch(() => { /* non-fatal */ })

 // Load KPIs, evidence, and locations in background
 const [{ kpis }, locations] = await Promise.all([
 apiService.loadKPIsAndEvidence(),
 apiService.getLocations() // Get all locations across all initiatives
 ])
 if (isStale()) return
 setAllKPIs(kpis)
 setAllLocations(locations)
 setIsLoadingStats(false)

 console.log('Dashboard data loaded successfully')

 } catch (error) {
 if (isStale()) return
 const message = error instanceof Error ? error.message : 'Failed to load dashboard data'
 setLoadingState({ isLoading: false, error: message })
 notify.error(message)
 console.error('Dashboard loading error:', error)
 } finally {
 // Only the current (winning) load resets shared state, so a superseded
 // load finishing late can't clear the newer load's spinner or promise.
 if (!isStale()) {
 setIsLoadingData(false)
 loadingPromise.current = null
 }
 }
 }

 // Smart refresh function - only refresh specific data when needed
 const refreshInitiatives = async () => {
 try {
 const initiatives = await apiService.getInitiatives()
 setInitiatives(initiatives)
 } catch (error) {
 console.error('Failed to refresh initiatives:', error)
 }
 }

 const refreshKPIsAndEvidence = async () => {
 try {
 setIsLoadingStats(true)
 const [kpis, locations] = await Promise.all([
 apiService.getKPIs(),
 apiService.getLocations()
 ])
 setAllKPIs(kpis)
 setAllLocations(locations)
 setIsLoadingStats(false)
 } catch (error) {
 console.error('Failed to refresh KPIs and evidence:', error)
 setIsLoadingStats(false)
 }
 }

 const handleCreateInitiative = async (formData: CreateInitiativeForm) => {
 try {
 const newInitiative = await apiService.createInitiative(formData)
 notify.success('Initiative created successfully!')
 // Only refresh initiatives, not all data
 await refreshInitiatives()

 } catch (error: any) {
 // Check if it's an initiative limit error
 if (error?.code === 'INITIATIVE_LIMIT_REACHED' || error?.message?.includes('Initiative limit reached')) {
 setUpgradeUsage(error.usage || { current: initiatives.length, limit: 2 })
 setShowUpgradeModal(true)
 setShowCreateModal(false)
 return // Don't throw, we're handling it with UI
 }
 const message = error instanceof Error ? error.message : 'Failed to create initiative'
 notify.error(message)
 throw error
 }
 }

 const handleEditInitiative = async (formData: CreateInitiativeForm) => {
 if (!selectedInitiative?.id) return
 try {
 await apiService.updateInitiative(selectedInitiative.id, formData)
 notify.success('Initiative updated successfully!')
 // Only refresh initiatives, not all data
 await refreshInitiatives()
 setShowEditModal(false)
 setSelectedInitiative(null)
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to update initiative'
 notify.error(message)
 throw error
 }
 }

 const handleDeleteInitiative = async (initiative: Initiative) => {
 if (!initiative.id) return
 if (deleteConfirmText !== 'DELETE MY INITIATIVE') {
 notify.error('Please type "DELETE MY INITIATIVE" exactly to confirm')
 return
 }
 try {
 await apiService.deleteInitiative(initiative.id)
 notify.success('Initiative deleted successfully!')
 // Refresh all data since deleting initiative affects KPIs and evidence too
 setIsLoadingStats(true)
 await loadAllData()
 setDeleteConfirmInitiative(null)
 setDeleteConfirmText('')
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to delete initiative'
 notify.error(message)
 }
 }

 const openEditModal = (initiative: Initiative) => {
 setSelectedInitiative(initiative)
 setShowEditModal(true)
 }

 // dnd-kit sensors. MouseSensor only (no TouchSensor) → drag is desktop-only.
 // Activation distance prevents accidental drags when clicking the handle.
 const initiativeDragSensors = useSensors(
 useSensor(MouseSensor, { activationConstraint: { distance: 6 } })
 )

 const handleInitiativeDragEnd = async (event: DragEndEvent) => {
 const { active, over } = event
 if (!over || active.id === over.id) return
 const oldIndex = initiatives.findIndex(i => i.id === active.id)
 const newIndex = initiatives.findIndex(i => i.id === over.id)
 if (oldIndex < 0 || newIndex < 0) return

 const previous = initiatives
 const reordered = arrayMove(initiatives, oldIndex, newIndex)
 // Optimistic update — write the new order with fresh display_order indices.
 const withOrder = reordered.map((init, idx) => ({ ...init, display_order: idx }))
 setInitiatives(withOrder)
 try {
 await apiService.updateInitiativeOrder(
 withOrder
 .filter(i => !!i.id)
 .map((i, idx) => ({ id: i.id!, display_order: idx }))
 )
 } catch (err) {
 console.error('Failed to save initiative order:', err)
 setInitiatives(previous)
 notify.error('Failed to save initiative order')
 }
 }

 const openDeleteConfirm = (initiative: Initiative) => {
 setDeleteConfirmInitiative(initiative)
 }


 // IMPORTANT: these hooks MUST run before any early return to preserve hook order.
 // Over-limit initiatives are locked: keep the oldest `limit`, lock the rest.
 // Matches the backend's downgrade rule (enforcePlanLimits keeps the oldest).
 const lockedInitiativeIds = useMemo(() => {
 const set = new Set<string>()
 if (initiativesLimit === null || initiatives.length <= initiativesLimit) return set
 const byAge = [...initiatives].sort((a, b) => {
 const ta = a.created_at ? new Date(a.created_at).getTime() : 0
 const tb = b.created_at ? new Date(b.created_at).getTime() : 0
 return ta - tb
 })
 byAge.slice(initiativesLimit).forEach(i => { if (i.id) set.add(i.id) })
 return set
 }, [initiatives, initiativesLimit])

 // Per-initiative counts for the hero cards (metrics + locations).
 const initiativeStats = useMemo(() => {
 const map: Record<string, { metrics: number; locations: number }> = {}
 for (const i of initiatives) {
 if (i.id) map[i.id] = { metrics: 0, locations: 0 }
 }
 for (const k of allKPIs) {
 if (k.initiative_id && map[k.initiative_id]) map[k.initiative_id].metrics++
 }
 for (const l of allLocations) {
 if (l.initiative_id && map[l.initiative_id]) map[l.initiative_id].locations++
 }
 return map
 }, [initiatives, allKPIs, allLocations])


 if (loadingState.isLoading) {
 return <PageLoader />
 }

 if (loadingState.error) {
 return (
 <div className="text-center py-12 px-4 max-w-lg mx-auto">
 <InlineAlert tone="error" className="mb-4 text-left">{loadingState.error}</InlineAlert>
 <Button
 onClick={() => {
 if (!isLoadingData && !loadingPromise.current) {
 loadingPromise.current = loadAllData()
 }
 }}
 disabled={isLoadingData || !!loadingPromise.current}
 >
 {(isLoadingData || loadingPromise.current) ? 'Loading...' : 'Try Again'}
 </Button>
 </div>
 )
 }

 return (
 <>
 <motion.div
 className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8"
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.35, ease: easeOut }}
 >
 <div className="max-w-6xl mx-auto">
 <PageHeader
 title={isSharedMember ? 'Team initiatives' : 'Initiatives'}
 subtitle={isSharedMember && organizationName
 ? `Team · ${organizationName}`
 : 'Each initiative is a program you track. Open one to add metrics, locations, and evidence.'}
 help={<InitiativesHelp />}
 actions={canCreateInitiatives ? (
 <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 New initiative
 </button>
 ) : undefined}
 />

 {initiatives.length === 0 ? (
 <div className="app-card p-10">
 <EmptyState
 title="No initiatives yet"
 description="Create one to start tracking metrics, locations, and evidence."
 action={canCreateInitiatives ? (
 <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary">
 Create initiative
 </button>
 ) : undefined}
 />
 </div>
 ) : (
 <DndContext
 sensors={initiativeDragSensors}
 collisionDetection={closestCenter}
 onDragEnd={handleInitiativeDragEnd}
 >
 <SortableContext
 items={initiatives.map(i => i.id!).filter(Boolean)}
 strategy={rectSortingStrategy}
 >
 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
 {initiatives.map((initiative) => (
 <SortableInitiativeCard
 key={initiative.id}
 initiative={initiative}
 stats={isLoadingStats ? null : (initiative.id ? initiativeStats[initiative.id] : null) || { metrics: 0, locations: 0 }}
 canEditInitiatives={canEditInitiatives}
 canDeleteInitiatives={canDelete}
 openEditModal={openEditModal}
 openDeleteConfirm={openDeleteConfirm}
 locked={!!initiative.id && lockedInitiativeIds.has(initiative.id)}
 onLockedClick={() => setShowUpgradeModal(true)}
 orgLogoUrl={dashboardOrg?.logo_url}
 />
 ))}
 {canCreateInitiatives && (
 <button
 type="button"
 onClick={() => setShowCreateModal(true)}
 className="min-h-[9.5rem] flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/40 text-sm font-medium transition-colors"
 >
 <Plus className="w-4 h-4" />
 New initiative
 </button>
 )}
 </div>
 </SortableContext>
 </DndContext>
 )}
 </div>
 </motion.div>

 {showCreateModal && (
 <CreateInitiativeModal
 isOpen={showCreateModal}
 onClose={() => setShowCreateModal(false)}
 onSubmit={handleCreateInitiative}
 />
 )}

 {/* Edit Initiative Modal */}
 {selectedInitiative && (
 <CreateInitiativeModal
 isOpen={showEditModal}
 onClose={() => {
 setShowEditModal(false)
 setSelectedInitiative(null)
 }}
 onSubmit={handleEditInitiative}
 editData={selectedInitiative}
 />
 )}


 {/* Delete Confirmation Dialog */}
 {deleteConfirmInitiative && (
 <ModalFrame zIndexClass="z-50" size="sm" panelClassName="bg-white rounded-xl max-w-md w-full p-6 shadow-app-modal border border-gray-200">
 <div className="flex items-start space-x-4 mb-6">
 <div className="app-icon-tile">
 <Trash2 className="w-5 h-5 text-red-500" />
 </div>
 <div className="flex-1">
 <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Initiative</h3>
 <p className="text-sm text-gray-500">This action cannot be undone</p>
 </div>
 </div>

 <p className="text-gray-600 mb-4 text-sm leading-relaxed">
 Are you sure you want to delete "<strong className="font-medium text-gray-800">{deleteConfirmInitiative.title}</strong>"?
 This will also delete all associated KPIs, impact claims, and evidence.
 </p>

 <div className="mb-6">
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY INITIATIVE</span> to confirm:
 </label>
 <input
 type="text"
 value={deleteConfirmText}
 onChange={(e) => setDeleteConfirmText(e.target.value)}
 placeholder="DELETE MY INITIATIVE"
 className="app-input"
 />
 </div>

 <div className="flex space-x-3">
 <button
 onClick={() => { setDeleteConfirmInitiative(null); setDeleteConfirmText('') }}
 className="app-btn app-btn-secondary flex-1"
 >
 Cancel
 </button>
 <button
 onClick={() => handleDeleteInitiative(deleteConfirmInitiative)}
 disabled={deleteConfirmText !== 'DELETE MY INITIATIVE'}
 className="app-btn app-btn-danger flex-1"
 >
 Delete Initiative
 </button>
 </div>
 </ModalFrame>
 )}

 <UpgradeModal
 isOpen={showUpgradeModal}
 onClose={() => setShowUpgradeModal(false)}
 title="You've hit your initiative limit"
 subtitle={`You're using ${upgradeUsage?.current ?? initiatives.length} of ${upgradeUsage?.limit ?? 1} initiatives. Upgrade for more.`}
 />

 </>
 )
} 
