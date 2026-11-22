import React, { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Activity,
  MapPin,
  BookOpen,
  User,
  ChevronLeft,
  Layers,
  Compass,
  Building2,
  Users,
  ChevronDown,
  Check,
  Plus,
  X,
  BarChart3,
  Home,
  FileText,
  FileBarChart,
  MoreHorizontal,
  HelpCircle,
  ChevronRight,
  Mail,
} from 'lucide-react'
import { apiService } from '../services/api'
import { CreateKPIForm, Initiative, User as UserType, SubscriptionStatus } from '../types'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import MobileDashboard from './mobile/MobileDashboard'
import MobileOrgMetricsTab from './mobile/MobileOrgMetricsTab'
import { Button, PageLoader } from './ui'
import MobileLocationsTab from './mobile/MobileLocationsTab'
import MobileStoriesTab, { MobileStoryForm } from './mobile/MobileStoriesTab'
import MobileHome from './mobile/MobileHome'
import MobileAccountTab from './mobile/MobileAccountTab'
import TimelineTab from './InitiativeTabs/TimelineTab'
import MobileOverview from './overview/MobileOverview'
import UploadWizardLauncher from './upload/UploadWizardLauncher'
import CreateKPIModal from './CreateKPIModal'
import ExplorePage from '../pages/ExplorePage'
import ShareTeamPage from '../pages/ShareTeamPage'
import ModalFrame, { ModalHeader, ModalBody } from './ModalFrame'
import { isStudioMode, isStudioComposer, isDarkStudioPath } from '../pages/studio/studioPaths'
import {
  springSoft,
  springSnappy,
  tapScale,
  sheetBackdrop,
  sheetPanel,
  dropdownPop,
} from './mobile/motion'

const ContentCreatePage = lazy(() => import('../pages/ContentCreatePage'))
const MobileReportsTab = lazy(() => import('./mobile/MobileReportsTab'))

interface MobileAppProps {
  user: UserType
  subscriptionStatus: SubscriptionStatus | null
}

type TopLevelView = 'home' | 'initiatives' | 'content' | 'more' | 'teams' | 'reports' | 'metrics' | 'explore' | 'account'
type InitiativeTab = 'logs' | 'overview' | 'stories' | 'locations'
type CaptureAction = 'log' | 'story'

const mobilePaths: Record<TopLevelView, string> = {
  home: '/', initiatives: '/tracking/programs', content: '/studio',
  more: '/more', teams: '/share/team', reports: '/reports', metrics: '/metrics', explore: '/explore', account: '/account',
}

function MobileNavItem({
  active,
  layoutId,
  onClick,
  icon: Icon,
  label,
  isNew = false,
}: {
  active: boolean
  layoutId: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
  isNew?: boolean
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      whileTap={tapScale}
      className="relative flex flex-col items-center justify-center flex-1 min-w-0 h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2"
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-x-1.5 inset-y-1.5 rounded-xl bg-primary-50"
          transition={springSoft}
        />
      )}
      <Icon
        className={`relative z-10 w-5 h-5 transition-colors ${
          active ? 'text-primary-800 stroke-[2.5]' : 'text-secondary-500'
        }`}
      />
      <span
        className={`relative z-10 text-xs mt-1 transition-colors ${
          active ? 'font-semibold text-primary-800' : 'font-medium text-secondary-500'
        }`}
      >
        {label}
      </span>
      {isNew && <span className="absolute right-1 top-1 rounded-full studio-teal-wash studio-accent-text px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none">New</span>}
    </motion.button>
  )
}

function AddLogFab({ onClick, ariaLabel = 'Add log' }: { onClick: () => void; ariaLabel?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        whileTap={{ scale: 0.9 }}
        transition={springSnappy}
        className="-mt-7 w-14 h-14 rounded-full bg-primary-500 text-white shadow-lg shadow-primary-500/35 flex items-center justify-center ring-4 ring-white"
      >
        <Plus className="w-7 h-7" strokeWidth={2.5} />
      </motion.button>
    </div>
  )
}

