import React from 'react'
import { MapPin, CalendarRange, Tag as TagIcon, Users, type LucideIcon } from 'lucide-react'
import { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
import DateRangePicker, { type DateRangePickerHandle } from '../DateRangePicker'
import { ScopeColumn, ScopeChips } from '../shared/ScopeFilterColumns'
import { WizardState, includesClaim } from './wizardTypes'

interface WizardScopeStepProps {
 state: WizardState
 update: (patch: Partial<WizardState>) => void
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
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
export default function WizardScopeStep({ state, update, locations, tags, beneficiaryGroups, datePickerRef }: WizardScopeStepProps) {
 const claim = includesClaim(state.kind)
 const today = getLocalDateString(new Date())

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
 tags.length > 0 ? {
 key: 'tag',
 icon: TagIcon,
 title: 'Tag',
 optional: true,
 done: state.tagIds.length > 0,
 body: (
 <ScopeChips
 icon={TagIcon}
 label="Tag"
 options={tags.map(t => ({ id: t.id, name: t.name }))}
 selected={state.tagIds}
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
