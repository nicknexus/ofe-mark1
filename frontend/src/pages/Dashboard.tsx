import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Settings2,
  Copy,
  MoreHorizontal,
  ChevronRight,
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
import { motion, AnimatePresence } from 'framer-motion'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Location, MetricTag, InitiativeActivity } from '../types'
import { truncateText, formatRelativeTime } from '../utils'
import { readSWR, writeSWR } from '../utils/swrCache'
import { notify } from '../lib/notify'
import CreateInitiativeModal, { type CreateInitiativeSource } from '../components/CreateInitiativeModal'
import ProgramSetupDrawer from '../components/setup/ProgramSetupDrawer'
import { createProgramFromSource } from '../components/setup/createProgram'
import ModalFrame from '../components/ModalFrame'
import UpgradeModal from '../components/UpgradeModal'
import { SubscriptionService } from '../services/subscription'
import { Lock } from 'lucide-react'
import { useTutorial } from '../context/TutorialContext'
import { useOnboarding } from '../context/OnboardingContext'
import { useTeam } from '../context/TeamContext'
import { Button, PageLoader, InlineAlert, PageHelpTip } from '../components/ui'
import { InitiativesHelp } from '../components/tracking/TrackingHelp'
import { easeOut, dropdownPop } from '../components/timeline/motion'
import { shouldHoldTutorialAutostart } from '../lib/layoutIntro'

// Warm the program page's two payloads on hover so the click lands on an
// in-memory cache hit. apiService dedupes in-flight requests and caches GETs
// for 60s, so repeated hovers are free (and invalidation still works).
function prefetchProgram(id: string | undefined) {
  if (!id) return
  apiService.getInitiativeDashboard(id).catch(() => {})
  apiService.getInitiativeTimeline(id).catch(() => {})
}

function StatCount({
  value,
  label,
  loading,
}: {
  value?: number
  label: string
  loading: boolean
}) {
  return (
    <div className="min-w-[3.25rem] text-center">
      {loading ? (
        <span className="mx-auto block h-4 w-5 rounded bg-gray-100 animate-pulse" />
      ) : (
        <p className="text-[15px] font-semibold tabular-nums text-secondary-900 leading-none tracking-tight">{value ?? 0}</p>
      )}
      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-secondary-400">{label}</p>
    </div>
  )
}

