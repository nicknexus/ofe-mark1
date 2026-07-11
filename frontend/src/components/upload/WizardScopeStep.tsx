import React from 'react'
import { MapPin, CalendarRange, Tag as TagIcon, Users, LucideIcon } from 'lucide-react'
import { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import { WizardState, includesClaim } from './wizardTypes'

interface ScopeOption {
 id: string
 name: string
}

/**
 * Chip multi-select with an explicit "All" shortcut. "All" literally selects
 * every option — broadness is expressed as real scope links so the
 * auto-matcher (and anyone auditing a connection later) sees exactly why a
 * link exists. Empty scope means narrow, not wildcard.
 */
function ScopeChips({
 icon: Icon,
 label,
 hint,
 options,
 selected,
 onChange,
 single = false,
 allowAll = true,
}: {
 icon: LucideIcon
 label: string
 hint?: string
 options: ScopeOption[]
 selected: string[]
 onChange: (ids: string[]) => void
 single?: boolean
 allowAll?: boolean
}) {
 const allSelected = options.length > 0 && selected.length === options.length

 const toggle = (id: string) => {
 if (single) {
 onChange(selected.includes(id) ? [] : [id])
 return
 }
 if (selected.includes(id)) onChange(selected.filter(s => s !== id))
 else onChange([...selected, id])
 }

 return (
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
 <Icon className="w-3.5 h-3.5 text-gray-400" />
 {label}
 </label>
 {!single && allowAll && options.length > 1 && (
 <button
 type="button"
 onClick={() => onChange(allSelected ? [] : options.map(o => o.id))}
 className={`text-xs font-medium px-2 py-0.5 rounded-full border transition-colors ${allSelected
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 text-gray-500 hover:bg-gray-50'
 }`}
 >
 {allSelected ? 'All selected' : 'Select all'}
 </button>
 )}
 </div>
 {hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
 <div className="flex flex-wrap gap-1.5">
 {options.length === 0 ? (
 <p className="text-xs text-gray-400">None available</p>
 ) : options.map(option => {
 const active = selected.includes(option.id)
 return (
 <button
 key={option.id}
 type="button"
 onClick={() => toggle(option.id)}
 className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
 }`}
 >
 {option.name}
 </button>
 )
 })}
 </div>
 </div>
 )
}

interface WizardScopeStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
}

/**
 * Step 3 — Where & When, entered once. When a claim is involved this scope
 * is shared between the claim and its evidence, which guarantees they
 * auto-link (claims take one location and at most one tag, so those become
 * single-selects). Evidence-only uploads can go as broad as needed with the
 * All shortcuts — a year of financials across every location and tag.
 */
export default function WizardScopeStep({ state, update, locations, tags, beneficiaryGroups }: WizardScopeStepProps) {
 const claim = includesClaim(state.kind)
 const evidenceOnly = state.kind === 'evidence'
 const today = getLocalDateString(new Date())

 return (
 <div className="space-y-5 max-w-2xl">
 {/* Location */}
 <ScopeChips
 icon={MapPin}
 label={claim ? 'Location' : 'Locations'}
 hint={claim ? 'Impact claims record one location.' : 'Pick every location this evidence covers.'}
 options={locations.map(l => ({ id: l.id!, name: l.name }))}
 selected={state.locationIds}
 onChange={(ids) => update({ locationIds: ids })}
 single={claim}
 />

 {/* Date — the app's own picker (calendar with day + range modes), not the native input */}
 <div>
 <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
 <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
 When did this happen?
 </label>
 <DateRangePicker
 value={state.dateMode === 'single'
 ? { singleDate: state.dateSingle || undefined }
 : { startDate: state.dateStart || undefined, endDate: state.dateEnd || undefined }}
 onChange={(value) => {
 if (value.singleDate) {
 update({ dateMode: 'single', dateSingle: value.singleDate, dateStart: '', dateEnd: '' })
 } else {
 update({
 dateMode: 'range',
 dateSingle: '',
 dateStart: value.startDate || '',
 dateEnd: value.endDate || '',
 })
 }
 }}
 maxDate={today}
 placeholder="Pick a date or range"
 className="w-full sm:w-72"
 />
 {evidenceOnly && (
 <p className="text-[11px] text-gray-400 mt-1.5">
 A broad range (e.g. the whole year) connects this evidence to every claim inside it.
 </p>
 )}
 </div>

 {/* Tags */}
 {tags.length > 0 && (
 <ScopeChips
 icon={TagIcon}
 label={claim ? 'Tag (optional)' : 'Tags'}
 hint={claim
 ? 'Claims take one tag; the evidence will carry the same tag so they connect.'
 : 'Tagged claims only connect to evidence carrying their tag — select all to cover everything.'}
 options={tags.map(t => ({ id: t.id, name: t.name }))}
 selected={state.tagIds}
 onChange={(ids) => update({ tagIds: ids })}
 single={claim}
 />
 )}

 {/* Beneficiary groups */}
 {beneficiaryGroups.length > 0 && (
 <ScopeChips
 icon={Users}
 label="Beneficiary groups (optional)"
 hint="Scoped claims only connect to evidence sharing a group."
 options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
 selected={state.beneficiaryGroupIds}
 onChange={(ids) => update({ beneficiaryGroupIds: ids })}
 />
 )}
 </div>
 )
}
