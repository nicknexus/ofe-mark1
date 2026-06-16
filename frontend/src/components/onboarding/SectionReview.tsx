import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Trash2, Check, Loader2, MapPin, Target, BarChart3, Users, Building2 } from 'lucide-react'
import {
  ChatStage, SectionItem, DescriptionItem, LocationItem, InitiativeItem, MetricItem, GroupItem,
} from './planTypes'
import { easeOut } from './motion'

interface Props {
  stage: ChatStage
  items: SectionItem[]
  onChange: (items: SectionItem[]) => void
  onConfirm: () => void
  onSkip: () => void
  persisting: boolean
  scopeLabel?: string
}

const STAGE_META: Record<ChatStage, { icon: React.ComponentType<any>; title: string; addLabel: string; confirm: string }> = {
  description: { icon: Building2, title: 'Your organization', addLabel: '', confirm: 'Save & continue' },
  locations: { icon: MapPin, title: 'Locations', addLabel: 'Add location', confirm: 'Add & continue' },
  initiatives: { icon: Target, title: 'Initiatives', addLabel: 'Add initiative', confirm: 'Add & continue' },
  metrics: { icon: BarChart3, title: 'Metrics', addLabel: 'Add metric', confirm: 'Add & continue' },
  groups: { icon: Users, title: 'Beneficiary groups', addLabel: 'Add group', confirm: 'Add & continue' },
}

function blankItem(stage: ChatStage): SectionItem {
  switch (stage) {
    case 'description': return { statement: '', description: '' }
    case 'locations': return { name: '', country: '' }
    case 'initiatives': return { title: '', description: '', region: '' }
    case 'metrics': return { title: '', description: '', unit_of_measurement: '', metric_type: 'number', category: 'output', tags: [] }
    case 'groups': return { name: '', description: '', total_number: null, age_range_start: null, age_range_end: null }
  }
}

