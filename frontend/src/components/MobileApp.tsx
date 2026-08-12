import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
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
} from 'lucide-react'
import { apiService } from '../services/api'
import { CreateKPIForm, Initiative, User as UserType, SubscriptionStatus } from '../types'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import MobileDashboard from './mobile/MobileDashboard'
import MobileOrgMetricsTab from './mobile/MobileOrgMetricsTab'
import { PageLoader } from './ui'
import MobileLocationsTab from './mobile/MobileLocationsTab'
import MobileStoriesTab from './mobile/MobileStoriesTab'
import MobileAccountTab from './mobile/MobileAccountTab'
import TimelineTab from './InitiativeTabs/TimelineTab'
import MobileOverview from './overview/MobileOverview'
import UploadWizardLauncher from './upload/UploadWizardLauncher'
import CreateKPIModal from './CreateKPIModal'
import ExplorePage from '../pages/ExplorePage'
import {
  springSoft,
  springSnappy,
  tapScale,
  sheetBackdrop,
  sheetPanel,
  dropdownPop,
} from './mobile/motion'

interface MobileAppProps {
  user: UserType
  subscriptionStatus: SubscriptionStatus | null
}

type TopLevelView = 'initiatives' | 'metrics' | 'explore' | 'account'
type InitiativeTab = 'logs' | 'overview' | 'stories' | 'locations'

function MobileNavItem({
  active,
  layoutId,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  layoutId: string
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={tapScale}
      className="relative flex flex-col items-center justify-center flex-1 h-full"
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
          active ? 'text-primary-700 stroke-[2.5]' : 'text-gray-400'
        }`}
      />
      <span
        className={`relative z-10 text-[11px] mt-0.5 transition-colors ${
          active ? 'font-semibold text-primary-800' : 'font-medium text-gray-400'
        }`}
      >
        {label}
      </span>
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
  } = useTeam()
  const [view, setViewRaw] = useState<TopLevelView>(() => {
    const saved = sessionStorage.getItem('mobile-view')
    if (saved === 'explore' || saved === 'account' || saved === 'initiatives' || saved === 'metrics') {
      return saved
    }
    return 'initiatives'
  })
  const setView = (v: TopLevelView) => {
    sessionStorage.setItem('mobile-view', v)
    setViewRaw(v)
  }
  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null)
  const [initiativeTab, setInitiativeTab] = useState<InitiativeTab>('overview')
  const [loading, setLoading] = useState(true)
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const orgDropdownRef = useRef<HTMLDivElement>(null)

  const [showAddPicker, setShowAddPicker] = useState(false)
  const [addInitiativeId, setAddInitiativeId] = useState<string | null>(null)
  const [showAddMetricModal, setShowAddMetricModal] = useState(false)
  const [metricsRefreshKey, setMetricsRefreshKey] = useState(0)

  useEffect(() => {
    if (location.pathname === '/explore') {
      setView('explore')
      navigate('/', { replace: true })
    }
  }, [location.pathname])

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
    try {
      const data = await apiService.getInitiatives()
      setInitiatives(data)
    } catch (error) {
      console.error('Failed to load initiatives:', error)
      setInitiatives([])
    } finally {
      setLoading(false)
    }
  }

  // Mirror desktop Dashboard: clear stale org data and refetch on org switch.
  useEffect(() => {
    if (!activeOrganization?.id) return
    setSelectedInitiative(null)
    setShowAddPicker(false)
    setAddInitiativeId(null)
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
    setSelectedInitiative(null)
  }

  const handlePlusClick = () => {
    if (initiatives.length === 0) {
      notify.error('Create an initiative first')
      setView('initiatives')
      return
    }
    if (initiatives.length === 1) {
      setAddInitiativeId(initiatives[0].id!)
      return
    }
    setShowAddPicker(true)
  }

  const openTimelineForMetric = (kpiId: string) => {
    setInitiativeTab('logs')
    navigate(`/?metric=${kpiId}`, { replace: true })
  }

  const wizard = addInitiativeId ? (
    <UploadWizardLauncher
      initiativeId={addInitiativeId}
      onClose={() => setAddInitiativeId(null)}
      onCreated={loadInitiatives}
    />
  ) : null

  const addPicker = (
    <AnimatePresence>
      {showAddPicker && (
        <div className="fixed inset-0 z-[90]">
          <motion.div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowAddPicker(false)}
            {...sheetBackdrop}
          />
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl safe-area-pb max-h-[70vh] flex flex-col shadow-app-modal border-t border-gray-100"
            {...sheetPanel}
          >
            <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-gray-200" />
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="min-w-0 pr-3">
                <h2 className="text-base font-semibold text-gray-900">Add a log</h2>
                <p className="text-xs text-gray-500 mt-0.5">Pick an initiative for this claim or evidence</p>
              </div>
              <motion.button
                type="button"
                onClick={() => setShowAddPicker(false)}
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
                    setShowAddPicker(false)
                    setAddInitiativeId(initiative.id!)
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
              aria-label="Back to initiatives"
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
    <div className="min-h-screen pb-24 bg-white">
      {hasMultipleOrgs && (view === 'initiatives' || view === 'metrics') && (
        <div
          className="bg-white border-b border-gray-100/80 px-4 py-2.5 sticky top-0 z-40"
          ref={orgDropdownRef}
        >
          <motion.button
            type="button"
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
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

      <div className="flex-1">
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
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 safe-area-pb z-50">
        <div className="flex justify-around items-center h-16 px-0.5">
          <MobileNavItem
            active={view === 'initiatives'}
            layoutId="mobileTopNav"
            onClick={() => {
              setView('initiatives')
              if (location.pathname !== '/') navigate('/', { replace: true })
            }}
            icon={Layers}
            label="Initiatives"
          />
          <MobileNavItem
            active={view === 'metrics'}
            layoutId="mobileTopNav"
            onClick={() => {
              setView('metrics')
              if (location.pathname !== '/') navigate('/', { replace: true })
            }}
            icon={BarChart3}
            label="Metrics"
          />
          <AddLogFab onClick={handlePlusClick} />
          <MobileNavItem
            active={view === 'explore'}
            layoutId="mobileTopNav"
            onClick={() => {
              setView('explore')
              if (location.pathname !== '/') navigate('/', { replace: true })
            }}
            icon={Compass}
            label="Explore"
          />
          <MobileNavItem
            active={view === 'account'}
            layoutId="mobileTopNav"
            onClick={() => {
              setView('account')
              if (location.pathname !== '/') navigate('/', { replace: true })
            }}
            icon={User}
            label="Account"
          />
        </div>
      </nav>

      {addPicker}
      {wizard}
    </div>
  )
}
