import React, { useState, useEffect, useMemo } from 'react'
import { Users, BarChart3, FileText, Calendar, Info, Edit, MessageSquare, MapPin } from 'lucide-react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BeneficiaryGroup, KPIUpdate, Evidence, Story, Location } from '../types'
import { apiService } from '../services/api'
import { formatDate } from '../utils'
import LogsEvidenceDetailHost from './timeline/LogsEvidenceDetailHost'
import ModalFrame, { ModalHeader, ModalBody } from './ModalFrame'
import { SectionLoader } from './ui'
import { DetailColumn, StoriesList, MetricsList, EvidenceList } from './shared/EntityDetailSections'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const CARTO_VOYAGER_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
const OSM_FALLBACK_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

function TileLayerWithFallback() {
  const [useFallback, setUseFallback] = useState(false)
  const map = useMap()
  useEffect(() => {
    if (useFallback) return
    const testImg = new Image()
    testImg.onerror = () => setUseFallback(true)
    testImg.src = 'https://a.basemaps.cartocdn.com/rastertiles/voyager/0/0/0.png'
    return () => { testImg.onerror = null }
  }, [useFallback])
  useEffect(() => {
    const handleTileError = () => { if (!useFallback) setUseFallback(true) }
    map.on('tileerror', handleTileError)
    return () => { map.off('tileerror', handleTileError) }
  }, [map, useFallback])
  return (
    <TileLayer
      attribution={useFallback ? OSM_ATTRIBUTION : CARTO_ATTRIBUTION}
      url={useFallback ? OSM_FALLBACK_URL : CARTO_VOYAGER_URL}
      subdomains={useFallback ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd']}
      maxZoom={20}
    />
  )
}

function MapResizeHandler() {
  const map = useMap()
  useEffect(() => {
    const handleResize = () => setTimeout(() => map.invalidateSize(), 100)
    window.addEventListener('resize', handleResize)
    const container = map.getContainer()
    const resizeObserver = new ResizeObserver(() => map.invalidateSize())
    resizeObserver.observe(container)
    map.invalidateSize()
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
    }
  }, [map])
  return null
}

function FitBoundsToLocations({ locations }: { locations: Location[] }) {
  const map = useMap()
  useEffect(() => {
    if (locations.length === 0) return
    if (locations.length === 1) {
      map.setView([locations[0].latitude, locations[0].longitude], 12)
      return
    }
    const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
  }, [map, locations])
  return null
}

function createLocationIcon() {
  const size = 32
  const color = '#c0dfa1'
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
        <div style="width:20px;height:20px;border-radius:50%;background-color:${color};border:3px solid white;position:relative;z-index:10;">
          <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:8px;height:8px;border-radius:50%;background-color:white;"></div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

const locationMarkerIcon = createLocationIcon()

interface BeneficiaryGroupDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  beneficiaryGroup: BeneficiaryGroup | null
  onEditClick?: (group: BeneficiaryGroup) => void
  onMetricClick?: (kpiId: string) => void
  onStoryClick?: (storyId: string) => void
  refreshKey?: number
  initiativeId?: string
  groupLocations?: Location[]
}

