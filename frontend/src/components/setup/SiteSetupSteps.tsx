import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapContainer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  Plus, Target, BarChart3, MapPin, BookOpen, Palette, Check, Building2, Quote, Pencil, AlertTriangle, Search,
  ArrowRight, Lightbulb, Flag,
} from 'lucide-react'
import StepHeader from '../onboarding/StepHeader'
import PublicPagePreview from '../onboarding/PublicPagePreview'
import { easeOut } from '../onboarding/motion'
import { BasemapLayer } from '../map/BasemapLayer'
import { Badge, BadgeTone, InlineAlert, Spinner } from '../ui'
import { useNominatimSearch, NominatimResult } from '../../hooks/useNominatimSearch'
import {
  SiteSetupDraft, SiteSetupProgram, SiteSetupMetric, SiteSetupLocation, SiteSetupBranding, SiteSetupTitledItem,
} from '../../types'

export type DraftUpdater = (fn: (d: SiteSetupDraft) => SiteSetupDraft) => void

let idSeq = 0
const newId = (prefix: string) => `${prefix}-new-${Date.now().toString(36)}-${idSeq++}`
const isNew = (id: string) => id.includes('-new-')

const itemMotion = {
  layout: true,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { duration: 0.25, ease: easeOut },
} as const

const CATEGORY: Record<SiteSetupMetric['category'], { label: string; hint: string; tone: BadgeTone }> = {
  input: { label: 'Input', hint: 'What you put in', tone: 'evidence' },
  output: { label: 'Output', hint: 'What you deliver', tone: 'accent' },
  impact: { label: 'Impact', hint: 'The change it creates', tone: 'impact' },
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// ─── Shared bits ─────────────────────────────────────────────────────────────
function IncludePill({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={on ? 'Click to skip' : 'Click to add'}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition flex-shrink-0 ${on
        ? 'bg-primary-500 text-white shadow-sm hover:bg-primary-600'
        : 'bg-white border border-gray-200 text-secondary-500 hover:border-gray-300 hover:text-secondary-700'
        }`}
    >
      {on ? <><Check className="w-3 h-3" /> Adding</> : <><Plus className="w-3 h-3" /> Add back</>}
    </button>
  )
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-btn app-btn-ghost app-btn-icon app-btn-sm flex-shrink-0" title="Edit">
      <Pencil className="w-3.5 h-3.5" />
    </button>
  )
}

function EditFooter({ onDone, onRemove, doneDisabled }: { onDone: () => void; onRemove?: () => void; doneDisabled?: boolean }) {
  return (
    <div className="flex items-center justify-between pt-1">
      {onRemove
        ? <button type="button" onClick={onRemove} className="text-xs font-medium text-secondary-400 hover:text-red-600">Remove</button>
        : <span />}
      <button type="button" onClick={onDone} disabled={doneDisabled} className="app-btn app-btn-secondary app-btn-sm">
        <Check className="w-3.5 h-3.5" /> Done
      </button>
    </div>
  )
}

function SourceNote({ text }: { text: string }) {
  if (!text) return null
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-secondary-400 mt-3" title={text}>
      <Quote className="w-3 h-3 mt-0.5 flex-shrink-0" />
      <span className="line-clamp-2 italic">{text}</span>
    </p>
  )
}

function ReviewSummary({ adding, skipped, noun, extra }: { adding: number; skipped: number; noun: string; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-5">
      <Badge tone="accent"><Check className="w-3 h-3" /> {plural(adding, noun)} will be added</Badge>
      {skipped > 0 && <Badge tone="neutral">{skipped} skipped</Badge>}
      {extra}
    </div>
  )
}

function AddTile({ onClick, label, disabled, className = '' }: { onClick: () => void; label: string; disabled?: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-secondary-500 flex items-center justify-center gap-2 px-4 py-5 transition hover:border-primary-300 hover:bg-primary-50/40 hover:text-secondary-700 disabled:opacity-50 disabled:pointer-events-none ${className}`}
    >
      <Plus className="w-4 h-4" /> {label}
    </button>
  )
}

