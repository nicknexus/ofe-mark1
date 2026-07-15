import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPin,
  Users,
  Tag as TagIcon,
  BarChart3,
  UserCircle,
  FileText,
  ChevronDown,
  Check,
  X,
  LucideIcon,
} from 'lucide-react'
import { Location, BeneficiaryGroup, MetricTag, KPI, TimelineContributor } from '../../types'
import DateRangePicker from '../DateRangePicker'
import { getLocalDateString } from '../../utils'
import { TimelineFilters, TimelineView, hasActiveFilters } from '../../utils/timeline'
import { dropdownPop } from './motion'

interface FilterOption {
 id: string
 name: string
}

interface FilterPillProps {
 icon: LucideIcon
 label: string
 pluralLabel: string
 options: FilterOption[]
 selected: string[]
 onChange: (ids: string[]) => void
 emptyText: string
}

/**
 * One portal-dropdown multi-select pill (same visual pattern as
 * KPIFilterBar / EvidenceTab, extracted so the Timeline doesn't repeat the
 * dropdown markup per filter dimension).
 */
function FilterPill({ icon: Icon, label, pluralLabel, options, selected, onChange, emptyText }: FilterPillProps) {
 const [open, setOpen] = useState(false)
 const buttonRef = useRef<HTMLButtonElement>(null)
 const [position, setPosition] = useState({ top: 0, left: 0 })

 useEffect(() => {
 if (open && buttonRef.current) {
 const rect = buttonRef.current.getBoundingClientRect()
 setPosition({ top: rect.bottom + 4, left: rect.left })
 }
 }, [open])

 const active = selected.length > 0

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-2 h-9 px-3 rounded-full border text-sm font-medium transition-colors ${active
          ? 'border-primary-300 bg-primary-50 text-primary-800 hover:bg-primary-100'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${active ? 'text-primary-600' : 'text-gray-400'}`} />
        <span className="truncate max-w-[140px]">
          {selected.length === 0
            ? label
            : selected.length === 1
              ? options.find(o => o.id === selected[0])?.name || `1 ${label.toLowerCase()}`
              : `${selected.length} ${pluralLabel}`}
        </span>
        {active && selected.length > 1 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[11px] font-semibold">{selected.length}</span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 -mr-0.5 transition-transform ${active ? 'text-primary-500' : 'text-gray-400'} ${open ? 'rotate-180' : ''}`} />
      </button>

      {buttonRef.current && createPortal(
        <AnimatePresence>
          {open && (
          <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <motion.div
            initial={dropdownPop.initial}
            animate={dropdownPop.animate}
            exit={dropdownPop.exit}
            className="fixed bg-white border border-gray-200 rounded-xl shadow-modal z-[9999] p-2 min-w-[220px] max-h-72 overflow-y-auto"
            style={{ top: `${position.top}px`, left: `${position.left}px`, transformOrigin: 'top left' }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.length === 0 ? (
              <p className="text-xs text-gray-500 px-2 py-1.5">{emptyText}</p>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 pb-1.5 mb-1 border-b border-gray-100">
                  <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{pluralLabel}</span>
                  {active && (
                    <button onClick={(e) => { e.stopPropagation(); onChange([]) }} className="text-xs font-medium text-primary-700 hover:text-primary-800">Clear</button>
                  )}
                </div>
                {options.map(option => {
                  const checked = selected.includes(option.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => {
                        if (checked) onChange(selected.filter(id => id !== option.id))
                        else onChange([...selected, option.id])
                      }}
                      className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors ${checked ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                    >
                      <span className={`w-4 h-4 rounded flex items-center justify-center border flex-shrink-0 transition-colors ${checked ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'}`}>
                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                      <span className={`text-sm truncate flex-1 ${checked ? 'text-primary-800 font-medium' : 'text-gray-700'}`}>{option.name}</span>
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

const EVIDENCE_TYPE_OPTIONS: FilterOption[] = [
 { id: 'visual_proof', name: 'Visual Support' },
 { id: 'documentation', name: 'Documentation' },
 { id: 'testimony', name: 'Testimonies' },
 { id: 'financials', name: 'Financials' },
]

export interface TimelineFilterBarProps {
  view: TimelineView
  filters: TimelineFilters
  onFiltersChange: (filters: TimelineFilters) => void
  kpis: KPI[]
  /** Hide the Metric pill (used when the page is already scoped to one metric). */
  hideMetric?: boolean
  locations: Location[]
 beneficiaryGroups: BeneficiaryGroup[]
 tags: MetricTag[]
 contributors: Record<string, TimelineContributor>
}

/**
 * Shared filter row for all Timeline views. Fully controlled by the
 * URL-derived TimelineFilters value. Tag / beneficiary-group pills follow
 * the existing Free-tier behavior: hidden when the org has no options.
 */
export default function TimelineFilterBar({
  view,
  filters,
  onFiltersChange,
  kpis,
  hideMetric,
  locations,
  beneficiaryGroups,
  tags,
  contributors,
}: TimelineFilterBarProps) {
 const set = (patch: Partial<TimelineFilters>) => onFiltersChange({ ...filters, ...patch })

 const contributorOptions: FilterOption[] = Object.entries(contributors).map(([id, c]) => ({
 id,
 name: c.name || c.email || 'Unknown user',
 }))

 const activityDateValue = {
 startDate: filters.activityFrom || undefined,
 endDate: filters.activityTo || undefined,
 }
 const uploadDateValue = {
 startDate: filters.uploadFrom || undefined,
 endDate: filters.uploadTo || undefined,
 }

 const dateChange = (keys: ['activityFrom', 'activityTo'] | ['uploadFrom', 'uploadTo']) =>
 (value: { singleDate?: string; startDate?: string; endDate?: string }) => {
 const from = value.singleDate || value.startDate || null
 const to = value.singleDate || value.endDate || null
 set({ [keys[0]]: from, [keys[1]]: to } as Partial<TimelineFilters>)
 }

 return (
      <div className="flex flex-wrap items-center gap-2">
        <DateRangePicker
          value={activityDateValue}
          onChange={dateChange(['activityFrom', 'activityTo'])}
          maxDate={getLocalDateString(new Date())}
          placeholder="Activity date"
          variant="pill"
        />
        <DateRangePicker
          value={uploadDateValue}
          onChange={dateChange(['uploadFrom', 'uploadTo'])}
          maxDate={getLocalDateString(new Date())}
          placeholder="Upload date"
          variant="pill"
        />

        {!hideMetric && (
          <FilterPill
            icon={BarChart3}
            label="Metric"
            pluralLabel="metrics"
            options={kpis.map(k => ({ id: k.id!, name: k.title }))}
            selected={filters.metrics}
            onChange={(ids) => set({ metrics: ids })}
            emptyText="No metrics available"
          />
        )}
        <FilterPill
          icon={MapPin}
          label="Location"
          pluralLabel="locations"
 options={locations.map(l => ({ id: l.id!, name: l.name }))}
 selected={filters.locations}
 onChange={(ids) => set({ locations: ids })}
 emptyText="No locations available"
 />
 {tags.length > 0 && (
 <FilterPill
 icon={TagIcon}
 label="Tag"
 pluralLabel="tags"
 options={tags.map(t => ({ id: t.id, name: t.name }))}
 selected={filters.tags}
 onChange={(ids) => set({ tags: ids })}
 emptyText="No tags available"
 />
 )}
 {beneficiaryGroups.length > 0 && (
 <FilterPill
 icon={Users}
 label="Beneficiary Group"
 pluralLabel="groups"
 options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
 selected={filters.beneficiaryGroups}
 onChange={(ids) => set({ beneficiaryGroups: ids })}
 emptyText="No beneficiary groups available"
 />
 )}
 <FilterPill
 icon={UserCircle}
 label="Uploaded by"
 pluralLabel="contributors"
 options={contributorOptions}
 selected={filters.contributors}
 onChange={(ids) => set({ contributors: ids })}
 emptyText="No contributors yet"
 />
 {view === 'evidence' && (
 <FilterPill
 icon={FileText}
 label="Evidence type"
 pluralLabel="types"
 options={EVIDENCE_TYPE_OPTIONS}
 selected={filters.evidenceTypes}
 onChange={(ids) => set({ evidenceTypes: ids })}
 emptyText="No evidence types"
 />
 )}

 {hasActiveFilters(filters) && (
 <button
 onClick={() => onFiltersChange({
 ...filters,
 q: '',
 metrics: [],
 locations: [],
 beneficiaryGroups: [],
 tags: [],
 contributors: [],
 evidenceTypes: [],
 status: null,
 activityFrom: null,
 activityTo: null,
 uploadFrom: null,
 uploadTo: null,
 })}
          className="inline-flex items-center gap-1 h-9 px-3 rounded-full text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Clear all
        </button>
        )}
      </div>
  )
}
