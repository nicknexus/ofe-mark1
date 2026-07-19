import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
 Plus,
 MapPin,
 Edit,
 Trash2,
 Users,
 Check,
 AlertCircle,
 ArrowRight,
 Globe,
 Compass,
 Sparkles,
 BarChart3,
 Palette,
 Image as ImageIcon,
  FileText,
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
 verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { apiService } from '../services/api'
import { Initiative, LoadingState, CreateInitiativeForm, KPI, Location, OrganizationContext } from '../types'
import { formatDate, truncateText } from '../utils'
import { notify } from '../lib/notify'
import CreateInitiativeModal from '../components/CreateInitiativeModal'
import LocationMap from '../components/LocationMap'
import AllLocationsModal from '../components/AllLocationsModal'
import ModalFrame from '../components/ModalFrame'
import UpgradeModal from '../components/UpgradeModal'
import { SubscriptionService } from '../services/subscription'
import TagsWidget from '../components/MetricTags/TagsWidget'
import { ExternalLink, Lock } from 'lucide-react'
import { useTutorial } from '../context/TutorialContext'
import { useOnboarding } from '../context/OnboardingContext'
import { useTeam } from '../context/TeamContext'
import { Button, PageLoader, InlineAlert, EmptyState } from '../components/ui'

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

// ============ Small widgets ============
function scoreColor(pct: number): string {
 if (pct >= 80) return '#22c55e'
 if (pct >= 50) return '#f59e0b'
 return '#ef4444'
}

function CompletionRing({ pct, size = 56 }: { pct: number; size?: number }) {
 const stroke = 6
 const r = (size - stroke) / 2
 const c = 2 * Math.PI * r
 const dash = (pct / 100) * c
 const color = scoreColor(pct)
 return (
 <svg width={size} height={size} className="flex-shrink-0">
 <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f5f9" strokeWidth={stroke} fill="none" />
 <circle
 cx={size / 2}
 cy={size / 2}
 r={r}
 stroke={color}
 strokeWidth={stroke}
 fill="none"
 strokeDasharray={`${dash} ${c}`}
 strokeLinecap="round"
 transform={`rotate(-90 ${size / 2} ${size / 2})`}
 style={{ transition: 'stroke-dasharray 500ms ease' }}
 />
 <text
 x="50%"
 y="50%"
 textAnchor="middle"
 dominantBaseline="central"
 fontSize={size * 0.28}
 fontWeight={700}
 fill="#374151"
 >{pct}%</text>
 </svg>
 )
}

