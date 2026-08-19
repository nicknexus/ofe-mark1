import React from 'react'
import { MapPin, CalendarRange, Tag as TagIcon, Users, Check, LucideIcon } from 'lucide-react'
import { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
import DateRangePicker, { type DateRangePickerHandle } from '../DateRangePicker'
import { WizardState, includesClaim } from './wizardTypes'

/**
 * One scope dimension as a card: an icon-and-title header that ticks green
 * once the dimension is set, an "Optional" tag where it applies, and a
 * scrolling body so long option lists can't stretch the row out of shape.
 */
function ScopeColumn({
  icon: Icon,
  title,
  optional,
  done,
  bodyClassName,
  children,
}: {
  icon: LucideIcon
  title: string
  optional?: boolean
  done: boolean
  bodyClassName?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white shadow-card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/70 flex-shrink-0">
        <span className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-gray-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">{title}</p>
          {optional && (
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide leading-tight">Optional</p>
          )}
        </div>
        {done && (
          <span className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
        )}
      </div>
      <div className={`px-4 py-3 flex-1 overflow-y-auto ${bodyClassName ?? 'max-h-[200px]'}`}>{children}</div>
    </div>
  )
}

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
 hideHeader = false,
}: {
 icon: LucideIcon
 label: string
 hint?: string
 options: ScopeOption[]
 selected: string[]
 onChange: (ids: string[]) => void
 single?: boolean
 allowAll?: boolean
 /** Column mode: the ScopeColumn header already names the dimension, so the
  * label/hint row is dropped and "Select all" becomes a leading "All" chip. */
 hideHeader?: boolean
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

 const chipClass = (active: boolean) =>
 `px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${active
 ? 'border-primary-500 bg-primary-50 text-primary-800'
 : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
 }`

 return (
 <div>
 {!hideHeader && (
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
 )}
 {!hideHeader && hint && <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>}
 <div className="flex flex-wrap gap-1.5">
 {options.length === 0 ? (
 <p className="text-xs text-gray-400">None available</p>
 ) : (
 <>
 {hideHeader && !single && allowAll && options.length > 1 && (
 <button
 type="button"
 onClick={() => onChange(allSelected ? [] : options.map(o => o.id))}
 className={chipClass(allSelected)}
 >
 All
 </button>
 )}
 {options.map(option => {
 const active = selected.includes(option.id)
 return (
 <button
 key={option.id}
 type="button"
 onClick={() => toggle(option.id)}
 className={chipClass(active)}
 >
 {option.name}
 </button>
 )
 })}
 </>
 )}
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
 /** Program metrics — used to limit claim tags to ones attached to the chosen metric(s). */
 kpis?: Array<{ id?: string; tag_ids?: string[] }>
 datePickerRef?: React.Ref<DateRangePickerHandle>
}

/**
 * Step — Where & When, entered once. When a claim is involved this scope is
 * shared between the claim and its evidence, which guarantees they auto-link
 * (claims take one location and at most one tag, so those become
 * single-selects). Evidence-only uploads can go as broad as needed with the
 * All shortcuts. The claim+evidence flow lays the four dimensions out as
 * columns (date · location · tags · groups) so the whole scope can be set at
 * a glance. Claim-only and evidence-only use the same column layout.
 */
export default function WizardScopeStep({ state, update, locations, tags, beneficiaryGroups, kpis = [], datePickerRef }: WizardScopeStepProps) {
 const claim = includesClaim(state.kind)
 const today = getLocalDateString(new Date())

 // Claims can only use tags on their parent metric. If a metric is already
 // chosen, only offer its tags. In claim+evidence (scope-first), offer tags
 // that exist on at least one metric in this program so the next step isn't empty.
 const selectableTags = (() => {
   if (!claim) return tags
   const relevantKpis = state.claimKpiId
     ? kpis.filter(k => k.id === state.claimKpiId)
     : state.evidenceKpiIds.length > 0
       ? kpis.filter(k => state.evidenceKpiIds.includes(k.id!))
       : kpis
   if (relevantKpis.length === 0) return tags
   const allowed = new Set(relevantKpis.flatMap(k => k.tag_ids || []))
   if (allowed.size === 0) return []
   return tags.filter(t => allowed.has(t.id))
 })()

 const dateValue = state.dateMode === 'single'
   ? { singleDate: state.dateSingle || undefined }
   : { startDate: state.dateStart || undefined, endDate: state.dateEnd || undefined }

 const handleDateChange = (value: { singleDate?: string; startDate?: string; endDate?: string }) => {
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
 }

 const dateDone = state.dateMode === 'single' ? !!state.dateSingle : !!state.dateStart
 const columns = [
 {
 key: 'date',
 icon: CalendarRange,
 title: 'Date',
 optional: false,
 done: dateDone,
 body: (
   <DateRangePicker
     ref={datePickerRef}
     variant="inline"
     compact
     value={dateValue}
     onChange={handleDateChange}
     maxDate={today}
     className="w-full -mx-1"
   />
 ),
 },
 {
 key: 'location',
 icon: MapPin,
 title: claim ? 'Location' : 'Locations',
 optional: false,
 done: state.locationIds.length > 0,
 body: (
 <ScopeChips
 icon={MapPin}
 label={claim ? 'Location' : 'Locations'}
 options={locations.map(l => ({ id: l.id!, name: l.name }))}
 selected={state.locationIds}
 onChange={(ids) => update({ locationIds: ids })}
 single={claim}
 hideHeader
 />
 ),
 },
 tags.length > 0 && (claim ? selectableTags.length > 0 : true) ? {
 key: 'tag',
 icon: TagIcon,
 title: 'Tag',
 optional: true,
 done: state.tagIds.length > 0,
 body: (
 <ScopeChips
 icon={TagIcon}
 label="Tag"
 options={selectableTags.map(t => ({ id: t.id, name: t.name }))}
 selected={state.tagIds.filter(id => selectableTags.some(t => t.id === id))}
 onChange={(ids) => update({ tagIds: ids })}
 single={claim}
 hideHeader
 />
 ),
 } : null,
 beneficiaryGroups.length > 0 ? {
 key: 'groups',
 icon: Users,
 title: 'Groups',
 optional: true,
 done: state.beneficiaryGroupIds.length > 0,
 body: (
 <ScopeChips
 icon={Users}
 label="Beneficiary groups"
 options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))}
 selected={state.beneficiaryGroupIds}
 onChange={(ids) => update({ beneficiaryGroupIds: ids })}
 hideHeader
 />
 ),
 } : null,
 ].filter(Boolean) as Array<{ key: string; icon: LucideIcon; title: string; optional: boolean; done: boolean; body: React.ReactNode }>

 const colsClass = columns.length === 4
   ? 'sm:grid-cols-2 md:grid-cols-4'
   : columns.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
 return (
   <div className={`grid grid-cols-1 ${colsClass} gap-3 md:gap-4 w-full`}>
     {columns.map(col => (
       <ScopeColumn
         key={col.key}
         icon={col.icon}
         title={col.title}
         optional={col.optional}
         done={col.done}
         bodyClassName={col.key === 'date' ? 'max-h-none overflow-visible py-2' : undefined}
       >
         {col.body}
       </ScopeColumn>
     ))}
   </div>
 )
}