export default function SectionReview({ stage, items, onChange, onConfirm, onSkip, persisting, scopeLabel }: Props) {
  const meta = STAGE_META[stage]
  const Icon = meta.icon

  const update = (idx: number, patch: any) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  const add = () => onChange([...items, blankItem(stage)])

  const isList = stage !== 'description'
  const canConfirm = items.length > 0 && !persisting

  return (
    <div className="onboarding-review-card">
      <div className="onboarding-review-card-head">
        <span className="app-icon-tile app-icon-tile-sm app-icon-tile-accent">
          <Icon className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-secondary-900 leading-tight">{meta.title}</p>
          {scopeLabel && <p className="text-[11px] text-secondary-400 truncate">for {scopeLabel}</p>}
        </div>
        <span className="ml-auto text-[11px] text-secondary-400 shrink-0">Edit before saving</span>
      </div>

      <div className="onboarding-review-card-body space-y-3">
        <AnimatePresence initial={false}>
        {items.map((item, idx) => (
          <motion.div
            key={idx}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: easeOut }}
            className={isList ? 'app-card-muted p-3 relative group' : ''}
          >
            {isList && items.length > 1 && (
              <button
                type="button"
                onClick={() => remove(idx)}
                className="absolute top-2 right-2 p-1 rounded-md text-secondary-300 hover:text-red-500 hover:bg-white transition"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {stage === 'description' && (
              <div className="space-y-3">
                <div>
                  <label className="app-label">Mission statement</label>
                  <input className="app-input" value={(item as DescriptionItem).statement} maxLength={150}
                    onChange={(e) => update(idx, { statement: e.target.value })} placeholder="One line on what you do" />
                </div>
                <div>
                  <label className="app-label">Description</label>
                  <textarea className="app-input resize-none" rows={3} value={(item as DescriptionItem).description}
                    onChange={(e) => update(idx, { description: e.target.value })} placeholder="A short paragraph about your work" />
                </div>
              </div>
            )}

            {stage === 'locations' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-6">
                <div>
                  <label className="app-label">Place</label>
                  <input className="app-input" value={(item as LocationItem).name}
                    onChange={(e) => update(idx, { name: e.target.value })} placeholder="e.g. Nairobi, Kenya" />
                </div>
                <div>
                  <label className="app-label">Country (optional)</label>
                  <input className="app-input" value={(item as LocationItem).country || ''}
                    onChange={(e) => update(idx, { country: e.target.value })} placeholder="Kenya" />
                </div>
              </div>
            )}

            {stage === 'initiatives' && (
              <div className="space-y-2.5 pr-6">
                <div>
                  <label className="app-label">Title</label>
                  <input className="app-input" value={(item as InitiativeItem).title}
                    onChange={(e) => update(idx, { title: e.target.value })} placeholder="e.g. Youth Training 2025" />
                </div>
                <div>
                  <label className="app-label">Description</label>
                  <textarea className="app-input resize-none" rows={2} value={(item as InitiativeItem).description || ''}
                    onChange={(e) => update(idx, { description: e.target.value })} placeholder="What it aims to achieve" />
                </div>
              </div>
            )}

            {stage === 'metrics' && (
              <div className="space-y-2.5 pr-6">
                <div>
                  <label className="app-label">Metric</label>
                  <input className="app-input" value={(item as MetricItem).title}
                    onChange={(e) => update(idx, { title: e.target.value })} placeholder="e.g. Students Trained" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="app-label">Unit</label>
                    <input className="app-input" value={(item as MetricItem).unit_of_measurement}
                      onChange={(e) => update(idx, { unit_of_measurement: e.target.value })} placeholder="People" />
                  </div>
                  <div>
                    <label className="app-label">Type</label>
                    <select className="app-input" value={(item as MetricItem).metric_type}
                      onChange={(e) => update(idx, { metric_type: e.target.value })}>
                      <option value="number">Number</option>
                      <option value="percentage">Percentage</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="app-label">Category</label>
                    <select className="app-input" value={(item as MetricItem).category}
                      onChange={(e) => update(idx, { category: e.target.value })}>
                      <option value="input">Input</option>
                      <option value="output">Output</option>
                      <option value="impact">Impact</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="app-label">Tags (comma separated, optional)</label>
                  <input className="app-input" value={((item as MetricItem).tags || []).join(', ')}
                    onChange={(e) => update(idx, { tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="Grade 1, Grade 2" />
                </div>
              </div>
            )}

            {stage === 'groups' && (
              <div className="space-y-2.5 pr-6">
                <div>
                  <label className="app-label">Group name</label>
                  <input className="app-input" value={(item as GroupItem).name}
                    onChange={(e) => update(idx, { name: e.target.value })} placeholder="e.g. Children 5-12" />
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="app-label">Total</label>
                    <input type="number" className="app-input" value={(item as GroupItem).total_number ?? ''}
                      onChange={(e) => update(idx, { total_number: e.target.value === '' ? null : Number(e.target.value) })} placeholder="150" />
                  </div>
                  <div>
                    <label className="app-label">Min age</label>
                    <input type="number" className="app-input" value={(item as GroupItem).age_range_start ?? ''}
                      onChange={(e) => update(idx, { age_range_start: e.target.value === '' ? null : Number(e.target.value) })} placeholder="5" />
                  </div>
                  <div>
                    <label className="app-label">Max age</label>
                    <input type="number" className="app-input" value={(item as GroupItem).age_range_end ?? ''}
                      onChange={(e) => update(idx, { age_range_end: e.target.value === '' ? null : Number(e.target.value) })} placeholder="12" />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ))}
        </AnimatePresence>

        {isList && (
          <button type="button" onClick={add}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--ob-border-strong)] py-2.5 text-sm font-medium text-secondary-500 hover:border-[var(--ob-accent-2)] hover:text-[var(--ob-accent)] hover:bg-[var(--ob-muted)] transition">
            <Plus className="w-4 h-4" /> {meta.addLabel}
          </button>
        )}
      </div>

      <div className="onboarding-review-card-foot">
        <button type="button" onClick={onConfirm} disabled={!canConfirm}
          className="app-btn app-btn-primary app-btn-sm flex-1 disabled:opacity-50">
          {persisting ? <><Loader2 className="w-4 h-4 animate-spin" /> Adding…</> : <><Check className="w-4 h-4" /> {meta.confirm}</>}
        </button>
        <button type="button" onClick={onSkip} disabled={persisting}
          className="app-btn app-btn-ghost app-btn-sm text-secondary-500">
          Skip
        </button>
      </div>
    </div>
  )
}
