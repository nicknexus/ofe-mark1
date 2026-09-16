import React, { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  BarChart3,
  Trash2,
  Settings2,
  Sparkles,
  LayoutDashboard,
  Activity,
  MapPin,
  Users,
  BookOpen,
  ExternalLink,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { apiService } from '../services/api'
import { InitiativeDashboard, LoadingState, CreateKPIForm } from '../types'
import { aggregateKpiUpdates } from '../utils/kpiAggregation'
import CreateKPIModal from '../components/CreateKPIModal'
import MetricsDashboardTab from '../components/metricsDashboard/MetricsDashboardTab'
import MetricDetailTab from '../components/InitiativeTabs/MetricDetailTab'
import HomeTab from '../components/InitiativeTabs/HomeTab'
import TimelineTab from '../components/InitiativeTabs/TimelineTab'
import LocationTab from '../components/InitiativeTabs/LocationTab'
import BeneficiariesTab from '../components/InitiativeTabs/BeneficiariesTab'
import StoriesTab from '../components/InitiativeTabs/StoriesTab'
import ReportTab from '../components/InitiativeTabs/ReportTab'
import MobileBottomNav from '../components/MobileBottomNav'
import ModalFrame, { ModalHeader } from '../components/ModalFrame'
import ProgramSetupDrawer from '../components/setup/ProgramSetupDrawer'
import UploadWizardLauncher from '../components/upload/UploadWizardLauncher'
import { notify } from '../lib/notify'
import { Button, PageLoader, InlineAlert } from '../components/ui'
import { useTeam } from '../context/TeamContext'

type ProgramTab = 'metrics' | 'logs' | 'location' | 'beneficiaries' | 'stories'

const TABS: { id: ProgramTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'metrics', label: 'Metrics', icon: LayoutDashboard },
  { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'location', label: 'Locations', icon: MapPin },
  { id: 'beneficiaries', label: 'People', icon: Users },
  { id: 'stories', label: 'Stories', icon: BookOpen },
]

/**
 * Program workspace. One header (title, section switcher, Add log / Set up /
 * Report), one body. The org sidebar stays visible so users never lose the
 * rest of the app. Structural setup (metrics, tags, locations, groups) lives
 * in the Set up drawer; logging lives in the Add log wizard; the AI report
 * opens in a modal. Sections are still deep-linkable via ?tab=.
 */
