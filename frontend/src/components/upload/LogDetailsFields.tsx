import React, { useState } from 'react'
import { ChevronDown, Pencil, Tag, Users } from 'lucide-react'
import type { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import { ScopeChips } from './WizardScopeStep'
import DescriptionModal from './DescriptionModal'
import type { LogDetails, LogField } from './logDraft'

interface Props {
 value: LogDetails
 onChange: (patch: Partial<LogDetails>) => void
 locations: Location[]
 tags: MetricTag[]
 beneficiaryGroups: BeneficiaryGroup[]
 id: string
 overrides?: Partial<LogDetails>
 onReset?: (keys: Array<keyof LogDetails>) => void
 locked?: boolean
 onCreateLocation?: () => void
 onCreateTag?: (name: string) => Promise<void>
 errors?: LogField[]
}

export default function LogDetailsFields({ value, onChange, locations, tags, beneficiaryGroups, id, overrides, onReset, locked, onCreateLocation, onCreateTag, errors }: Props) {
 const today = getLocalDateString(new Date())
 const reset = (keys: Array<keyof LogDetails>) => onReset && (
  keys.some(key => overrides?.[key] !== undefined)
   ? <button type="button" onClick={() => onReset(keys)} className="text-xs font-medium text-primary-700 hover:underline">Use Master</button>
   : <span className="text-xs text-secondary-500">Master Scope</span>
 )
 const dateKeys: Array<keyof LogDetails> = ['dateMode', 'dateSingle', 'dateStart', 'dateEnd']
 const shared = id === 'shared'
 const [editingDescription, setEditingDescription] = useState(false)
 const bad = (field: LogField) => errors?.includes(field) ?? false
 const invalid = (field: LogField) => bad(field) ? '!border-red-400 !ring-2 !ring-red-100' : ''
 const state = (field: LogField | null, filled: boolean) => field && bad(field) ? invalid(field) : filled ? '!border-primary-600' : ''
 const [openChips, setOpenChips] = useState<'tags' | 'groups' | null>(null)
 const pill = (key: 'tags' | 'groups', Icon: typeof Tag, text: string, count: number) => {
  const open = openChips === key
  return <button type="button" aria-expanded={open} onClick={() => setOpenChips(open ? null : key)}
   className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full border text-xs font-medium transition-colors ${count ? 'border-primary-600 bg-primary-50 text-primary-900' : open ? 'border-gray-300 bg-gray-50 text-gray-700' : 'border-gray-200 bg-white text-secondary-700 hover:border-gray-300'}`}>
   <Icon className="w-3.5 h-3.5" />
   {text}
   {count > 0 && <span className="min-w-[1.125rem] h-[1.125rem] px-1 rounded-full bg-primary-700 text-white text-[10px] leading-[1.125rem] text-center">{count}</span>}
   <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
  </button>
 }
 const hasDate = !!(value.dateMode === 'single' ? value.dateSingle : value.dateStart)
 const label = (field: LogField, text: string, htmlFor?: string) => {
  const className = `app-label !mb-0 ${bad(field) ? '!text-red-600' : ''}`
  return <span className="flex items-center gap-1.5">
   {htmlFor ? <label htmlFor={htmlFor} className={className}>{text}</label> : <span className={className}>{text}</span>}
   {bad(field) && <span className="text-[10px] font-semibold uppercase tracking-wide text-red-600">Required</span>}
  </span>
 }
 return (
  <div className={shared ? 'space-y-2' : 'space-y-3'}>
   <div className={`grid gap-3 ${shared ? 'sm:grid-cols-2 xl:grid-cols-4' : ''}`}>
    <div className="min-w-0">
     <div className="flex items-center justify-between gap-2 mb-1">{label('title', 'Title', `${id}-title`)}{reset(['evidenceTitle'])}</div>
     <input id={`${id}-title`} aria-invalid={bad('title')} className={`app-input ${state('title', !!value.evidenceTitle.trim())}`} value={value.evidenceTitle} onChange={e => onChange({ evidenceTitle: e.target.value })} placeholder="e.g. October skills workshop" />
    </div>
    <fieldset disabled={locked} className={shared ? 'contents' : 'grid gap-3 min-w-0'}>
     <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">{label('date', 'Activity date')}{reset(dateKeys)}</div>
      {locked
       ? <p className="app-input bg-gray-50 text-secondary-600">{value.dateMode === 'single' ? value.dateSingle : `${value.dateStart} to ${value.dateEnd}`}</p>
       : <DateRangePicker
        value={value.dateMode === 'single' ? { singleDate: value.dateSingle || undefined } : { startDate: value.dateStart || undefined, endDate: value.dateEnd || undefined }}
        onChange={next => onChange(next.singleDate
         ? { dateMode: 'single', dateSingle: next.singleDate, dateStart: '', dateEnd: '' }
         : next.startDate
          ? { dateMode: 'range', dateSingle: '', dateStart: next.startDate, dateEnd: next.endDate || next.startDate }
          : { dateMode: value.dateMode, dateSingle: '', dateStart: '', dateEnd: '' })}
        maxDate={today}
        placeholder="Select date or range"
        className={`w-full ${bad('date') ? 'rounded-full ring-2 ring-red-300' : ''}`}
        activeColor={bad('date') || !hasDate ? undefined : '#a8c889'}
       />}
     </div>
     <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1">
       {label('location', 'Location', `${id}-location`)}
       <span className="flex items-center gap-2">
        {onCreateLocation && <button type="button" onClick={onCreateLocation} className="text-xs text-primary-700 hover:underline">+ New</button>}
        {reset(['locationIds'])}
       </span>
      </div>
      <select id={`${id}-location`} aria-invalid={bad('location')} className={`app-input ${state('location', value.locationIds.length > 0)}`} value={value.locationIds[0] || ''} onChange={e => onChange({ locationIds: e.target.value ? [e.target.value] : [] })}>
       <option value="">Choose a location</option>
       {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
      </select>
     </div>
    </fieldset>
    <div className="min-w-0">
     <div className="flex items-center justify-between gap-2 mb-1"><label htmlFor={`${id}-description`} className="app-label !mb-0">Description</label>{reset(['evidenceDescription'])}</div>
     <button id={`${id}-description`} type="button" onClick={() => setEditingDescription(true)} title={value.evidenceDescription || undefined}
      className={`app-input text-left flex items-center gap-2 ${value.evidenceDescription.trim() ? '' : 'hover:border-gray-300'} ${state(null, !!value.evidenceDescription.trim())} ${shared ? '' : 'min-h-[3.5rem] items-start'}`}>
      <span className={`flex-1 min-w-0 ${shared ? 'truncate' : 'line-clamp-2'} ${value.evidenceDescription ? '' : 'text-gray-400'}`}>{value.evidenceDescription || 'What happened?'}</span>
      <Pencil className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
     </button>
     {editingDescription && <DescriptionModal value={value.evidenceDescription} onSave={evidenceDescription => onChange({ evidenceDescription })} onClose={() => setEditingDescription(false)} />}
    </div>
   </div>
   <fieldset disabled={locked} className="min-w-0 space-y-2">
    <div className="flex flex-wrap gap-2">
     {(tags.length > 0 || onCreateTag) && pill('tags', Tag, 'Tags', value.tagIds.length)}
     {beneficiaryGroups.length > 0 && pill('groups', Users, 'Beneficiary groups', value.beneficiaryGroupIds.length)}
    </div>
    {openChips === 'tags' && <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
     <div className="flex justify-end mb-1 empty:hidden">{reset(['tagIds'])}</div>
     <ScopeChips icon={Tag} label="Tags" hideHeader allowAll={false} options={tags.map(t => ({ id: t.id, name: t.name }))} selected={value.tagIds} onChange={tagIds => onChange({ tagIds })} onCreate={onCreateTag ? name => onCreateTag(name || '') : undefined} createLabel="New tag" createInline />
    </div>}
    {openChips === 'groups' && <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-2.5">
     <div className="flex justify-end mb-1 empty:hidden">{reset(['beneficiaryGroupIds'])}</div>
     <ScopeChips icon={Users} label="Beneficiary groups" hideHeader options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))} selected={value.beneficiaryGroupIds} onChange={beneficiaryGroupIds => onChange({ beneficiaryGroupIds })} />
    </div>}
   </fieldset>
  </div>
 )
}
