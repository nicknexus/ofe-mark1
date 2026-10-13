import { useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowRight,
  Bookmark,
  Camera,
  Check,
  ChevronLeft,
  ExternalLink,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Plus,
  RefreshCw,
  Route,
  Sparkles,
  X,
} from 'lucide-react'
import { EmptyState, SectionLoader, Skeleton, Spinner } from '../ui'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { FILMING_META, FILMING_ORDER, LENS_META, toCardV2 } from './ideaCard'
import { STAKEHOLDER_ART } from './ContentImpactWeb'
import type {
  ContentIdea,
  ContentIdeaFilmingIdea,
  ContentIdeaGuide,
  ContentIdeaSelection,
  IdeaFilmingCategory,
} from '../../types'

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
const YES_NO_START = /^(are|is|do|does|did|have|has|can|could|will|would|was|were|should)\b/i

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
      <span className="text-[12px] text-secondary-500 mr-1">Why not?</span>
      {DISMISS_REASONS.map(reason => (
        <button key={reason} type="button" className="app-chip text-[12px]" onClick={() => onPick(reason)}>
          {reason}
        </button>
      ))}
      <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2" onClick={onCancel} aria-label="Cancel">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function CaptureToolbar({
  refreshing,
  unavailable,
  saved,
  onRefresh,
  onTodos,
}: {
  refreshing: boolean
  unavailable?: boolean
  saved: number
  onRefresh: () => void
  onTodos: () => void
}) {
  return (
    <>
      <p className="text-[13px] text-white/50 min-w-0">Stories worth getting, picked from what you already track.</p>
      <button
        type="button"
        className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 inline-flex items-center gap-1.5"
        onClick={onTodos}
      >
        <Bookmark className="w-3.5 h-3.5" /> Saved{saved > 0 ? ` (${saved})` : ''}
      </button>
      <button
        type="button"
        className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 inline-flex items-center gap-1.5 disabled:opacity-50"
        disabled={refreshing || unavailable}
        onClick={onRefresh}
      >
        {refreshing ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />} New ideas
      </button>
    </>
  )
}