function PublicScoreCard({
 score,
 checks,
}: {
 score: { done: number; total: number; pct: number }
 checks: { id: string; label: string; done: boolean; to: string }[]
}) {
 const [open, setOpen] = useState(false)
 return (
 <div className="app-card p-4 flex flex-col min-h-0">
 <div className="flex items-center gap-3">
 <CompletionRing pct={score.pct} size={48} />
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-1.5">
 <Globe className="w-3.5 h-3.5 text-gray-500" />
 <h3 className="text-sm font-semibold text-gray-800">Public Page</h3>
 </div>
 <p className="text-xs text-gray-500 mt-0.5">{score.done} of {score.total} complete</p>
 </div>
 <button
 onClick={() => setOpen(v => !v)}
 className="text-xs font-medium text-gray-500 hover:text-gray-800"
 >
 {open ? 'Hide' : 'View'}
 </button>
 </div>
 {open && (
 <div className="mt-3 space-y-1 overflow-y-auto min-h-0 flex-1">
 {checks.map(c => (
 <Link
 key={c.id}
 to={c.to}
 className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${c.done ? 'text-gray-400 line-through' : 'text-gray-700 hover:bg-gray-50'
 }`}
 >
 {c.done
 ? <Check className="w-3.5 h-3.5 text-impact-600 flex-shrink-0" />
 : <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
 <span className="truncate flex-1">{c.label}</span>
 {!c.done && <ArrowRight className="w-3 h-3 text-gray-400" />}
 </Link>
 ))}
 </div>
 )}
 </div>
 )
}

function ContextScoreCard({
 score,
 checks,
}: {
 score: { done: number; total: number; pct: number }
 checks: { id: string; label: string; done: boolean }[]
}) {
 const color = scoreColor(score.pct)
 return (
 <Link
 to="/context"
 className="group bg-white rounded-2xl border border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5 p-4 flex flex-col gap-2.5 transition-all duration-200 min-h-0"
 >
 <div className="flex items-center gap-2.5">
 <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
 <Compass className="w-4 h-4 text-primary-600" />
 </div>
 <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight flex-1">Context Page</h3>
 <span className="text-xs font-semibold text-gray-500">{score.done}/{score.total}</span>
 <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
 </div>
 <div className="w-full h-1.5 bg-gray-100/80 rounded-full overflow-hidden">
 <div
 className="h-full rounded-full transition-all duration-500 "
 style={{ width: `${score.pct}%`, backgroundColor: color }}
 />
 </div>
 <div className="flex flex-wrap gap-1">
 {checks.map(c => (
 <span
 key={c.id}
 className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${c.done
 ? 'bg-impact-50 text-impact-700 ring-1 ring-impact-100'
 : 'bg-gray-50 text-gray-500 ring-1 ring-gray-100'
 }`}
 title={c.label}
 >
 {c.done ? <Check className="w-2.5 h-2.5" /> : <span className="w-1 h-1 rounded-full bg-current" />}
 {c.label}
 </span>
 ))}
 </div>
 </Link>
 )
}

function NextStepsCard({
 steps,
 loading,
}: {
 steps: { id: string; label: string; icon: React.ReactNode; to?: string; onClick?: () => void }[]
 loading?: boolean
}) {
 const rowClass = "group w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-gradient-to-br from-white to-gray-50/40 hover:from-primary-50/40 hover:to-primary-50/10 border border-gray-100 hover:border-primary-200/70 transition-all"
 return (
 <div className="bg-white rounded-2xl border border-gray-200/70 shadow-card p-4 flex flex-col min-h-0 flex-1">
 <div className="flex items-center gap-2.5 mb-3 flex-shrink-0">
 <div className="w-8 h-8 rounded-xl bg-primary-50 ring-1 ring-primary-100/50 flex items-center justify-center">
 <Sparkles className="w-4 h-4 text-primary-600" />
 </div>
 <h3 className="text-[13px] font-semibold text-gray-900 tracking-tight">Next Steps</h3>
 </div>
 <div className="flex-1 min-h-[6rem] overflow-y-auto space-y-1.5">
 {loading ? (
 <>
 <div className="h-[38px] rounded-xl bg-gray-100/70 animate-pulse" />
 <div className="h-[38px] rounded-xl bg-gray-100/70 animate-pulse" />
 <div className="h-[38px] rounded-xl bg-gray-100/60 animate-pulse" />
 </>
 ) : steps.length === 0 ? (
 <div className="h-full flex flex-col items-center justify-center text-center py-2">
 <div className="w-10 h-10 rounded-full bg-gradient-to-br from-impact-50 to-impact-100 ring-1 ring-impact-200/50 flex items-center justify-center mb-2">
 <Check className="w-5 h-5 text-impact-600" />
 </div>
 <p className="text-xs font-medium text-gray-700">All caught up!</p>
 <p className="text-xs text-gray-500 mt-0.5">Your dashboard is in great shape.</p>
 </div>
 ) : (
 steps.map(s => {
 const inner = (
 <>
 <div className="w-7 h-7 rounded-lg bg-white ring-1 ring-gray-200/70 shadow-sm flex items-center justify-center text-gray-500 group-hover:text-primary-600 group-hover:ring-primary-200/70 flex-shrink-0 transition-colors">
 {s.icon}
 </div>
 <span className="text-xs font-medium text-gray-700 group-hover:text-primary-700 flex-1 truncate">
 {s.label}
 </span>
 <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
 </>
 )
 return s.onClick ? (
 <button key={s.id} type="button" onClick={s.onClick} className={rowClass}>{inner}</button>
 ) : (
 <Link key={s.id} to={s.to || '#'} className={rowClass}>{inner}</Link>
 )
 })
 )}
 </div>
 </div>
 )
}

export default function Dashboard() {
 const navigate = useNavigate()
 const { startTutorial, needsTutorial, isActive: tutorialActive } = useTutorial()
 const { hasCompletedOnboarding, isActive: onboardingActive } = useOnboarding()
 const {
 isOwner,
 isSharedMember,
 organizationName,
 ownedOrganization,
 activeOrganization,
 canCreateInitiatives,
 canEditInitiatives,
 canDelete,
 canEditLocations,
 } = useTeam()
 // Team members see the full dashboard, including the right rail (Context Score /
 // Next Steps / Tags). Those read from activeOrganization so a team member sees the
 // org they're scoped into, not a missing ownedOrganization.
 const dashboardOrg = activeOrganization || ownedOrganization
 // Granular gating: create / edit / delete are independent grants.
 // Account-level widgets (logo, branding, public toggle) remain owner-only.
 const canManageInitiatives = canEditInitiatives || canDelete || canCreateInitiatives
 const [initiatives, setInitiatives] = useState<Initiative[]>([])
 const [allKPIs, setAllKPIs] = useState<KPI[]>([])
 const [allLocations, setAllLocations] = useState<Location[]>([])
 const [totalEvidence, setTotalEvidence] = useState<number>(0)
 const [orgContext, setOrgContext] = useState<OrganizationContext | null>(null)
 const [contextLoaded, setContextLoaded] = useState(false)
 // Organization info now comes from TeamContext
 const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
 const [isLoadingStats, setIsLoadingStats] = useState(true)
 const [showCreateModal, setShowCreateModal] = useState(false)
 const [showAllLocationsModal, setShowAllLocationsModal] = useState(false)
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
 if (!dashboardOrg?.id) return
 let cancelled = false
 setContextLoaded(false)
 apiService.getOrgContext(dashboardOrg.id)
 .then(ctx => { if (!cancelled) { setOrgContext(ctx); setContextLoaded(true) } })
 .catch(() => { if (!cancelled) { setOrgContext(null); setContextLoaded(true) } })
 return () => { cancelled = true }
 }, [dashboardOrg?.id])

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
 setTotalEvidence(0)
 setOrgContext(null)
 setContextLoaded(false)
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
 const [{ kpis, evidence }, locations] = await Promise.all([
 apiService.loadKPIsAndEvidence(),
 apiService.getLocations() // Get all locations across all initiatives
 ])
 if (isStale()) return
 setAllKPIs(kpis)
 setTotalEvidence(evidence.length)
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
 const [kpis, evidence, locations] = await Promise.all([
 apiService.getKPIs(),
 apiService.getEvidence(),
 apiService.getLocations()
 ])
 setAllKPIs(kpis)
 setTotalEvidence(evidence.length)
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


 // ============ Completeness + Next Steps (owner only) ============
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

 const publicChecks = useMemo(() => {
 const o = ownedOrganization
 const firstInit = initiatives[0]?.id
 return [
 { id: 'logo', label: 'Upload organization logo', done: !!o?.logo_url, to: '/account?tab=organization' },
 { id: 'brand', label: 'Set brand color', done: !!o?.brand_color && o.brand_color !== '#c0dfa1', to: '/account?tab=branding' },
 { id: 'statement', label: 'Write mission statement', done: !!(o?.statement && o.statement.trim().length > 0), to: '/account?tab=organization' },
 { id: 'public', label: 'Make organization public', done: !!o?.is_public, to: '/account?tab=organization' },
 { id: 'initiative', label: 'Create an initiative', done: initiatives.length > 0, to: '/' },
    { id: 'metric', label: 'Add at least one metric', done: allKPIs.length > 0, to: firstInit ? `/initiatives/${firstInit}?tab=metrics` : '/' },
 { id: 'location', label: 'Add at least one location', done: allLocations.length > 0, to: firstInit ? `/initiatives/${firstInit}?tab=location` : '/' },
 { id: 'evidence', label: 'Add at least one evidence', done: totalEvidence > 0, to: firstInit ? `/initiatives/${firstInit}?tab=logs&view=evidence` : '/' },
 ]
 }, [ownedOrganization, initiatives, allKPIs, allLocations, totalEvidence])

 const publicScore = useMemo(() => {
 const done = publicChecks.filter(c => c.done).length
 return { done, total: publicChecks.length, pct: Math.round((done / publicChecks.length) * 100) }
 }, [publicChecks])

 const contextChecks = useMemo(() => {
 const c = orgContext
 const hasText = (v?: string | null) => !!(v && v.trim().length > 0)
 const hasList = (v?: any[] | null) => Array.isArray(v) && v.length > 0
 return [
 { id: 'problem', label: 'Problem Statement', done: hasText(c?.problem_statement) },
 { id: 'stats', label: 'Stats & Statements', done: hasList(c?.stats_and_statements) },
 { id: 'theory', label: 'Theory of Change', done: hasText(c?.theory_of_change) || hasList(c?.theory_of_change_stages) },
 { id: 'strategies', label: 'Strategies', done: hasList(c?.strategies) },
 { id: 'more', label: 'More Context', done: hasText(c?.additional_info) },
 ]
 }, [orgContext])

 const contextScore = useMemo(() => {
 const done = contextChecks.filter(c => c.done).length
 return { done, total: contextChecks.length, pct: Math.round((done / contextChecks.length) * 100) }
 }, [contextChecks])

 const nextSteps = useMemo(() => {
 type Step = { id: string; label: string; icon: React.ReactNode; to?: string; onClick?: () => void }
 const steps: Step[] = []
 const o = dashboardOrg
 const firstInit = initiatives[0]?.id
 if (!o?.logo_url) steps.push({ id: 'logo', label: 'Upload your logo', to: '/account?tab=branding', icon: <ImageIcon className="w-4 h-4" /> })
 if (!o?.brand_color) steps.push({ id: 'brand', label: 'Pick a brand color', to: '/account?tab=branding', icon: <Palette className="w-4 h-4" /> })
 if (!o?.statement) steps.push({ id: 'statement', label: 'Add a mission statement', to: '/account?tab=organization', icon: <FileText className="w-4 h-4" /> })
 if (!o?.is_public) steps.push({ id: 'public', label: 'Publish your organization', to: '/account?tab=account', icon: <Globe className="w-4 h-4" /> })
 if (initiatives.length === 0) steps.push({ id: 'initiative', label: 'Create your first initiative', onClick: () => setShowCreateModal(true), icon: <Plus className="w-4 h-4" /> })
 initiatives.forEach((init) => {
 const initKpis = allKPIs.filter(k => k.initiative_id === init.id)
    if (initKpis.length === 0) steps.push({ id: `metrics-${init.id}`, label: `Add metrics to "${init.title}"`, to: `/initiatives/${init.id}?tab=metrics`, icon: <BarChart3 className="w-4 h-4" /> })
 })
 if (allLocations.length === 0 && firstInit) {
 steps.push({ id: 'locations', label: 'Add locations to an initiative', to: `/initiatives/${firstInit}?tab=location`, icon: <MapPin className="w-4 h-4" /> })
 }
 if (totalEvidence === 0 && firstInit) {
 steps.push({ id: 'evidence', label: 'Add evidence to an initiative', to: `/initiatives/${firstInit}?tab=logs&view=evidence`, icon: <FileText className="w-4 h-4" /> })
 }
 if (contextScore.done < contextScore.total) {
 steps.push({ id: 'context', label: `Finish context page (${contextScore.done}/${contextScore.total})`, to: '/context', icon: <Compass className="w-4 h-4" /> })
 }
 return steps.slice(0, 4)
 }, [dashboardOrg, initiatives, allKPIs, allLocations, totalEvidence, contextScore])

 // Right rail is shown whenever there's an active org context — owner or team member.
 const showOwnerWidgets = !!dashboardOrg

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

 const handleLocationClick = (location: Location) => {
 if (location.initiative_id) {
    navigate(`/initiatives/${location.initiative_id}?tab=location`)
 }
 }

 return (
 <>
 <div className="min-h-screen lg:h-screen lg:overflow-hidden pt-24 pb-6 px-4 sm:px-6 lg:px-8 xl:px-10 flex flex-col">
 <div className="max-w-[1600px] mx-auto w-full flex-1 min-h-0 flex flex-col gap-4">
          {/* Command-center header — title, at-a-glance stats, primary action */}
          <div className="flex-shrink-0 min-w-0 flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 leading-tight tracking-tight">
                  {isSharedMember ? 'Team Initiatives' : 'Your Initiatives'}
                </h1>
                {isSharedMember && organizationName && (
                  <span
                    className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-purple-50 border border-purple-100 text-xs font-medium text-purple-700"
                    title={`You're viewing ${organizationName}'s initiatives as a team member`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Team · {organizationName}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {organizationName ? `Everything ${organizationName} is tracking, in one place` : 'Everything you’re tracking, in one place'}
              </p>
            </div>

            {/* Public page status — click to toggle in org settings */}
            {!isSharedMember && (() => {
              const live = !!dashboardOrg?.is_public
              return (
                <Link
                  to="/account?tab=organization"
                  className={`group inline-flex items-center gap-2 h-8 pl-2.5 pr-3 rounded-full border text-xs font-medium transition-colors ${live
                    ? 'bg-impact-50 border-impact-100 text-impact-700 hover:bg-impact-100/70'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  title={live ? 'Your public page is live — click to manage' : 'Your public page is off — click to publish'}
                >
                  <span className="relative flex h-2 w-2">
                    {live && <span className="absolute inline-flex h-full w-full rounded-full bg-impact-400 opacity-60 animate-ping" />}
                    <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-impact-500' : 'bg-gray-300'}`} />
                  </span>
                  <Globe className="w-3.5 h-3.5" />
                  {live ? 'Public page live' : 'Public page not live'}
                  <ArrowRight className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </Link>
              )
            })()}

            {canCreateInitiatives && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="ml-auto app-btn app-btn-primary shadow-sm"
                title="New initiative"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">New initiative</span>
                <span className="sm:hidden">Add</span>
              </button>
            )}
          </div>

 {/* Two-pane workspace: initiatives on the left (scrollable list, so
 every initiative stays reachable and reorderable), everything else
 stacked on the right — locked to the viewport on desktop. */}
 <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
 {/* Initiatives — the heart of the page (narrower column) */}
 <section className="lg:col-span-5 xl:col-span-4 flex flex-col min-h-0">
              <div className="flex items-center gap-2 mb-2.5 flex-shrink-0">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All initiatives</h2>
                <span className="app-chip text-[11px] px-1.5 py-0 tabular-nums">{initiatives.length}</span>
              </div>
 <div className="flex-1 min-h-0 lg:overflow-y-auto lg:pr-1.5 lg:pt-1.5">
 {initiatives.length === 0 ? (
 <div className="app-card p-10 text-center">
 <div className="app-icon-tile mx-auto mb-4">
 <img src="/Nexuslogo.png" alt="Nexus Logo" className="w-6 h-6 object-contain" />
 </div>
 <h3 className="text-lg font-semibold text-gray-800 mb-2">
 {isSharedMember ? 'No Initiatives Yet' : 'Welcome to Nexus Impacts AI'}
 </h3>
 <p className="text-gray-500 mb-6 max-w-md mx-auto text-sm">
 {isSharedMember
 ? `Your organization doesn't have any initiatives yet. Create the first one to start tracking impact.`
 : 'Create your first initiative to start tracking impact.'}
 </p>
 {canCreateInitiatives && (
 <button
 onClick={() => setShowCreateModal(true)}
 className="app-btn app-btn-primary"
 >
 Create Your First Initiative
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
 strategy={verticalListSortingStrategy}
 >
 <div className="space-y-3">
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
                    </div>
                  </SortableContext>
                  {canCreateInitiatives && (
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(true)}
                      className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300 hover:bg-primary-50/40 py-3.5 text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      New initiative
                    </button>
                  )}
                </DndContext>
              )}
            </div>
          </section>

 {/* Everything else — progress widgets in a row, map filling the rest */}
 <section className="lg:col-span-7 xl:col-span-8 flex flex-col min-h-0">
 <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex-shrink-0">Progress & places</h2>
 <div className="flex-1 min-h-0 flex flex-col gap-4">
 {showOwnerWidgets ? (
 <div className="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 <ContextScoreCard score={contextScore} checks={contextChecks} />
 <NextStepsCard steps={nextSteps} loading={isLoadingStats || !contextLoaded} />
 <div className="min-h-0 h-full">
 <TagsWidget />
 </div>
 </div>
 ) : (
 <div className="flex-shrink-0 max-w-md max-h-56 lg:overflow-y-auto">
 <TagsWidget compact />
 </div>
 )}

 {/* Locations map — chrome-less rounded frame with overlay actions,
 same treatment as the Metrics Overview map. `isolate` keeps the
 map's z-indexes (Leaflet panes + pills) inside this frame so they
 never bleed through modals or full-screen overlays. */}
 <div className="hidden md:block relative isolate h-64 lg:h-auto lg:flex-1 lg:min-h-[180px] rounded-3xl overflow-hidden border border-gray-200/60 shadow-card">
 <LocationMap
 locations={allLocations}
 onLocationClick={handleLocationClick}
 hideEmptyBanner
 autoFit
 />
 <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
 <button
 onClick={() => setShowAllLocationsModal(true)}
 className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white transition-colors"
 title="View all org locations"
 >
 <ExternalLink className="w-3.5 h-3.5 text-primary-600" />
 View all · {allLocations.length}
 </button>
 {canEditLocations && (
 <button
 onClick={() => setShowAllLocationsModal(true)}
 className="inline-flex items-center gap-1 h-8 px-3 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white transition-colors"
 title="Add location"
 >
 <Plus className="w-3.5 h-3.5 text-primary-600" />
 Add
 </button>
 )}
 </div>
 </div>
 </div>
 </section>
 </div>
 </div>
 </div>

 {/* Modals */}
 <AllLocationsModal
 isOpen={showAllLocationsModal}
 onClose={async () => {
 setShowAllLocationsModal(false)
 try {
 const fresh = await apiService.getOrgLocations()
 setAllLocations(fresh)
 } catch { /* noop */ }
 }}
 />

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

 {/* Upgrade Modal - Initiative Limit Reached */}
 <UpgradeModal
 isOpen={showUpgradeModal}
 onClose={() => setShowUpgradeModal(false)}
 title="You've hit your initiative limit"
 subtitle={`You're using ${upgradeUsage?.current ?? initiatives.length} of ${upgradeUsage?.limit ?? 1} initiatives. Upgrade for more.`}
 />

 </>
 )
} 