export default function BeneficiaryGroupDetailsModal({
  isOpen,
  onClose,
  beneficiaryGroup,
  onEditClick,
  onMetricClick,
  onStoryClick,
  refreshKey,
  initiativeId,
  groupLocations = [],
}: BeneficiaryGroupDetailsModalProps) {
  const [kpiUpdates, setKpiUpdates] = useState<KPIUpdate[]>([])
  const [evidence, setEvidence] = useState<Evidence[]>([])
  const [stories, setStories] = useState<Story[]>([])
  const [location, setLocation] = useState<Location | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && beneficiaryGroup?.id && initiativeId) {
      setLoading(true)
      Promise.all([
        apiService.getKPIUpdatesForBeneficiaryGroup(beneficiaryGroup.id),
        apiService.getStories(initiativeId, { beneficiaryGroupIds: [beneficiaryGroup.id] }),
        apiService.getEvidenceForBeneficiaryGroup(beneficiaryGroup.id),
      ])
        .then(([updates, storiesData, evidenceData]) => {
          setKpiUpdates(Array.isArray(updates) ? updates : [])
          setStories(Array.isArray(storiesData) ? storiesData : [])
          setEvidence(Array.isArray(evidenceData) ? evidenceData : [])
        })
        .catch((error) => {
          console.error('Failed to fetch beneficiary group data:', error)
          setKpiUpdates([])
          setEvidence([])
          setStories([])
        })
        .finally(() => setLoading(false))
    } else {
      setKpiUpdates([])
      setEvidence([])
      setStories([])
    }
  }, [isOpen, beneficiaryGroup?.id, refreshKey, initiativeId])

  useEffect(() => {
    if (!isOpen) {
      setLocation(null)
      return
    }
    if (groupLocations.length > 0) {
      setLocation(null)
      return
    }
    if (beneficiaryGroup?.location_id) {
      apiService.getLocation(beneficiaryGroup.location_id)
        .then(loc => setLocation(loc))
        .catch(() => setLocation(null))
    } else {
      setLocation(null)
    }
  }, [isOpen, beneficiaryGroup?.location_id, groupLocations.length])

  const mapLocations = useMemo(() => {
    if (groupLocations.length > 0) return groupLocations
    if (location) return [location]
    return []
  }, [groupLocations, location])

  const mapCenter = useMemo<[number, number]>(() => {
    if (mapLocations.length === 0) return [0, 0]
    const avgLat = mapLocations.reduce((s, l) => s + l.latitude, 0) / mapLocations.length
    const avgLng = mapLocations.reduce((s, l) => s + l.longitude, 0) / mapLocations.length
    return [avgLat, avgLng]
  }, [mapLocations])

  if (!isOpen || !beneficiaryGroup) return null

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

  const ageRange = beneficiaryGroup.age_range_start && beneficiaryGroup.age_range_end
    ? `${beneficiaryGroup.age_range_start}-${beneficiaryGroup.age_range_end}`
    : beneficiaryGroup.age_range_start
      ? `${beneficiaryGroup.age_range_start}+`
      : null

  return (
    <>
      <ModalFrame
        size="full"
        zIndexClass="z-[70]"
        panelClassName="bg-white rounded-xl border border-gray-200 w-full max-w-[1500px] h-[94vh] max-h-[94vh] overflow-hidden shadow-app-modal flex flex-col"
      >
        <ModalHeader
          icon={Users}
          title={beneficiaryGroup.name}
          subtitle={beneficiaryGroup.description || undefined}
          onClose={onClose}
          actions={onEditClick ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onEditClick(beneficiaryGroup)
              }}
              className="app-btn app-btn-secondary app-btn-sm"
            >
              <Edit className="w-4 h-4" />
              <span>Edit</span>
            </button>
          ) : undefined}
        />
        <div className="px-6 py-2 border-b border-gray-100 flex flex-wrap items-center gap-4 text-sm text-gray-500">
          {beneficiaryGroup.total_number != null && (
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>{beneficiaryGroup.total_number.toLocaleString()} beneficiaries</span>
            </div>
          )}
          {ageRange && (
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" />
              <span>Age: {ageRange}</span>
            </div>
          )}
          {beneficiaryGroup.created_at && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Created {formatDate(beneficiaryGroup.created_at)}</span>
            </div>
          )}
        </div>
        <ModalBody className="!py-3 !px-4 sm:!px-5 flex-1 min-h-0 overflow-hidden flex flex-col">
          {loading ? (
            <SectionLoader label="Loading beneficiary group data..." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 flex-1 min-h-0 h-full">
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
              <DetailColumn icon={MapPin} title="Location" count={mapLocations.length} flush>
                {mapLocations.length === 0 ? (
                  <div className="flex items-center justify-center h-full min-h-[200px]">
                    <div className="text-center py-8">
                      <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs text-gray-500">No location linked</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative w-full h-full min-h-[200px]">
                    <MapContainer
                      center={mapCenter}
                      zoom={2}
                      style={{ width: '100%', height: '100%' }}
                      className="leaflet-map-dashboard relative z-0"
                      zoomControl={false}
                      scrollWheelZoom
                    >
                      <TileLayerWithFallback />
                      <MapResizeHandler />
                      <FitBoundsToLocations locations={mapLocations} />
                      {mapLocations.map(loc => (
                        <Marker key={loc.id} position={[loc.latitude, loc.longitude]} icon={locationMarkerIcon}>
                          <Tooltip direction="top" offset={[0, -16]} permanent={mapLocations.length <= 3}>
                            <span className="text-xs font-medium">{loc.name}</span>
                            {loc.country && <span className="text-xs text-gray-500 ml-1">({loc.country})</span>}
                          </Tooltip>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                )}
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
            if (beneficiaryGroup?.id) {
              apiService.getEvidenceForBeneficiaryGroup(beneficiaryGroup.id)
                .then(data => setEvidence(Array.isArray(data) ? data : []))
            }
          }}
        />
      )}
    </>
  )
}
