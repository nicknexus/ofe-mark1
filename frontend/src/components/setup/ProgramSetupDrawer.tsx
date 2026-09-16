import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BarChart3, MapPin, Users, Plus, Pencil, Trash2, Link2, Unlink, Tag as TagIcon, CheckCircle2, AlertCircle, Settings2 } from 'lucide-react'
import { getKPIColor } from '../metricsDashboard/metricColorPalette'
import { aggregateKpiUpdates } from '../../utils/kpiAggregation'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { BeneficiaryGroup, CreateKPIForm, KPI, KPIUpdate, Location, MetricTag, ProgramReadiness } from '../../types'
import { SectionLoader } from '../ui'
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
  const { canAddMetrics, canEditMetrics, canDelete, canEditLocations, canAddBeneficiaries, canEditBeneficiaries, canEditTags, activeOrganization } = useTeam()

  const [loading, setLoading] = useState(true)
  const [kpis, setKpis] = useState<KPI[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [groups, setGroups] = useState<BeneficiaryGroup[]>([])
  const [tags, setTags] = useState<MetricTag[]>([])
  const [readiness, setReadiness] = useState<ProgramReadiness | null>(null)
  const [updatesByKpi, setUpdatesByKpi] = useState<Record<string, KPIUpdate[]>>({})

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
      const [k, l, g, t, r, u] = await Promise.all([
        apiService.getKPIs(initiativeId),
        apiService.getLocations(initiativeId),
        apiService.getBeneficiaryGroups(initiativeId).catch(() => [] as BeneficiaryGroup[]),
        apiService.getMetricTags().catch(() => [] as MetricTag[]),
        apiService.getInitiativeReadiness(initiativeId).catch(() => null),
        apiService.getKPIUpdatesForInitiative(initiativeId).catch(() => ({} as Record<string, KPIUpdate[]>)),
      ])
      setKpis((k || []).filter(x => !x.archived_at))
      setLocations(l || [])
      setGroups(g || [])
      setTags(t || [])
      setReadiness(r)
      setUpdatesByKpi(u || {})
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
  const orgLogoUrl = activeOrganization?.logo_url

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Program setup">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 w-full max-w-2xl app-canvas shadow-app-modal border-l border-gray-200 flex flex-col animate-slide-in-right">
        {/* Header: branded identity + readiness at a glance */}
        <div className="flex-shrink-0 bg-white border-b border-gray-200/80">
          <div className="h-1 bg-gradient-to-r from-primary-500 via-primary-300 to-evidence-500" />
          <div className="px-5 pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-white ring-1 ring-gray-200/80 shadow-card flex items-center justify-center flex-shrink-0 overflow-hidden">
                <img
                  src={orgLogoUrl || '/Nexuslogo.png'}
                  alt=""
                  className="w-full h-full object-contain p-1"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Nexuslogo.png' }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary-900/70 leading-none mb-1 inline-flex items-center gap-1">
                  <Settings2 className="w-3 h-3" /> Program setup
                </p>
                <h2 className="text-xl font-semibold text-gray-900 tracking-tight truncate leading-tight">{initiativeTitle || 'Program'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">Metrics, tags, locations and groups. Everything a log needs to connect.</p>
              </div>
              <button type="button" onClick={onClose} aria-label="Close" className="app-btn app-btn-icon app-btn-ghost text-secondary-500 hover:text-secondary-900 flex-shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!(loading && kpis.length === 0) && (
              <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <ReadyChip icon={BarChart3} ok={kpis.length > 0} label={`${kpis.length} metric${kpis.length === 1 ? '' : 's'}`} missing="Add a metric" />
                <ReadyChip icon={MapPin} ok={locations.length > 0} label={`${locations.length} location${locations.length === 1 ? '' : 's'}`} missing="Add a location" />
                <ReadyChip icon={TagIcon} ok optional label={`${new Set(kpis.flatMap(k => k.tag_ids || [])).size} tag${new Set(kpis.flatMap(k => k.tag_ids || [])).size === 1 ? '' : 's'}`} />
                <ReadyChip icon={Users} ok optional label={`${groups.length} group${groups.length === 1 ? '' : 's'}`} />
                <span className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${ready ? 'bg-impact-50 text-impact-700 border border-impact-100' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                  {ready ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {ready ? 'Ready to log' : 'Not ready yet'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">
          {loading && kpis.length === 0 ? (
            <SectionLoader label="Loading setup" />
          ) : (
            <>
              {/* Metrics: the same tiles as the program's Metrics page */}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {kpis.map((kpi, index) => {
                    const kpiTags = (kpi.tag_ids || []).map(id => tagById.get(id)).filter(Boolean) as MetricTag[]
                    const editingTags = tagEditorKpi?.id === kpi.id
                    const color = getKPIColor(kpi.category, index)
                    const isPct = kpi.metric_type === 'percentage'
                    const total = aggregateKpiUpdates(updatesByKpi[kpi.id!] || [], kpi.metric_type)
                    return (
                      <div key={kpi.id} className={`app-tile p-4 group relative flex flex-col ${editingTags ? 'sm:col-span-2 border-primary-300/70' : ''}`}>
                        {/* Top-right: hover actions */}
                        <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
                          {canEditMetrics && (
                            <button type="button" onClick={() => setKpiModal({ mode: 'edit', kpi })} className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all" title="Edit metric">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button type="button" onClick={() => askDeleteKpi(kpi)} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all" title="Delete metric">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="flex items-start gap-2 pr-14 mb-3">
                          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
                          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={kpi.title}>{kpi.title}</p>
                        </div>
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                            {isPct ? `${Math.round(total)}%` : total.toLocaleString()}
                          </span>
                          {!isPct && kpi.unit_of_measurement && <span className="text-xs text-gray-400 truncate">{kpi.unit_of_measurement}</span>}
                          <span className="ml-auto text-[11px] text-gray-400 capitalize flex-shrink-0">{kpi.category}</span>
                        </div>

                        {/* Tags row: the thing people couldn't find before */}
                        <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                          {kpiTags.map(t => (
                            <TagChip
                              key={t.id}
                              name={t.name}
                              size="xs"
                              onRemove={canEditMetrics && canEditTags ? () => handleSetKpiTags(kpi, (kpi.tag_ids || []).filter(id => id !== t.id)) : undefined}
                            />
                          ))}
                          {kpiTags.length === 0 && !(canEditMetrics && canEditTags) && (
                            <span className="text-[11px] text-gray-400">No tags</span>
                          )}
                          {canEditMetrics && canEditTags && (
                            <button
                              type="button"
                              onClick={() => setTagEditorKpi(editingTags ? null : kpi)}
                              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] font-medium transition-colors ${editingTags ? 'border-primary-400 text-primary-800 bg-primary-50' : 'border-gray-300 text-gray-500 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/40'}`}
                            >
                              <TagIcon className="w-3 h-3" /> {kpiTags.length === 0 ? 'Add tags' : 'Edit tags'}
                            </button>
                          )}
                        </div>

                        {editingTags && (
                          <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3">
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
                    )
                  })}
                  {canAddMetrics && (
                    <AddTile onClick={() => setKpiModal({ mode: 'create' })} label={kpis.length === 0 ? 'Add your first metric' : 'New metric'} hint={kpis.length === 0 ? 'The first thing you want to track, like "Students trained".' : undefined} />
                  )}
                  {!canAddMetrics && kpis.length === 0 && (
                    <p className="text-sm text-gray-500 sm:col-span-2">No metrics yet.</p>
                  )}
                </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {locations.map(loc => (
                    <EntityTile
                      key={loc.id}
                      icon={MapPin}
                      title={loc.name}
                      subtitle={loc.country || loc.description || `${loc.latitude?.toFixed?.(3)}, ${loc.longitude?.toFixed?.(3)}`}
                      onEdit={canEditLocations ? () => setLocationModal({ location: loc }) : undefined}
                      onRemove={canEditLocations ? () => askUnlinkLocation(loc) : undefined}
                      removeIcon={Unlink}
                      removeTitle="Remove from program"
                    />
                  ))}
                  {canEditLocations && (
                    <AddTile onClick={() => setLocationPickerOpen(true)} label={locations.length === 0 ? 'Add a location' : 'Add location'} hint={locations.length === 0 ? 'Link one from your organization or create a new one.' : undefined} />
                  )}
                  {!canEditLocations && locations.length === 0 && (
                    <p className="text-sm text-gray-500 sm:col-span-2">No locations yet.</p>
                  )}
                </div>
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
                {groups.length === 0 && !canAddBeneficiaries ? (
                  <p className="text-sm text-gray-500">No groups. Skip this unless you report by who benefits.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groups.map(g => (
                      <EntityTile
                        key={g.id}
                        icon={Users}
                        title={g.name}
                        subtitle={[g.total_number != null ? `${g.total_number} people` : null, g.age_range_start != null ? `age ${g.age_range_start}${g.age_range_end != null ? `-${g.age_range_end}` : '+'}` : null].filter(Boolean).join(' · ') || g.description || 'No details'}
                        onEdit={canEditBeneficiaries ? () => setGroupModal({ group: g }) : undefined}
                        onRemove={canDelete ? () => askDeleteGroup(g) : undefined}
                        removeIcon={Trash2}
                        removeTitle="Delete group"
                      />
                    ))}
                    {canAddBeneficiaries && (
                      <AddTile onClick={() => setGroupModal({})} label={groups.length === 0 ? 'Add a group' : 'Add group'} hint={groups.length === 0 ? 'Optional. Skip unless you report by who benefits.' : undefined} muted />
                    )}
                  </div>
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
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="app-icon-tile-sm app-icon-tile-accent flex-shrink-0"><Icon className="w-4 h-4" /></span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-gray-900 tracking-tight flex items-center gap-2 leading-tight">
              {title}
              <span className="min-w-[1.25rem] px-1.5 py-px rounded-full bg-gray-200/80 text-[11px] font-semibold tabular-nums text-gray-600 text-center">{count}</span>
            </h3>
            {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  )
}

/** Location / group tile: same shell as the metric tiles, hover-only actions. */
function EntityTile({ icon: Icon, title, subtitle, onEdit, onRemove, removeIcon: RemoveIcon, removeTitle }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  onEdit?: () => void
  onRemove?: () => void
  removeIcon: React.ComponentType<{ className?: string }>
  removeTitle: string
}) {
  return (
    <div className="app-tile p-4 group relative flex items-center gap-3">
      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
        {onEdit && (
          <button type="button" onClick={onEdit} className="p-1 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
        {onRemove && (
          <button type="button" onClick={onRemove} className="p-1 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all" title={removeTitle}>
            <RemoveIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-900 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1 pr-12">
        <p className="text-sm font-medium text-gray-800 truncate">{title}</p>
        {subtitle && <p className="text-xs text-gray-400 truncate mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

/** Dashed "+ add" tile that sits in the same grid as the real tiles. */
function AddTile({ onClick, label, hint, muted }: { onClick: () => void; label: string; hint?: string; muted?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[4.5rem] rounded-2xl border border-dashed p-4 text-left flex items-center gap-3 transition-colors ${muted
        ? 'border-gray-200 text-gray-400 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/30'
        : 'border-gray-300 text-gray-500 hover:text-primary-800 hover:border-primary-300 hover:bg-primary-50/40'}`}
    >
      <span className="w-10 h-10 rounded-xl border border-dashed border-current/40 flex items-center justify-center flex-shrink-0">
        <Plus className="w-4 h-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs font-normal opacity-80 mt-0.5">{hint}</span>}
      </span>
    </button>
  )
}

/** Header readiness chip: quiet when present, amber when required and missing. */
function ReadyChip({ icon: Icon, ok, label, missing, optional }: {
  icon: React.ComponentType<{ className?: string }>
  ok: boolean
  label: string
  missing?: string
  optional?: boolean
}) {
  if (ok) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${optional ? 'text-gray-400' : 'text-gray-500'}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
      <AlertCircle className="w-3 h-3" /> {missing || label}
    </span>
  )
}
