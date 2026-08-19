import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Trash2, Plus } from 'lucide-react'
import { Location } from '../types'
import { apiService } from '../services/api'
import LocationMap from '../components/LocationMap'
import LocationModal from '../components/LocationModal'
import ConfirmDialog from '../components/ConfirmDialog'
import UpgradeModal from '../components/UpgradeModal'
import { useTeam } from '../context/TeamContext'
import { notify } from '../lib/notify'
import { PageHeader, PageLoader, EmptyState, SectionLoader } from '../components/ui'
import { LocationsHelp } from '../components/tracking/TrackingHelp'
import { fadeUp, easeOut } from '../components/timeline/motion'

export default function LocationsPage() {
  const navigate = useNavigate()
  const { canEditLocations, canDelete } = useTeam()
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await apiService.getOrgLocations()
      setLocations(data)
    } catch {
      notify.error('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return locations
    return locations.filter(l =>
      l.name.toLowerCase().includes(q) ||
      (l.country?.toLowerCase().includes(q) ?? false)
    )
  }, [locations, search])

  const handleCreate = async (data: Partial<Location>) => {
    try {
      await apiService.createLocation(data)
      notify.success('Location added')
      await load()
      setIsCreateOpen(false)
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'LOCATION_LIMIT_REACHED') {
        setIsCreateOpen(false)
        setShowUpgrade(true)
        return
      }
      throw error
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteLocation(id)
      notify.success('Location deleted')
      await load()
      setDeleteConfirmId(null)
    } catch {
      notify.error('Failed to delete location')
    }
  }

  const openInitiative = (loc: Location) => {
    const id = loc.initiative_id || loc.initiative_ids?.[0]
    if (id) navigate(`/programs/${id}?tab=location`)
  }

  const target = locations.find(l => l.id === deleteConfirmId)

  if (loading && locations.length === 0) return <PageLoader />

  return (
    <motion.div
      className="min-h-screen lg:h-screen lg:overflow-hidden pt-6 pb-6 px-4 sm:px-6 lg:px-8 flex flex-col"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: easeOut }}
    >
      <div className="max-w-[1600px] mx-auto w-full flex-1 min-h-0 flex flex-col">
        <PageHeader
          className="mb-4 flex-shrink-0"
          title="Locations"
          subtitle="Where the work happens, across every program."
          help={<LocationsHelp />}
          actions={canEditLocations ? (
            <button type="button" onClick={() => setIsCreateOpen(true)} className="app-btn app-btn-primary app-btn-sm">
              <Plus className="w-4 h-4" />
              Add location
            </button>
          ) : undefined}
        />

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 relative z-0 min-h-[280px] rounded-xl overflow-hidden border border-gray-200/80 shadow-card">
            <LocationMap
              locations={filtered}
              selectedLocationId={selectedId}
              onLocationClick={(loc) => setSelectedId(loc.id || null)}
              hideEmptyBanner
              autoFit
            />
          </div>

          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-4 app-card p-3 flex flex-col min-h-0">
            <div className="relative mb-3 flex-shrink-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search locations"
                className="app-input pl-10"
              />
            </div>
            <p className="app-section-title px-1 mb-2">{locations.length} location{locations.length === 1 ? '' : 's'}</p>
            <div className="flex-1 overflow-y-auto space-y-1 min-h-0 scrollbar-thin">
              {loading ? (
                <SectionLoader />
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={locations.length === 0 ? 'No locations yet' : 'No matches'}
                  description={locations.length === 0 ? 'Add a place so metrics and evidence can sit on the map.' : undefined}
                  action={locations.length === 0 && canEditLocations ? (
                    <button type="button" onClick={() => setIsCreateOpen(true)} className="app-btn app-btn-primary app-btn-sm">
                      Add location
                    </button>
                  ) : undefined}
                />
              ) : (
                filtered.map((loc) => (
                  <div
                    key={loc.id}
                    onClick={() => setSelectedId(loc.id || null)}
                    onDoubleClick={() => openInitiative(loc)}
                    className={`w-full text-left p-3 rounded-xl border transition-colors group cursor-pointer ${
                      selectedId === loc.id
                        ? 'border-primary-300 bg-primary-50'
                        : 'border-transparent hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-secondary-900 truncate">{loc.name}</p>
                        {loc.country && <p className="text-xs text-secondary-500 mt-0.5 truncate">{loc.country}</p>}
                        {(loc.initiative_ids?.length ?? 0) > 0 && (
                          <p className="text-[11px] text-secondary-400 mt-1">
                            {loc.initiative_ids!.length} program{loc.initiative_ids!.length === 1 ? '' : 's'}
                          </p>
                        )}
                      </div>
                      {canDelete && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteConfirmId(loc.id || null)
                          }}
                          className="p-1 text-gray-400 hover:text-red-500 rounded opacity-0 group-hover:opacity-100"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            {selectedId && (
              <button
                type="button"
                onClick={() => {
                  const loc = locations.find(l => l.id === selectedId)
                  if (loc) openInitiative(loc)
                }}
                className="app-btn app-btn-secondary app-btn-sm w-full mt-2 flex-shrink-0"
              >
                Open in program
              </button>
            )}
          </motion.div>
        </div>
      </div>

      <LocationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        initialLocation={null}
      />
      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        title="You've hit your location limit"
        subtitle="Upgrade to Growth or Pro to add more locations."
      />
      {deleteConfirmId && target && (
        <ConfirmDialog
          title="Delete location"
          message={`Permanently delete "${target.name}" from your organization? This removes it from every program that uses it.`}
          confirmLabel="Delete location"
          tone="danger"
          onConfirm={() => handleDelete(deleteConfirmId)}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </motion.div>
  )
}