export default function MobileApp({ user, subscriptionStatus }: MobileAppProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    switcherOrganizations,
    activeOrganization,
    switchOrganization,
    hasMultipleOrgs,
    isSharedMember,
    canAddMetrics,
    canAddImpactClaims,
    canAddEvidence,
    canAddStories,
    canUseContentStudio,
    canManageTeam,
  } = useTeam()
  const view: TopLevelView = isStudioMode(location.pathname) ? 'content'
    : (Object.entries(mobilePaths).find(([, path]) => path === location.pathname)?.[0] as TopLevelView | undefined) || 'home'
  const setView = (v: TopLevelView) => {
    setSelectedInitiative(null)
    setOrgDropdownOpen(false)
    navigate(mobilePaths[v])
  }
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
  const [initiativeTab, setInitiativeTab] = useState<InitiativeTab>('overview')
  const [loading, setLoading] = useState(true)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const orgDropdownRef = useRef<HTMLDivElement>(null)
  const capturePickerRef = useRef<HTMLDivElement>(null)
  const initiativeRequest = useRef(0)

  const [captureAction, setCaptureAction] = useState<CaptureAction | null>(null)
  const [addInitiativeId, setAddInitiativeId] = useState<string | null>(null)
  const [storyInitiativeId, setStoryInitiativeId] = useState<string | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [showAddMetricModal, setShowAddMetricModal] = useState(false)
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
    setSelectedInitiative(null)
  }, [location.pathname])

  useEffect(() => {
    if (!captureAction) return
    const previousOverflow = document.body.style.overflow
    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    capturePickerRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const handlePickerKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCaptureAction(null)
      if (event.key !== 'Tab') return
      const buttons = capturePickerRef.current?.querySelectorAll<HTMLButtonElement>('button')
      if (!buttons?.length) return
      const first = buttons[0]
      const last = buttons[buttons.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handlePickerKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handlePickerKey)
      previousFocus?.focus()
    }
  }, [captureAction])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(e.target as Node)) {
        setOrgDropdownOpen(false)
      }
    }
    if (orgDropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [orgDropdownOpen])

  const loadInitiatives = async () => {
    const request = ++initiativeRequest.current
    try {
      const data = await apiService.getInitiatives()
      if (request === initiativeRequest.current) setInitiatives(data)
    } catch (error) {
      console.error('Failed to load programs:', error)
      if (request === initiativeRequest.current) setInitiatives([])
    } finally {
      if (request === initiativeRequest.current) setLoading(false)
    }
  }

  // Mirror desktop Dashboard: clear stale org data and refetch on org switch.
  useEffect(() => {
    if (!activeOrganization?.id) return
    setSelectedInitiative(null)
    setCaptureAction(null)
    setAddInitiativeId(null)
    setStoryInitiativeId(null)
    setShowAddMetricModal(false)
    setInitiatives([])
    setLoading(true)
    loadInitiatives()
  }, [activeOrganization?.id])

  const handleEnterInitiative = (initiative: Initiative) => {
    setSelectedInitiative(initiative)
    setInitiativeTab('overview')
  }

  const handleCreateKPI = async (kpiData: CreateKPIForm) => {
    if (!selectedInitiative?.id) return
    try {
      await apiService.createKPI(kpiData)
      notify.success('Metric created')
      apiService.clearCache(`/initiatives/${selectedInitiative.id}/dashboard`)
      setMetricsRefreshKey((k) => k + 1)
      setShowAddMetricModal(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create metric'
      notify.error(message)
      throw error
    }
  }

  const handleExitInitiative = () => {
    setView('initiatives')
  }

  const openCapture = (action: CaptureAction, initiativeId: string) => {
    setCaptureAction(null)
    if (action === 'story') setStoryInitiativeId(initiativeId)
    else setAddInitiativeId(initiativeId)
  }

  const handleCapture = (action: CaptureAction) => {
    if (action === 'story' ? !canAddStories : !(canAddImpactClaims || canAddEvidence)) return
    if (initiatives.length === 0) {
      notify.error('Create a program first')
      setView('initiatives')
      return
    }
    if (initiatives.length === 1) {
      openCapture(action, initiatives[0].id!)
      return
    }
    setCaptureAction(action)
  }

  const openTimelineForMetric = (kpiId: string) => {
    setInitiativeTab('logs')
    navigate(`${location.pathname}?metric=${kpiId}`, { replace: true })
  }

  const wizard = addInitiativeId ? (
    <UploadWizardLauncher
      initiativeId={addInitiativeId}
      programTitle={initiatives.find(initiative => initiative.id === addInitiativeId)?.title}
      onClose={() => setAddInitiativeId(null)}
      onCreated={loadInitiatives}
    />
  ) : null

  const addPicker = (
    <AnimatePresence>
      {captureAction && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCaptureAction(null)}
            {...sheetBackdrop}
          />
          <motion.div
            ref={capturePickerRef}
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl safe-area-pb max-h-[70vh] flex flex-col shadow-app-modal border-t border-gray-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-capture-picker-title"
            {...sheetPanel}
          >
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-gray-200" />
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="min-w-0 pr-3">
                <h2 id="mobile-capture-picker-title" className="text-base font-semibold text-gray-900">{captureAction === 'story' ? 'Add a story' : 'Add a log'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Choose the program this {captureAction} belongs to.</p>
              </div>
              <motion.button
                type="button"
                onClick={() => setCaptureAction(null)}
                whileTap={tapScale}
                className="p-2 -mr-1 rounded-xl text-gray-400 active:bg-gray-50"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>
            <div className="overflow-y-auto px-3 pb-4 space-y-1.5">
              {initiatives.map((initiative) => (
                <motion.button
                  key={initiative.id}
                  type="button"
                  whileTap={tapScale}
                  onClick={() => {
                    openCapture(captureAction, initiative.id!)
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-gray-200/70 bg-white shadow-card text-left active:border-primary-300/70"
                >
                  <div className="w-10 h-10 rounded-xl bg-white ring-1 ring-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img
                      src={activeOrganization?.logo_url || '/Nexuslogo.png'}
                      alt=""
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png'
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{initiative.title}</p>
                  </div>
                  <Plus className="w-4 h-4 text-primary-600 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )

  if (loading) {
    return <PageLoader label="Loading..." />
  }

  if (selectedInitiative) {
    return (
      <div className="h-[100dvh] flex flex-col bg-white overflow-hidden">
        <div className="flex-shrink-0 bg-white border-b border-gray-100/80 px-3 py-2.5 z-40">
          <div className="flex items-center gap-2">
            <motion.button
              type="button"
              onClick={handleExitInitiative}
              whileTap={tapScale}
              className="p-2 rounded-xl text-gray-500 active:bg-gray-50"
              aria-label="Back to programs"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold text-gray-900 truncate">
                {selectedInitiative.title}
              </h1>
              <p className="text-[11px] text-gray-400 truncate">
                {initiativeTab === 'overview'
                  ? 'Metrics'
                  : initiativeTab === 'logs'
                    ? 'Logs'
                    : initiativeTab === 'stories'
                      ? 'Stories'
                      : 'Locations'}
              </p>
            </div>
          </div>
        </div>

        {/* Fills down to the fixed bottom nav; Logs uses h-full + internal scroll */}
        <div className="flex-1 min-h-0 overflow-hidden pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {initiativeTab === 'logs' ? (
            <TimelineTab initiativeId={selectedInitiative.id!} onRefresh={() => {}} />
          ) : (
            <div className="h-full overflow-y-auto">
              {initiativeTab === 'overview' && (
                <MobileOverview
                  initiativeId={selectedInitiative.id!}
                  onOpenTimelineForMetric={openTimelineForMetric}
                  onAddKPI={canAddMetrics ? () => setShowAddMetricModal(true) : undefined}
                  refreshKey={metricsRefreshKey}
                />
              )}
              {initiativeTab === 'stories' && (
                <MobileStoriesTab key={selectedInitiative.id} initiativeId={selectedInitiative.id!} />
              )}
              {initiativeTab === 'locations' && (
                <MobileLocationsTab key={selectedInitiative.id} initiativeId={selectedInitiative.id!} />
              )}
            </div>
          )}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 safe-area-pb z-50">
          <div className="flex justify-around items-center h-16 px-1">
            <MobileNavItem
              active={initiativeTab === 'overview'}
              layoutId="mobileInitNav"
              onClick={() => setInitiativeTab('overview')}
              icon={LayoutDashboard}
              label="Metrics"
            />
            <MobileNavItem
              active={initiativeTab === 'logs'}
              layoutId="mobileInitNav"
              onClick={() => setInitiativeTab('logs')}
              icon={Activity}
              label="Logs"
            />
            <AddLogFab onClick={() => setAddInitiativeId(selectedInitiative.id!)} />
            <MobileNavItem
              active={initiativeTab === 'stories'}
              layoutId="mobileInitNav"
              onClick={() => setInitiativeTab('stories')}
              icon={BookOpen}
              label="Stories"
            />
            <MobileNavItem
              active={initiativeTab === 'locations'}
              layoutId="mobileInitNav"
              onClick={() => setInitiativeTab('locations')}
              icon={MapPin}
              label="Locations"
            />
          </div>
        </nav>

        {showAddMetricModal && selectedInitiative?.id && (
          <CreateKPIModal
            isOpen={showAddMetricModal}
            onClose={() => setShowAddMetricModal(false)}
            onSubmit={handleCreateKPI}
            initiativeId={selectedInitiative.id}
            onAttached={() => {
              apiService.clearCache(`/initiatives/${selectedInitiative.id}/dashboard`)
              setMetricsRefreshKey((k) => k + 1)
            }}
          />
        )}

        {wizard}
      </div>
    )
  }

  return (
    <div className={`mobile-workspace app-canvas min-h-[100dvh] ${view === 'home' ? 'flex flex-col' : ''}`}>
      {!isStudioComposer(location.pathname) && (
        <header className="flex items-center justify-between gap-3 bg-white border-b border-gray-200/80 px-5 pb-3 pt-[calc(12px+env(safe-area-inset-top,0px))]">
          <button type="button" onClick={() => setView('home')} className="flex items-center gap-2 min-w-0 min-h-11 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2" aria-label="Nexus home">
            <img src="/Nexuslogo.png" alt="" className="h-7 w-auto shrink-0" />
            <span className="text-[15px] font-newsreader font-extralight text-secondary-900 truncate leading-none pt-0.5">Nexus Impacts</span>
          </button>
          <Button type="button" variant="secondary" size="lg" onClick={() => setShowHelp(true)} className="px-3">
            <HelpCircle className="h-4 w-4" aria-hidden="true" /> Help
          </Button>
        </header>
      )}
      {hasMultipleOrgs && view !== 'content' && (
        <div
          className="bg-white border-b border-gray-100/80 px-4 py-2.5 sticky top-0 z-40"
          ref={orgDropdownRef}
        >
          <motion.button
            type="button"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            aria-expanded={orgDropdownOpen}
            aria-label={`Switch organization, currently ${activeOrganization?.name || 'none selected'}`}
            whileTap={tapScale}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border transition-colors ${
              isSharedMember
                ? 'bg-evidence-50 border-evidence-200'
                : 'bg-gray-50/80 border-gray-200/80'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isSharedMember ? 'bg-evidence-100' : 'bg-white ring-1 ring-gray-100'
                }`}
              >
                {isSharedMember ? (
                  <Users className="w-4 h-4 text-evidence-700" />
                ) : (
                  <Building2 className="w-4 h-4 text-gray-600" />
                )}
              </div>
              <span
                className={`text-sm font-semibold truncate ${
                  isSharedMember ? 'text-evidence-800' : 'text-gray-900'
                }`}
              >
                {activeOrganization?.name || 'Select Organization'}
              </span>
              {isSharedMember && (
                <span className="text-[10px] font-semibold uppercase tracking-wide bg-evidence-100 text-evidence-700 px-1.5 py-0.5 rounded-md flex-shrink-0">
                  Team
                </span>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${
                orgDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </motion.button>

          <AnimatePresence>
            {orgDropdownOpen && (
              <motion.div
                className="absolute left-4 right-4 mt-1.5 bg-white rounded-2xl border border-gray-200/70 shadow-app-modal z-50 flex flex-col max-h-[min(60vh,calc(100dvh-7rem))] overflow-hidden"
                {...dropdownPop}
              >
                <p className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex-shrink-0">
                  Switch Organization
                </p>
                <div className="p-1.5 pt-0 overflow-y-auto overscroll-contain touch-pan-y">
                  {switcherOrganizations.map((org) => (
                    <motion.button
                      key={org.id}
                      type="button"
                      whileTap={tapScale}
                      onClick={() => {
                        switchOrganization(org.id)
                        setOrgDropdownOpen(false)
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        org.id === activeOrganization?.id
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-gray-700 active:bg-gray-50'
                      }`}
                    >
                      {org.role === 'member' ? (
                        <Users className="w-4 h-4 text-evidence-600 flex-shrink-0" />
                      ) : (
                        <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      )}
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">{org.name}</div>
                        <div className="text-xs text-gray-400">
                          {org.role === 'owner' ? 'Your organization' : 'Team member'}
                        </div>
                      </div>
                      {org.id === activeOrganization?.id && (
                        <Check className="w-4 h-4 text-primary-500 flex-shrink-0" />
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className={view === 'home' ? 'flex flex-1' : 'flex-1'}>
        {view === 'home' && (
          <MobileHome
            organizationName={activeOrganization?.name || user.organization || 'Your organization'}
            logoUrl={activeOrganization?.logo_url}
            canAddLog={canAddImpactClaims || canAddEvidence}
            canAddStory={canAddStories}
            canCreatePost={canUseContentStudio}
            onAddLog={() => handleCapture('log')}
            onAddStory={() => handleCapture('story')}
            onCreatePost={() => navigate('/studio/new', { state: { studioStart: 'diy' } })}
          />
        )}
        {view === 'initiatives' && (
          <MobileDashboard
            initiatives={initiatives}
            onEnterInitiative={handleEnterInitiative}
            onRefresh={loadInitiatives}
            loading={loading}
            onNavigateToAccount={() => setView('account')}
          />
        )}
        {view === 'metrics' && (
          <MobileOrgMetricsTab onEnterInitiative={handleEnterInitiative} />
        )}
        {view === 'explore' && <ExplorePage embedded />}
        {view === 'account' && (
          <MobileAccountTab user={user} subscriptionStatus={subscriptionStatus} />
        )}
        {view === 'teams' && <ShareTeamPage key={activeOrganization?.id} />}
        {view === 'reports' && (
          <Suspense fallback={<PageLoader label="Loading reports..." />}>
            <MobileReportsTab key={activeOrganization?.id} initiatives={initiatives} />
          </Suspense>
        )}
        {view === 'content' && (
          <div className={`mobile-studio ${isDarkStudioPath(location.pathname) ? '' : 'studio-canvas bg-[var(--studio-canvas)]'}`}>
            {!isStudioComposer(location.pathname) && (
              <nav aria-label="Content Studio" className="flex gap-1 overflow-x-auto border-b border-gray-100 px-4 py-3">
                {[
                  ['/studio', 'Overview'], ['/studio/library', 'Posts'], ['/studio/calendar', 'Schedule'],
                  ['/studio/accounts', 'Accounts'], ['/studio/insights', 'Insights'],
                ].map(([path, label]) => (
                  <Link key={path} to={path} aria-current={location.pathname === path ? 'page' : undefined}
                    className={`shrink-0 rounded-lg px-3 py-2.5 text-sm font-medium ${location.pathname === path ? 'studio-teal-wash studio-accent-text' : 'text-secondary-600'}`}>
                    {label}
                  </Link>
                ))}
              </nav>
            )}
            <Suspense fallback={<PageLoader label="Loading Content Studio..." />}>
              <ContentCreatePage key={activeOrganization?.id} />
            </Suspense>
          </div>
        )}
        {view === 'more' && (
          <main className="mx-auto max-w-lg px-5 py-7">
            <h1 className="app-page-title mb-2">More from Nexus</h1>
            <p className="text-sm text-secondary-500 mb-6">Your organization, insights and settings.</p>
            <div className="app-card divide-y divide-gray-100 overflow-hidden">
              {[
                ...(canManageTeam ? [{ view: 'teams' as const, label: 'Teams', description: 'Invite and manage team members', icon: Users }] : []),
                { view: 'reports' as const, label: 'Reports', description: 'Create and download program impact reports', icon: FileBarChart },
                { view: 'metrics' as const, label: 'Metrics', description: 'See your impact across programs', icon: BarChart3 },
                { view: 'explore' as const, label: 'Explore', description: 'Discover work from other organizations', icon: Compass },
                { view: 'account' as const, label: 'Account', description: 'Profile, organization and settings', icon: User },
              ].map(({ view: nextView, label, description, icon: Icon }) => (
                <button key={nextView} type="button" onClick={() => setView(nextView)} className="flex w-full items-center gap-3 p-4 text-left active:bg-primary-50">
                  <Icon className="h-5 w-5 shrink-0 text-primary-950" aria-hidden="true" />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-secondary-900">{label}</span><span className="block mt-1 text-xs leading-relaxed text-secondary-500">{description}</span></span>
                  <ChevronRight className="h-4 w-4 text-secondary-400" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setShowHelp(true)} className="app-btn app-btn-secondary mt-5 w-full"><HelpCircle className="h-4 w-4" /> Help and support</button>
          </main>
        )}
      </div>

      <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200/80 safe-area-pb z-50">
        <div className="flex items-center h-16 px-1">
          <MobileNavItem
            active={view === 'home'}
            layoutId="mobileTopNav"
            onClick={() => setView('home')}
            icon={Home}
            label="Home"
          />
          <MobileNavItem
            active={view === 'initiatives'}
            layoutId="mobileTopNav"
            onClick={() => setView('initiatives')}
            icon={Layers}
            label="Programs"
          />
          <MobileNavItem
            active={view === 'content'}
            layoutId="mobileTopNav"
            onClick={() => setView('content')}
            icon={FileText}
            label="Content"
            isNew
          />
          <MobileNavItem
            active={['more', 'teams', 'reports', 'metrics', 'explore', 'account'].includes(view)}
            layoutId="mobileTopNav"
            onClick={() => setView('more')}
            icon={MoreHorizontal}
            label="More"
          />
        </div>
      </nav>

      {addPicker}
      {wizard}
      {storyInitiativeId && (
        <MobileStoryForm
          key={storyInitiativeId}
          initiativeId={storyInitiativeId}
          onClose={() => setStoryInitiativeId(null)}
          onSuccess={() => { setStoryInitiativeId(null); loadInitiatives() }}
        />
      )}
      {showHelp && (
        <ModalFrame size="sm" onClose={() => setShowHelp(false)}>
          <ModalHeader title="How can we help?" icon={HelpCircle} onClose={() => setShowHelp(false)} />
          <ModalBody>
            <dl className="space-y-5 text-sm text-secondary-600 leading-relaxed">
              <div><dt className="font-semibold text-secondary-900">Add log</dt><dd>Record a result or upload evidence. Choose a program, add the details, then review and save.</dd></div>
              <div><dt className="font-semibold text-secondary-900">Add story</dt><dd>Capture a meaningful moment with a photo, video, audio recording or written story.</dd></div>
              <div><dt className="font-semibold text-secondary-900">Create social post</dt><dd>Choose materials from your work, craft your post and pick where to share it in Content Studio.</dd></div>
            </dl>
            <a href="mailto:support@nexusimpacts.com" className="app-btn app-btn-secondary w-full mt-6"><Mail className="h-4 w-4" /> Contact support</a>
          </ModalBody>
        </ModalFrame>
      )}
    </div>
  )
}
