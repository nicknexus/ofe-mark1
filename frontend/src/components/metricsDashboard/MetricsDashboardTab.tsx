import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Plus, GripVertical, ChevronDown, ChevronRight, Check, MapPin, Users, Tag as TagIcon, Filter, X, LayoutGrid, LineChart, BarChart3, TrendingUp, Link2, Unlink, FileText } from 'lucide-react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { BeneficiaryGroup, Location, MetricTag, TimelineStats } from '../../types'
import { getLocalDateString } from '../../utils'
import { getKPIColor } from './metricColorPalette'
import { generateMetricsDashboardChartData } from './generateMetricsDashboardChartData'
import { filterDashboardKpiUpdates, computeFilteredTotals } from './filterDashboardKpiUpdates'
import { type TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import { fadeUp, dropdownPop, staggerContainer, viewSwap } from '../timeline/motion'
import LocationMap from '../LocationMap'
import DateRangePicker from '../DateRangePicker'

const TIMEFRAMES: Array<{ key: TimeFrameKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: '1month', label: '1M' },
  { key: '6months', label: '6M' },
  { key: '1year', label: '1Y' },
  { key: '5years', label: '5Y' },
]

interface FilterOption { id: string; name: string; color?: string }

/** Fixed metric-card height so the grid reads as clean, even rows. */
const METRIC_CARD_H_CLASS = 'h-[112px]'

interface MetricsDashboardTabProps {
  initiativeId: string
  kpis: any[]
  kpiTotals: Record<string, number>
  kpiUpdates: any[]
  onAddKPI?: () => void
  onMetricDetailClick?: (kpiId: string) => void
  onOpenLocations?: () => void
  onStoryClick?: (storyId: string) => void
  onRefresh?: () => void
}

/** White pill + portal dropdown with animated open, matching the Logs filter bar. */
function FilterPill({
  icon: Icon,
  label,
  options,
  selected,
  onChange,
  emptyText,
  total,
}: {
  icon: typeof MapPin
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (ids: string[]) => void
  emptyText: string
  /** When set, the pill acts as a visibility toggle (active when some are hidden). */
  total?: number
}) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const isVisibility = typeof total === 'number'
  const active = isVisibility ? selected.length < total! : selected.length > 0
  const toggle = (id: string) =>
    selected.includes(id) ? onChange(selected.filter(x => x !== id)) : onChange([...selected, id])

  const openMenu = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 6, left: r.left })
    }
    setOpen(true)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`inline-flex items-center gap-2 h-9 pl-3 pr-2.5 rounded-full border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 ${active ? 'border-primary-300 bg-primary-50 text-primary-800' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
        <span>{label}</span>
        {active && (
          <span className="app-chip app-chip-accent text-[11px] px-1.5 py-0">{selected.length}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
              <motion.div
                initial={dropdownPop.initial}
                animate={dropdownPop.animate}
                exit={dropdownPop.exit}
                onClick={(e) => e.stopPropagation()}
                className="fixed z-[9999] w-56 app-card p-2 max-h-64 overflow-y-auto shadow-card-lg"
                style={{ top: pos.top, left: pos.left }}
              >
                {options.length === 0 ? (
                  <p className="text-xs text-gray-500 px-2 py-1.5">{emptyText}</p>
                ) : (
                  <>
                    <div className="flex items-center justify-between px-2 pb-1.5">
                      <span className="text-xs font-semibold text-gray-700">{label}</span>
                      {isVisibility ? (
                        <button
                          onClick={() => onChange(selected.length === total ? [] : options.map(o => o.id))}
                          className="text-xs text-primary-700 hover:text-primary-800"
                        >
                          {selected.length === total ? 'Deselect all' : 'Select all'}
                        </button>
                      ) : selected.length > 0 ? (
                        <button onClick={() => onChange([])} className="text-xs text-primary-700 hover:text-primary-800">
                          Clear
                        </button>
                      ) : null}
                    </div>
                    {options.map(o => {
                      const checked = selected.includes(o.id)
                      return (
                        <button
                          key={o.id}
                          onClick={() => toggle(o.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 text-left transition-colors"
                        >
                          <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-primary-500 border-primary-500' : 'border-gray-300'}`}>
                            {checked && <Check className="w-3 h-3 text-white" />}
                          </span>
                          {o.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: o.color }} />}
                          <span className="text-sm text-gray-700 truncate">{o.name}</span>
                        </button>
                      )
                    })}
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}

