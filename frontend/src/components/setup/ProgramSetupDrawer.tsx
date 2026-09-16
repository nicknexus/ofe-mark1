import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BarChart3, MapPin, Users, Plus, Pencil, Trash2, Link2, Unlink, Tag as TagIcon, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { BeneficiaryGroup, CreateKPIForm, KPI, Location, MetricTag, ProgramReadiness } from '../../types'
import { SectionLoader, EmptyState, InlineAlert } from '../ui'
import CreateKPIModal from '../CreateKPIModal'
import AddLocationPickerModal from '../AddLocationPickerModal'
import LocationModal from '../LocationModal'
import { CreateGroupModal } from '../BeneficiaryManager'
import TagPicker from '../MetricTags/TagPicker'
import TagChip from '../MetricTags/TagChip'
import ConfirmDialog from '../ConfirmDialog'

interface ProgramSetupDrawerProps {
  initiativeId: string
  initiativeTitle?: string
  isOpen: boolean
  onClose: () => void
  /** Fired after any structural change so the parent can refresh counts. */
  onChanged?: () => void
}

/**
 * One place to set a program up: metrics (with their tags inline),
 * locations and beneficiary groups. Reachable from the dashboard card and
 * the program header so nobody has to hunt through tabs to find where a
 * tag or location gets added.
 *
 * Composes the existing create/edit modals rather than re-implementing
 * forms, so validation, plan gates and permissions behave exactly as
 * they do elsewhere.
 */