function ProgramChips({ programs, selected, onChange }: {
  programs: SiteSetupProgram[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  if (programs.length < 2) return null
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  return (
    <div>
      <p className="app-label">Belongs to</p>
      <div className="flex flex-wrap gap-1.5">
        {programs.map(p => {
          const on = selected.includes(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition ${on
                ? 'bg-primary-50 border-primary-300 text-primary-900'
                : 'bg-white border-gray-200 text-secondary-500 hover:border-primary-200'
                }`}
            >
              {on && <Check className="w-3 h-3" />}
              {p.title || 'Untitled program'}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LimitNotice({ count, room, noun }: { count: number; room: number; noun: string }) {
  if (!Number.isFinite(room) || count <= room) return null
  return (
    <InlineAlert tone="warning" className="mb-4 max-w-4xl">
      Your plan includes {plural(room, noun)}. Skip {count - room} to continue, or upgrade later to add more.
    </InlineAlert>
  )
}

const cardState = (skip?: boolean, editing?: boolean) =>
  editing
    ? 'app-card ring-2 ring-primary-200'
    : skip
      ? 'app-card-muted opacity-70'
      : 'app-card'

// ─── Programs ────────────────────────────────────────────────────────────────
function ProgramCard({ program, metricCount, onChange, onRemove }: {
  program: SiteSetupProgram
  metricCount: number
  onChange: (patch: Partial<SiteSetupProgram>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(isNew(program.id) && !program.title)
  const skip = !!program.skip

  return (
    <motion.div {...itemMotion} className={`${cardState(skip, editing)} p-5 flex flex-col`}>
      <div className="flex items-start gap-3">
        <div className={`app-icon-tile ${skip ? '' : 'app-icon-tile-accent'}`}><Target className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          {editing ? (
            <input className="app-input font-semibold" value={program.title} maxLength={140} autoFocus
              onChange={e => onChange({ title: e.target.value })} placeholder="e.g. Trade school" />
          ) : (
            <h3 className={`text-[15px] font-semibold leading-snug ${skip ? 'text-secondary-500 line-through decoration-gray-300' : 'text-secondary-900'}`}>
              {program.title || 'Untitled program'}
            </h3>
          )}
          {!editing && program.region && (
            <p className="flex items-center gap-1 text-xs text-secondary-500 mt-1"><MapPin className="w-3 h-3" /> {program.region}</p>
          )}
        </div>
        {!editing && <EditButton onClick={() => setEditing(true)} />}
        {!editing && <IncludePill on={!skip} onClick={() => onChange({ skip: !skip })} />}
      </div>

      {editing ? (
        <div className="space-y-3 mt-4">
          <div>
            <label className="app-label">What it delivers</label>
            <textarea className="app-input resize-none" rows={3} value={program.description}
              onChange={e => onChange({ description: e.target.value })} placeholder="What it does, for whom, and where" />
          </div>
          <div>
            <label className="app-label">Region (optional)</label>
            <input className="app-input" value={program.region} maxLength={120}
              onChange={e => onChange({ region: e.target.value })} placeholder="e.g. Northern Haiti" />
          </div>
          <EditFooter onDone={() => setEditing(false)} onRemove={onRemove} doneDisabled={!program.title.trim()} />
        </div>
      ) : (
        <>
          {program.description && (
            <p className="text-sm text-secondary-600 leading-relaxed mt-3 line-clamp-4">{program.description}</p>
          )}
          <div className="mt-auto pt-4">
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <span className="app-chip"><BarChart3 className="w-3 h-3" /> {plural(metricCount, 'metric')}</span>
              {skip && <span className="text-xs text-secondary-400">Will not be created</span>}
            </div>
            <SourceNote text={program.source} />
          </div>
        </>
      )}
    </motion.div>
  )
}

export function ProgramsStep({ draft, update, room }: { draft: SiteSetupDraft; update: DraftUpdater; room: number }) {
  const edit = (id: string, patch: Partial<SiteSetupProgram>) =>
    update(d => ({ ...d, programs: d.programs.map(p => (p.id === id ? { ...p, ...patch } : p)) }))
  const remove = (id: string) =>
    update(d => ({
      ...d,
      programs: d.programs.filter(p => p.id !== id),
      metrics: d.metrics.map(m => ({ ...m, program_ids: m.program_ids.filter(x => x !== id) })),
      locations: d.locations.map(l => ({ ...l, program_ids: l.program_ids.filter(x => x !== id) })),
    }))
  const add = () =>
    update(d => ({ ...d, programs: [...d.programs, { id: newId('p'), title: '', description: '', region: '', source: '' }] }))

  const existing = draft.programs.filter(p => p.existing_id)
  const fresh = draft.programs.filter(p => !p.existing_id)
  const adding = fresh.filter(p => !p.skip).length
  const metricCount = (id: string) => draft.metrics.filter(m => !m.skip && m.program_ids.includes(id)).length

  return (
    <div>
      <StepHeader
        icon={Target}
        title={existing.length ? 'New programs we found' : 'These are the programs we found'}
        description={existing.length
          ? 'We compared your site with what is already in your account. Only programs you do not have yet are below.'
          : 'Programs are the services you run. Each one holds the metrics you will track, so keep them specific. Skip anything that is not a real program, or edit it.'}
      />
      {existing.length > 0 && (
        <div className="app-card-muted p-4 mb-5 max-w-4xl">
          <p className="app-label mb-2">Already in your account</p>
          <div className="flex flex-wrap gap-1.5">
            {existing.map(p => {
              const n = metricCount(p.id)
              return (
                <span key={p.id} className="app-chip">
                  <Check className="w-3 h-3 text-impact-600" /> {p.title}
                  {n > 0 && <span className="text-primary-700 font-semibold">+{plural(n, 'metric')}</span>}
                </span>
              )
            })}
          </div>
        </div>
      )}
      <ReviewSummary adding={adding} skipped={fresh.length - adding} noun="program" />
      <LimitNotice count={adding} room={room} noun="program" />
      {existing.length > 0 && fresh.length === 0 && (
        <InlineAlert tone="info" className="mb-4 max-w-4xl">
          No new programs. Everything we found matches what you already have. Add one if we missed it, or keep going for new metrics and places.
        </InlineAlert>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        <AnimatePresence initial={false}>
          {fresh.map(p => (
            <ProgramCard
              key={p.id}
              program={p}
              metricCount={metricCount(p.id)}
              onChange={patch => edit(p.id, patch)}
              onRemove={() => remove(p.id)}
            />
          ))}
        </AnimatePresence>
        <AddTile onClick={add} label="Add a program" className="min-h-[160px]" />
      </div>
    </div>
  )
}

// ─── Metrics ─────────────────────────────────────────────────────────────────
function MetricCard({ metric, programs, onChange, onRemove }: {
  metric: SiteSetupMetric
  programs: SiteSetupProgram[]
  onChange: (patch: Partial<SiteSetupMetric>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(isNew(metric.id) && !metric.title)
  const skip = !!metric.skip
  const cat = CATEGORY[metric.category]
  const unit = metric.metric_type === 'percentage' ? '%' : metric.unit_of_measurement || 'units'
  const alsoIn = programs.filter(p => metric.program_ids.includes(p.id)).slice(1)

  if (editing) {
    return (
      <motion.div {...itemMotion} className={`${cardState(skip, true)} p-4 space-y-3 sm:col-span-2`}>
        <div>
          <label className="app-label">Metric</label>
          <input className="app-input font-semibold" value={metric.title} maxLength={120} autoFocus
            onChange={e => onChange({ title: e.target.value })} placeholder="e.g. Students enrolled" />
        </div>
        <div>
          <p className="app-label">Kind of metric</p>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CATEGORY) as SiteSetupMetric['category'][]).map(key => {
              const on = metric.category === key
              return (
                <button key={key} type="button" onClick={() => onChange({ category: key })}
                  className={`rounded-lg border px-3 py-2 text-left transition ${on ? 'border-primary-400 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                  <span className="block text-sm font-semibold text-secondary-900">{CATEGORY[key].label}</span>
                  <span className="block text-[11px] text-secondary-500">{CATEGORY[key].hint}</span>
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="app-label">Counted as</label>
            <select className="app-input" value={metric.metric_type}
              onChange={e => onChange({ metric_type: e.target.value as SiteSetupMetric['metric_type'] })}>
              <option value="number">A number</option>
              <option value="percentage">A percentage</option>
            </select>
          </div>
          {metric.metric_type === 'number' && (
            <div>
              <label className="app-label">Unit</label>
              <input className="app-input" value={metric.unit_of_measurement} maxLength={60}
                onChange={e => onChange({ unit_of_measurement: e.target.value })} placeholder="e.g. students" />
            </div>
          )}
        </div>
        <div>
          <label className="app-label">Description (optional)</label>
          <textarea className="app-input resize-none" rows={2} value={metric.description}
            onChange={e => onChange({ description: e.target.value })} placeholder="What is counted and why it matters" />
        </div>
        <ProgramChips programs={programs} selected={metric.program_ids} onChange={ids => onChange({ program_ids: ids })} />
        <EditFooter
          onDone={() => setEditing(false)}
          onRemove={onRemove}
          doneDisabled={!metric.title.trim() || (metric.metric_type === 'number' && !metric.unit_of_measurement.trim())}
        />
      </motion.div>
    )
  }

  if (metric.existing_id) {
    const targets = programs.filter(p => metric.program_ids.includes(p.id)).map(p => p.title)
    return (
      <motion.div {...itemMotion} className={`${cardState(skip)} p-4 flex flex-col`}>
        <div className="flex items-center gap-2">
          <Badge tone="neutral"><Check className="w-3 h-3" /> In your account</Badge>
          <span className="flex-1" />
          <IncludePill on={!skip} onClick={() => onChange({ skip: !skip })} />
        </div>
        <p className={`text-sm font-semibold mt-3 leading-snug ${skip ? 'text-secondary-500 line-through decoration-gray-300' : 'text-secondary-900'}`}>
          {metric.title}
        </p>
        <p className="text-xs text-secondary-500 mt-1.5">
          {targets.length ? `Also tracks it in ${targets.join(', ')}` : 'Links it to another program'}
        </p>
        <div className="mt-auto"><SourceNote text={metric.rationale} /></div>
      </motion.div>
    )
  }

  return (
    <motion.div {...itemMotion} className={`${cardState(skip)} p-4 flex flex-col`}>
      <div className="flex items-center gap-2">
        <Badge tone={skip ? 'neutral' : cat.tone}>{cat.label}</Badge>
        <span className="flex-1" />
        <EditButton onClick={() => setEditing(true)} />
        <IncludePill on={!skip} onClick={() => onChange({ skip: !skip })} />
      </div>
      <p className={`text-sm font-semibold mt-3 leading-snug ${skip ? 'text-secondary-500 line-through decoration-gray-300' : 'text-secondary-900'}`}>
        {metric.title || 'Untitled metric'}
      </p>
      <div className="flex items-baseline gap-1.5 mt-1.5">
        <span className="text-2xl font-bold text-gray-200 tabular-nums leading-none">0</span>
        <span className="text-xs font-medium text-secondary-500">{unit}</span>
      </div>
      {metric.description && <p className="text-xs text-secondary-500 mt-2 line-clamp-2">{metric.description}</p>}
      {alsoIn.length > 0 && (
        <p className="text-[11px] text-secondary-400 mt-2">Also in {alsoIn.map(p => p.title).join(', ')}</p>
      )}
      <div className="mt-auto"><SourceNote text={metric.rationale} /></div>
    </motion.div>
  )
}

export function MetricsStep({ draft, update }: { draft: SiteSetupDraft; update: DraftUpdater }) {
  const edit = (id: string, patch: Partial<SiteSetupMetric>) =>
    update(d => ({ ...d, metrics: d.metrics.map(m => (m.id === id ? { ...m, ...patch } : m)) }))
  const remove = (id: string) => update(d => ({ ...d, metrics: d.metrics.filter(m => m.id !== id) }))
  const add = (programId: string | null) =>
    update(d => ({
      ...d,
      metrics: [...d.metrics, {
        id: newId('m'), title: '', description: '', metric_type: 'number', unit_of_measurement: '',
        category: 'output', program_ids: programId ? [programId] : [], rationale: '',
      }],
    }))

  const programs = draft.programs.filter(p => !p.skip)
  const groups = useMemo(() => {
    const byProgram = programs.map(p => ({ program: p as SiteSetupProgram | null, metrics: [] as SiteSetupMetric[] }))
    const loose: SiteSetupMetric[] = []
    for (const m of draft.metrics) {
      const home = programs.length === 1 ? 0 : programs.findIndex(p => m.program_ids.includes(p.id))
      if (home >= 0) byProgram[home].metrics.push(m)
      else loose.push(m)
    }
    // Existing programs only show up when the scan adds something to them.
    const shown = byProgram.filter(g => !g.program?.existing_id || g.metrics.length > 0)
    return loose.length ? [...shown, { program: null, metrics: loose }] : shown
  }, [draft.metrics, programs])

  const adding = draft.metrics.filter(m => !m.skip).length

  return (
    <div>
      <StepHeader
        icon={BarChart3}
        title="These are the metrics we suggest"
        description="What you will track inside each program. Nothing is counted yet, you add numbers as you log progress."
      />
      <ReviewSummary adding={adding} skipped={draft.metrics.length - adding} noun="metric" />
      <div className="space-y-8 max-w-4xl">
        {groups.map(({ program, metrics }) => (
          <section key={program?.id || 'loose'}>
            <div className="flex items-center gap-2.5 mb-3">
              <div className={`app-icon-tile-sm ${program ? 'app-icon-tile-accent' : ''}`}>
                {program ? <Target className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-secondary-900 truncate flex items-center gap-2">
                  {program ? program.title || 'Untitled program' : 'Not linked to a program'}
                  {program?.existing_id && <Badge tone="neutral">In your account</Badge>}
                </p>
                <p className="text-xs text-secondary-500">
                  {program ? plural(metrics.filter(m => !m.skip).length, 'metric') : 'Added to your metric library. Link them to a program later.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence initial={false}>
                {metrics.map(m => (
                  <MetricCard key={m.id} metric={m} programs={programs} onChange={patch => edit(m.id, patch)} onRemove={() => remove(m.id)} />
                ))}
              </AnimatePresence>
              {program && <AddTile onClick={() => add(program.id)} label="Add metric" className="min-h-[132px]" />}
            </div>
          </section>
        ))}
        {programs.length === 0 && (
          <InlineAlert tone="info">Add at least one program first. Metrics live inside programs.</InlineAlert>
        )}
      </div>
    </div>
  )
}

// ─── Locations ───────────────────────────────────────────────────────────────
const PIN_COLOR = '#608341'

/** New places default to the new programs on a rescan, else every program. */
const defaultPrograms = (programs: SiteSetupProgram[]) => {
  const active = programs.filter(p => !p.skip)
  const fresh = active.filter(p => !p.existing_id)
  return (fresh.length ? fresh : active).map(p => p.id)
}

function FitPins({ points }: { points: { lat: number; lng: number }[] }) {
  const map = useMap()
  const key = points.map(p => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).join('|')
  useEffect(() => {
    if (points.length === 0) map.setView([15, 0], 1)
    else if (points.length === 1) map.setView([points[0].lat, points[0].lng], 7)
    else map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng] as [number, number])), { padding: [36, 36], maxZoom: 7 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key])
  return null
}

function PinPreview({ locations }: { locations: SiteSetupLocation[] }) {
  const points = locations
    .filter(l => !l.skip && l.latitude !== null && l.longitude !== null)
    .map(l => ({ id: l.id, name: l.name, lat: l.latitude as number, lng: l.longitude as number }))
  return (
    <div className="app-card overflow-hidden h-[320px] lg:h-[420px] relative">
      <MapContainer center={[15, 0]} zoom={1} style={{ width: '100%', height: '100%' }} zoomControl={false}
        scrollWheelZoom={false} attributionControl={false} className="relative z-0">
        <BasemapLayer />
        <FitPins points={points} />
        {points.map(p => (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={8}
            pathOptions={{ color: '#ffffff', weight: 2.5, fillColor: PIN_COLOR, fillOpacity: 1 }}>
            <Tooltip direction="top" offset={[0, -6]}>{p.name}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      <div className="absolute left-3 bottom-3 z-[400] app-chip bg-white shadow-card">
        <MapPin className="w-3 h-3" /> {plural(points.length, 'pin')}
      </div>
    </div>
  )
}

function LocationCard({ location, programs, onChange, onRemove }: {
  location: SiteSetupLocation
  programs: SiteSetupProgram[]
  onChange: (patch: Partial<SiteSetupLocation>) => void
  onRemove: () => void
}) {
  const [editing, setEditing] = useState(isNew(location.id) && !location.name)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const { results, isSearching, search, clearResults } = useNominatimSearch()
  const boxRef = useRef<HTMLDivElement>(null)
  const skip = !!location.skip
  const pinned = location.latitude !== null && location.longitude !== null
  const approx = pinned && location.geo_status === 'approx'
  const existing = !!location.existing_id
  const looking = !existing && !location.geo_status && !pinned

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const startEdit = () => {
    setQuery([location.name, location.area, location.country].filter(Boolean).join(', '))
    setEditing(true)
  }

  const pick = (r: NominatimResult) => {
    onChange({
      name: r.display_name.split(',')[0],
      country: r.address?.country || location.country,
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      place_label: r.display_name,
      geo_status: 'found',
    })
    setQuery(r.display_name)
    clearResults()
    setOpen(false)
  }

  const statusTile = existing
    ? <div className="app-icon-tile-sm bg-impact-50 text-impact-600"><Check className="w-4 h-4" /></div>
    : looking
    ? <div className="app-icon-tile-sm"><Spinner className="w-4 h-4" /></div>
    : approx
      ? <div className="app-icon-tile-sm bg-amber-50 text-amber-600"><MapPin className="w-4 h-4" /></div>
      : pinned
        ? <div className="app-icon-tile-sm bg-impact-50 text-impact-600"><MapPin className="w-4 h-4" /></div>
        : <div className="app-icon-tile-sm bg-amber-50 text-amber-600"><AlertTriangle className="w-4 h-4" /></div>
  const subtitle = existing
    ? 'Already in your account. We will link it to the programs below.'
    : looking
    ? 'Finding it on the map'
    : approx
      ? `Approximate, pinned to ${location.area || 'the nearest town'}. Search to place it exactly.`
      : pinned
        ? location.place_label || `${location.latitude!.toFixed(4)}, ${location.longitude!.toFixed(4)}`
        : 'Not pinned yet. Search and pick the right place.'
  const placeTitle = [location.name || 'New place', location.area, location.country]
    .filter((part, i) => part && (i === 0 || !location.name.includes(part)))
    .join(', ')

  return (
    <motion.div {...itemMotion} className={`${cardState(skip, editing)} p-3.5`}>
      <div className="flex items-start gap-3">
        {statusTile}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${skip ? 'text-secondary-500 line-through decoration-gray-300' : 'text-secondary-900'}`}>
            {placeTitle}
          </p>
          <p className={`text-xs truncate mt-0.5 ${approx ? 'text-amber-700' : 'text-secondary-500'}`} title={subtitle}>
            {subtitle}
          </p>
        </div>
        {!editing && !existing && <EditButton onClick={startEdit} />}
        {!editing && <IncludePill on={!skip} onClick={() => onChange({ skip: !skip })} />}
      </div>

      {editing && (
        <div className="space-y-3 mt-3">
          <div className="relative" ref={boxRef}>
            <label className="app-label">Search a place</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400 z-10" />
              <input
                className="app-input pl-10 pr-9"
                value={query}
                autoFocus
                placeholder="e.g. Cap-Haitien, Haiti"
                onChange={e => { setQuery(e.target.value); setOpen(true); search(e.target.value) }}
                onFocus={() => { setOpen(true); if (query) search(query) }}
              />
              {isSearching && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />}
            </div>
            {open && results.length > 0 && (
              <div className="absolute z-50 w-full mt-1.5 app-card-elevated max-h-60 overflow-y-auto">
                {results.map(r => (
                  <button key={r.place_id} type="button" onClick={() => pick(r)}
                    className="w-full text-left px-3.5 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-b-0">
                    <div className="font-medium text-secondary-900 text-sm truncate">{r.display_name.split(',')[0]}</div>
                    <div className="text-xs text-secondary-500 mt-0.5 line-clamp-2">{r.display_name}</div>
                  </button>
                ))}
              </div>
            )}
            <p className="app-help">Pick a match so the pin lands in the right spot.</p>
          </div>
          {pinned && (
            <div>
              <label className="app-label">Display name</label>
              <input className="app-input" value={location.name} maxLength={120}
                onChange={e => onChange({ name: e.target.value })} />
            </div>
          )}
          <ProgramChips programs={programs} selected={location.program_ids} onChange={ids => onChange({ program_ids: ids })} />
          <EditFooter onDone={() => setEditing(false)} onRemove={onRemove} doneDisabled={!location.name.trim()} />
        </div>
      )}

      {!editing && (programs.length > 1 || existing) && location.program_ids.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5 pl-11">
          {programs.filter(p => location.program_ids.includes(p.id)).map(p => (
            <span key={p.id} className="app-chip text-[11px] py-0.5">{p.title}</span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export function LocationsStep({ draft, update, room }: { draft: SiteSetupDraft; update: DraftUpdater; room: number }) {
  const edit = (id: string, patch: Partial<SiteSetupLocation>) =>
    update(d => ({ ...d, locations: d.locations.map(l => (l.id === id ? { ...l, ...patch } : l)) }))
  const remove = (id: string) => update(d => ({ ...d, locations: d.locations.filter(l => l.id !== id) }))
  const add = () =>
    update(d => ({
      ...d,
      locations: [...d.locations, {
        id: newId('l'), name: '', country: '', latitude: null, longitude: null,
        program_ids: defaultPrograms(d.programs), geo_status: 'manual',
      }],
    }))

  const programs = draft.programs.filter(p => !p.skip)
  const included = draft.locations.filter(l => !l.skip)
  const creating = included.filter(l => !l.existing_id)
  const unpinned = creating.filter(l => l.geo_status && (l.latitude === null || l.longitude === null)).length
  const approximate = included.filter(l => l.geo_status === 'approx').length

  return (
    <div>
      <StepHeader
        icon={MapPin}
        title="These are the places we found"
        description="Where your work happens. We looked each one up on the map, check the pins look right."
      />
      <ReviewSummary
        adding={included.length}
        skipped={draft.locations.length - included.length}
        noun="location"
        extra={<>
          {approximate > 0 && <Badge tone="warning"><MapPin className="w-3 h-3" /> {approximate} approximate</Badge>}
          {unpinned > 0 && <Badge tone="warning"><AlertTriangle className="w-3 h-3" /> {unpinned} not pinned</Badge>}
        </>}
      />
      <LimitNotice count={creating.length} room={room} noun="location" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-5 max-w-5xl items-start">
        <div className="space-y-2.5">
          {draft.locations.length === 0 && (
            <InlineAlert tone="info">We did not find specific places on your site. Add one, or skip this for now.</InlineAlert>
          )}
          <AnimatePresence initial={false}>
            {draft.locations.map(l => (
              <LocationCard key={l.id} location={l} programs={programs} onChange={patch => edit(l.id, patch)} onRemove={() => remove(l.id)} />
            ))}
          </AnimatePresence>
          <AddTile onClick={add} label="Add a place" className="w-full" disabled={Number.isFinite(room) && creating.length >= room} />
        </div>
        <div className="lg:sticky lg:top-0">
          <PinPreview locations={draft.locations} />
        </div>
      </div>
    </div>
  )
}

// ─── Story ───────────────────────────────────────────────────────────────────
function StoryBlock({ icon: Icon, title, empty, editor, children }: {
  icon: React.ElementType
  title: string
  empty: boolean
  editor: React.ReactNode
  children: React.ReactNode
}) {
  const [editing, setEditing] = useState(false)
  return (
    <div className={`${editing ? 'app-card ring-2 ring-primary-200' : 'app-card'} p-5`}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="app-icon-tile-sm app-icon-tile-accent"><Icon className="w-4 h-4" /></div>
        <p className="text-sm font-semibold text-secondary-900 flex-1">{title}</p>
        {!editing && <EditButton onClick={() => setEditing(true)} />}
      </div>
      {editing ? (
        <div className="space-y-3">
          {editor}
          <EditFooter onDone={() => setEditing(false)} />
        </div>
      ) : empty ? (
        <button type="button" onClick={() => setEditing(true)} className="text-sm text-secondary-400 hover:text-secondary-600">
          Nothing found on your site. Click to write it.
        </button>
      ) : children}
    </div>
  )
}

function TitledListEditor({ items, onChange, addLabel }: {
  items: SiteSetupTitledItem[]
  onChange: (items: SiteSetupTitledItem[]) => void
  addLabel: string
}) {
  const edit = (i: number, patch: Partial<SiteSetupTitledItem>) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="app-card-muted p-3 space-y-2">
          <div className="flex items-center gap-2">
            <input className="app-input" value={it.title} maxLength={120} placeholder="Title" onChange={e => edit(i, { title: e.target.value })} />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-xs font-medium text-secondary-400 hover:text-red-600 flex-shrink-0">Remove</button>
          </div>
          <textarea className="app-input resize-none" rows={2} value={it.description} placeholder="Description"
            onChange={e => edit(i, { description: e.target.value })} />
        </div>
      ))}
      {items.length < 5 && <AddTile onClick={() => onChange([...items, { title: '', description: '' }])} label={addLabel} className="w-full py-3" />}
    </div>
  )
}

export function StoryStep({ draft, update, include, setInclude }: {
  draft: SiteSetupDraft
  update: DraftUpdater
  include: boolean
  setInclude: (v: boolean) => void
}) {
  const story = draft.story
  const org = draft.organization
  const setStory = (patch: Partial<SiteSetupDraft['story']>) => update(d => ({ ...d, story: { ...d.story, ...patch } }))
  const setOrg = (patch: Partial<SiteSetupDraft['organization']>) => update(d => ({ ...d, organization: { ...d.organization, ...patch } }))
  const stages = story.theory_of_change_stages.filter(s => s.title.trim())
  const strategies = story.strategies.filter(s => s.title.trim())

  return (
    <div>
      <StepHeader
        icon={BookOpen}
        title="This is the story we pulled together"
        description="Your mission and the problem you solve, shown on your public page. We only fill fields that are still empty in your account."
      />
      <div className="flex items-center gap-3 mb-5 max-w-4xl">
        <IncludePill on={include} onClick={() => setInclude(!include)} />
        <span className="text-sm text-secondary-600">{include ? 'This will be added to your organization profile.' : 'Skipped. Your profile stays as it is.'}</span>
      </div>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl transition-opacity ${include ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="md:col-span-2">
          <StoryBlock
            icon={Quote}
            title="Mission"
            empty={!org.statement && !org.description}
            editor={<>
              <div>
                <label className="app-label">Mission statement</label>
                <input className="app-input" value={org.statement} maxLength={150} onChange={e => setOrg({ statement: e.target.value })} placeholder="One line on what you do" />
                <p className="app-help">{org.statement.length}/150</p>
              </div>
              <div>
                <label className="app-label">About your organization</label>
                <textarea className="app-input resize-none" rows={4} value={org.description} onChange={e => setOrg({ description: e.target.value })} />
              </div>
            </>}
          >
            {org.statement && <p className="text-lg font-semibold text-secondary-900 leading-snug">{org.statement}</p>}
            {org.description && <p className="text-sm text-secondary-600 leading-relaxed mt-2">{org.description}</p>}
          </StoryBlock>
        </div>
        <StoryBlock
          icon={Flag}
          title="The problem you address"
          empty={!story.problem_statement}
          editor={<textarea className="app-input resize-none" rows={4} value={story.problem_statement} onChange={e => setStory({ problem_statement: e.target.value })} />}
        >
          <p className="text-sm text-secondary-600 leading-relaxed">{story.problem_statement}</p>
        </StoryBlock>
        <StoryBlock
          icon={Lightbulb}
          title="Theory of change"
          empty={!story.theory_of_change}
          editor={<textarea className="app-input resize-none" rows={4} value={story.theory_of_change} onChange={e => setStory({ theory_of_change: e.target.value })} />}
        >
          <p className="text-sm text-secondary-600 leading-relaxed">{story.theory_of_change}</p>
        </StoryBlock>
        <div className="md:col-span-2">
          <StoryBlock
            icon={ArrowRight}
            title="Steps to change"
            empty={stages.length === 0}
            editor={<TitledListEditor items={story.theory_of_change_stages} addLabel="Add step" onChange={items => setStory({ theory_of_change_stages: items })} />}
          >
            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stages.map((s, i) => (
                <li key={i} className="app-card-muted p-3">
                  <span className="inline-flex w-6 h-6 rounded-full bg-primary-500 text-white text-xs font-bold items-center justify-center">{i + 1}</span>
                  <p className="text-sm font-semibold text-secondary-900 mt-2">{s.title}</p>
                  {s.description && <p className="text-xs text-secondary-500 mt-1 line-clamp-3">{s.description}</p>}
                </li>
              ))}
            </ol>
          </StoryBlock>
        </div>
        <div className="md:col-span-2">
          <StoryBlock
            icon={Target}
            title="Strategies"
            empty={strategies.length === 0}
            editor={<TitledListEditor items={story.strategies} addLabel="Add strategy" onChange={items => setStory({ strategies: items })} />}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {strategies.map((s, i) => (
                <div key={i} className="app-card-muted p-3">
                  <p className="text-sm font-semibold text-secondary-900">{s.title}</p>
                  {s.description && <p className="text-xs text-secondary-500 mt-1 line-clamp-3">{s.description}</p>}
                </div>
              ))}
            </div>
          </StoryBlock>
        </div>
      </div>
    </div>
  )
}

// ─── Brand ───────────────────────────────────────────────────────────────────
export function BrandStep({ branding, color, setColor, currentColor, keepLogo, setKeepLogo, currentLogo, orgName }: {
  branding: SiteSetupBranding | null
  color: string | null
  setColor: (c: string | null) => void
  currentColor: string
  keepLogo: boolean
  setKeepLogo: (v: boolean) => void
  currentLogo?: string | null
  orgName?: string
}) {
  const colors = branding?.colors || []
  const logo = branding?.logo_url || ''
  const previewColor = color || currentColor
  const previewLogo = logo && keepLogo ? logo : currentLogo || undefined
  const found = colors.length > 0 || !!logo

  return (
    <div>
      <StepHeader
        icon={Palette}
        title="This is the look we picked up"
        description="Your brand color and logo from your site. Keep them, switch them, or skip and set them later in Account settings."
      />
      {!found && (
        <InlineAlert tone="info" className="mb-4 max-w-4xl">We could not detect a brand color or logo on your site. You can set them later in Account settings.</InlineAlert>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        <div className="space-y-4">
          <div className="app-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-secondary-900">Logo</p>
              {logo && <IncludePill on={keepLogo} onClick={() => setKeepLogo(!keepLogo)} />}
            </div>
            {logo ? (
              <div className={`w-24 h-24 rounded-xl bg-white ring-1 ring-gray-200 flex items-center justify-center overflow-hidden p-2 transition ${keepLogo ? '' : 'opacity-40'}`}>
                <img src={logo} alt="Logo found on your site" className="max-w-full max-h-full object-contain" />
              </div>
            ) : (
              <div className="flex items-center gap-3 text-sm text-secondary-500">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center"><Building2 className="w-5 h-5 text-gray-400" /></div>
                No logo found
              </div>
            )}
          </div>
          <div className="app-card p-5">
            <p className="text-sm font-semibold text-secondary-900 mb-3">Brand color</p>
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                type="button"
                onClick={() => setColor(null)}
                className={`h-10 px-3 rounded-xl border-2 text-xs font-medium text-secondary-600 transition ${color === null ? 'border-secondary-700' : 'border-gray-200 hover:border-gray-300'}`}
              >
                Keep current
              </button>
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  title={c}
                  className={`w-10 h-10 rounded-xl border-2 transition hover:scale-105 ${color === c ? 'border-secondary-700 ring-2 ring-offset-2 ring-gray-300' : 'border-white shadow-card'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-3">
              <input type="color" value={previewColor} onChange={e => setColor(e.target.value)} className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0" />
              <span className="font-mono text-sm text-secondary-600">{previewColor}</span>
            </div>
          </div>
        </div>
        <PublicPagePreview color={previewColor} logoUrl={previewLogo} orgName={orgName} />
      </div>
    </div>
  )
}
