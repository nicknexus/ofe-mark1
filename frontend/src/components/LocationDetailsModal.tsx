import React, { useState, useEffect } from 'react'
import { MapPin, BarChart3, FileText, Calendar, Info, Edit, MessageSquare } from 'lucide-react'
import { Location, KPIUpdate, Evidence, Story } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import LogsEvidenceDetailHost from './timeline/LogsEvidenceDetailHost'
import ModalFrame, { ModalHeader, ModalBody } from './ModalFrame'
import { SectionLoader } from './ui'
import { DetailColumn, StoriesList, MetricsList, EvidenceList } from './shared/EntityDetailSections'

interface LocationDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  location: Location | null
  onLocationClick?: (location: Location) => void
  onEditClick?: (location: Location) => void
  onMetricClick?: (kpiId: string) => void
  onStoryClick?: (storyId: string) => void
  refreshKey?: number
  initiativeId?: string
}

export default function LocationDetailsModal({
  isOpen,
  onClose,
  location,
  onEditClick,
  onMetricClick,
  onStoryClick,
  refreshKey,
  initiativeId,
}: LocationDetailsModalProps) {
  const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && location?.id && initiativeId) {
      setLoading(true)
      Promise.all([
        apiService.getLocationKPIUpdates(location.id),
        apiService.getLocationEvidence(location.id),
        apiService.getStories(initiativeId, { locationIds: [location.id] }),
      ])
        .then(([updates, ev, storiesData]) => {
          setKpiUpdates(updates || [])
          setEvidence(ev || [])
          setStories(storiesData || [])
        })
        .catch((error) => {
          console.error('Failed to fetch location data:', error)
          setKpiUpdates([])
          setEvidence([])
          setStories([])
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setKpiUpdates([])
      setEvidence([])
      setStories([])
    }
  }, [isOpen, location?.id, refreshKey, initiativeId])

  if (!isOpen || !location) return null

  const metricsByKPI: Record<string, { kpi: any, updates: KPIUpdate[], total: number }> = {}
  kpiUpdates.forEach((update: any) => {
    const kpiId = update.kpi_id || update.kpis?.id || 'unknown'
    if (!metricsByKPI[kpiId]) {
      metricsByKPI[kpiId] = {
        kpi: update.kpis || update.kpi,
        updates: [],
        total: 0,
      }
    }
    metricsByKPI[kpiId].updates.push(update)
    metricsByKPI[kpiId].total += (update.value || 0)
  })

  return (
    <>
      <ModalFrame
        size="full"
        zIndexClass="z-[70]"
        panelClassName="bg-white rounded-xl border border-gray-200 w-full max-w-[1500px] h-[94vh] max-h-[94vh] overflow-hidden shadow-app-modal flex flex-col"
      >
        <ModalHeader
          icon={MapPin}
          title={location.name}
          subtitle={location.description || undefined}
          onClose={onClose}
          actions={onEditClick ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onEditClick(location)
              }}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : undefined}
        />
        <div className="px-6 py-2 border-b border-gray-100 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4" />
            <span>{location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</span>
          </div>
          {location.created_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(location.created_at)}</span>
            </div>
          )}
        </div>
        <ModalBody className="!py-3 !px-4 sm:!px-5 flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading ? (
            <SectionLoader label="Loading location data..." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 flex-1 min-h-0 h-full">
              <DetailColumn icon={MessageSquare} title="Stories" count={stories.length}>
                <StoriesList stories={stories} onStoryClick={onStoryClick} onClose={onClose} />
              </DetailColumn>
              <DetailColumn icon={BarChart3} title="Metrics" count={Object.keys(metricsByKPI).length}>
                <MetricsList metricsByKPI={metricsByKPI} onMetricClick={onMetricClick} onClose={onClose} />
              </DetailColumn>
              <DetailColumn icon={FileText} title="Evidence" count={evidence.length}>
                <EvidenceList
                  evidence={evidence}
                  onEvidenceClick={(ev) => {
                    if (ev.id) setSelectedEvidenceId(ev.id)
                  }}
                />
              </DetailColumn>
            </div>
          )}
        </ModalBody>
      </ModalFrame>

      {selectedEvidenceId && initiativeId && (
        <LogsEvidenceDetailHost
          evidenceId={selectedEvidenceId}
          initiativeId={initiativeId}
          onClose={() => setSelectedEvidenceId(null)}
          onDataChanged={() => {
            if (location?.id && initiativeId) {
              apiService.getLocationEvidence(location.id).then(ev => setEvidence(ev || []))
            }
          }}
        />
      )}
    </>
  )
}
