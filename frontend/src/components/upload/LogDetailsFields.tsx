import React from 'react'
import { Tag, Users } from 'lucide-react'
import type { BeneficiaryGroup, Location, MetricTag } from '../../types'
import { getLocalDateString } from '../../utils'
import { ScopeChips } from './WizardScopeStep'
import type { LogDetails } from './logDraft'

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
}

export default function LogDetailsFields({ value, onChange, locations, tags, beneficiaryGroups, id, overrides, onReset, locked, onCreateLocation, onCreateTag }: Props) {
 const today = getLocalDateString(new Date())
 const reset = (keys: Array<keyof LogDetails>) => onReset && (
  keys.some(key => overrides?.[key] !== undefined)
   ? <button type="button" onClick={() => onReset(keys)} className="text-xs font-medium text-primary-700 hover:underline">Use master</button>
   : <span className="text-xs text-secondary-500">Master scope</span>
 )
 const dateKeys: Array<keyof LogDetails> = ['dateMode', 'dateSingle', 'dateStart', 'dateEnd']
 return (
  <div className="space-y-3">
   <div className={`grid gap-3 ${id === 'shared' ? 'xl:grid-cols-3' : ''}`}>
    <div>
     <div className="flex items-center justify-between gap-2 mb-1"><label htmlFor={`${id}-title`} className="app-label !mb-0">Title</label>{reset(['evidenceTitle'])}</div>
     <input id={`${id}-title`} className="app-input" value={value.evidenceTitle} onChange={e => onChange({ evidenceTitle: e.target.value })} placeholder="e.g. October skills workshop" />
    </div>
    <fieldset disabled={locked} className={`grid ${id === 'shared' ? 'sm:grid-cols-2 xl:col-span-2' : ''} gap-3 min-w-0`}>
     <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1"><label htmlFor={`${id}-date`} className="app-label !mb-0">Activity date</label>{reset(dateKeys)}</div>
      <div className="flex gap-2 items-center">
       <input id={`${id}-date`} aria-label={value.dateMode === 'range' ? 'Start date' : 'Activity date'} type="date" max={today} className="app-input min-w-0" value={value.dateMode === 'single' ? value.dateSingle : value.dateStart} onChange={e => onChange({ dateMode: value.dateMode, dateSingle: value.dateMode === 'single' ? e.target.value : '', dateStart: value.dateMode === 'range' ? e.target.value : '', dateEnd: value.dateEnd })} />
       {value.dateMode === 'range' && <><span className="text-xs text-secondary-500">to</span><input aria-label="End date" type="date" max={today} min={value.dateStart} className="app-input min-w-0" value={value.dateEnd} onChange={e => onChange({ dateMode: 'range', dateSingle: '', dateStart: value.dateStart, dateEnd: e.target.value })} /></>}
      </div>
      <button type="button" className="text-xs text-primary-700 mt-1.5 hover:underline" onClick={() => onChange(value.dateMode === 'single'
       ? { dateMode: 'range', dateStart: value.dateSingle, dateEnd: value.dateSingle, dateSingle: '' }
       : { dateMode: 'single', dateSingle: value.dateStart, dateStart: '', dateEnd: '' })}>{value.dateMode === 'single' ? 'Use a date range' : 'Use a single date'}</button>
     </div>
     <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 mb-1"><label htmlFor={`${id}-location`} className="app-label !mb-0">Location</label>{reset(['locationIds'])}</div>
      <select id={`${id}-location`} className="app-input" value={value.locationIds[0] || ''} onChange={e => onChange({ locationIds: e.target.value ? [e.target.value] : [] })}>
       <option value="">Choose a location</option>
       {locations.map(location => <option key={location.id} value={location.id}>{location.name}</option>)}
      </select>
      {onCreateLocation && <button type="button" onClick={onCreateLocation} className="text-xs text-primary-700 mt-1.5 hover:underline">+ New location</button>}
     </div>
    </fieldset>
   </div>
   <div>
    <div className="flex items-center justify-between gap-2 mb-1"><label htmlFor={`${id}-description`} className="app-label !mb-0">Description</label>{reset(['evidenceDescription'])}</div>
    <textarea id={`${id}-description`} className="app-input" rows={2} value={value.evidenceDescription} onChange={e => onChange({ evidenceDescription: e.target.value })} placeholder="What happened?" />
   </div>
   <fieldset disabled={locked} className={`grid gap-3 min-w-0 ${id === 'shared' ? 'sm:grid-cols-2' : ''}`}>
    {(tags.length > 0 || onCreateTag) && <details>
     <summary className="cursor-pointer text-xs font-medium text-secondary-700">Tags{value.tagIds.length ? ` (${value.tagIds.length})` : ''}</summary>
     <div className="flex justify-end my-1">{reset(['tagIds'])}</div>
     <ScopeChips icon={Tag} label="Tags" hideHeader allowAll={false} options={tags.map(t => ({ id: t.id, name: t.name }))} selected={value.tagIds} onChange={tagIds => onChange({ tagIds })} onCreate={onCreateTag ? name => onCreateTag(name || '') : undefined} createLabel="New tag" createInline />
    </details>}
    {beneficiaryGroups.length > 0 && <details>
     <summary className="cursor-pointer text-xs font-medium text-secondary-700">Beneficiary groups{value.beneficiaryGroupIds.length ? ` (${value.beneficiaryGroupIds.length})` : ''}</summary>
     <div className="flex justify-end my-1">{reset(['beneficiaryGroupIds'])}</div>
     <ScopeChips icon={Users} label="Beneficiary groups" hideHeader options={beneficiaryGroups.map(g => ({ id: g.id!, name: g.name }))} selected={value.beneficiaryGroupIds} onChange={beneficiaryGroupIds => onChange({ beneficiaryGroupIds })} />
    </details>}
   </fieldset>
  </div>
 )
}
