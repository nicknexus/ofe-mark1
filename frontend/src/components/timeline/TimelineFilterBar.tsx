import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
 Search,
 MapPin,
 Users,
 Tag as TagIcon,
 BarChart3,
 UserCircle,
 FileText,
 ChevronDown,
 LucideIcon,
} from 'lucide-react'
import { Location, BeneficiaryGroup, MetricTag, KPI, TimelineContributor } from '../../types'
import DateRangePicker from '../DateRangePicker'
import { getLocalDateString } from '../../utils'
import { TimelineFilters, TimelineView, hasActiveFilters } from '../../utils/timeline'

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
 className={`flex items-center pl-0 pr-4 h-10 rounded-r-full rounded-l-full text-sm font-medium transition-all duration-200 border-2 border-l-0 ${active
 ? 'bg-primary-50 border-primary-500 hover:bg-primary-100 text-gray-700'
 : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'
 }`}
 >
 <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 ${active
 ? 'bg-primary-100 border-primary-500'
 : 'bg-gray-100 border-gray-200'
 }`}>
 <Icon className={`w-5 h-5 ${active ? 'text-primary-500' : 'text-gray-600'}`} />
 </div>
 <span className="ml-3">
 {selected.length === 0
 ? label
 : selected.length === 1
 ? options.find(o => o.id === selected[0])?.name || `1 ${label.toLowerCase()}`
 : `${selected.length} ${pluralLabel}`}
 </span>
 {active && (
 <span className="ml-1 app-chip app-chip-accent text-xs px-1.5 py-0">{selected.length}</span>
 )}
 <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
 </button>

 {open && buttonRef.current && createPortal(
 <>
 <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
 <div
 className="fixed bg-white border border-gray-100 rounded-xl shadow-modal z-[9999] p-3 min-w-[200px] max-h-64 overflow-y-auto"
 style={{ top: `${position.top}px`, left: `${position.left}px` }}
 onClick={(e) => e.stopPropagation()}
 >
 {options.length === 0 ? (
 <p className="text-xs text-gray-500">{emptyText}</p>
 ) : (
 <>
 <div className="flex items-center justify-between mb-2">
 <span className="text-xs font-semibold text-gray-700">Select {pluralLabel}</span>
 {active && (
 <button onClick={(e) => { e.stopPropagation(); onChange([]) }} className="text-xs text-primary-700 hover:text-primary-800">Clear</button>
 )}
 </div>
 {options.map(option => (
 <label key={option.id} className="flex items-center space-x-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer">
 <input
 type="checkbox"
 checked={selected.includes(option.id)}
 onChange={(e) => {
 if (e.target.checked) onChange([...selected, option.id])
 else onChange(selected.filter(id => id !== option.id))
 }}
 className="w-3 h-3 text-primary-500 border-gray-300 rounded focus:ring-primary-500"
 />
 <span className="text-xs text-gray-700 truncate flex-1">{option.name}</span>
 </label>
 ))}
 </>
 )}
 </div>
 </>,
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
 <div className="space-y-3">
 {/* Search */}
 <div className="relative hidden md:block">
 <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
 <input
 type="text"
 value={filters.q}
 onChange={(e) => set({ q: e.target.value })}
 placeholder="Search claims and evidence..."
 className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 />
 </div>

 <div className="flex flex-wrap items-center gap-2">
 <DateRangePicker
 value={activityDateValue}
 onChange={dateChange(['activityFrom', 'activityTo'])}
 maxDate={getLocalDateString(new Date())}
 placeholder="Activity date"
 className="w-auto text-xs"
 />
 <DateRangePicker
 value={uploadDateValue}
 onChange={dateChange(['uploadFrom', 'uploadTo'])}
 maxDate={getLocalDateString(new Date())}
 placeholder="Upload date"
 className="w-auto text-xs"
 />

 <FilterPill
 icon={BarChart3}
 label="Metric"
 pluralLabel="metrics"
 options={kpis.map(k => ({ id: k.id!, name: k.title }))}
 selected={filters.metrics}
 onChange={(ids) => set({ metrics: ids })}
 emptyText="No metrics available"
 />
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
 className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
 >
 Clear all
 </button>
 )}
 </div>
 </div>
 )
}
