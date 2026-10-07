import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Camera,
  Check,
  ChevronLeft,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  RefreshCw,
  Route,
  Star,
  X,
} from 'lucide-react'
import { EmptyState, SectionLoader, Skeleton, Spinner } from '../ui'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import type { ContentIdea, ContentIdeaGuide } from '../../types'

type Level = 'quick' | 'good' | 'story'

const EASE = [0.16, 1, 0.3, 1] as const
const DISMISS_REASONS = ['Not relevant', 'Already did this', "Can't get access", 'Other'] as const
const CHANNEL_LABELS: Record<string, string> = {
  nexus: 'Your Nexus page',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  donor_email: 'Donor email',
  sms: 'SMS',
}
const LEVEL_TIMES: Record<Level, string> = { quick: '2 to 5 min', good: '10 to 15 min', story: '20 to 30 min' }

function Where({ idea }: { idea: ContentIdea }) {
  if (idea.journey_title) {
    return (
      <span className="inline-flex items-center gap-1 min-w-0 text-impact-700">
        <Route className="w-3 h-3 flex-shrink-0" /> <span className="truncate">{idea.journey_title}</span>
      </span>
    )
  }
  if (idea.initiative_title) return <span className="truncate">{idea.initiative_title}</span>
  return null
}

function DismissReasons({ onPick, onCancel }: { onPick: (reason: string) => void; onCancel: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[12px] text-white/50 mr-1">Why not?</span>
      {DISMISS_REASONS.map(reason => (
        <button key={reason} type="button" className="app-chip text-[12px] hover:bg-white/10" onClick={() => onPick(reason)}>
          {reason}
        </button>
      ))}
      <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2" onClick={onCancel} aria-label="Cancel">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function orderIdeas(ideas: ContentIdea[]) {
  return [...ideas.filter(i => i.status === 'suggested'), ...ideas.filter(i => i.status === 'accepted')]
}

function IdeaActions({
  idea,
  featured,
  onOpen,
  onLater,
  onDismiss,
}: {
  idea: ContentIdea
  featured: boolean
  onOpen: () => void
  onLater: () => void
  onDismiss: (reason: string) => void
}) {
  const [dismissing, setDismissing] = useState(false)
  const inProgress = idea.status === 'accepted'
  if (dismissing) {
    return <DismissReasons onPick={reason => { setDismissing(false); onDismiss(reason) }} onCancel={() => setDismissing(false)} />
  }
  return (
    <div className="flex flex-wrap items-center gap-1">
      <button type="button" className={`app-btn app-btn-sm ${featured ? 'app-btn-primary' : 'app-btn-secondary'}`} onClick={onOpen}>
        <Camera className="w-3.5 h-3.5" /> {inProgress ? 'Open brief' : 'Capture'}
      </button>
      <button type="button" className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10" onClick={onLater}>Later</button>
      <button type="button" className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/10" onClick={() => setDismissing(true)}>
        Not useful
      </button>
    </div>
  )
}

export function CaptureToolbar({
  refreshing,
  unavailable,
  onRefresh,
}: {
  refreshing: boolean
  unavailable?: boolean
  onRefresh: () => void
}) {
  return (
    <>
      <p className="text-[13px] text-white/50 min-w-0">Stories worth getting, picked from what you already track.</p>
      <button type="button" className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 inline-flex items-center gap-1.5 disabled:opacity-50" disabled={refreshing || unavailable} onClick={onRefresh}>
        {refreshing ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />} New ideas
      </button>
    </>
  )
}

export function CaptureQueue({
  ideas,
  loading,
  refreshing,
  unavailable,
  onOpen,
  onLater,
  onDismiss,
}: {
  ideas: ContentIdea[]
  loading: boolean
  refreshing: boolean
  unavailable?: boolean
  onOpen: (idea: ContentIdea) => void
  onLater: (idea: ContentIdea) => void
  onDismiss: (idea: ContentIdea, reason: string) => void
}) {
  const ordered = orderIdeas(ideas)
  const busy = loading || refreshing

  return (
    <div className="pb-8">
      {unavailable ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-[13px] text-white/70">Capture ideas aren't available for this organization yet.</p>
        </div>
      ) : busy && ordered.length === 0 ? (
        <div className="space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-3">
          <Check className="w-4 h-4 text-seafoam flex-shrink-0" />
          <p className="text-[13px] text-white/70">
            Nothing urgent to capture right now. Keep tracking, and Nexus will spot the next good story.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {ordered.map((idea, i) => {
            const featured = i === 0 && idea.status === 'suggested'
            const ask = idea.card.ask[0]
            return (
              <article key={idea.id} className={`rounded-2xl border px-4 py-3.5 ${featured ? 'border-seafoam/40 bg-white/[0.07]' : 'border-white/10 bg-white/5'}`}>
                <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                  <button type="button" className="min-w-0 flex-1 text-left group" onClick={() => onOpen(idea)}>
                    <div className="flex flex-wrap items-center gap-2">
                      {featured && (
                        <span className="app-chip app-chip-accent text-[10px] uppercase tracking-wide inline-flex items-center gap-1">
                          <Star className="w-3 h-3" /> Recommended
                        </span>
                      )}
                      {idea.status === 'accepted' && (
                        <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide">In progress</span>
                      )}
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-seafoam">{idea.angle_label}</span>
                      <span className="text-[12px] text-white/50 min-w-0"><Where idea={idea} /></span>
                    </div>
                    <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-white leading-snug group-hover:text-seafoam">
                      {idea.card.title}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-white/70 leading-snug line-clamp-2">{idea.card.why}</p>
                    {ask && (
                      <p className="mt-1.5 text-[13px] italic text-white/80 line-clamp-1">&ldquo;{ask}&rdquo;</p>
                    )}
                  </button>
                  <div className="flex flex-col items-start gap-2 lg:items-end flex-shrink-0">
                    <span className="inline-flex items-center gap-1 text-[12px] text-white/50">
                      <Clock className="w-3 h-3" /> {LEVEL_TIMES.quick}
                    </span>
                    <IdeaActions
                      idea={idea}
                      featured={featured}
                      onOpen={() => onOpen(idea)}
                      onLater={() => onLater(idea)}
                      onDismiss={reason => onDismiss(idea, reason)}
                    />
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function NextCapture({
  ideas,
  onOpen,
  onAll,
}: {
  ideas: ContentIdea[]
  onOpen: (idea: ContentIdea) => void
  onAll: () => void
}) {
  const ordered = orderIdeas(ideas)
  const idea = ordered[0]
  if (!idea) return null
  const more = ordered.length - 1
  const ask = idea.card.ask[0]
  return (
    <aside className="sticky top-0 space-y-2">
      <p className="app-section-title">Next to capture</p>
      <article className="app-card p-4">
        <div className="flex items-center gap-2 min-w-0">
          {idea.status === 'suggested' ? (
            <span className="app-chip app-chip-accent text-[10px] uppercase tracking-wide inline-flex items-center gap-1 flex-shrink-0">
              <Star className="w-3 h-3" /> Recommended
            </span>
          ) : (
            <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide flex-shrink-0">In progress</span>
          )}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-800 truncate">{idea.angle_label}</span>
        </div>
        <button type="button" className="mt-2 text-left group" onClick={() => onOpen(idea)}>
          <h3 className="text-[15px] font-semibold tracking-tight text-secondary-900 leading-snug group-hover:text-primary-800">
            {idea.card.title}
          </h3>
          <p className="mt-1 text-[13px] text-secondary-600 leading-snug line-clamp-3">{idea.card.why}</p>
        </button>
        {ask && (
          <p className="mt-3 pl-3 border-l-2 border-primary-300 text-[13px] italic text-secondary-800 leading-snug line-clamp-3">
            &ldquo;{ask}&rdquo;
          </p>
        )}
        <div className="mt-3 flex items-center gap-2 text-[12px] text-secondary-500 min-w-0">
          <Where idea={idea} />
          <span className="inline-flex items-center gap-1 flex-shrink-0 ml-auto">
            <Clock className="w-3 h-3" /> {LEVEL_TIMES.quick}
          </span>
        </div>
        <button type="button" className="app-btn app-btn-primary app-btn-sm mt-4 w-full" onClick={() => onOpen(idea)}>
          <Camera className="w-3.5 h-3.5" /> Capture this
        </button>
      </article>
      {more > 0 && (
        <button type="button" className="app-btn app-btn-ghost app-btn-sm w-full" onClick={onAll}>
          {more} more to capture
        </button>
      )}
    </aside>
  )
}

export function IdeaBrief({
  ideaId,
  onBack,
  onCapture,
  onUsePhotos,
  onLater,
  onDismiss,
  onOpenPost,
}: {
  ideaId: string
  onBack: () => void
  onCapture: (idea: ContentIdea) => void
  onUsePhotos: (idea: ContentIdea) => void
  onLater: (idea: ContentIdea) => void
  onDismiss: (idea: ContentIdea, reason: string) => void
  onOpenPost: (packageId: string) => void
}) {
  const reduce = useReducedMotion()
  const [idea, setIdea] = useState<(ContentIdea & { guide: ContentIdeaGuide }) | null>(null)
  const [missing, setMissing] = useState(false)
  const [level, setLevel] = useState<Level>('quick')
  const [dismissing, setDismissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIdea(null)
    setMissing(false)
    apiService.getContentIdea(ideaId)
      .then(row => { if (!cancelled) setIdea(row) })
      .catch(() => { if (!cancelled) setMissing(true) })
    return () => { cancelled = true }
  }, [ideaId])

  if (missing) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Idea not found"
        description="It may have expired, or it belongs to another organization."
        action={<button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onBack}>Back to content</button>}
      />
    )
  }
  if (!idea) return <SectionLoader />

  const { card, guide } = idea
  const steps = card.capture[level].length ? card.capture[level] : card.capture.quick
  const done = idea.status === 'posted'
  const closed = idea.status === 'dismissed' || idea.status === 'expired'

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    notify.success('Link copied. Send it to whoever is on site.')
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="w-full max-w-3xl mx-auto pb-28 space-y-4"
    >
      <div className="flex items-center gap-2">
        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button type="button" className="app-btn app-btn-ghost app-btn-sm ml-auto" onClick={copyLink}>
          <Link2 className="w-3.5 h-3.5" /> Copy link
        </button>
      </div>

      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-primary-800">{idea.angle_label}</span>
          {done && <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide">Posted</span>}
          {closed && <span className="app-chip text-[10px] uppercase tracking-wide">Closed</span>}
          <span className="text-[12px] text-secondary-500 min-w-0 flex"><Where idea={idea} /></span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-secondary-900 leading-snug">{card.title}</h2>
        <p className="mt-2 text-[14px] text-secondary-600 leading-relaxed">{card.why}</p>
        <div className="mt-4 app-card-muted px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500">Who to find</p>
          <p className="mt-0.5 text-[14px] text-secondary-900">{card.who}</p>
        </div>
      </section>

      <section className="app-card p-5 sm:p-6">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500">What to ask</p>
        <ol className="mt-3 space-y-3">
          {card.ask.map((q, i) => (
            <li key={q} className="flex gap-3">
              <span className="inline-flex w-7 h-7 rounded-full items-center justify-center flex-shrink-0 bg-white/10 text-white text-[13px] font-semibold">
                {i + 1}
              </span>
              <p className="text-[17px] sm:text-[18px] font-medium text-secondary-900 leading-snug pt-0.5">&ldquo;{q}&rdquo;</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[12px] text-secondary-500">Let them finish. Ask one follow-up. Write down their strongest sentence exactly as they said it.</p>
      </section>

      <section className="app-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500">How to capture it</p>
          <div className="app-segmented ml-auto">
            {(['quick', 'good', 'story'] as const).map(id => (
              <button
                key={id}
                type="button"
                aria-current={level === id ? 'page' : undefined}
                className="app-segmented-item"
                onClick={() => setLevel(id)}
              >
                {guide.levels[id]?.label || id}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[12px] text-secondary-500 inline-flex items-center gap-1">
          <Clock className="w-3 h-3" /> {guide.levels[level]?.time || LEVEL_TIMES[level]}
          {level === 'quick' ? '. Only have five minutes? Do this.' : ''}
        </p>
        <ol className="mt-3 space-y-2">
          {steps.map((step, i) => (
            <li key={`${level}-${i}`} className="flex gap-3 text-[14px] text-secondary-800 leading-snug">
              <span className="text-secondary-400 font-medium w-4 flex-shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="app-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-impact-700">Do</p>
          <ul className="mt-2 space-y-1.5">
            {guide.do.map(line => (
              <li key={line} className="flex gap-2 text-[13px] text-secondary-700 leading-snug">
                <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-impact-600" /> {line}
              </li>
            ))}
          </ul>
        </div>
        <div className="app-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-red-700">Don't</p>
          <ul className="mt-2 space-y-1.5">
            {guide.dont.map(line => (
              <li key={line} className="flex gap-2 text-[13px] text-secondary-700 leading-snug">
                <X className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-500" /> {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="app-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-secondary-500">Best for</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.channels.map(c => (
            <span key={c} className="app-chip text-[12px]">{CHANNEL_LABELS[c] || c}</span>
          ))}
        </div>
        {(card.journey_potential || card.follow_up) && (
          <p className="mt-3 text-[13px] text-secondary-600 flex gap-2">
            <Route className="w-4 h-4 flex-shrink-0 text-impact-700 mt-0.5" />
            <span>
              {card.journey_potential && !idea.journey_id ? 'This could become a journey. ' : ''}
              {card.follow_up}
            </span>
          </p>
        )}
      </section>

      <div className="sticky bottom-4 z-10 app-card-elevated px-4 py-3">
        {done && idea.package_id ? (
          <button type="button" className="app-btn app-btn-primary" onClick={() => onOpenPost(idea.package_id!)}>
            <ExternalLink className="w-4 h-4" /> Open the post
          </button>
        ) : dismissing ? (
          <DismissReasons
            onPick={reason => { setDismissing(false); onDismiss(idea, reason) }}
            onCancel={() => setDismissing(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="app-btn app-btn-primary" onClick={() => onCapture(idea)}>
              <Camera className="w-4 h-4" /> I captured it
            </button>
            <button type="button" className="app-btn app-btn-secondary" onClick={() => onUsePhotos(idea)}>
              <ImageIcon className="w-4 h-4" /> Use photos I have
            </button>
            {!closed && (
              <>
                <button type="button" className="app-btn app-btn-ghost ml-auto" onClick={() => onLater(idea)}>Later</button>
                <button type="button" className="app-btn app-btn-ghost text-secondary-500" onClick={() => setDismissing(true)}>Not useful</button>
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
