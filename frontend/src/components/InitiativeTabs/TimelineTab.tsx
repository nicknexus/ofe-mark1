import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { apiService } from '../../services/api'
import {
 BeneficiaryGroup,
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
import { AlertCircle, Plus } from 'lucide-react'
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
import EvidencePreviewModal from '../EvidencePreviewModal'
import DataPointPreviewModal from '../DataPointPreviewModal'
import AddEvidenceModal from '../AddEvidenceModal'
import ConfirmDialog from '../ConfirmDialog'

const VIEWS: Array<{ id: TimelineView; label: string }> = [
 { id: 'claims', label: 'Claims' },
 { id: 'evidence', label: 'Evidence' },
 { id: 'connections', label: 'Connections' },
]

interface TimelineTabProps {
 initiativeId: string
 onRefresh?: () => void
}

/**
 * Unified operational view over the initiative's impact claims, evidence,
 * and their connections. Sub-view and every filter live in URL params so
 * filtered views can be deep-linked, refreshed, and navigated with browser
 * controls (?tab=timeline&view=...&metric=...).
 */
export default function TimelineTab({ initiativeId, onRefresh }: TimelineTabProps) {
 const { canAddImpactClaims, canEditEvidence, canDelete } = useTeam()
 const [searchParams, setSearchParams] = useSearchParams()

 const [data, setData] = useState<TimelineResponse | null>(null)
 const [loading, setLoading] = useState(true)
 const [locations, setLocations] = useState<Location[]>([])
 const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
 const [tags, setTags] = useState<MetricTag[]>([])

 // Modal state (same wiring as EvidenceTab)
 const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
 const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false)
 const [editingEvidence, setEditingEvidence] = useState<Evidence | null>(null)
 const [isEditModalOpen, setIsEditModalOpen] = useState(false)
 const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null)
 const [selectedDataPointKpi, setSelectedDataPointKpi] = useState<any>(null)
 const [isDataPointPreviewOpen, setIsDataPointPreviewOpen] = useState(false)
 const [deleteEvidence, setDeleteEvidence] = useState<Evidence | null>(null)
 const [connectTarget, setConnectTarget] = useState<{ evidence: TimelineEvidence; claimId?: string } | null>(null)
 const [isWizardOpen, setIsWizardOpen] = useState(false)

 const rawView = searchParams.get('view')
 const view: TimelineView = rawView === 'evidence' || rawView === 'connections' ? rawView : 'claims'
 const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])

 const setView = (next: TimelineView) => {
 const params = new URLSearchParams(searchParams)
 if (next === 'claims') params.delete('view')
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
 setSelectedDataPoint(claim)
 setSelectedDataPointKpi(kpi || null)
 setIsDataPointPreviewOpen(true)
 }

 const handleOpenEvidence = (ev: TimelineEvidence) => {
 setSelectedEvidence(ev)
 setIsPreviewModalOpen(true)
 }

 const handleEditEvidence = async (ev: Evidence) => {
 setIsPreviewModalOpen(false)
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

 const handleDeleteEvidence = async (ev: Evidence) => {
 if (!ev.id) return
 try {
 await apiService.deleteEvidence(ev.id)
 notify.success('Evidence deleted successfully')
 setDeleteEvidence(null)
 setIsPreviewModalOpen(false)
 setSelectedEvidence(null)
 await refresh()
 } catch (error) {
 notify.error('Failed to delete evidence')
 }
 }

 return (
    <div className="h-screen overflow-hidden flex flex-col mobile-content-padding">
      {/* Header + toolbar (kept compact so the list below is the focus) */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-gray-100 bg-white space-y-3">
        {/* Title row */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-800 leading-tight">Timeline</h2>
            <p className="text-xs text-gray-500 hidden sm:block">
              All claims, evidence, and connections for this initiative
            </p>
          </div>
          {(canAddImpactClaims || canEditEvidence) && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="app-btn app-btn-primary app-btn-sm flex-shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}
        </div>

        {/* View switcher + at-a-glance stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="inline-flex items-center gap-0.5 p-0.5 rounded-full bg-gray-100 border border-gray-200 self-start">
            {VIEWS.map(v => {
              const isActive = view === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="timelineViewSeg"
                      className="absolute inset-0 rounded-full bg-white shadow-card"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">{v.label}</span>
                </button>
              )
            })}
          </div>

          {data && (
            <TimelineStatCards
              stats={data.stats}
              activeStatus={filters.status}
              onStatusClick={(status) => setFilters({ ...filters, status })}
            />
          )}
        </div>

        {/* Filters */}
        <TimelineFilterBar
          view={view}
          filters={filters}
          onFiltersChange={setFilters}
          kpis={data?.kpis || []}
          locations={locations}
          beneficiaryGroups={beneficiaryGroups}
          tags={tags}
          contributors={data?.contributors || {}}
        />
      </div>

      {/* Active view — primary focus of the page */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
        {loading ? (
          <SectionLoader className="h-64" />
        ) : !data ? (
          <div className="app-card md:p-8">
            <EmptyState
              icon={AlertCircle}
              title="Timeline unavailable"
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
                  contributors={data.contributors}
                  filters={filters}
                  onOpenClaim={handleOpenClaim}
                />
              ) : view === 'evidence' ? (
                <EvidenceView
                  evidence={data.evidence}
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
                  onConnectEvidence={canEditEvidence
                    ? (ev, claimId) => setConnectTarget({ evidence: ev, claimId })
                    : undefined}
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

 {/* Connect evidence → claim (re-scope + link) */}
 {connectTarget && data && (
 <ConnectEvidenceDialog
 evidence={connectTarget.evidence}
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

 {/* Evidence preview */}
 {isPreviewModalOpen && selectedEvidence && (
 <EvidencePreviewModal
 isOpen={isPreviewModalOpen}
 onClose={() => {
 setIsPreviewModalOpen(false)
 setSelectedEvidence(null)
 }}
 evidence={selectedEvidence}
 onEdit={canEditEvidence ? handleEditEvidence : undefined}
 onDelete={canDelete ? setDeleteEvidence : undefined}
 onDataPointClick={(dataPoint, kpi) => {
 setSelectedDataPoint(dataPoint)
 setSelectedDataPointKpi(kpi)
 setIsPreviewModalOpen(false)
 setIsDataPointPreviewOpen(true)
 }}
 />
 )}

 {/* Claim preview */}
 {selectedDataPoint && (
 <DataPointPreviewModal
 isOpen={isDataPointPreviewOpen}
 onClose={() => {
 setIsDataPointPreviewOpen(false)
 setSelectedDataPoint(null)
 setSelectedDataPointKpi(null)
 }}
 dataPoint={selectedDataPoint}
 kpi={selectedDataPointKpi || selectedDataPoint.kpi}
 onEvidenceClick={(ev) => {
 setSelectedEvidence(ev)
 setIsDataPointPreviewOpen(false)
 setIsPreviewModalOpen(true)
 }}
 />
 )}

 {/* Edit evidence (legacy single-record form, same as EvidenceTab) */}
 {isEditModalOpen && editingEvidence && (
 <AddEvidenceModal
 isOpen={isEditModalOpen}
 onClose={() => {
 setIsEditModalOpen(false)
 setEditingEvidence(null)
 }}
 onSubmit={handleSaveEvidence}
 availableKPIs={data?.kpis || []}
 initiativeId={initiativeId}
 editData={editingEvidence}
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
