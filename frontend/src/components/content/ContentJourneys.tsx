import { useEffect, useState } from 'react'
import { CheckCircle2, ChevronLeft, Globe, Image as Images, Pencil, Plus, RotateCcw, Route, Share2, Trash2 } from 'lucide-react'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from '../ModalFrame'
import { EmptyState, PageHelpTip, SectionLoader, Spinner } from '../ui'
import { apiService } from '../../services/api'
import { formatDate } from '../../utils'
import type { ContentJourney, ContentJourneyStatus, ContentPackage, Initiative } from '../../types'

export type JourneyFilter = 'all' | ContentJourneyStatus

export function PublishSoon({ small }: { small?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled
        className={`app-btn app-btn-secondary pointer-events-none cursor-not-allowed opacity-40 ${small ? 'app-btn-sm' : ''}`}
      >
        <Globe className={small ? 'w-3.5 h-3.5' : 'w-4 h-4'} /> Publish
      </button>
      <PageHelpTip label="Publishing" align="end">
        <p>Publishing to your Nexus public page is coming very soon. Save everything as a draft for now. Drafts stay with your team until you can publish.</p>
      </PageHelpTip>
    </span>
  )
}

export function PublishBadge({ published }: { published: boolean }) {
  return published ? (
    <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide inline-flex items-center gap-1">
      <Globe className="w-3 h-3" /> Published
    </span>
  ) : (
    <span className="app-chip text-[10px] uppercase tracking-wide">Draft</span>
  )
}

export function sortJourneys(journeys: ContentJourney[]): ContentJourney[] {
  const rank = (j: ContentJourney) => (j.status === 'completed' ? 1 : 0)
  return [...journeys].sort((a, b) => rank(a) - rank(b))
}

export function JourneyStatusBadge({ status }: { status: ContentJourneyStatus }) {
  return status === 'completed' ? (
    <span className="app-chip bg-white/95 text-secondary-600 text-[10px] uppercase tracking-wide inline-flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" /> Completed
    </span>
  ) : (
    <span className="app-chip bg-white/95 text-impact-700 text-[10px] uppercase tracking-wide inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-impact-500" /> Ongoing
    </span>
  )
}

export function SocialCount({ count, stale }: { count: number; stale?: boolean }) {
  if (!count) return null
  return (
    <span className={`app-chip text-[10px] inline-flex items-center gap-1 ${stale ? 'bg-amber-50 text-amber-700 border-amber-200' : ''}`}>
      <Share2 className="w-3 h-3" /> {count} social{stale ? ' · outdated' : ''}
    </span>
  )
}