export default function ProgramSetupDrawer({ initiativeId, initiativeTitle, isOpen, onClose, onChanged }: ProgramSetupDrawerProps) {
  const { canAddMetrics, canEditMetrics, canDelete, canEditLocations, canAddBeneficiaries, canEditBeneficiaries, canEditTags } = useTeam()

  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<KPI[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
  const [tags, setTags] = useState<MetricTag[]>([])
  const [readiness, setReadiness] = useState<ProgramReadiness | null>(null)

  // Modals
  const [kpiModal, setKpiModal] = useState<{ mode: 'create' } | { mode: 'edit'; kpi: KPI } | null>(null)
  const [tagEditorKpi, setTagEditorKpi] = useState<KPI | null>(null)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [locationModal, setLocationModal] = useState<{ location?: Location } | null>(null)
  const [groupModal, setGroupModal] = useState<{ group?: BeneficiaryGroup } | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; message: string; tone?: 'danger' | 'default'; confirmLabel?: string; onConfirm: () => Promise<void> } | null>(null)

  const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [k, l, g, t, r] = await Promise.all([
        apiService.getKPIs(initiativeId),
        apiService.getLocations(initiativeId),
        apiService.getBeneficiaryGroups(initiativeId).catch(() => [] as BeneficiaryGroup[]),
        apiService.getMetricTags().catch(() => [] as MetricTag[]),
        apiService.getInitiativeReadiness(initiativeId).catch(() => null),
      ])
      setKpis((k || []).filter(x => !x.archived_at))
      setLocations(l || [])
      setGroups(g || [])
      setTags(t || [])
      setReadiness(r)
    } catch (e) {
      notify.error((e as Error).message || 'Could not load program setup')
    } finally {
      setLoading(false)
    }
  }, [initiativeId])

  useEffect(() => {
    if (isOpen) load()
  }, [isOpen, load])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [isOpen, onClose])

  const changed = useCallback(async () => {
    apiService.clearCache('/kpis')
    apiService.clearCache('/locations')
    apiService.clearCache('/beneficiaries')
    apiService.clearCache(`/initiatives/${initiativeId}`)
    await load()
    onChanged?.()
  }, [initiativeId, load, onChanged])

  // ── Metrics ──────────────────────────────────────────────────────────

  const handleCreateKpi = async (data: CreateKPIForm) => {
    await apiService.createKPI({ ...data, initiative_id: initiativeId })
    notify.success('Metric added')
    await changed()
  }

  const handleEditKpi = async (data: CreateKPIForm) => {
    if (kpiModal?.mode !== 'edit' || !kpiModal.kpi.id) return
    await apiService.updateKPI(kpiModal.kpi.id, data)
    notify.success('Metric updated')
    await changed()
  }

  const handleSetKpiTags = async (kpi: KPI, tagIds: string[]) => {
    if (!kpi.id) return
    // Optimistic: reflect immediately, then persist.
    setKpis(prev => prev.map(k => (k.id === kpi.id ? { ...k, tag_ids: tagIds } : k)))
    try {
      await apiService.updateKPI(kpi.id, { tag_ids: tagIds } as Partial<CreateKPIForm>)
      apiService.clearCache('/kpis')
      onChanged?.()
    } catch (e) {
      notify.error((e as Error).message || 'Could not update tags')
      await load()
    }
  }

  const askDeleteKpi = (kpi: KPI) => setConfirm({
    title: 'Delete metric',
    message: `Delete "${kpi.title}" from this program? Its impact claims and their evidence connections will be removed.`,
    tone: 'danger',
    confirmLabel: 'Delete metric',
    onConfirm: async () => {
      await apiService.deleteKPI(kpi.id!)
      notify.success('Metric deleted')
      await changed()
    },
  })

  // ── Locations ────────────────────────────────────────────────────────

  const handleCreateLocation = async (data: Partial<Location>) => {
    try {
      await apiService.createLocation({ ...data, initiative_id: initiativeId })
      notify.success('Location added')
      setLocationModal(null)
      await changed()
    } catch (e: any) {
      if (e?.code === 'LOCATION_LIMIT_REACHED') {
        notify.error('Location limit reached on your plan.')
        setLocationModal(null)
        return
      }
      throw e
    }
  }

  const handleUpdateLocation = async (data: Partial<Location>) => {
    const loc = locationModal?.location
    if (!loc?.id) return
    await apiService.updateLocation(loc.id, data)
    notify.success('Location updated')
    setLocationModal(null)
    await changed()
  }

  const askUnlinkLocation = (loc: Location) => setConfirm({
    title: 'Remove location from program',
    message: `Remove "${loc.name}" from this program? The location itself stays in your organization.`,
    confirmLabel: 'Remove',
    onConfirm: async () => {
      await apiService.unlinkLocationFromInitiative(loc.id!, initiativeId)
      notify.success('Removed from this program')
      await changed()
    },
  })

  // ── Groups ───────────────────────────────────────────────────────────

  const handleSaveGroup = async (data: any) => {
    if (groupModal?.group?.id) {
      await apiService.updateBeneficiaryGroup(groupModal.group.id, data)
      notify.success('Group updated')
    } else {
      await apiService.createBeneficiaryGroup({ ...data, initiative_id: initiativeId })
      notify.success('Group added')
    }
    await changed()
  }

  const askDeleteGroup = (g: BeneficiaryGroup) => setConfirm({
    title: 'Delete beneficiary group',
    message: `Delete "${g.name}"? Claims and evidence scoped to it will lose that scope.`,
    tone: 'danger',
    confirmLabel: 'Delete group',
    onConfirm: async () => {
      await apiService.deleteBeneficiaryGroup(g.id!)
      notify.success('Group deleted')
      await changed()
    },
  })

  if (!isOpen) return null

  const ready = readiness?.ready ?? (kpis.length > 0 && locations.length > 0)

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Program setup">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-2xl bg-white shadow-app-modal border-l border-gray-200 flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="flex items-start gap-3 min-w-0">
            <div className="app-icon-tile app-icon-tile-accent mt-0.5"><Settings2 className="w-5 h-5" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">Program setup</h2>
              {initiativeTitle && <p className="text-sm text-gray-500 truncate">{initiativeTitle}</p>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="app-btn-icon rounded-lg text-secondary-500 hover:bg-gray-100 hover:text-secondary-900 transition-colors flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {loading && kpis.length === 0 ? (
            <SectionLoader label="Loading setup" />
          ) : (
            <>
              {/* Readiness */}
              <InlineAlert tone={ready ? 'success' : 'warning'}>
                <span className="inline-flex items-start gap-2">
                  {ready ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                  <span>
                    {ready
                      ? 'Ready to log. Claims and evidence connect automatically when their metric, location and dates match.'
                      : kpis.length === 0 && locations.length === 0
                        ? 'Add at least one metric and one location before logging.'
                        : kpis.length === 0
                          ? 'Add at least one metric before logging.'
                          : 'Add at least one location before logging. Claims need a location and evidence connects by location.'}
                  </span>
                </span>
              </InlineAlert>

              {/* Metrics */}
              <Section
                icon={BarChart3}
                title="Metrics"
                count={kpis.length}
                hint="What you measure. Tags split a metric into breakdowns like Grade 1, Grade 2."
                action={canAddMetrics ? (
                  <button type="button" onClick={() => setKpiModal({ mode: 'create' })} className="app-btn app-btn-primary app-btn-sm">
                    <Plus className="w-4 h-4" /> Add metric
                  </button>
                ) : undefined}
              >
                {kpis.length === 0 ? (
                  <EmptyState title="No metrics yet" description="Add the first thing you want to track." />
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {kpis.map(kpi => {
                      const kpiTags = (kpi.tag_ids || []).map(id => tagById.get(id)).filter(Boolean) as MetricTag[]
                      const editingTags = tagEditorKpi?.id === kpi.id
                      return (
                        <li key={kpi.id} className="px-4 py-3 bg-white">
                          <div className="flex items-start gap-3">
                            <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0 mt-0.5"><BarChart3 className="w-4 h-4" /></div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{kpi.title}</p>
                              <p className="text-xs text-gray-500 truncate capitalize">{kpi.category} · {kpi.unit_of_measurement}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                {kpiTags.map(t => (
                                  <TagChip
                                    key={t.id}
                                    name={t.name}
                                    size="xs"
                                    onRemove={canEditMetrics && canEditTags ? () => handleSetKpiTags(kpi, (kpi.tag_ids || []).filter(id => id !== t.id)) : undefined}
                                  />
                                ))}
                                {canEditMetrics && canEditTags && (
                                  <button
                                    type="button"
                                    onClick={() => setTagEditorKpi(editingTags ? null : kpi)}
                                    className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs font-medium transition-colors ${editingTags ? 'border-primary-400 text-primary-700 bg-primary-50' : 'border-gray-300 text-gray-500 hover:text-primary-700 hover:border-primary-300'}`}
                                  >
                                    <TagIcon className="w-3 h-3" /> {kpiTags.length === 0 ? 'Add tags' : 'Edit tags'}
                                  </button>
                                )}
                              </div>
                              {editingTags && (
                                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                                  <TagPicker
                                    mode="multi"
                                    selectedIds={kpi.tag_ids || []}
                                    onChange={(ids) => handleSetKpiTags(kpi, ids)}
                                    label="Tags on this metric"
                                    helperText="Claims on this metric can use these tags. Evidence carrying a tag supports claims with that tag and any untagged claims."
                                  />
                                  <div className="mt-2 text-right">
                                    <button type="button" onClick={() => setTagEditorKpi(null)} className="app-btn app-btn-ghost app-btn-sm">Done</button>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              {canEditMetrics && (
                                <button type="button" onClick={() => setKpiModal({ mode: 'edit', kpi })} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-gray-700" title="Edit metric">
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button type="button" onClick={() => askDeleteKpi(kpi)} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-red-600" title="Delete metric">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Section>

              {/* Locations */}
              <Section
                icon={MapPin}
                title="Locations"
                count={locations.length}
                hint="Where the work happens. Every claim needs one; evidence connects to claims at the same location."
                action={canEditLocations ? (
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setLocationPickerOpen(true)} className="app-btn app-btn-secondary app-btn-sm">
                      <Link2 className="w-4 h-4" /> Link existing
                    </button>
                    <button type="button" onClick={() => setLocationModal({})} className="app-btn app-btn-primary app-btn-sm">
                      <Plus className="w-4 h-4" /> New
                    </button>
                  </div>
                ) : undefined}
              >
                {locations.length === 0 ? (
                  <EmptyState title="No locations yet" description="Link one from your organization or create a new one." />
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {locations.map(loc => (
                      <li key={loc.id} className="px-4 py-3 bg-white flex items-center gap-3">
                        <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><MapPin className="w-4 h-4" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{loc.name}</p>
                          <p className="text-xs text-gray-500 truncate">{loc.country || loc.description || `${loc.latitude?.toFixed?.(3)}, ${loc.longitude?.toFixed?.(3)}`}</p>
                        </div>
                        {canEditLocations && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button type="button" onClick={() => setLocationModal({ location: loc })} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-gray-700" title="Edit location">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => askUnlinkLocation(loc)} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-red-600" title="Remove from program">
                              <Unlink className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              {/* Groups */}
              <Section
                icon={Users}
                title="Beneficiary groups"
                count={groups.length}
                hint="Optional. Who the program serves. Scoped claims only connect to evidence with a matching group."
                action={canAddBeneficiaries ? (
                  <button type="button" onClick={() => setGroupModal({})} className="app-btn app-btn-secondary app-btn-sm">
                    <Plus className="w-4 h-4" /> Add group
                  </button>
                ) : undefined}
              >
                {groups.length === 0 ? (
                  <p className="text-sm text-gray-500 px-1">No groups. Skip this unless you report by who benefits.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {groups.map(g => (
                      <li key={g.id} className="px-4 py-3 bg-white flex items-center gap-3">
                        <div className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><Users className="w-4 h-4" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{g.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {[g.total_number != null ? `${g.total_number} people` : null, g.age_range_start != null ? `age ${g.age_range_start}${g.age_range_end != null ? `-${g.age_range_end}` : '+'}` : null].filter(Boolean).join(' · ') || g.description || 'No details'}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {canEditBeneficiaries && (
                            <button type="button" onClick={() => setGroupModal({ group: g })} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-gray-700" title="Edit group">
                              <Pencil className="w-4 h-4" />
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => askDeleteGroup(g)} className="app-btn app-btn-icon app-btn-ghost text-gray-400 hover:text-red-600" title="Delete group">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>

      {/* Modals (rendered above the drawer) */}
      {kpiModal && (
        <CreateKPIModal
          isOpen
          onClose={() => setKpiModal(null)}
          onSubmit={kpiModal.mode === 'create' ? handleCreateKpi : handleEditKpi}
          initiativeId={initiativeId}
          editData={kpiModal.mode === 'edit' ? kpiModal.kpi : undefined}
          onAttached={changed}
        />
      )}
      {locationPickerOpen && (
        <AddLocationPickerModal
          isOpen
          onClose={() => setLocationPickerOpen(false)}
          initiativeId={initiativeId}
          excludeIds={locations.map(l => l.id!).filter(Boolean)}
          onCreateNew={() => { setLocationPickerOpen(false); setLocationModal({}) }}
          onLinked={async () => { setLocationPickerOpen(false); await changed() }}
        />
      )}
      {locationModal && (
        <LocationModal
          isOpen
          onClose={() => setLocationModal(null)}
          onSubmit={locationModal.location ? handleUpdateLocation : handleCreateLocation}
          initialLocation={locationModal.location || null}
          initiativeId={initiativeId}
        />
      )}
      {groupModal && (
        <CreateGroupModal
          isOpen
          onClose={() => setGroupModal(null)}
          onSubmit={handleSaveGroup}
          editData={groupModal.group || null}
          initiativeId={initiativeId}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          tone={confirm.tone}
          confirmLabel={confirm.confirmLabel}
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const c = confirm
            setConfirm(null)
            try { await c.onConfirm() } catch (e) { notify.error((e as Error).message || 'Something went wrong') }
          }}
        />
      )}
    </div>,
    document.body
  )
}

function Section({ icon: Icon, title, count, hint, action, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count: number
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Icon className="w-4 h-4 text-primary-700" />
            {title}
            <span className="text-xs font-medium text-gray-400">{count}</span>
          </h3>
          {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}
