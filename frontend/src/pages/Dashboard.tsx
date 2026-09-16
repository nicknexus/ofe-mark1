import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Edit,
  Trash2,
  GripVertical,
  Settings2,
  Copy,
  MoreHorizontal,
  ChevronRight,
  Clock,
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
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Location, InitiativeActivity } from '../types'
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
import { Button, PageLoader, InlineAlert, EmptyState, PageHeader } from '../components/ui'
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
  size = 'compact',
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
  /** Organization logo; falls back to the Nexus mark when absent. */
  orgLogoUrl?: string | null
  /** 'large' when the org has only a few programs (2-col grid). */
  size?: 'compact' | 'large'
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
  const large = size === 'large'
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

  // One line that says whether this program is alive.
  const activityLine = (() => {
    if (activity === undefined) return null
    if (!activity || (activity.claims === 0 && activity.evidence === 0)) return { text: 'No logs yet', quiet: true }
    const parts = [
      activity.claims > 0 ? `${activity.claims} claim${activity.claims === 1 ? '' : 's'}` : null,
      activity.evidence > 0 ? `${activity.evidence} evidence` : null,
    ].filter(Boolean).join(', ')
    return { text: `Last log ${activity.last_log_at ? formatRelativeTime(activity.last_log_at) : ''}`.trim(), detail: parts, quiet: false }
  })()

  // Four numbers that describe the program at a glance. Structure counts come
  // from the org-wide lists, log counts from /initiatives/activity. Missing
  // structure reads amber so "what's not set up" is visible without a chip.
  const statTiles: Array<{ label: string; value: number | null; warn: boolean }> = [
    { label: 'Metrics', value: stats ? stats.metrics : null, warn: !!stats && stats.metrics === 0 },
    { label: 'Locations', value: stats ? stats.locations : null, warn: !!stats && stats.locations === 0 },
    { label: 'Claims', value: activity === undefined ? null : (activity?.claims ?? 0), warn: false },
    { label: 'Evidence', value: activity === undefined ? null : (activity?.evidence ?? 0), warn: false },
  ]

  const inner = (
    <div className={`${large ? 'p-5 gap-4' : 'p-4 gap-3.5'} h-full flex flex-col`}>
      {/* Identity row. The chevron is the "this opens" affordance: always
          visible, slides right on hover. */}
      <div className={`flex items-start gap-3 ${hasMenu ? 'pr-8' : ''}`}>
        {locked ? (
          <div className={`${large ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl flex items-center justify-center flex-shrink-0 ring-1 bg-amber-50 text-amber-600 ring-amber-100`}>
            <Lock className="w-4 h-4" />
          </div>
        ) : (
          <div className={`${large ? 'w-12 h-12' : 'w-10 h-10'} rounded-xl flex items-center justify-center flex-shrink-0 bg-white ring-1 ring-gray-200/80 shadow-card overflow-hidden`}>
            <img
              src={orgLogoUrl || '/Nexuslogo.png'}
              alt=""
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className={`${large ? 'text-base' : 'text-[15px]'} font-semibold leading-snug line-clamp-1 tracking-tight transition-colors ${locked ? 'text-gray-500' : 'text-gray-900 group-hover:text-primary-800'}`} title={initiative.title}>
              {initiative.title}
            </h3>
            {!locked && (
              <ChevronRight className="w-4 h-4 flex-shrink-0 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" aria-hidden />
            )}
          </div>
          <p className={`text-xs text-gray-500 mt-0.5 leading-relaxed ${large ? 'line-clamp-2' : 'line-clamp-2'}`}>
            {locked ? 'Locked. Upgrade to unlock this program.' : truncateText(initiative.description, large ? 150 : 110)}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      {!locked && (
        <div className="grid grid-cols-4 gap-1.5">
          {statTiles.map(t => (
            <div
              key={t.label}
              className={`rounded-lg px-2 py-1.5 ring-1 ${t.warn ? 'bg-amber-50 ring-amber-100' : 'bg-gray-50/80 ring-gray-100'}`}
            >
              {t.value === null ? (
                <span className="block h-5 w-8 rounded bg-gray-200/70 animate-pulse" />
              ) : (
                <span className={`block ${large ? 'text-lg' : 'text-base'} font-semibold tabular-nums leading-none ${t.warn ? 'text-amber-700' : 'text-gray-900'}`}>
                  {t.value}
                </span>
              )}
              <span className={`block text-[10px] font-medium uppercase tracking-wide mt-1 ${t.warn ? 'text-amber-600' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Footer: last activity (left), Set up (right). */}
      <div className="mt-auto pt-3 border-t border-gray-100 flex items-center justify-between gap-3 min-w-0">
        {locked ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600">
            <Lock className="w-3.5 h-3.5" />
            Locked
          </span>
        ) : (
          <>
            {activityLine ? (
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium min-w-0 truncate ${activityLine.quiet ? 'text-gray-400' : 'text-gray-600'}`} title={activityLine.detail}>
                <Clock className="w-3 h-3 flex-shrink-0" /> {activityLine.text}
              </span>
            ) : (
              <span className="block h-3.5 w-24 rounded bg-gray-100 animate-pulse" />
            )}
            {canEditInitiatives && (
              <button
                type="button"
                onClick={(e) => { stop(e); openSetup(initiative) }}
                title={ready ? 'Metrics, tags, locations, groups' : 'Finish setting up this program'}
                className={`app-btn app-btn-sm flex-shrink-0 ${ready
                  ? 'app-btn-secondary'
                  : 'app-btn-secondary border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'}`}
              >
                <Settings2 className="w-3.5 h-3.5" /> Set up
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )

  return (
    <div ref={setNodeRef} style={style} className="h-full">
      <div
        className={`group relative h-full ${locked
          ? 'app-tile-static transition-all duration-200 hover:border-amber-300/70 hover:shadow-card-hover'
          : 'app-tile'
        } ${menuOpen ? 'z-20' : ''}`}
      >
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
                    <MenuItem icon={Settings2} label="Set up" onClick={() => { setMenuOpen(false); openSetup(initiative) }} />
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

/** Amber "fix this" chip shown only while something required is missing. */
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
 const [{ kpis }, locations, groups] = await Promise.all([
        apiService.loadKPIsAndEvidence(),
        apiService.getLocations(), // Get all locations across all initiatives
        apiService.getBeneficiaryGroups().catch(() => []),
      ])
      if (isStale()) return
      setAllKPIs(kpis)
      setAllLocations(locations)
      setAllGroups(groups || [])
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
      await refreshInitiatives()
      refreshKPIsAndEvidence()
      // Blank programs land straight in Set up so the next step is obvious.
      if (source.kind === 'blank' && newInitiative?.id) {
        setSetupInitiative(newInitiative)
      }

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
 if (deleteConfirmText !== 'DELETE MY INITIATIVE') {
 notify.error('Please type "DELETE MY INITIATIVE" exactly to confirm')
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

  // A handful of programs gets roomier two-column cards; a long list stays compact.
  const largeCards = initiatives.length <= 4


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
 title={isSharedMember ? 'Team programs' : 'Programs'}
 subtitle={isSharedMember && organizationName
 ? `Team · ${organizationName}`
 : 'Set up metrics and locations here, then log claims and evidence.'}
 help={<InitiativesHelp />}
 actions={canCreateInitiatives ? (
 <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary app-btn-sm">
 <Plus className="w-4 h-4" />
 New program
 </button>
 ) : undefined}
 />

 {initiatives.length === 0 ? (
 <div className="app-card p-10">
 <EmptyState
 title="No programs yet"
 description="Create one to start tracking metrics, locations, and evidence."
 action={canCreateInitiatives ? (
 <button type="button" onClick={() => setShowCreateModal(true)} className="app-btn app-btn-primary">
 Create program
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
 <div className={`grid grid-cols-1 md:grid-cols-2 ${largeCards ? 'gap-4' : 'xl:grid-cols-3 gap-3'}`}>
 {initiatives.map((initiative) => (
 <SortableInitiativeCard
 key={initiative.id}
 initiative={initiative}
 size={largeCards ? 'large' : 'compact'}
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
 className="min-h-[9.5rem] flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/40 text-sm font-medium transition-colors"
 >
 <Plus className="w-4 h-4" />
 New program
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