export function JourneyFilters({ value, onChange }: { value: JourneyFilter; onChange: (next: JourneyFilter) => void }) {
  return (
    <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-white/10 bg-black/20">
      {([['all', 'Any'], ['ongoing', 'Ongoing'], ['completed', 'Completed']] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`h-full rounded-full text-[13px] font-medium transition-all ${
            value === id ? 'px-3.5 bg-white text-[#1c242b]' : 'px-3 text-white/50 hover:text-white'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function JourneyGrid({
  journeys,
  loading,
  filter,
  onOpen,
  onAddUpdate,
  onCreate,
}: {
  journeys: ContentJourney[]
  loading: boolean
  filter: JourneyFilter
  onOpen: (journey: ContentJourney) => void
  onAddUpdate: (journey: ContentJourney) => void
  onCreate: () => void
}) {
  if (loading) return <SectionLoader />
  const visible = sortJourneys(filter === 'all' ? journeys : journeys.filter(j => j.status === filter))
  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <EmptyState
          icon={Route}
          title={journeys.length ? 'Nothing here' : 'No journeys yet'}
          description={journeys.length
            ? 'No journeys match this filter.'
            : 'Follow a class, a family, or a project over time. Add updates as it happens.'}
          action={journeys.length ? undefined : (
            <button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={onCreate}>New journey</button>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map(journey => (
            <JourneyCard key={journey.id} journey={journey} onOpen={() => onOpen(journey)} onAddUpdate={() => onAddUpdate(journey)} />
          ))}
        </div>
      )}
    </div>
  )
}

export function JourneyCard({
  journey,
  onOpen,
  onAddUpdate,
  compact,
}: {
  journey: ContentJourney
  onOpen: () => void
  onAddUpdate: () => void
  compact?: boolean
}) {
  const last = journey.last_update_at || journey.created_at
  return (
    <article className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left cursor-pointer flex flex-col transition-colors hover:bg-white/[0.08] hover:border-white/20" onClick={onOpen}>
      <div className={`relative w-full bg-white/5 ${compact ? 'h-24' : 'h-36'}`}>
        {journey.cover_url ? (
          <img src={journey.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center text-white/70">
            <Route className="w-7 h-7" />
          </span>
        )}
        <span className="absolute top-2 left-2 app-chip bg-white/95 text-[10px] uppercase tracking-wide">
          {journey.update_count} {journey.update_count === 1 ? 'update' : 'updates'}
        </span>
        <span className="absolute top-2 right-2">
          <JourneyStatusBadge status={journey.status} />
        </span>
      </div>
      <div className="p-4 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-white line-clamp-1 min-w-0">{journey.title}</p>
          {!compact && <span className="ml-auto flex-shrink-0"><PublishBadge published={!!journey.published_at} /></span>}
        </div>
        {!compact && journey.description && (
          <p className="text-[13px] text-white/70 line-clamp-2">{journey.description}</p>
        )}
        <p className="text-[11px] text-white/40">
          {journey.initiative_title ? `${journey.initiative_title} · ` : ''}
          {journey.update_count ? 'Updated' : 'Started'} {formatDate(last, { month: 'short', day: 'numeric' })}
        </p>
        <button
          type="button"
          className="app-btn app-btn-secondary app-btn-sm mt-auto self-start"
          onClick={e => { e.stopPropagation(); onAddUpdate() }}
        >
          <Plus className="w-3.5 h-3.5" /> Add update
        </button>
      </div>
    </article>
  )
}

export function JourneyModal({
  journey,
  programs,
  onClose,
  onSave,
}: {
  journey?: ContentJourney | null
  programs: Initiative[]
  onClose: () => void
  onSave: (input: { title: string; description: string | null; initiative_id: string | null }) => Promise<void>
}) {
  const [title, setTitle] = useState(journey?.title || '')
  const [description, setDescription] = useState(journey?.description || '')
  const [initiativeId, setInitiativeId] = useState(journey?.initiative_id || '')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ title: title.trim(), description: description.trim() || null, initiative_id: initiativeId || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalFrame size="md" onClose={onClose}>
      <ModalHeader
        icon={Route}
        title={journey ? 'Edit journey' : 'New journey'}
        subtitle="A folder of updates that follows something over time."
        onClose={onClose}
      />
      <ModalBody rail>
        <div className="space-y-4">
          <div>
            <label className="app-label">Name</label>
            <input
              className="app-input"
              value={title}
              autoFocus
              maxLength={120}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ms. Rivera's 3rd grade, 2026-27"
            />
          </div>
          <div>
            <label className="app-label">Who or what are you following?</label>
            <textarea
              className="app-input resize-none"
              rows={3}
              maxLength={1000}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="22 students in our after-school reading program. We'll share how they grow through the year."
            />
            <p className="app-help">Shown with the journey on your public page. Nexus also uses it to keep every update on the same thread.</p>
          </div>
          <div>
            <label className="app-label">Program (optional)</label>
            <select className="app-input" value={initiativeId} onChange={e => setInitiativeId(e.target.value)}>
              <option value="">No program</option>
              {programs.filter(p => p.id).map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
            <p className="app-help">Photos from this program show first when you add an update.</p>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <button type="button" className="app-btn app-btn-ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="app-btn app-btn-primary" disabled={!title.trim() || saving} onClick={submit}>
          {saving ? <Spinner className="w-3.5 h-3.5" /> : null}
          {journey ? 'Save' : 'Create journey'}
        </button>
      </ModalFooter>
    </ModalFrame>
  )
}

export function JourneyDetail({
  journey,
  updates,
  loading,
  onBack,
  onAddUpdate,
  onOpenUpdate,
  onEdit,
  onToggleStatus,
  onTogglePublished,
  onDelete,
}: {
  journey: ContentJourney
  updates: ContentPackage[]
  loading: boolean
  onBack: () => void
  onAddUpdate: () => void
  onOpenUpdate: (pkg: ContentPackage) => void
  onEdit: () => void
  onToggleStatus: () => void
  onTogglePublished: () => void
  onDelete: () => void
}) {
  const completed = journey.status === 'completed'
  const published = !!journey.published_at
  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onEdit}>
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onToggleStatus}>
            {completed ? <RotateCcw className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {completed ? 'Mark ongoing' : 'Mark completed'}
          </button>
          {published ? (
            <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onTogglePublished}>
              <Globe className="w-3.5 h-3.5" /> Move to draft
            </button>
          ) : (
            <PublishSoon small />
          )}
          <button type="button" className="app-btn app-btn-ghost app-btn-sm text-secondary-500 hover:text-red-600" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      </div>

      <section className="app-card p-5 flex flex-wrap items-start gap-4">
        <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center flex-shrink-0 bg-white/10 text-white">
          <Route className="w-6 h-6" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-impact-700">
              Journey · {completed ? 'Completed' : 'Ongoing'}
            </p>
            <PublishBadge published={published} />
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-secondary-900">{journey.title}</h2>
          {journey.description && <p className="mt-1 text-sm text-secondary-600 leading-relaxed max-w-2xl">{journey.description}</p>}
          <p className="mt-2 text-[12px] text-secondary-400">
            {journey.initiative_title ? `${journey.initiative_title} · ` : ''}
            {updates.length} {updates.length === 1 ? 'update' : 'updates'}
            {updates.length ? ` (${updates.filter(u => u.published_at).length} published)` : ''}
            {' · '}Started {formatDate(journey.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
          {!published && (
            <p className="mt-2 text-[12px] text-secondary-500">
              This journey is a draft. Save updates as drafts until publishing is on.
            </p>
          )}
        </div>
        <button type="button" className="app-btn app-btn-primary" onClick={onAddUpdate}>
          <Plus className="w-4 h-4" /> Add update
        </button>
      </section>

      {loading ? (
        <SectionLoader />
      ) : updates.length === 0 ? (
        <EmptyState
          icon={Images}
          title="No updates yet"
          description="Add the first update. Pick photos, write it yourself or let Nexus draft it, then save it as a draft."
          action={<button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={onAddUpdate}>Add update</button>}
        />
      ) : (
        <ol className="relative space-y-3 pl-6 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-px before:bg-white/20">
          {updates.map((pkg, i) => (
            <li key={pkg.id} className="relative">
              <span className={`absolute -left-6 top-4 w-[19px] h-[19px] rounded-full bg-[#2C343B] border-2 ${pkg.published_at ? 'border-seafoam' : 'border-white/30'}`} />
              <article
                className="app-card-interactive overflow-hidden cursor-pointer flex flex-col sm:flex-row"
                onClick={() => onOpenUpdate(pkg)}
              >
                {pkg.image_url && (
                  <div className="relative sm:w-44 h-40 sm:h-auto flex-shrink-0 bg-gray-50">
                    <img src={pkg.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    {(pkg.media?.length || 0) > 1 && (
                      <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-white">
                        <Images className="w-3 h-3" /> {pkg.media!.length}
                      </span>
                    )}
                  </div>
                )}
                <div className="p-4 space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-impact-700">Update {updates.length - i}</span>
                    <span className="text-[11px] text-secondary-400">{formatDate(pkg.created_at, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="ml-auto flex items-center gap-1">
                      <SocialCount count={pkg.versions?.length || 0} stale={pkg.channels_stale} />
                      <PublishBadge published={!!pkg.published_at} />
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-secondary-900">{pkg.hook}</p>
                  <p className="text-sm text-secondary-600 line-clamp-2 whitespace-pre-line">{pkg.body}</p>
                </div>
              </article>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export function usePrograms(enabled: boolean, orgId?: string) {
  const [programs, setPrograms] = useState<Initiative[]>([])
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    apiService.getInitiatives()
      .then(rows => { if (!cancelled) setPrograms(rows) })
      .catch(() => { if (!cancelled) setPrograms([]) })
    return () => { cancelled = true }
  }, [enabled, orgId])
  return programs
}
