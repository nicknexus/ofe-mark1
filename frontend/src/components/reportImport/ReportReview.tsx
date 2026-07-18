import React from 'react'
import {
  Building2, Target, MapPin, BarChart3, Users, BookOpen, Check, Trash2,
} from 'lucide-react'
import {
  ReviewState, ReviewMetric, ReviewGroup, initiativeOptions,
} from './reviewModel'

interface Props {
  value: ReviewState
  onChange: (next: ReviewState) => void
  existingInitiatives: { id: string; title: string }[]
  /** 'initiative' hides org-level sections and the per-item initiative picker. */
  scope?: 'organization' | 'initiative'
}

/** A toggleable card. Dim + checkbox controls whether the item is applied. */
function ItemCard({
  include, onToggle, onRemove, children,
}: {
  include: boolean
  onToggle: () => void
  onRemove?: () => void
  children: React.ReactNode
}) {
  return (
    <div className={`app-card-muted p-3 relative transition ${include ? '' : 'opacity-50'}`}>
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-label={include ? 'Exclude' : 'Include'}
          className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition ${
            include ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 bg-white text-transparent'
          }`}
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove"
            className="text-secondary-300 hover:text-red-500 transition flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}

function Section({
  icon: Icon, title, count, children,
}: {
  icon: React.ComponentType<any>
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent">
          <Icon className="w-4 h-4" />
        </span>
        <h3 className="text-sm font-semibold text-secondary-900">{title}</h3>
        <span className="text-[11px] text-secondary-400">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export default function ReportReview({ value, onChange, existingInitiatives, scope = 'organization' }: Props) {
  const isInitiativeScope = scope === 'initiative'
  const initOpts = initiativeOptions(value, existingInitiatives)

  // Immutable section updaters --------------------------------------------
  const setOrg = (patch: Partial<ReviewState['org']>) => onChange({ ...value, org: { ...value.org, ...patch } })
  const setCtx = (patch: Partial<ReviewState['context']>) => onChange({ ...value, context: { ...value.context, ...patch } })
  const updateList = <K extends 'locations' | 'initiatives' | 'metrics' | 'groups'>(
    key: K, idx: number, patch: Partial<ReviewState[K][number]>
  ) => {
    const next = value[key].map((it, i) => (i === idx ? { ...it, ...patch } : it)) as ReviewState[K]
    onChange({ ...value, [key]: next })
  }
  const removeFromList = (key: 'locations' | 'initiatives' | 'metrics' | 'groups', idx: number) => {
    onChange({ ...value, [key]: value[key].filter((_, i) => i !== idx) as any })
  }
  const updateStrategy = (idx: number, patch: Partial<ReviewState['context']['strategies'][number]>) =>
    setCtx({ strategies: value.context.strategies.map((s, i) => (i === idx ? { ...s, ...patch } : s)) })
  const updateStat = (idx: number, patch: Partial<ReviewState['context']['stats'][number]>) =>
    setCtx({ stats: value.context.stats.map((s, i) => (i === idx ? { ...s, ...patch } : s)) })

  const ctx = value.context
  const contextCount =
    (ctx.problem_statement.trim() ? 1 : 0) +
    (ctx.theory_of_change.trim() ? 1 : 0) +
    (ctx.additional_info.trim() ? 1 : 0) +
    ctx.strategies.length + ctx.stats.length

  return (
    <div className="space-y-6">
      {/* Organization profile */}
      {!isInitiativeScope && (value.org.statement || value.org.description || value.org.website_url || value.org.donation_url) && (
        <Section icon={Building2} title="Organization profile" count={1}>
          <ItemCard include={value.org.include} onToggle={() => setOrg({ include: !value.org.include })}>
            <div className="space-y-2.5">
              <div>
                <label className="app-label">Mission statement</label>
                <input className="app-input" maxLength={150} value={value.org.statement}
                  onChange={e => setOrg({ statement: e.target.value })} placeholder="One line, max 150 chars" />
              </div>
              <div>
                <label className="app-label">Description</label>
                <textarea className="app-input resize-none" rows={2} value={value.org.description}
                  onChange={e => setOrg({ description: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="app-label">Website</label>
                  <input className="app-input" value={value.org.website_url}
                    onChange={e => setOrg({ website_url: e.target.value })} placeholder="https://" />
                </div>
                <div>
                  <label className="app-label">Donation link</label>
                  <input className="app-input" value={value.org.donation_url}
                    onChange={e => setOrg({ donation_url: e.target.value })} placeholder="https://" />
                </div>
              </div>
            </div>
          </ItemCard>
        </Section>
      )}

      {/* About & impact (organization context) */}
      <Section icon={BookOpen} title="About & impact" count={contextCount}>
        {ctx.problem_statement.trim() !== '' && (
          <ItemCard include={ctx.includeProblem} onToggle={() => setCtx({ includeProblem: !ctx.includeProblem })}>
            <label className="app-label">Problem statement</label>
            <textarea className="app-input resize-none" rows={2} value={ctx.problem_statement}
              onChange={e => setCtx({ problem_statement: e.target.value })} />
          </ItemCard>
        )}
        {ctx.theory_of_change.trim() !== '' && (
          <ItemCard include={ctx.includeToc} onToggle={() => setCtx({ includeToc: !ctx.includeToc })}>
            <label className="app-label">Theory of change</label>
            <textarea className="app-input resize-none" rows={2} value={ctx.theory_of_change}
              onChange={e => setCtx({ theory_of_change: e.target.value })} />
          </ItemCard>
        )}
        {ctx.strategies.map((s, idx) => (
          <ItemCard key={`strat-${idx}`} include={s.include}
            onToggle={() => updateStrategy(idx, { include: !s.include })}>
            <label className="app-label">Strategic priority</label>
            <input className="app-input mb-2" value={s.title} onChange={e => updateStrategy(idx, { title: e.target.value })} />
            <textarea className="app-input resize-none" rows={2} value={s.description}
              onChange={e => updateStrategy(idx, { description: e.target.value })} placeholder="Description (optional)" />
          </ItemCard>
        ))}
        {ctx.stats.map((s, idx) => (
          <ItemCard key={`stat-${idx}`} include={s.include}
            onToggle={() => updateStat(idx, { include: !s.include })}>
            <div className="flex gap-2 mb-2">
              <select className="app-input w-32" value={s.type}
                onChange={e => updateStat(idx, { type: e.target.value as 'stat' | 'statement' })}>
                <option value="stat">Stat</option>
                <option value="statement">Statement</option>
              </select>
              {s.type === 'stat' && (
                <input className="app-input flex-1" value={s.value}
                  onChange={e => updateStat(idx, { value: e.target.value })} placeholder="e.g. 440,000" />
              )}
            </div>
            <input className="app-input mb-2" value={s.title}
              onChange={e => updateStat(idx, { title: e.target.value })} placeholder="Title" />
            <textarea className="app-input resize-none" rows={2} value={s.description}
              onChange={e => updateStat(idx, { description: e.target.value })} placeholder="Description" />
          </ItemCard>
        ))}
        {ctx.additional_info.trim() !== '' && (
          <ItemCard include={ctx.includeAdditional} onToggle={() => setCtx({ includeAdditional: !ctx.includeAdditional })}>
            <label className="app-label">Additional info (charity #, address, leadership…)</label>
            <textarea className="app-input resize-none" rows={3} value={ctx.additional_info}
              onChange={e => setCtx({ additional_info: e.target.value })} />
          </ItemCard>
        )}
      </Section>

      {/* Locations */}
      <Section icon={MapPin} title="Locations" count={value.locations.length}>
        {value.locations.map((l, idx) => (
          <ItemCard key={idx} include={l.include}
            onToggle={() => updateList('locations', idx, { include: !l.include })}
            onRemove={() => removeFromList('locations', idx)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="app-label">Place</label>
                <input className="app-input" value={l.name}
                  onChange={e => updateList('locations', idx, { name: e.target.value })} />
              </div>
              <div>
                <label className="app-label">Country</label>
                <input className="app-input" value={l.country}
                  onChange={e => updateList('locations', idx, { country: e.target.value })} />
              </div>
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* Initiatives */}
      <Section icon={Target} title="Initiatives" count={value.initiatives.length}>
        {value.initiatives.map((i, idx) => (
          <ItemCard key={i.key} include={i.include}
            onToggle={() => updateList('initiatives', idx, { include: !i.include })}
            onRemove={() => removeFromList('initiatives', idx)}>
            <label className="app-label">Title</label>
            <input className="app-input mb-2" value={i.title}
              onChange={e => updateList('initiatives', idx, { title: e.target.value })} />
            <textarea className="app-input resize-none" rows={2} value={i.description}
              onChange={e => updateList('initiatives', idx, { description: e.target.value })} placeholder="What it aims to achieve" />
          </ItemCard>
        ))}
      </Section>

      {/* Metrics */}
      <Section icon={BarChart3} title="Metrics" count={value.metrics.length}>
        {value.metrics.map((m, idx) => (
          <MetricCard key={idx} m={m} options={initOpts} hideAttach={isInitiativeScope}
            onToggle={() => updateList('metrics', idx, { include: !m.include })}
            onRemove={() => removeFromList('metrics', idx)}
            onPatch={patch => updateList('metrics', idx, patch)} />
        ))}
        {!isInitiativeScope && value.metrics.length > 0 && initOpts.length === 0 && (
          <p className="text-[12px] text-amber-600">Add or include at least one initiative above so metrics have somewhere to attach.</p>
        )}
      </Section>

      {/* Beneficiary groups */}
      <Section icon={Users} title="Beneficiary groups" count={value.groups.length}>
        {value.groups.map((g, idx) => (
          <GroupCard key={idx} g={g} options={initOpts} hideAttach={isInitiativeScope}
            onToggle={() => updateList('groups', idx, { include: !g.include })}
            onRemove={() => removeFromList('groups', idx)}
            onPatch={patch => updateList('groups', idx, patch)} />
        ))}
      </Section>
    </div>
  )
}

function AttachSelect({ value, options, onChange }: {
  value: string
  options: { key: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="app-label">Attach to initiative</label>
      <select className="app-input" value={value} onChange={e => onChange(e.target.value)}>
        {options.length === 0 && <option value="">No initiative available</option>}
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  )
}

function MetricCard({ m, options, hideAttach, onToggle, onRemove, onPatch }: {
  m: ReviewMetric
  options: { key: string; label: string }[]
  hideAttach?: boolean
  onToggle: () => void
  onRemove: () => void
  onPatch: (patch: Partial<ReviewMetric>) => void
}) {
  return (
    <ItemCard include={m.include} onToggle={onToggle} onRemove={onRemove}>
      <label className="app-label">Metric</label>
      <input className="app-input mb-2" value={m.title} onChange={e => onPatch({ title: e.target.value })} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        <div>
          <label className="app-label">Unit</label>
          <input className="app-input" value={m.unit_of_measurement} onChange={e => onPatch({ unit_of_measurement: e.target.value })} />
        </div>
        <div>
          <label className="app-label">Type</label>
          <select className="app-input" value={m.metric_type} onChange={e => onPatch({ metric_type: e.target.value as ReviewMetric['metric_type'] })}>
            <option value="number">Number</option>
            <option value="percentage">Percentage</option>
          </select>
        </div>
        <div>
          <label className="app-label">Category</label>
          <select className="app-input" value={m.category} onChange={e => onPatch({ category: e.target.value as ReviewMetric['category'] })}>
            <option value="input">Input</option>
            <option value="output">Output</option>
            <option value="impact">Impact</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
        <div>
          <label className="app-label">Reported value</label>
          <input type="number" className="app-input" value={m.value ?? ''}
            onChange={e => onPatch({ value: e.target.value === '' ? null : Number(e.target.value) })} placeholder="optional" />
        </div>
        <div>
          <label className="app-label">Period start</label>
          <input type="date" className="app-input" value={m.period_start}
            onChange={e => onPatch({ period_start: e.target.value })} />
        </div>
        <div>
          <label className="app-label">Period end</label>
          <input type="date" className="app-input" value={m.period_end}
            onChange={e => onPatch({ period_end: e.target.value })} />
        </div>
      </div>
      {!hideAttach && (
        <AttachSelect value={m.targetKey} options={options} onChange={v => onPatch({ targetKey: v })} />
      )}
      {m.value != null && (
        <p className="text-[11px] text-secondary-400 mt-1">A data point will be created with this value.</p>
      )}
    </ItemCard>
  )
}

function GroupCard({ g, options, hideAttach, onToggle, onRemove, onPatch }: {
  g: ReviewGroup
  options: { key: string; label: string }[]
  hideAttach?: boolean
  onToggle: () => void
  onRemove: () => void
  onPatch: (patch: Partial<ReviewGroup>) => void
}) {
  return (
    <ItemCard include={g.include} onToggle={onToggle} onRemove={onRemove}>
      <label className="app-label">Group name</label>
      <input className="app-input mb-2" value={g.name} onChange={e => onPatch({ name: e.target.value })} />
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <label className="app-label">Total</label>
          <input type="number" className="app-input" value={g.total_number ?? ''}
            onChange={e => onPatch({ total_number: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="app-label">Min age</label>
          <input type="number" className="app-input" value={g.age_range_start ?? ''}
            onChange={e => onPatch({ age_range_start: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
        <div>
          <label className="app-label">Max age</label>
          <input type="number" className="app-input" value={g.age_range_end ?? ''}
            onChange={e => onPatch({ age_range_end: e.target.value === '' ? null : Number(e.target.value) })} />
        </div>
      </div>
      {!hideAttach && (
        <AttachSelect value={g.targetKey} options={options} onChange={v => onPatch({ targetKey: v })} />
      )}
    </ItemCard>
  )
}
