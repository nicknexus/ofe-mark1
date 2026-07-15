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
import { Plus, GripVertical, ChevronDown, ChevronRight, Check, MapPin, Users, Tag as TagIcon, Filter, X } from 'lucide-react'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useTeam } from '../../context/TeamContext'
import { BeneficiaryGroup, Location, MetricTag, TimelineClaim, TimelineEvidence } from '../../types'
import { getLocalDateString } from '../../utils'
import { getKPIColor } from './metricColorPalette'
import { generateMetricsDashboardChartData } from './generateMetricsDashboardChartData'
import { filterDashboardKpiUpdates, computeFilteredTotals } from './filterDashboardKpiUpdates'
import { type TimeFrameKey } from '../expandableKpiCard/generateKpiChartData'
import { fadeUp, dropdownPop } from '../timeline/motion'
import LocationMap from '../LocationMap'
import DateRangePicker from '../DateRangePicker'
import UploadWizard from '../upload/UploadWizard'

const TIMEFRAMES: Array<{ key: TimeFrameKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: '1month', label: '1M' },
  { key: '6months', label: '6M' },
  { key: '1year', label: '1Y' },
  { key: '5years', label: '5Y' },
]

interface FilterOption { id: string; name: string; color?: string }

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

interface WizardData {
  tags: MetricTag[]
  beneficiaryGroups: BeneficiaryGroup[]
  existingClaims: TimelineClaim[]
  existingEvidence: TimelineEvidence[]
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
    <div ref={setNodeRef} style={style} className="h-full">
      <div onClick={onOpen} className="app-card-interactive p-4 cursor-pointer group relative h-full flex flex-col">
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
  const { canAddImpactClaims, canEditEvidence, canEditMetrics } = useTeam()
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

  // Add Log (header action) — lazily fetches what the wizard needs
  const [isAddLogOpen, setIsAddLogOpen] = useState(false)
  const [wizardData, setWizardData] = useState<WizardData | null>(null)

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

  const openAddLog = async () => {
    if (!wizardData) {
      try {
        const [timeline, tags, groups] = await Promise.all([
          apiService.getInitiativeTimeline(initiativeId),
          apiService.getMetricTags(),
          apiService.getBeneficiaryGroups(initiativeId),
        ])
        setWizardData({
          tags: tags || [],
          beneficiaryGroups: groups || [],
          existingClaims: timeline?.claims || [],
          existingEvidence: timeline?.evidence || [],
        })
      } catch {
        notify.error('Could not open the Add Log flow')
        return
      }
    }
    setIsAddLogOpen(true)
  }

  const canAddLog = canAddImpactClaims || canEditEvidence

  const metricOptions: FilterOption[] = orderedKPIs.map(k => ({ id: k.id, name: k.title, color: colorByKpi[k.id] }))

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 leading-tight tracking-tight">Metrics</h2>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
              What this initiative measures — open a metric to see its detail and logs
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canAddLog && (
              <button onClick={openAddLog} className="app-btn app-btn-secondary app-btn-lg flex-shrink-0">
                <Plus className="w-5 h-5" />
                <span>Add Log</span>
              </button>
            )}
            {onAddKPI && (
              <button onClick={onAddKPI} className="app-btn app-btn-primary app-btn-lg shadow-sm flex-shrink-0">
                <Plus className="w-5 h-5" />
                <span>Add metric</span>
              </button>
            )}
          </div>
        </div>

        {/* Master filter bar */}
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        {/* Metric cards — draggable, the focus */}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedKPIs.map(k => k.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {orderedKPIs.map(kpi => (
                <MetricCard
                  key={kpi.id}
                  kpi={kpi}
                  color={colorByKpi[kpi.id]}
                  total={filteredTotals[kpi.id] ?? 0}
                  canReorder={canEditMetrics}
                  onOpen={() => (onMetricDetailClick ? onMetricDetailClick(kpi.id) : openLogsForMetric(kpi.id))}
                />
              ))}
              {onAddKPI && (
                <button
                  onClick={onAddKPI}
                  className="min-h-[104px] rounded-xl border-2 border-dashed border-gray-200 hover:border-primary-400 hover:bg-primary-50/30 transition-colors flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-primary-700"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-xs font-medium">Add metric</span>
                </button>
              )}
            </div>
          </SortableContext>
        </DndContext>

        {/* Trend chart (3/4) + locations map (1/4) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-3 app-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-semibold text-gray-800">Metrics over time</h3>
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
            <div className="h-[320px]">
              {chartKpis.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-gray-400">
                  {kpis.length === 0 ? 'No metrics yet' : 'Select metrics to view'}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 30 }}>
                    <defs>
                      {chartKpis.map(kpi => (
                        <linearGradient key={kpi.id} id={`metrics-dash-gradient-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={colorByKpi[kpi.id]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={colorByKpi[kpi.id]} stopOpacity={0.05} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={50}
                      interval={chartData.length > 12 ? Math.floor(chartData.length / 12) : 0}
                    />
                    <YAxis
                      stroke="#9ca3af"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => {
                        if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
                        if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
                        return value.toString()
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        fontSize: '12px',
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
                        strokeWidth={2}
                        fill={`url(#metrics-dash-gradient-${kpi.id})`}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            {chartKpis.length > 0 && (
              <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-gray-100">
                {chartKpis.map(kpi => (
                  <button
                    key={kpi.id}
                    onClick={() => openLogsForMetric(kpi.id)}
                    className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                    title="View logs for this metric"
                  >
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorByKpi[kpi.id] }} />
                    {kpi.title}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Locations map */}
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="lg:col-span-1 app-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
              <h3 className="text-sm font-semibold text-gray-800">Locations</h3>
              {onOpenLocations && (
                <button onClick={onOpenLocations} className="text-xs font-medium text-primary-700 hover:text-primary-800">
                  Manage
                </button>
              )}
            </div>
            <div className="flex-1 min-h-[280px]">
              <LocationMap
                locations={mapLocations}
                autoFit
                flatTopCorners
                hideEmptyBanner
                initiativeId={initiativeId}
                onMetricClick={onMetricDetailClick}
                onStoryClick={onStoryClick}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Add Log — the guided wizard (claims, evidence, or both) */}
      {isAddLogOpen && wizardData && (
        <UploadWizard
          initiativeId={initiativeId}
          canCreateClaim={canAddImpactClaims}
          canCreateEvidence={canEditEvidence}
          kpis={kpis}
          locations={locations}
          tags={wizardData.tags}
          beneficiaryGroups={wizardData.beneficiaryGroups}
          existingClaims={wizardData.existingClaims}
          existingEvidence={wizardData.existingEvidence}
          onClose={() => setIsAddLogOpen(false)}
          onCreated={() => { setIsAddLogOpen(false); onRefresh?.() }}
        />
      )}
    </div>
  )
}