export default function InitiativePage() {
  const { canAddImpactClaims, canAddEvidence, canAddMetrics, canEditMetrics, canDelete, canEditInitiatives, activeOrganization } = useTeam()
  const { id, kpiId } = useParams<{ id: string; kpiId?: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [dashboard, setDashboard] = useState<InitiativeDashboard | null>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: true })
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false)
  const [kpiTotals, setKpiTotals] = useState<Record<string, number>>({})
  const [allKPIUpdates, setAllKPIUpdates] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<ProgramTab>('metrics')
  const [initialStoryId, setInitialStoryId] = useState<string | undefined>(undefined)

  // Header-driven overlays
  const [setupOpen, setSetupOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [addLogOpen, setAddLogOpen] = useState(false)
  const [addLogSignal, setAddLogSignal] = useState(0)

  // Metric modals
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false)
  const [isEditKPIModalOpen, setIsEditKPIModalOpen] = useState(false)
  const [deleteConfirmKPI, setDeleteConfirmKPI] = useState<any>(null)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [selectedKPI, setSelectedKPI] = useState<any>(null)

  const canLog = canAddImpactClaims || canAddEvidence

  // ?tab= handling, with redirects for legacy tab names.
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (!tab) return
    const params = new URLSearchParams(searchParams)
    if (tab === 'home') { params.set('tab', 'metrics'); setSearchParams(params, { replace: true }); return }
    if (tab === 'timeline') { params.set('tab', 'logs'); setSearchParams(params, { replace: true }); return }
    if (tab === 'evidence') { params.set('tab', 'logs'); params.set('view', 'evidence'); setSearchParams(params, { replace: true }); return }
    if (tab === 'report') { params.delete('tab'); setSearchParams(params, { replace: true }); setReportOpen(true); return }
    if ((TABS as { id: string }[]).some(t => t.id === tab)) setActiveTab(tab as ProgramTab)
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (id) loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // A metric URL always shows the Metrics section.
  useEffect(() => {
    if (kpiId && dashboard) setActiveTab('metrics')
  }, [kpiId, dashboard])

  const loadKPITotals = async (kpis: any[], clearFirst = true) => {
    if (!id || kpis.length === 0) {
      setKpiTotals({})
      if (clearFirst) setAllKPIUpdates([])
      return
    }
    const buildFromGrouped = (grouped: Record<string, any[]>) => {
      const totals: Record<string, number> = {}
      const allUpdates: any[] = []
      for (const kpi of kpis) {
        const updates = grouped[kpi.id] || []
        totals[kpi.id] = aggregateKpiUpdates(updates as any, kpi.metric_type)
        for (const update of updates) {
          allUpdates.push({ ...update, kpi_title: kpi.title, kpi_unit: kpi.unit_of_measurement })
        }
      }
      setKpiTotals(totals)
      setAllKPIUpdates(allUpdates)
    }
    try {
      buildFromGrouped(await apiService.getKPIUpdatesForInitiative(id))
      return
    } catch (error) {
      console.warn('Batch KPI updates failed, falling back to per-KPI loop:', error)
    }
    const grouped: Record<string, any[]> = {}
    await Promise.all(kpis.map(async (kpi) => {
      try { grouped[kpi.id] = await apiService.getKPIUpdates(kpi.id) } catch { grouped[kpi.id] = [] }
    }))
    buildFromGrouped(grouped)
  }

  const loadDashboard = async () => {
    if (!id || isLoadingDashboard) return
    try {
      setIsLoadingDashboard(true)
      if (!dashboard) setLoadingState({ isLoading: true })
      const data = await apiService.getInitiativeDashboard(id)
      setDashboard(data)
      if (data?.kpis) await loadKPITotals(data.kpis)
      setLoadingState({ isLoading: false })
    } catch (error: any) {
      if (error?.code === 'INITIATIVE_LOCKED') {
        notify.error('This program is locked on your current plan. Upgrade to unlock it.')
        navigate('/')
        return
      }
      const message = error instanceof Error ? error.message : 'Failed to load dashboard'
      setLoadingState({ isLoading: false, error: message })
      notify.error(message)
    } finally {
      setIsLoadingDashboard(false)
    }
  }

  const refreshAfterChange = () => {
    if (dashboard?.kpis) loadKPITotals(dashboard.kpis, false)
    apiService.clearCache(`/initiatives/${id}/dashboard`)
    if (!isLoadingDashboard) loadDashboard()
  }

  // ── Metric CRUD (used by the dashboard's Add metric + detail Edit) ─────

  const handleCreateKPI = async (kpiData: CreateKPIForm) => {
    try {
      const newKPI = await apiService.createKPI(kpiData)
      notify.success('Metric created')
      apiService.clearCache(`/initiatives/${id}/dashboard`)
      if (!isLoadingDashboard) await loadDashboard()
      if (newKPI?.id) navigate(`/programs/${id}/metrics/${newKPI.id}`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to create metric')
      throw error
    }
  }

  const handleEditKPI = async (kpiData: CreateKPIForm) => {
    if (!selectedKPI) return
    try {
      await apiService.updateKPI(selectedKPI.id, kpiData)
      notify.success('Metric updated')
      apiService.clearCache(`/initiatives/${id}/dashboard`)
      if (!isLoadingDashboard) loadDashboard()
      setIsEditKPIModalOpen(false)
      setSelectedKPI(null)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to update metric')
      throw error
    }
  }

  const handleDeleteKPI = async (kpi: any) => {
    if (deleteConfirmText !== 'DELETE MY METRIC') {
      notify.error('Please type "DELETE MY METRIC" exactly to confirm')
      return
    }
    try {
      await apiService.deleteKPI(kpi.id)
      notify.success('Metric deleted')
      apiService.clearCache(`/initiatives/${id}/dashboard`)
      if (!isLoadingDashboard) loadDashboard()
      setDeleteConfirmKPI(null)
      setDeleteConfirmText('')
      if (kpiId === kpi.id) navigate(`/programs/${id}`)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete metric')
    }
  }

  const openEditModal = (kpi: any) => { setSelectedKPI(kpi); setIsEditKPIModalOpen(true) }
  const openDeleteConfirm = (kpi: any) => setDeleteConfirmKPI(kpi)

  // ── Navigation ─────────────────────────────────────────────────────────

  const handleTabChange = (tab: string) => {
    if (tab === 'report') { setReportOpen(true); return }
    setActiveTab(tab as ProgramTab)
    if (kpiId) {
      navigate(`/programs/${id}?tab=${tab}`)
    } else {
      setSearchParams(new URLSearchParams({ tab }), { replace: true })
    }
  }

  const handleMetricCardClick = (kpiIdToOpen: string) => navigate(`/programs/${id}/metrics/${kpiIdToOpen}`)

  const openStory = (storyId: string) => { setInitialStoryId(storyId); handleTabChange('stories') }

  const handleAddLog = () => {
    // On Logs, hand off to the tab's own wizard (it has the Advanced paths and
    // refreshes itself). Elsewhere, use the self-fetching launcher.
    if (activeTab === 'logs' && !kpiId) setAddLogSignal(s => s + 1)
    else setAddLogOpen(true)
  }

  const publicHref = useMemo(() => {
    const orgSlug = activeOrganization?.slug
    const initSlug = dashboard?.initiative?.slug
    if (!orgSlug || !initSlug) return null
    return `${activeOrganization?.is_demo ? '/demo' : '/org'}/${orgSlug}/${initSlug}`
  }, [activeOrganization?.slug, activeOrganization?.is_demo, dashboard?.initiative?.slug])

  const setupReady = !!dashboard && dashboard.kpis.length > 0

  // ── Body ───────────────────────────────────────────────────────────────

  const renderMetricsContent = () => {
    if (!dashboard) return null
    const { kpis } = dashboard
    if (kpis.length === 0) {
      return (
        <div className="h-full overflow-hidden">
          <div className="flex items-center justify-center h-full p-6">
            <div className="app-card p-10 text-center max-w-md mx-auto">
              <div className="app-icon-tile mx-auto mb-6">
                <BarChart3 className="w-6 h-6 text-primary-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Set up this program</h3>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                Add the metrics you want to track and the locations where the work happens. Then log claims and evidence against them.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {canEditInitiatives && (
                  <button onClick={() => setSetupOpen(true)} className="app-btn app-btn-primary">
                    <Settings2 className="w-4 h-4" />
                    <span>Open Set up</span>
                  </button>
                )}
                {canAddMetrics && (
                  <button onClick={() => setIsKPIModalOpen(true)} className="app-btn app-btn-secondary">
                    <Plus className="w-4 h-4" />
                    <span>Add a metric</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }
    return (
      <MetricsDashboardTab
        initiativeId={id!}
        kpis={kpis}
        kpiTotals={kpiTotals}
        kpiUpdates={allKPIUpdates}
        onAddKPI={canAddMetrics ? () => setIsKPIModalOpen(true) : undefined}
        onMetricDetailClick={handleMetricCardClick}
        onOpenLocations={() => handleTabChange('location')}
        onRefresh={refreshAfterChange}
        onStoryClick={openStory}
      />
    )
  }

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'logs':
        return <TimelineTab initiativeId={id!} onRefresh={loadDashboard} openAddLogSignal={addLogSignal} />
      case 'location':
        return <LocationTab onStoryClick={openStory} onMetricClick={handleMetricCardClick} />
      case 'beneficiaries':
        return <BeneficiariesTab initiativeId={id!} onRefresh={loadDashboard} onStoryClick={openStory} onMetricClick={handleMetricCardClick} />
      case 'stories':
        return <StoriesTab initiativeId={id!} onRefresh={loadDashboard} initialStoryId={initialStoryId} />
      case 'metrics':
      default: {
        const detailKpi = kpiId ? (dashboard?.kpis || []).find(k => k.id === kpiId) : null
        if (detailKpi) {
          return (
            <MetricDetailTab
              initiativeId={id!}
              kpi={detailKpi}
              kpis={dashboard?.kpis || []}
              kpiTotal={kpiTotals[detailKpi.id!] || 0}
              kpiUpdates={allKPIUpdates}
              onBack={() => navigate(`/programs/${id}`)}
              onEdit={canEditMetrics ? () => openEditModal(detailKpi) : undefined}
              onRefresh={loadDashboard}
              onStoryClick={openStory}
            />
          )
        }
        return <HomeTab>{renderMetricsContent()}</HomeTab>
      }
    }
  }

  if (loadingState.isLoading) return <PageLoader />

  if (loadingState.error || !dashboard) {
    return (
      <div className="text-center py-12 px-4 app-canvas min-h-screen">
        <InlineAlert tone="error" className="mb-4 max-w-md mx-auto text-left">{loadingState.error || 'Program not found'}</InlineAlert>
        <div className="space-x-4">
          <Button asChild variant="secondary"><Link to="/tracking/programs">Back to programs</Link></Button>
          <Button onClick={loadDashboard} disabled={isLoadingDashboard}>{isLoadingDashboard ? 'Loading' : 'Try again'}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-canvas h-screen flex flex-col">
      {/* Header: identity row + prominent section switcher */}
      <header className="flex-shrink-0 bg-white border-b border-gray-200/80 shadow-[0_1px_0_rgba(16,24,40,0.02)]">
        <div className="px-4 sm:px-6 pt-4 pb-3 flex items-start gap-3">
          <Link to="/tracking/programs" className="app-btn app-btn-icon app-btn-ghost text-gray-500 hover:text-gray-900 mt-1 flex-shrink-0" title="Back to programs" aria-label="Back to programs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="hidden sm:flex w-11 h-11 rounded-xl bg-white ring-1 ring-gray-200/80 shadow-card items-center justify-center flex-shrink-0 overflow-hidden mt-0.5">
            <img
              src={activeOrganization?.logo_url || '/Nexuslogo.png'}
              alt=""
              className="w-full h-full object-contain p-1"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary-900/70 leading-none mb-1">Program</p>
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight truncate leading-tight">{dashboard.initiative.title}</h1>
              {publicHref && (
                <a href={publicHref} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-1 rounded-full border border-impact-100 bg-impact-50 px-2 py-0.5 text-[11px] font-medium text-impact-700 hover:bg-impact-100 flex-shrink-0" title="Open public page">
                  <ExternalLink className="w-3 h-3" /> Public
                </a>
              )}
            </div>
            {dashboard.initiative.description && (
              <p className="text-sm text-gray-500 truncate hidden sm:block mt-0.5 max-w-3xl">{dashboard.initiative.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {canLog && (
              <button
                type="button"
                onClick={handleAddLog}
                disabled={!setupReady}
                title={setupReady ? 'Log a claim or evidence' : 'Add a metric first'}
                className="app-btn app-btn-primary"
              >
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add log</span>
              </button>
            )}
            {canEditInitiatives && (
              <button type="button" onClick={() => setSetupOpen(true)} className="app-btn app-btn-secondary" title="Metrics, tags, locations, groups">
                <Settings2 className="w-4 h-4" /> <span className="hidden sm:inline">Set up</span>
              </button>
            )}
            <button type="button" onClick={() => setReportOpen(true)} className="app-btn app-btn-secondary" title="Generate an AI impact report">
              <Sparkles className="w-4 h-4 text-primary-800" /> <span className="hidden md:inline">Report</span>
            </button>
          </div>
        </div>

        {/* Section switcher (desktop). Mobile uses the bottom nav. */}
        <nav className="hidden md:flex items-center px-4 sm:px-6 pb-3" aria-label="Program sections">
          <div className="app-segmented">
            {TABS.map(t => {
              const Icon = t.icon
              const active = activeTab === t.id && !(t.id !== 'metrics' && kpiId)
              const count = t.id === 'metrics' ? dashboard.kpis.length : t.id === 'logs' ? allKPIUpdates.length : null
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTabChange(t.id)}
                  className="app-segmented-item"
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="programSectionPill"
                      className="absolute inset-0 rounded-lg bg-white border border-gray-200/70 shadow-card"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <Icon className={`relative z-10 w-4 h-4 ${active ? 'text-primary-800' : 'text-gray-400'}`} />
                  <span className="relative z-10">{t.label}</span>
                  {count !== null && count > 0 && (
                    <span className={`relative z-10 min-w-[1.25rem] px-1.5 py-px rounded-full text-[11px] font-semibold tabular-nums text-center ${active ? 'bg-primary-100 text-primary-950' : 'bg-gray-200/80 text-gray-600'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </header>

      {/* Body: each section owns its own scroll. */}
      <div className="flex-1 min-h-0">
        {renderActiveTab()}
      </div>

      <MobileBottomNav activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Overlays */}
      {setupOpen && (
        <ProgramSetupDrawer
          initiativeId={id!}
          initiativeTitle={dashboard.initiative.title}
          isOpen
          onClose={() => setSetupOpen(false)}
          onChanged={refreshAfterChange}
        />
      )}

      {addLogOpen && (
        <UploadWizardLauncher
          initiativeId={id!}
          onClose={() => setAddLogOpen(false)}
          onCreated={refreshAfterChange}
        />
      )}

      {reportOpen && (
        <ModalFrame size="full" zIndexClass="z-[70]" onClose={() => setReportOpen(false)} paddingClassName="p-0 md:p-4">
          <ModalHeader title="AI impact report" subtitle="Generate a shareable summary from this program's claims, evidence and stories." icon={Sparkles} onClose={() => setReportOpen(false)} />
          <div className="flex-1 min-h-0 h-[80vh]">
            <ReportTab initiativeId={id!} dashboard={dashboard} />
          </div>
        </ModalFrame>
      )}

      <CreateKPIModal
        isOpen={isKPIModalOpen}
        onClose={() => setIsKPIModalOpen(false)}
        onSubmit={handleCreateKPI}
        initiativeId={id!}
        onAttached={async () => {
          apiService.clearCache(`/initiatives/${id}/dashboard`)
          if (!isLoadingDashboard) await loadDashboard()
        }}
      />

      {selectedKPI && (
        <CreateKPIModal
          isOpen={isEditKPIModalOpen}
          onClose={() => { setIsEditKPIModalOpen(false); setSelectedKPI(null) }}
          onSubmit={handleEditKPI}
          initiativeId={id!}
          editData={selectedKPI}
          onDelete={canDelete ? () => { setIsEditKPIModalOpen(false); openDeleteConfirm(selectedKPI) } : undefined}
        />
      )}

      {deleteConfirmKPI && (
        <ModalFrame zIndexClass="z-[60]" size="sm" panelClassName="bg-white rounded-xl max-w-md w-full p-6 shadow-app-modal border border-gray-200">
          <div className="flex items-start space-x-4 mb-6">
            <div className="app-icon-tile"><Trash2 className="w-5 h-5 text-red-500" /></div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Delete metric</h3>
              <p className="text-sm text-gray-500">This action cannot be undone</p>
            </div>
          </div>
          <p className="text-gray-600 mb-2 text-sm">
            Are you sure you want to delete <strong className="text-gray-800">"{deleteConfirmKPI.title}"</strong>?
          </p>
          <p className="text-xs text-gray-500 mb-4">This will also delete all associated impact claims and evidence links.</p>
          <div className="mb-6">
            <label className="app-label">
              Type <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">DELETE MY METRIC</span> to confirm:
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE MY METRIC"
              className="app-input"
            />
          </div>
          <div className="flex space-x-3">
            <button onClick={() => { setDeleteConfirmKPI(null); setDeleteConfirmText('') }} className="app-btn app-btn-secondary flex-1">Cancel</button>
            <button onClick={() => handleDeleteKPI(deleteConfirmKPI)} disabled={deleteConfirmText !== 'DELETE MY METRIC'} className="app-btn app-btn-danger flex-1">Delete metric</button>
          </div>
        </ModalFrame>
      )}
    </div>
  )
}