/**
 * Draggable metric card, kept deliberately simple: name, current value and
 * unit, plus a chevron as the "this opens" affordance. Everything else
 * (claim counts, evidence coverage) lives inside the metric detail.
 */
function MetricCard({
  kpi,
  color,
  total,
  canReorder,
  onOpen,
}: {
  kpi: any
  color: string
  total: number
  canReorder: boolean
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: kpi.id, disabled: !canReorder })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 30 : undefined,
  }
  const isPct = kpi.metric_type === 'percentage'

  return (
    <div ref={setNodeRef} style={style} className={METRIC_CARD_H_CLASS}>
      <div onClick={onOpen} className="bg-white rounded-2xl border border-gray-200/70 shadow-card hover:shadow-card-hover hover:border-primary-300/70 hover:-translate-y-0.5 transition-all duration-200 p-4 cursor-pointer group relative h-full flex flex-col">
        {/* Top-right: reorder handle (hover) + open indicator */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5">
          {canReorder && (
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              title="Drag to reorder"
              className="p-1 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-all"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all" />
        </div>

        <div className="flex items-start gap-2 pr-8 mb-3">
          <span className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: color }} />
          <p className="text-sm font-medium text-gray-800 leading-snug line-clamp-2" title={kpi.title}>
            {kpi.title}
          </p>
        </div>
        <div className="flex items-baseline gap-1.5 mt-auto">
          <span className="text-2xl font-semibold text-gray-900 tabular-nums">
            {isPct ? `${Math.round(total)}%` : total.toLocaleString()}
          </span>
          {!isPct && kpi.unit_of_measurement && (
            <span className="text-xs text-gray-400 truncate">{kpi.unit_of_measurement}</span>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Initiative Metrics page — the landing view and the initiative's
 * measurement overview: what is being tracked, what each metric currently
 * stands at, and where to create or open one. A drag-reorderable grid of
 * simple metric cards (name · value · unit, click to open), a master filter
 * bar (date · metrics · location · tag · groups) driving the cards, chart and
 * map, and a combined trend chart paired with a compact locations map.
 */
export default function MetricsDashboardTab({
  initiativeId,
  kpis,
  kpiUpdates,
  onAddKPI,
  onMetricDetailClick,
  onOpenLocations,
  onStoryClick,
  onRefresh,
}: MetricsDashboardTabProps) {
  const navigate = useNavigate()
  const { canEditMetrics } = useTeam()
  const [subView, setSubView] = useState<'metrics' | 'overview'>('metrics')
  const [timelineStats, setTimelineStats] = useState<TimelineStats | null>(null)
  const [isCumulative, setIsCumulative] = useState(true)
  const [timeFrame, setTimeFrame] = useState<TimeFrameKey>('all')

  // Reference data
  const [locations, setLocations] = useState<Location[]>([])
  const [beneficiaryGroups, setBeneficiaryGroups] = useState<BeneficiaryGroup[]>([])
  const [benGroupDerivedLocations, setBenGroupDerivedLocations] = useState<Record<string, string[]>>({})
  const [allTags, setAllTags] = useState<FilterOption[]>([])

  // Reorder
  const [orderedKPIs, setOrderedKPIs] = useState<any[]>([])

  // Chart line visibility + master filters
  const [visibleKPIs, setVisibleKPIs] = useState<string[]>([])
  const [datePickerValue, setDatePickerValue] = useState<{ singleDate?: string; startDate?: string; endDate?: string }>({})
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedBeneficiaryGroups, setSelectedBeneficiaryGroups] = useState<string[]>([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    const sorted = [...kpis].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
    setOrderedKPIs(sorted)
  }, [kpis])

  // Re-seed chart visibility only when the *set* of metrics changes (add/remove),
  // not on every kpis identity change (e.g. a reorder reload) — otherwise the
  // user's Metrics filter would reset.
  const kpiIdKey = useMemo(() => kpis.map(k => k.id).slice().sort().join(','), [kpis])
  useEffect(() => {
    setVisibleKPIs(kpis.map(k => k.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpiIdKey])

  useEffect(() => {
    if (!initiativeId) return
    apiService.getInitiativeTimeline(initiativeId)
      .then(t => setTimelineStats(t.stats))
      .catch(() => setTimelineStats(null))
  }, [initiativeId])

  useEffect(() => {
    if (!initiativeId) return
    apiService.getLocations(initiativeId).then(l => setLocations(l || [])).catch(() => setLocations([]))
    apiService.getMetricTags().then(t => setAllTags((t || []).map((x: any) => ({ id: x.id, name: x.name })))).catch(() => setAllTags([]))
    apiService.getBeneficiaryGroups(initiativeId)
      .then(groups => {
        setBeneficiaryGroups(groups || [])
        const groupIds = (groups || []).map(g => g.id!).filter(Boolean)
        if (groupIds.length > 0) {
          apiService.getBulkDerivedLocations(groupIds)
            .then(locs => setBenGroupDerivedLocations(locs || {}))
            .catch(() => setBenGroupDerivedLocations({}))
        }
      })
      .catch(() => setBeneficiaryGroups([]))
  }, [initiativeId])

  // beneficiary_group_ids come back on each update; used by the group filter.
  const updateBeneficiaryGroupsCache = useMemo(() => {
    const cache: Record<string, string[]> = {}
    for (const u of kpiUpdates) {
      if (u?.id) cache[u.id] = (u as any).beneficiary_group_ids || []
    }
    return cache
  }, [kpiUpdates])

  const colorByKpi = useMemo(() => {
    const map: Record<string, string> = {}
    kpis.forEach((kpi, index) => { map[kpi.id] = getKPIColor(kpi.category, index) })
    return map
  }, [kpis])

  const filteredUpdates = useMemo(() => filterDashboardKpiUpdates({
    kpiUpdates,
    datePickerValue,
    selectedLocations,
    selectedBeneficiaryGroups,
    selectedTags,
    updateBeneficiaryGroupsCache,
  }), [kpiUpdates, datePickerValue, selectedLocations, selectedBeneficiaryGroups, selectedTags, updateBeneficiaryGroupsCache])

  const filteredTotals = useMemo(() => computeFilteredTotals(filteredUpdates, kpis), [filteredUpdates, kpis])

  const visibleSet = useMemo(() => new Set(visibleKPIs), [visibleKPIs])

  const chartData = useMemo(() => generateMetricsDashboardChartData({
    filteredUpdates,
    filteredKPIs: kpis,
    kpis,
    visibleKPIs: visibleSet,
    datePickerValue,
    timeFrame,
    isCumulative,
    isPercentageMode: false,
  }), [filteredUpdates, kpis, visibleSet, datePickerValue, timeFrame, isCumulative])

  const chartKpis = useMemo(() => kpis.filter(k => visibleSet.has(k.id)), [kpis, visibleSet])

  const mapLocations = useMemo(() => {
    if (selectedBeneficiaryGroups.length > 0) {
      const ids = selectedBeneficiaryGroups.flatMap(bg => benGroupDerivedLocations[bg] || [])
      return locations.filter(l => ids.includes(l.id!))
    }
    if (selectedLocations.length > 0) return locations.filter(l => selectedLocations.includes(l.id!))
    return locations
  }, [locations, selectedLocations, selectedBeneficiaryGroups, benGroupDerivedLocations])

  const anyFilterActive =
    !!(datePickerValue.singleDate || datePickerValue.startDate || datePickerValue.endDate) ||
    selectedLocations.length > 0 || selectedTags.length > 0 || selectedBeneficiaryGroups.length > 0 ||
    visibleKPIs.length < kpis.length

  const clearAll = () => {
    setDatePickerValue({})
    setSelectedLocations([])
    setSelectedTags([])
    setSelectedBeneficiaryGroups([])
    setVisibleKPIs(kpis.map(k => k.id))
  }

  const openLogsForMetric = (kpiId: string) => {
    navigate(`/initiatives/${initiativeId}?tab=logs&metric=${kpiId}`)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEditMetrics) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedKPIs.findIndex(k => k.id === active.id)
    const newIndex = orderedKPIs.findIndex(k => k.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const previous = orderedKPIs
    const next = arrayMove(orderedKPIs, oldIndex, newIndex)
    setOrderedKPIs(next)
    try {
      await apiService.updateKPIOrder(next.map((k, i) => ({ id: k.id!, display_order: i })))
      // Reload the parent dashboard so its cached kpis (and every remount of
      // this tab) pick up the persisted order — this is what the public side
      // reads too, via display_order.
      onRefresh?.()
    } catch {
      notify.error('Failed to save order')
      setOrderedKPIs(previous)
    }
  }

  const metricOptions: FilterOption[] = orderedKPIs.map(k => ({ id: k.id, name: k.title, color: colorByKpi[k.id] }))

  return (
    <div className="h-full overflow-hidden bg-gray-50">
      <motion.div
        className="h-full flex flex-col gap-4 px-4 sm:px-6 lg:px-8 xl:px-10 py-5 max-w-[1800px] mx-auto w-full"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {/* Header — this page is where metrics get added and tracked */}
        <motion.div variants={fadeUp} className="flex-shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 leading-tight tracking-tight">Metrics</h2>
            <p className="text-sm text-gray-500 mt-1 hidden sm:block">
              Add and track what this initiative measures
            </p>
          </div>
          {onAddKPI && (
            <button
              onClick={onAddKPI}
              className="app-btn app-btn-primary shadow-sm flex-shrink-0 app-btn-sm md:h-12 md:px-6 md:text-base lg:h-14 lg:px-8 lg:text-[17px]"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5 lg:w-6 lg:h-6" />
              <span className="sm:hidden">Add</span>
              <span className="hidden sm:inline">Add metric</span>
            </button>
          )}
        </motion.div>

        {/* Master filter bar */}
        <motion.div variants={fadeUp} className="flex-shrink-0 flex flex-wrap items-center gap-2">
          <DateRangePicker
            value={datePickerValue}
            onChange={setDatePickerValue}
            maxDate={getLocalDateString(new Date())}
            placeholder="Date"
            variant="pill"
          />
          <FilterPill
            icon={Filter}
            label="Metrics"
            options={metricOptions}
            selected={visibleKPIs}
            onChange={setVisibleKPIs}
            emptyText="No metrics available"
            total={kpis.length}
          />
          <FilterPill
            icon={MapPin}
            label="Location"
            options={locations.map(l => ({ id: l.id!, name: l.name }))}
            selected={selectedLocations}
            onChange={setSelectedLocations}
            emptyText="No locations available"
          />
          {allTags.length > 0 && (
            <FilterPill
              icon={TagIcon}
              label="Tag"
              options={allTags}
              selected={selectedTags}
              onChange={setSelectedTags}
              emptyText="No tags available"
            />
          )}
          {beneficiaryGroups.length > 0 && (
            <FilterPill
              icon={Users}
              label="Groups"
              options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
              selected={selectedBeneficiaryGroups}
              onChange={setSelectedBeneficiaryGroups}
              emptyText="No beneficiary groups available"
            />
          )}
          {anyFilterActive && (
            <button
              onClick={clearAll}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}

          {/* Metrics ↔ Overview toggle */}
          <div className="ml-auto inline-flex items-center h-9 p-0.5 rounded-full bg-gray-100 border border-gray-200">
            {([
              { id: 'metrics', label: 'Metrics', icon: LayoutGrid },
              { id: 'overview', label: 'Overview', icon: LineChart },
            ] as const).map(v => {
              const active = subView === v.id
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSubView(v.id)}
                  className={`inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-sm font-medium transition-colors ${active ? 'bg-white text-gray-900 shadow-card' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  <v.icon className="w-4 h-4" />
                  {v.label}
                </button>
              )
            })}
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
        {subView === 'metrics' ? (
        <motion.section
          key="metrics-grid"
          className="flex-1 min-h-0 overflow-y-auto -mr-2 pr-2"
          initial={viewSwap.initial}
          animate={viewSwap.animate}
          exit={viewSwap.exit}
        >
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All metrics</h3>
            <span className="app-chip text-[11px] px-1.5 py-0 tabular-nums">{orderedKPIs.length}</span>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedKPIs.map(k => k.id)} strategy={rectSortingStrategy}>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {orderedKPIs.map(kpi => (
                <motion.div key={kpi.id} variants={fadeUp} className={METRIC_CARD_H_CLASS}>
                <MetricCard
                  kpi={kpi}
                  color={colorByKpi[kpi.id]}
                  total={filteredTotals[kpi.id] ?? 0}
                  canReorder={canEditMetrics}
                  onOpen={() => (onMetricDetailClick ? onMetricDetailClick(kpi.id) : openLogsForMetric(kpi.id))}
                />
                </motion.div>
              ))}
              {onAddKPI && (
                <motion.div variants={fadeUp} className={METRIC_CARD_H_CLASS}>
                <button
                  type="button"
                  onClick={onAddKPI}
                  className="w-full h-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-primary-700"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-medium">Add metric</span>
                </button>
                </motion.div>
              )}
            </motion.div>
          </SortableContext>
          </DndContext>
        </motion.section>
        ) : (
        <motion.div
          key="metrics-overview"
          className="flex-1 min-h-0 flex flex-col gap-4"
          initial={viewSwap.initial}
          animate={viewSwap.animate}
          exit={viewSwap.exit}
        >
        {/* Overview stats */}
        <motion.section
          className="flex-shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {[
            { key: 'metrics', label: 'Metrics', value: kpis.length, icon: BarChart3, accent: 'text-primary-600', tint: 'bg-primary-50' },
            { key: 'claims', label: 'Claims', value: timelineStats?.claims_total ?? 0, icon: TrendingUp, accent: 'text-primary-600', tint: 'bg-primary-50' },
            { key: 'evidence', label: 'Evidence', value: timelineStats?.evidence_total ?? 0, icon: FileText, accent: 'text-evidence-600', tint: 'bg-evidence-50' },
            { key: 'connected', label: 'Connected', value: timelineStats?.connected ?? 0, icon: Link2, accent: 'text-impact-600', tint: 'bg-impact-50' },
            { key: 'unconnected', label: 'Unconnected', value: timelineStats?.not_connected ?? 0, icon: Unlink, accent: 'text-red-500', tint: 'bg-red-50' },
          ].map(s => (
            <motion.div key={s.key} variants={fadeUp} className="rounded-2xl bg-white border border-gray-200/60 shadow-card p-4 flex items-center gap-3">
              <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${s.tint}`}>
                <s.icon className={`w-4 h-4 ${s.accent}`} />
              </span>
              <div className="min-w-0">
                <p className="text-xl font-semibold text-gray-900 tabular-nums leading-none">{s.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1 truncate">{s.label}</p>
              </div>
            </motion.div>
          ))}
        </motion.section>

        {/* Insights — trends and places, filling the rest of the locked page */}
        <section className="flex-1 min-h-0 flex flex-col">
          <motion.div
            className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
          <motion.div variants={fadeUp} className="lg:col-span-2 min-h-0 flex flex-col rounded-3xl bg-gradient-to-b from-white to-primary-50/20 border border-gray-200/60 shadow-card p-5 sm:p-6">
            <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-800">Metrics over time</h3>
                <p className="text-xs text-gray-400 mt-0.5">Progress across every metric you track</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
                  {(['Monthly', 'Cumulative'] as const).map(mode => {
                    const active = (mode === 'Cumulative') === isCumulative
                    return (
                      <button
                        key={mode}
                        onClick={() => setIsCumulative(mode === 'Cumulative')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${active ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'}`}
                      >
                        {mode}
                      </button>
                    )
                  })}
                </div>
                <div className="hidden sm:flex items-center bg-gray-100 rounded-xl p-0.5 border border-gray-200">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf.key}
                      onClick={() => setTimeFrame(tf.key)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${timeFrame === tf.key ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {chartKpis.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <span className="w-14 h-14 rounded-2xl bg-primary-50 flex items-center justify-center">
                    <LineChart className="w-7 h-7 text-primary-400" />
                  </span>
                  <p className="text-sm text-gray-500 max-w-xs">
                    {kpis.length === 0 ? 'Add a metric to start seeing your progress here' : 'Select metrics above to see them trend over time'}
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 12, right: 16, left: 4, bottom: 8 }}>
                    <defs>
                      {chartKpis.map(kpi => (
                        <linearGradient key={kpi.id} id={`metrics-dash-gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colorByKpi[kpi.id]} stopOpacity={0.18} />
                          <stop offset="95%" stopColor={colorByKpi[kpi.id]} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="4 6" stroke="#eef1f5" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      minTickGap={28}
                      padding={{ left: 12, right: 12 }}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                        return value.toString()
                      }}
                    />
                    <Tooltip
                      cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '14px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        fontSize: '12px',
                        padding: '10px 12px',
                      }}
                      formatter={(value: any, name: any) => {
                        const kpi = kpis.find(k => k.id === name)
                        const num = typeof value === 'number' ? value.toLocaleString() : value
                        return [`${num}${kpi?.unit_of_measurement ? ` ${kpi.unit_of_measurement}` : ''}`, kpi?.title || name]
                      }}
                    />
                    {chartKpis.map(kpi => (
                      <Area
                        key={kpi.id}
                        type="monotone"
                        dataKey={kpi.id}
                        stroke={colorByKpi[kpi.id]}
                        strokeWidth={2.5}
                        fill={`url(#metrics-dash-gradient-${kpi.id})`}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {chartKpis.length > 0 && (
              <div className="flex-shrink-0 flex flex-wrap justify-center gap-2 mt-4 pt-4 border-t border-gray-100 max-h-[72px] overflow-y-auto">
                {chartKpis.map(kpi => (
                  <button
                    key={kpi.id}
                    onClick={() => openLogsForMetric(kpi.id)}
                    className="inline-flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-gray-50 border border-gray-200/70 text-xs font-medium text-gray-600 hover:bg-white hover:border-gray-300 hover:text-gray-900 transition-colors"
                    title="View logs for this metric"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorByKpi[kpi.id] }} />
                    {kpi.title}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Locations map — chrome-less, just a rounded map for a modern feel */}
          {/* `isolate` keeps the map's internal z-indexes (Leaflet panes + the
              overlay pills) inside this frame so they never bleed through
              modals or full-screen overlays. */}
          <motion.div variants={fadeUp} className="lg:col-span-1 relative isolate min-h-[240px] rounded-3xl overflow-hidden border border-gray-200/60 shadow-card">
            <LocationMap
              locations={mapLocations}
              autoFit
              hideEmptyBanner
              initiativeId={initiativeId}
              onMetricClick={onMetricDetailClick}
              onStoryClick={onStoryClick}
            />
            {onOpenLocations && (
              <button
                onClick={onOpenLocations}
                className="absolute top-3 right-3 z-[400] inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-white/90 backdrop-blur border border-gray-200 shadow-sm text-xs font-medium text-gray-700 hover:bg-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5 text-primary-600" />
                Manage
              </button>
            )}
          </motion.div>
          </motion.div>
        </section>
        </motion.div>
        )}
        </AnimatePresence>
      </motion.div>

    </div>
  )
}