/** Saved cards, in the short form. Tap one to open the full card. */
export function CaptureTodos({
  ideas,
  loading,
  onOpen,
  onBack,
}: {
  ideas: ContentIdea[]
  loading: boolean
  onOpen: (idea: ContentIdea) => void
  onBack: () => void
}) {
  const saved = ideas.filter(i => i.status === 'accepted')
  return (
    <div className="pb-8">
      <button type="button" className="app-btn app-btn-ghost app-btn-sm mb-4" onClick={onBack}>
        <ChevronLeft className="w-4 h-4" /> Back to the web
      </button>
      {loading && saved.length === 0 ? (
        <div className="space-y-2">
          {[0, 1].map(i => (
            <div key={i} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ))}
        </div>
      ) : saved.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 flex items-center gap-3">
          <Bookmark className="w-4 h-4 text-seafoam flex-shrink-0" />
          <p className="text-[13px] text-white/70">Nothing saved yet. Open a circle and save the card you want to capture.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {saved.map(idea => {
            const card = toCardV2(idea.card)
            const art = idea.stakeholder ? STAKEHOLDER_ART[idea.stakeholder] : null
            const picked = card.selection?.filming_category
            const filming = picked ? FILMING_META[picked] : null
            const FilmIcon = filming?.icon
            return (
              <button
                key={idea.id}
                type="button"
                className="w-full text-left rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 hover:border-white/25 group"
                onClick={() => onOpen(idea)}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${art ? art.text : 'text-seafoam'}`}>
                    {idea.angle_label}
                  </span>
                  <span className="text-[12px] text-white/50 min-w-0"><Where idea={idea} /></span>
                </div>
                <h3 className="mt-1 text-[15px] font-semibold tracking-tight text-white leading-snug group-hover:text-seafoam">
                  {card.title}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[12px] text-white/50">
                  {FilmIcon && filming && (
                    <span className="inline-flex items-center gap-1">
                      <FilmIcon className="w-3.5 h-3.5" /> {filming.label}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    {(card.selection?.questions || card.questions.map(q => q.text)).length} questions
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function QuestionRow({
  text,
  lens,
  on,
  onToggle,
}: {
  text: string
  lens: keyof typeof LENS_META | null
  on: boolean
  onToggle: () => void
}) {
  const meta = lens ? LENS_META[lens] : null
  const LensIcon = meta?.icon
  return (
    <div
      role="checkbox"
      aria-checked={on}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={e => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          onToggle()
        }
      }}
      className="flex gap-3 items-start py-2.5 border-b border-white/10 last:border-b-0 cursor-pointer"
    >
      <span
        className={`w-5 h-5 mt-0.5 rounded-md border flex items-center justify-center flex-shrink-0 ${
          on ? 'bg-primary-500 border-primary-500 text-white' : 'border-white/30'
        }`}
      >
        {on && <Check className="w-3.5 h-3.5" />}
      </span>
      <span className="min-w-0">
        <span className={`block text-[15px] leading-snug ${on ? 'text-secondary-900' : 'text-secondary-500'}`}>{text}</span>
        <span className={`app-chip text-[11px] mt-1.5 ${meta ? meta.chip : ''} ${on ? '' : 'opacity-55'}`}>
          {LensIcon && <LensIcon className="w-3 h-3" />} {meta ? meta.label : 'Your question'}
        </span>
      </span>
    </div>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
      {steps.map((step, i) => (
        <span key={`${step}-${i}`} className="inline-flex items-center gap-1.5">
          <span className="app-chip text-[12px]">{step}</span>
          {i < steps.length - 1 && <ArrowRight className="w-3 h-3 text-secondary-400" />}
        </span>
      ))}
    </div>
  )
}

export function IdeaBrief({
  ideaId,
  onBack,
  onSave,
  onCapture,
  onUsePhotos,
  onLater,
  onDismiss,
  onAnother,
  onOpenPost,
}: {
  ideaId: string
  onBack: () => void
  onSave: (idea: ContentIdea, selection: ContentIdeaSelection) => Promise<void> | void
  onCapture: (idea: ContentIdea) => void
  onUsePhotos: (idea: ContentIdea) => void
  onLater: (idea: ContentIdea) => void
  onDismiss: (idea: ContentIdea, reason: string) => void
  onAnother: (idea: ContentIdea) => void
  onOpenPost: (packageId: string) => void
}) {
  const reduce = useReducedMotion()
  const [idea, setIdea] = useState<(ContentIdea & { guide: ContentIdeaGuide }) | null>(null)
  const [missing, setMissing] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [off, setOff] = useState<Set<number>>(new Set())
  const [custom, setCustom] = useState<string[]>([])
  const [customOff, setCustomOff] = useState<Set<number>>(new Set())
  const [draft, setDraft] = useState('')
  const [writing, setWriting] = useState(false)
  const [coach, setCoach] = useState<{ tone: 'nudge' | 'good' | 'error'; text: string } | null>(null)
  const [category, setCategory] = useState<IdeaFilmingCategory | null>(null)
  const [pick, setPick] = useState(0)
  const [ownIdeas, setOwnIdeas] = useState<Record<string, ContentIdeaFilmingIdea[]>>({})
  const [ownDraft, setOwnDraft] = useState('')
  const [writingIdea, setWritingIdea] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIdea(null)
    setMissing(false)
    setOff(new Set())
    setCustom([])
    setCustomOff(new Set())
    setCategory(null)
    setPick(0)
    setOwnIdeas({})
    setCoach(null)
    apiService
      .getContentIdea(ideaId)
      .then(row => {
        if (cancelled) return
        setIdea(row)
        setCategory(toCardV2(row.card).suggested.category)
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
    return () => {
      cancelled = true
    }
  }, [ideaId])

  const card = useMemo(() => (idea ? toCardV2(idea.card) : null), [idea])

  if (missing) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Idea not found"
        description="It may have expired, or it belongs to another organization."
        action={
          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onBack}>
            Back to content
          </button>
        }
      />
    )
  }
  if (!idea || !card) return <SectionLoader />

  const art = idea.stakeholder ? STAKEHOLDER_ART[idea.stakeholder] : null
  const active = category || card.suggested.category
  const current = card.filming.find(f => f.category === active)
  const ideasForCategory = [...(current?.ideas || []), ...(ownIdeas[active] || [])]
  const chosen = ideasForCategory[pick] || ideasForCategory[0] || null
  const kept = [
    ...card.questions.filter((_, i) => !off.has(i)).map(q => q.text),
    ...custom.filter((_, i) => !customOff.has(i)),
  ]
  const done = idea.status === 'posted'
  const closed = idea.status === 'dismissed' || idea.status === 'expired'
  const saved = idea.status === 'accepted'

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    notify.success('Link copied. Send it to whoever is on site.')
  }

  const addQuestion = (force: boolean) => {
    const text = draft.trim()
    if (!text) {
      setCoach({ tone: 'error', text: 'Type a question first.' })
      return
    }
    if (!force && YES_NO_START.test(text)) {
      setCoach({ tone: 'nudge', text: 'That might just get a "yes." Starting with What, How, or Tell me about gets you a story.' })
      return
    }
    setCustom(prev => [...prev, text])
    setDraft('')
    setWriting(false)
    setCoach({
      tone: 'good',
      text: force
        ? 'Added. If the answer is short, follow up with "Tell me more."'
        : "Nice. That's open, so you'll get a story, not a one-word answer.",
    })
  }

  const addOwnIdea = () => {
    const name = ownDraft.trim()
    if (!name) return
    setOwnIdeas(prev => ({ ...prev, [active]: [...(prev[active] || []), { name, steps: [] }] }))
    setPick(ideasForCategory.length)
    setOwnDraft('')
    setWritingIdea(false)
  }

  const save = async () => {
    if (kept.length === 0) {
      setCoach({ tone: 'error', text: 'Keep at least one question.' })
      return
    }
    setSaving(true)
    try {
      await onSave(idea, {
        questions: kept,
        filming_category: active,
        filming_idea: chosen?.name || null,
      })
    } finally {
      setSaving(false)
    }
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

      <section className="app-card overflow-hidden">
        <div className="p-5 sm:p-6" style={art ? { background: `linear-gradient(160deg, ${art.glow}, transparent 70%)` } : undefined}>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wide inline-flex items-center gap-1.5 ${art ? art.text : 'text-primary-800'}`}>
              <Sparkles className="w-3.5 h-3.5" /> {idea.angle_label}
            </span>
            {saved && <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide">Saved</span>}
            {done && <span className="app-chip app-chip-impact text-[10px] uppercase tracking-wide">Posted</span>}
            {closed && <span className="app-chip text-[10px] uppercase tracking-wide">Closed</span>}
            {!closed && !done && (
              <button type="button" className="app-btn app-btn-secondary app-btn-sm ml-auto" onClick={() => onAnother(idea)}>
                <RefreshCw className="w-3.5 h-3.5" /> Another idea
              </button>
            )}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-secondary-900 leading-snug">{card.title}</h2>
          <p className="mt-2 text-[15px] text-secondary-700 leading-relaxed">{card.who}</p>
          <p className="mt-3 flex gap-2.5 items-start text-[14px] text-secondary-600 leading-relaxed">
            <span className="w-2 h-2 mt-1.5 rounded-full bg-impact-500 flex-shrink-0 idea-live-dot" />
            <span>{card.why}</span>
          </p>
          <p className="mt-2 text-[12px] text-secondary-500 flex"><Where idea={idea} /></p>
        </div>
      </section>

      <section className="app-card p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-secondary-900 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-[11px] inline-flex items-center justify-center font-semibold">1</span>
          Pick your questions
        </p>
        <div className="mt-3">
          {card.questions.map((question, i) => (
            <QuestionRow
              key={`${question.text}-${i}`}
              text={question.text}
              lens={question.lens}
              on={!off.has(i)}
              onToggle={() =>
                setOff(prev => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
            />
          ))}
          {custom.map((text, i) => (
            <QuestionRow
              key={`own-${text}-${i}`}
              text={text}
              lens={null}
              on={!customOff.has(i)}
              onToggle={() =>
                setCustomOff(prev => {
                  const next = new Set(prev)
                  if (next.has(i)) next.delete(i)
                  else next.add(i)
                  return next
                })
              }
            />
          ))}
        </div>
        <div className="mt-3">
          {writing ? (
            <div className="flex gap-2">
              <input
                autoFocus
                className="app-input flex-1"
                placeholder="Write your own question"
                aria-label="Your own question"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addQuestion(false)
                }}
              />
              <button type="button" className="app-btn app-btn-secondary" onClick={() => addQuestion(false)}>
                Add
              </button>
            </div>
          ) : (
            <button type="button" className="text-[13.5px] text-primary-800 inline-flex items-center gap-1.5" onClick={() => setWriting(true)}>
              <Plus className="w-4 h-4" /> Add your own question
            </button>
          )}
        </div>
        {coach ? (
          <p className={`mt-2.5 text-[13px] leading-relaxed ${coach.tone === 'error' ? 'text-red-500' : 'text-secondary-600'}`}>
            {coach.tone !== 'error' && <Sparkles className="w-3.5 h-3.5 inline mr-1.5 text-primary-700" />}
            {coach.text}
            {coach.tone === 'nudge' && (
              <button type="button" className="app-chip text-[12px] ml-2" onClick={() => addQuestion(true)}>
                Add anyway
              </button>
            )}
          </p>
        ) : (
          <p className="mt-2.5 text-[13px] text-secondary-500">Then: "Tell me more about that." And wait.</p>
        )}
      </section>

      <section className="app-card p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-secondary-900 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-[11px] inline-flex items-center justify-center font-semibold">2</span>
          Pick how to film it
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FILMING_ORDER.filter(c => card.filming.some(f => f.category === c)).map(c => {
            const meta = FILMING_META[c]
            const Icon = meta.icon
            const on = c === active
            const best = c === card.suggested.category
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setCategory(c)
                  setPick(0)
                  setWritingIdea(false)
                }}
                className={`relative rounded-xl border px-2 pt-4 pb-2.5 flex flex-col items-center gap-1 text-center ${
                  on ? 'border-primary-500 bg-primary-500/10' : 'border-white/15 hover:border-white/30'
                }`}
              >
                {best && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary-500 text-white whitespace-nowrap">
                    Suggested
                  </span>
                )}
                <Icon className={`w-5 h-5 ${on ? 'text-primary-700' : 'text-secondary-500'}`} />
                <span className="text-[12.5px] leading-tight text-secondary-900">{meta.label}</span>
                <span className="text-[10.5px] text-secondary-500">{meta.kind}</span>
              </button>
            )
          })}
        </div>

        {current && (
          <>
            <p className="mt-4 text-[14px] text-secondary-700 leading-relaxed">{current.fit}</p>
            {active === card.suggested.category && (
              <p className="mt-1.5 text-[12.5px] text-primary-800 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Suggested: {card.suggested.reason}
              </p>
            )}
            <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-secondary-500">Pick a filming idea</p>
            <div className="mt-2 space-y-2">
              {ideasForCategory.map((option, i) => (
                <div
                  key={`${option.name}-${i}`}
                  role="radio"
                  aria-checked={i === pick}
                  tabIndex={0}
                  onClick={() => setPick(i)}
                  onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      setPick(i)
                    }
                  }}
                  className={`rounded-xl border px-3.5 py-3 flex gap-3 cursor-pointer ${
                    i === pick ? 'border-primary-500 bg-primary-500/5' : 'border-white/15 hover:border-white/30'
                  }`}
                >
                  <span
                    className={`w-4 h-4 mt-1 rounded-full border flex items-center justify-center flex-shrink-0 ${
                      i === pick ? 'border-primary-500' : 'border-white/30'
                    }`}
                  >
                    {i === pick && <span className="w-2 h-2 rounded-full bg-primary-500" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-semibold text-secondary-900">{option.name}</span>
                    {option.steps.length > 0 && <Steps steps={option.steps} />}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              {writingIdea ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    className="app-input flex-1"
                    placeholder="Describe your own filming idea"
                    aria-label="Your own filming idea"
                    value={ownDraft}
                    onChange={e => setOwnDraft(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addOwnIdea()
                    }}
                  />
                  <button type="button" className="app-btn app-btn-secondary" onClick={addOwnIdea}>
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-[13.5px] text-primary-800 inline-flex items-center gap-1.5"
                  onClick={() => setWritingIdea(true)}
                >
                  <Plus className="w-4 h-4" /> None of these? Write your own idea
                </button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="app-card p-5 sm:p-6">
        <p className="text-[13px] font-semibold text-secondary-900 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-white/10 text-[11px] inline-flex items-center justify-center font-semibold">3</span>
          Save it
        </p>
        <p className="mt-2 text-[13px] text-secondary-500">
          {kept.length} {kept.length === 1 ? 'question' : 'questions'}
          {chosen ? `, ${FILMING_META[active].label}: ${chosen.name}` : ''}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="app-btn app-btn-primary" disabled={saving} onClick={save}>
            {saving ? <Spinner className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            {saved ? 'Update my to-do' : 'Save to my to-dos'}
          </button>
          {!closed && !done && (
            <button type="button" className="app-btn app-btn-ghost ml-auto" onClick={() => onLater(idea)}>
              Later
            </button>
          )}
        </div>
      </section>

      {card.channels.length > 0 && (
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
      )}

      <div className="sticky bottom-4 z-10 app-card-elevated px-4 py-3">
        {done && idea.package_id ? (
          <button type="button" className="app-btn app-btn-primary" onClick={() => onOpenPost(idea.package_id!)}>
            <ExternalLink className="w-4 h-4" /> Open the post
          </button>
        ) : dismissing ? (
          <DismissReasons
            onPick={reason => {
              setDismissing(false)
              onDismiss(idea, reason)
            }}
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
              <button type="button" className="app-btn app-btn-ghost ml-auto text-secondary-500" onClick={() => setDismissing(true)}>
                Not useful
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
