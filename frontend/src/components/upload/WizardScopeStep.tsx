import React from 'react'
import { MapPin, CalendarRange, Tag as TagIcon, Users, LucideIcon } from 'lucide-react'
import { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
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

 const dateInputClass = 'px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent'

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

 {/* Date */}
 <div>
 <div className="flex items-center justify-between mb-1.5">
 <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
 <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
 When did this happen?
 </label>
 <div className="flex rounded-full border border-gray-200 overflow-hidden">
 {(['single', 'range'] as const).map(mode => (
 <button
 key={mode}
 type="button"
 onClick={() => update({ dateMode: mode })}
 className={`px-3 py-1 text-xs font-medium transition-colors ${state.dateMode === mode
 ? 'bg-primary-500 text-white'
 : 'bg-white text-gray-500 hover:bg-gray-50'
 }`}
 >
 {mode === 'single' ? 'One day' : 'Date range'}
 </button>
 ))}
 </div>
 </div>
 {state.dateMode === 'single' ? (
 <input
 type="date"
 value={state.dateSingle}
 max={today}
 onChange={(e) => update({ dateSingle: e.target.value })}
 className={`w-full sm:w-56 ${dateInputClass}`}
 />
 ) : (
 <div className="flex items-center gap-2">
 <input
 type="date"
 value={state.dateStart}
 max={today}
 onChange={(e) => update({ dateStart: e.target.value })}
 className={`flex-1 sm:flex-none sm:w-44 ${dateInputClass}`}
 />
 <span className="text-xs text-gray-400">to</span>
 <input
 type="date"
 value={state.dateEnd}
 max={today}
 onChange={(e) => update({ dateEnd: e.target.value })}
 className={`flex-1 sm:flex-none sm:w-44 ${dateInputClass}`}
 />
 </div>
 )}
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