// ============ Sortable initiative card ============
// Owner/team can drag-reorder initiatives on the dashboard. Order is persisted
// to the backend (display_order) and reflected on the public org page. Styled
// like the Metrics-tab cards: hairline border, crisp shadow, hover lift, and a
// chevron as the "this opens" affordance.
function SortableInitiativeCard({
  initiative,
  stats,
  activity,
  canEditInitiatives,
  canDeleteInitiatives,
  openEditModal,
  openDeleteConfirm,
  openSetup,
  openDuplicate,
  locked = false,
  onLockedClick,
  orgLogoUrl,
}: {
  initiative: Initiative
  /** Per-initiative counts; null while background stats are still loading. */
  stats: { metrics: number; locations: number; tags: number; groups: number } | null
  /** Last log + counts; undefined while loading, null if the endpoint failed. */
  activity?: InitiativeActivity | null
  canEditInitiatives: boolean
  canDeleteInitiatives: boolean
  openEditModal: (i: Initiative) => void
  openDeleteConfirm: (i: Initiative) => void
  openSetup: (i: Initiative) => void
  openDuplicate: (i: Initiative) => void
  locked?: boolean
  onLockedClick?: () => void
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

  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  const ready = !!stats && stats.metrics > 0 && stats.locations > 0
  const hasMenu = !locked && (canEditInitiatives || canDeleteInitiatives)
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

  const activityLine = (() => {
    if (activity === undefined) return null
    if (!activity || (activity.claims === 0 && activity.evidence === 0)) return { text: 'No logs yet', quiet: true }
    const parts = [
      activity.claims > 0 ? `${activity.claims} claim${activity.claims === 1 ? '' : 's'}` : null,
      activity.evidence > 0 ? `${activity.evidence} evidence` : null,
    ].filter(Boolean).join(', ')
    return { text: `Last log ${activity.last_log_at ? formatRelativeTime(activity.last_log_at) : ''}`.trim(), detail: parts, quiet: false }
  })()
  const statsLoading = stats === null

  const inner = (
    <div className={`h-full min-h-[17.5rem] px-5 pt-5 pb-4 flex flex-col ${hasMenu ? 'pr-11' : ''}`}>
      <div className="flex items-start gap-3.5 min-w-0">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
          locked
            ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
            : 'bg-white ring-1 ring-gray-200/80 shadow-card'
        }`}>
          {locked ? (
            <Lock className="w-4 h-4" />
          ) : (
            <img
              src={orgLogoUrl || '/Nexuslogo.png'}
              alt=""
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1 min-w-0">
            <h3
              className={`text-[23px] font-semibold leading-snug line-clamp-2 tracking-tight ${
                locked ? 'text-secondary-400' : 'text-secondary-900 group-hover:text-primary-800'
              }`}
              title={initiative.title}
            >
              {initiative.title}
            </h3>
            {!locked && (
              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" aria-hidden />
            )}
          </div>
          <p className="text-[13px] text-secondary-500 mt-1.5 leading-relaxed line-clamp-2">
            {locked ? 'Locked. Upgrade to unlock this program.' : truncateText(initiative.description, 140)}
          </p>
        </div>
      </div>

      <div className="mt-auto pt-5">
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
            <Lock className="w-4 h-4" />
            Locked
          </span>
        ) : (
          <div className="flex items-start gap-5">
            <StatCount value={stats?.metrics} label={stats?.metrics === 1 ? 'metric' : 'metrics'} loading={statsLoading} />
            <StatCount value={stats?.locations} label={stats?.locations === 1 ? 'location' : 'locations'} loading={statsLoading} />
          </div>
        )}
        <div className="mt-3.5 flex items-center justify-between gap-3 min-w-0">
          {!locked && (
            activityLine ? (
              <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium min-w-0 truncate ${activityLine.quiet ? 'text-secondary-400' : 'text-secondary-600'}`} title={activityLine.detail}>
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${activityLine.quiet ? 'bg-gray-300' : 'bg-impact-500'}`} />
                {activityLine.text}
              </span>
            ) : (
              <span className="block h-3.5 w-24 rounded bg-gray-100 animate-pulse" />
            )
          )}
          {!locked && canEditInitiatives && (
            <button
              type="button"
              onClick={(e) => { stop(e); openSetup(initiative) }}
              title={ready || !stats ? 'Metrics, tags, locations, groups' : 'Finish setting up this program'}
              className={`app-btn app-btn-sm flex-shrink-0 ${stats && !ready
                ? 'app-btn-secondary border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'
                : 'app-btn-secondary'}`}
            >
              <Settings2 className="w-3.5 h-3.5" /> Quick setup
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <div
        className={`group relative h-full ${locked
          ? 'app-tile-static shadow-card-lg transition-all duration-200 hover:border-amber-300/70 hover:shadow-card-hover'
          : 'app-tile shadow-card-lg'
        } ${menuOpen ? 'z-20' : ''}`}
      >
        {!locked && (
          <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
        {locked ? (
          <button type="button" onClick={onLockedClick} className="block w-full h-full text-left">
            {inner}
          </button>
        ) : (
          <Link
            to={`/programs/${initiative.id}`}
            state={{ initiative }}
            className="block h-full"
            onMouseEnter={() => prefetchProgram(initiative.id)}
            onFocus={() => prefetchProgram(initiative.id)}
          >
            {inner}
          </Link>
        )}

        {/* Left edge: drag grip, hover-only, desktop only. */}
        {!locked && canEditInitiatives && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            onClick={stop}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-9 items-center justify-center rounded-md bg-white border border-gray-200/80 shadow-card text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing"
            title="Drag to reorder"
            aria-label="Drag to reorder program"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Top-right: one menu. */}
        {hasMenu && (
          <div ref={menuRef} className="absolute top-3 right-3">
            <button
              type="button"
              onClick={(e) => { stop(e); setMenuOpen(v => !v) }}
              className={`p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all ${menuOpen ? 'bg-gray-100 text-gray-700 opacity-100' : 'opacity-0 group-hover:opacity-100 focus:opacity-100'}`}
              title="Program options"
              aria-label="Program options"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  role="menu"
                  initial={dropdownPop.initial}
                  animate={dropdownPop.animate}
                  exit={dropdownPop.exit}
                  className="absolute right-0 top-full mt-1 w-48 app-card-elevated p-1.5 origin-top-right"
                >
                  {canEditInitiatives && (
                    <MenuItem icon={Settings2} label="Quick setup" onClick={() => { setMenuOpen(false); openSetup(initiative) }} />
                  )}
                  {canEditInitiatives && (
                    <MenuItem icon={Edit} label="Edit details" onClick={() => { setMenuOpen(false); openEditModal(initiative) }} />
                  )}
                  {canEditInitiatives && (
                    <MenuItem icon={Copy} label="Duplicate structure" onClick={() => { setMenuOpen(false); openDuplicate(initiative) }} />
                  )}
                  {canDeleteInitiatives && (
                    <>
                      <div className="my-1 border-t border-gray-100" />
                      <MenuItem icon={Trash2} label="Delete program" tone="danger" onClick={() => { setMenuOpen(false); openDeleteConfirm(initiative) }} />
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {locked && <Lock className="absolute top-4 right-4 w-4 h-4 text-amber-500" />}
      </div>
    </div>
  )
}

function MenuItem({ icon: Icon, label, onClick, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-[13px] font-medium transition-colors ${tone === 'danger'
        ? 'text-red-600 hover:bg-red-50'
        : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${tone === 'danger' ? 'text-red-500' : 'text-gray-400'}`} />
      {label}
    </button>
  )
}

export default function Dashboard() {
 const navigate = useNavigate()
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
 const [allTags, setAllTags] = useState<MetricTag[]>([])
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
  const [setupInitiative, setSetupInitiative] = useState<Initiative | null>(null)
  const [createSource, setCreateSource] = useState<CreateInitiativeSource | undefined>(undefined)
  const [allGroups, setAllGroups] = useState<Array<{ initiative_id?: string }>>([])
  const [activity, setActivity] = useState<Record<string, InitiativeActivity> | null>(null)
 // Plan program limit — used to lock over-limit programs after a downgrade.
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
 // org's data while the new fetch is in flight. If we have this org's
 // last list in the SWR cache, paint it now instead of a full-page loader.
 const cached = readSWR<Initiative[]>(`initiatives:${dashboardOrg.id}`)
 setInitiatives(cached || [])
 if (cached && cached.length) setLoadingState({ isLoading: false })
 setAllKPIs([])
 setAllLocations([])
 setAllTags([])
 setIsLoadingStats(true)
 // Drop any in-flight promise from the previous org so loadAllData's
 // dedupe guard doesn't return the old promise to the new effect.
 loadingPromise.current = null
 loadingPromise.current = loadAllData()
 }, [dashboardOrg?.id])

 // Mirror the list into the SWR cache after every change (load, create,
 // delete, reorder) so the next visit paints the same thing instantly.
 useEffect(() => {
 if (!dashboardOrg?.id || loadingState.isLoading) return
 writeSWR(`initiatives:${dashboardOrg.id}`, initiatives)
 }, [initiatives, dashboardOrg?.id, loadingState.isLoading])

 // One-time backfill of evidence ↔ claim links per browser per org.
 // Catches up historical data created before the tag-gate rule (or other
 // matching changes) that wouldn't link until the user manually re-saved
 // either side. Idempotent on the backend; we use localStorage so it
 // really only runs once per browser/org rather than once per tab session.
 // To force a re-run (rare), delete the key in devtools.
 useEffect(() => {
 if (!dashboardOrg?.id) return
 const orgId = dashboardOrg.id
        // v2: tag rule changed (tagged evidence now supports untagged claims),
        // so every browser re-runs the backfill once more.
        const storageKey = `evidence-backfill-done:v2:${orgId}`
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
 // Only block the page when there is nothing cached to paint.
 const swrKey = dashboardOrg?.id ? `initiatives:${dashboardOrg.id}` : null
 if (!(swrKey && readSWR<Initiative[]>(swrKey)?.length)) setLoadingState({ isLoading: true })

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
 const [{ kpis }, locations, groups, tags] = await Promise.all([
        apiService.loadKPIsAndEvidence(),
        apiService.getLocations(),
        apiService.getBeneficiaryGroups().catch(() => []),
        apiService.getMetricTags().catch(() => [] as MetricTag[]),
      ])
      if (isStale()) return
      setAllKPIs(kpis)
      setAllLocations(locations)
      setAllGroups(groups || [])
      setAllTags(tags || [])
      setIsLoadingStats(false)
      apiService.getInitiativeActivity().then(setActivity).catch(() => setActivity({}))

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
 console.error('Failed to refresh programs:', error)
 }
 }

 const refreshKPIsAndEvidence = async () => {
 try {
 setIsLoadingStats(true)
 const [kpis, locations, groups] = await Promise.all([
        apiService.getKPIs(),
        apiService.getLocations(),
        apiService.getBeneficiaryGroups().catch(() => []),
      ])
      setAllKPIs(kpis)
      setAllLocations(locations)
      setAllGroups(groups || [])
      setIsLoadingStats(false)
 } catch (error) {
 console.error('Failed to refresh KPIs and evidence:', error)
 setIsLoadingStats(false)
 }
 }

 const handleCreateInitiative = async (formData: CreateInitiativeForm, source: CreateInitiativeSource) => {
    try {
      const { initiative: newInitiative, summary } = await createProgramFromSource(formData, source)
      notify.success(summary)
      apiService.clearCache()
      if (newInitiative?.id) {
        navigate(`/programs/${newInitiative.id}`, { state: { initiative: newInitiative } })
        return
      }
      await refreshInitiatives()
      refreshKPIsAndEvidence()

 } catch (error: any) {
 // Check if it's an initiative limit error
 if (error?.code === 'INITIATIVE_LIMIT_REACHED' || error?.message?.includes('Program limit reached')) {
 setUpgradeUsage(error.usage || { current: initiatives.length, limit: 2 })
 setShowUpgradeModal(true)
 setShowCreateModal(false)
 return // Don't throw, we're handling it with UI
 }
 const message = error instanceof Error ? error.message : 'Failed to create program'
 notify.error(message)
 throw error
 }
 }

 const handleEditInitiative = async (formData: CreateInitiativeForm) => {
 if (!selectedInitiative?.id) return
 try {
 await apiService.updateInitiative(selectedInitiative.id, formData)
 notify.success('Program updated successfully!')
 // Only refresh initiatives, not all data
 await refreshInitiatives()
 setShowEditModal(false)
 setSelectedInitiative(null)
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to update program'
 notify.error(message)
 throw error
 }
 }

 const handleDeleteInitiative = async (initiative: Initiative) => {
 if (!initiative.id) return
 if (deleteConfirmText !== 'DELETE MY PROGRAM') {
 notify.error('Please type "DELETE MY PROGRAM" exactly to confirm')
 return
 }
 try {
 await apiService.deleteInitiative(initiative.id)
 notify.success('Program deleted successfully!')
 // Refresh all data since deleting initiative affects KPIs and evidence too
 setIsLoadingStats(true)
 await loadAllData()
 setDeleteConfirmInitiative(null)
 setDeleteConfirmText('')
 } catch (error) {
 const message = error instanceof Error ? error.message : 'Failed to delete program'
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
 console.error('Failed to save program order:', err)
 setInitiatives(previous)
 notify.error('Failed to save program order')
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
    const map: Record<string, { metrics: number; locations: number; tags: number; groups: number }> = {}
    for (const i of initiatives) {
      if (i.id) map[i.id] = { metrics: 0, locations: 0, tags: 0, groups: 0 }
    }
    for (const k of allKPIs) {
      if (k.initiative_id && map[k.initiative_id] && !k.archived_at) {
        map[k.initiative_id].metrics++
        map[k.initiative_id].tags += (k.tag_ids || []).length
      }
    }
    for (const l of allLocations) {
      const seen = new Set<string>()
      if (l.initiative_id) seen.add(l.initiative_id)
      for (const iid of l.initiative_ids || []) seen.add(iid)
      for (const iid of seen) if (map[iid]) map[iid].locations++
    }
    for (const g of allGroups) {
      if (g.initiative_id && map[g.initiative_id]) map[g.initiative_id].groups++
    }
    return map
  }, [initiatives, allKPIs, allLocations, allGroups])

  const latestLogAt = useMemo(() => {
    if (!activity) return null
    return Object.values(activity).reduce<string | null>((best, a) => {
      if (!a.last_log_at) return best
      if (!best || a.last_log_at > best) return a.last_log_at
      return best
    }, null)
  }, [activity])


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
 className="min-h-screen pt-10 pb-12 px-4 sm:px-6 lg:px-8"
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ duration: 0.35, ease: easeOut }}
 >
 <div className="max-w-6xl mx-auto">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 mb-8 pb-6 border-b border-gray-200/70">
   <div className="min-w-0">
     <div className="flex items-center gap-2.5 mb-2.5">
       {dashboardOrg?.logo_url && (
         <span className="w-7 h-7 rounded-lg overflow-hidden bg-white ring-1 ring-gray-200/80 shadow-card flex-shrink-0">
           <img src={dashboardOrg.logo_url} alt="" className="w-full h-full object-contain" />
         </span>
       )}
       <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">
         {isSharedMember && organizationName ? `Team · ${organizationName}` : 'Tracking'}
       </p>
     </div>
     <div className="flex items-center gap-2 min-w-0">
       <h1 className="app-page-title text-[1.75rem] sm:text-[1.85rem]">
         {isSharedMember ? 'Team programs' : 'Programs'}
       </h1>
       <PageHelpTip label="Programs"><InitiativesHelp /></PageHelpTip>
     </div>
     <p className="mt-2.5 text-sm text-secondary-500">
       {latestLogAt
         ? `Last activity ${formatRelativeTime(latestLogAt)}.`
         : 'Open a program to log claims, evidence, and stories.'}
     </p>
   </div>
   <div className="flex items-center gap-3 flex-shrink-0">
     {initiatives.length > 0 && (
       <div className="hidden sm:flex items-baseline gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200/80 shadow-card">
         <span className="text-xl font-semibold leading-none text-secondary-900 tabular-nums">{initiatives.length}</span>
         <span className="text-[11px] font-medium text-secondary-400">
           {initiatives.length === 1 ? 'program' : 'programs'}
         </span>
       </div>
     )}
     {canCreateInitiatives && (
       <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary">
         <Plus className="w-4 h-4" />
         New program
       </button>
     )}
   </div>
 </div>

 {initiatives.length === 0 ? (
 <div className="relative overflow-hidden app-card px-8 py-16 sm:py-20 text-center">
   <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-200 via-primary-500 to-primary-200" />
   <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">Start here</p>
   <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight text-secondary-900">
     Your first program
   </h2>
   <p className="mt-3 text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
     A program is the work you prove. Attach metrics and locations, then log what happened.
   </p>
   {canCreateInitiatives && (
     <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary mt-7">
       <Plus className="w-4 h-4" />
       Create program
     </button>
   )}
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
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 {initiatives.map((initiative) => (
 <SortableInitiativeCard
 key={initiative.id}
 initiative={initiative}
 activity={activity === null ? undefined : (initiative.id ? activity[initiative.id] ?? null : null)}
                      stats={isLoadingStats ? null : (initiative.id ? initiativeStats[initiative.id] : null) || { metrics: 0, locations: 0, tags: 0, groups: 0 }}
                      canEditInitiatives={canEditInitiatives}
                      canDeleteInitiatives={canDelete}
                      openEditModal={openEditModal}
                      openDeleteConfirm={openDeleteConfirm}
                      openSetup={(i) => setSetupInitiative(i)}
                      openDuplicate={(i) => { setCreateSource({ kind: 'duplicate', sourceInitiativeId: i.id! }); setShowCreateModal(true) }}
 locked={!!initiative.id && lockedInitiativeIds.has(initiative.id)}
 onLockedClick={() => setShowUpgradeModal(true)}
 orgLogoUrl={dashboardOrg?.logo_url}
 />
 ))}
 {canCreateInitiatives && (
 <button
 type="button"
 onClick={() => setShowCreateModal(true)}
 className="group h-full min-h-[17.5rem] flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed border-gray-300 bg-white text-secondary-500 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
 >
 <Plus className="w-4 h-4" />
 <span className="text-sm font-semibold">New program</span>
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
          onClose={() => { setShowCreateModal(false); setCreateSource(undefined) }}
          onSubmit={handleCreateInitiative}
          duplicateCandidates={initiatives.filter(i => !!i.id && !lockedInitiativeIds.has(i.id))}
          initialSource={createSource}
        />
      )}

      {setupInitiative?.id && (
        <ProgramSetupDrawer
          initiativeId={setupInitiative.id}
          initiativeTitle={setupInitiative.title}
          isOpen
          onClose={() => setSetupInitiative(null)}
          onChanged={() => refreshKPIsAndEvidence()}
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
 <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete Program</h3>
 <p className="text-sm text-gray-500">This action cannot be undone</p>
 </div>
 </div>

 <p className="text-gray-600 mb-4 text-sm leading-relaxed">
 Are you sure you want to delete "<strong className="font-medium text-gray-800">{deleteConfirmInitiative.title}</strong>"?
 This will also delete all associated KPIs, impact claims, and evidence.
 </p>

 <div className="mb-6">
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY PROGRAM</span> to confirm:
 </label>
 <input
 type="text"
 value={deleteConfirmText}
 onChange={(e) => setDeleteConfirmText(e.target.value)}
 placeholder="DELETE MY PROGRAM"
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
 disabled={deleteConfirmText !== 'DELETE MY PROGRAM'}
 className="app-btn app-btn-danger flex-1"
 >
 Delete Program
 </button>
 </div>
 </ModalFrame>
 )}

 <UpgradeModal
 isOpen={showUpgradeModal}
 onClose={() => setShowUpgradeModal(false)}
 title="You've hit your program limit"
 subtitle={`You're using ${upgradeUsage?.current ?? initiatives.length} of ${upgradeUsage?.limit ?? 1} programs. Upgrade for more.`}
 />

 </>
 )
} 
