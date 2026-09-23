import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  BarChart3,
  BookOpen,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Facebook,
  Heart,
  Image as ImageIcon,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Pencil,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import { useTeam } from '../../context/TeamContext'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { formatDate } from '../../utils'
import { triggerDownload } from '../../utils/contentExport'
import {
  EmptyState,
  InlineAlert,
  PageHeader,
  SectionLoader,
  Skeleton,
  Spinner,
} from '../ui'
import type {
  ContentChannel,
  ContentChannelVersion,
  ContentDraftStatus,
  ContentMaster,
  ContentPackage,
  ContentSource,
  ContentStoryType,
  ContentUsageFilter,
  GraphicAspect,
  GraphicChrome,
  GraphicCopy,
  GraphicLayout,
} from '../../types'

type Step = 'home' | 'type' | 'control' | 'material' | 'working' | 'master' | 'channels' | 'review' | 'library'
type TypeFilter = 'all' | ContentSource['source_type']

const PAGE_SIZE = 21
const STORY_TYPES: { id: ContentStoryType; title: string; body: string; icon: typeof BarChart3; soon?: boolean }[] = [
  { id: 'glance', title: 'Impact at a Glance', body: 'Metrics, results, and measurable progress.', icon: BarChart3, soon: true },
  { id: 'moment', title: 'Moment', body: 'A milestone, event, testimonial, or update.', icon: Camera },
  { id: 'journey', title: 'Journey', body: 'A person, family, class, or community over time.', icon: Users, soon: true },
]
const CHANNELS: { id: ContentChannel; label: string; body: string; icon: typeof Sparkles; soon?: boolean }[] = [
  { id: 'instagram', label: 'Instagram', body: 'Square post. Short lines, a few emojis.', icon: Instagram },
  { id: 'facebook', label: 'Facebook', body: 'A page update people will share.', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', body: 'Professional, still human.', icon: Linkedin },
  { id: 'donor_email', label: 'Donor email', body: 'Deeper letter. Landscape header.', icon: Mail },
  { id: 'newsletter', label: 'Newsletter', body: 'Richer update for subscribers.', icon: Newspaper, soon: true },
  { id: 'sms', label: 'SMS', body: 'A short text with the photo.', icon: MessageSquare },
]

const EASE = [0.16, 1, 0.3, 1] as const
const WORKING_BEATS = [
  'Reading the proof you already logged',
  'Keeping every number honest',
  'Writing something worth sharing',
]

function sourceKey(s: Pick<ContentSource, 'source_type' | 'source_id'>) {
  return `${s.source_type}:${s.source_id}`
}

function channelLabel(id: ContentChannel) {
  return CHANNELS.find(c => c.id === id)?.label || id
}

function isEmailChannel(id: ContentChannel) {
  return id === 'donor_email' || id === 'newsletter'
}

function chromeForMaster(_master: ContentMaster): GraphicChrome {
  return {
    logo: false,
    orgName: false,
    title: false,
    metric: false,
    location: false,
  }
}

function copyForMaster(master: ContentMaster, orgName: string): GraphicCopy {
  const overlay = master.source.overlay
  let metricText = ''
  if (overlay && overlay.value != null && !Number.isNaN(Number(overlay.value))) {
    const n = Number.isInteger(overlay.value) ? overlay.value.toLocaleString('en-US') : String(overlay.value)
    metricText = overlay.unit ? `${n} ${overlay.unit}` : n
  }
  return {
    orgName: orgName || 'Impact',
    title: master.source.title,
    metricText,
    metricLabel: overlay?.label || '',
    location: master.source.location || '',
  }
}

function layoutFromChrome(chrome: GraphicChrome): GraphicLayout {
  if (chrome.metric) return 'stats'
  if (chrome.title) return 'title'
  return 'clean'
}

function aspectForChannel(channel: ContentChannel): GraphicAspect {
  if (channel === 'linkedin' || channel === 'donor_email' || channel === 'newsletter') return 'landscape'
  return 'square'
}

function aspectForDownload(channel: ContentChannel): GraphicAspect {
  return isEmailChannel(channel) ? 'landscape' : 'square'
}

function splitLongLine(line: string): string {
  if (!line.trim()) return ''
  const bits = line.split(/(?<=[.!?])\s+/).map(part => part.trim()).filter(Boolean)
  if (bits.length < 2) return line
  return bits.join('\n\n')
}

function ensureLineBreaks(text: string): string {
  const value = String(text || '').replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim()
  if (!value) return ''
  const rows = value.split('\n')
  const spoken = rows.filter(row => row.trim())
  if (spoken.length >= 2) {
    return rows
      .map(row => (row.length >= 90 && /[.!?].+\S/.test(row) ? splitLongLine(row) : row))
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  return splitLongLine(value)
}

function asPreviewBody(text: string): string {
  return ensureLineBreaks(text)
    .split(/\n+/)
    .map(row => row.trim())
    .filter(Boolean)
    .join('\n\n')
}

function hydrateMaster(master: ContentMaster): ContentMaster {
  return { ...master, body: asPreviewBody(master.body || '') }
}

function hydrateVersions(rows: Array<{ channel: ContentChannel; caption?: string | null; email_subject?: string | null; email_body?: string | null }>): ContentChannelVersion[] {
  return rows.map(row => ({
    channel: row.channel,
    caption: row.caption ? ensureLineBreaks(row.caption) : undefined,
    email_subject: row.email_subject || undefined,
    email_body: row.email_body ? ensureLineBreaks(row.email_body) : undefined,
  }))
}

function Help() {
  return (
    <div className="space-y-3 text-sm text-secondary-600 leading-relaxed">
      <p>Nexus writes one evidence-backed story, then adapts it for the channels you pick. Open a library card to see the saved versions. Regenerate only if you want a new take. Nexus does not post.</p>
    </div>
  )
}

function FlowBack({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex justify-center mb-4">
      <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onClick}>
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
    </div>
  )
}

function ChoiceCard({
  icon: Icon,
  accent,
  kicker,
  title,
  body,
  soon,
  onClick,
}: {
  icon: typeof Sparkles
  accent?: boolean
  kicker?: string
  title: string
  body: string
  soon?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`group relative h-full min-h-[16.5rem] app-tile shadow-card-lg text-left px-6 pt-6 pb-5 flex flex-col ${
        soon ? 'opacity-55 cursor-not-allowed hover:shadow-card hover:translate-y-0' : ''
      }`}
    >
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <span className={`app-icon-tile ${accent && !soon ? 'app-icon-tile-accent' : ''}`}>
        <Icon className="w-4 h-4" />
      </span>
      {(kicker || soon) && (
        <p className={`mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] ${soon ? 'text-secondary-400' : 'text-primary-800'}`}>
          {soon ? 'Coming soon' : kicker}
        </p>
      )}
      <div className={`${kicker || soon ? 'mt-2' : 'mt-5'} flex items-start gap-1 min-w-0`}>
        <h2 className={`text-[17px] font-semibold tracking-tight leading-snug ${soon ? 'text-secondary-600' : 'text-secondary-900 group-hover:text-primary-800'}`}>
          {title}
        </h2>
        {!soon && (
          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-gray-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" aria-hidden />
        )}
      </div>
      <p className="mt-2 text-sm text-secondary-500 leading-relaxed">{body}</p>
    </button>
  )
}

const TYPE_TINT: Record<ContentStoryType, { wash: string; icon: string; bar: string }> = {
  glance: { wash: 'bg-evidence-50', icon: 'bg-evidence-100 text-evidence-700', bar: 'via-evidence-400' },
  moment: { wash: 'bg-primary-50', icon: 'bg-primary-100 text-primary-800', bar: 'via-primary-400' },
  journey: { wash: 'bg-impact-50', icon: 'bg-impact-100 text-impact-700', bar: 'via-impact-400' },
}

function TypePickCard({
  id,
  icon: Icon,
  title,
  body,
  soon,
  onClick,
}: {
  id: ContentStoryType
  icon: typeof Sparkles
  title: string
  body: string
  soon?: boolean
  onClick: () => void
}) {
  const tint = TYPE_TINT[id]
  return (
    <button
      type="button"
      onClick={soon ? undefined : onClick}
      disabled={soon}
      className={`group relative h-full min-h-[18rem] overflow-hidden rounded-2xl border text-left px-6 pt-6 pb-5 flex flex-col shadow-card-lg transition-all duration-200 ${
        soon
          ? 'border-gray-200/80 cursor-not-allowed grayscale'
          : 'border-primary-200/80 hover:shadow-card-hover hover:border-primary-300 hover:-translate-y-0.5'
      } ${tint.wash}`}
    >
      <span className={`pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent ${tint.bar} to-transparent ${soon ? 'opacity-40' : 'opacity-80 group-hover:opacity-100'}`} />
      <span className={`inline-flex w-14 h-14 rounded-2xl items-center justify-center flex-shrink-0 ${tint.icon}`}>
        <Icon className="w-7 h-7" />
      </span>
      {soon && (
        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary-400">Coming soon</p>
      )}
      <div className={`${soon ? 'mt-2' : 'mt-5'} flex items-start gap-1 min-w-0`}>
        <h2 className={`text-[18px] font-semibold tracking-tight leading-snug ${soon ? 'text-secondary-600' : 'text-secondary-900 group-hover:text-primary-800'}`}>
          {title}
        </h2>
        {!soon && (
          <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-400 group-hover:text-primary-700 group-hover:translate-x-0.5 transition-all" aria-hidden />
        )}
      </div>
      <p className={`mt-2 text-sm leading-relaxed ${soon ? 'text-secondary-400' : 'text-secondary-600'}`}>{body}</p>
    </button>
  )
}

function WorkingStage({ label }: { label: string }) {
  const reduce = useReducedMotion()
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setBeat(b => (b + 1) % WORKING_BEATS.length), 2200)
    return () => window.clearInterval(id)
  }, [])
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-center px-6">
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,80vw)] h-[min(32rem,80vw)] rounded-full bg-primary-200/50 blur-3xl"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.28, 0.48, 0.28] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(18rem,60vw)] h-[min(18rem,60vw)] rounded-full bg-primary-100 blur-2xl"
        animate={reduce ? undefined : { scale: [1.06, 0.96, 1.06], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative w-32 h-32 mb-8">
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute left-1/2 top-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary-800" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-600" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary-400" />
        </motion.div>
        <motion.div
          className="absolute inset-0 m-auto w-[4.5rem] h-[4.5rem] flex items-center justify-center"
          animate={reduce ? undefined : { scale: [1, 1.05, 1] }}
          transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }}
        >
          <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
        </motion.div>
      </div>
      <p className="relative text-xl font-semibold tracking-tight text-secondary-900 text-center">{label}</p>
      <div className="relative h-6 mt-3">
        <AnimatePresence mode="wait">
          <motion.p
            key={beat}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="text-sm text-secondary-500 text-center"
          >
            {WORKING_BEATS[beat]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function ContentEngine() {
  const { activeOrganization } = useTeam()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState<Step>('home')
  const [backStep, setBackStep] = useState<Step>('home')
  const [storyType, setStoryType] = useState<ContentStoryType>('moment')
  const [master, setMaster] = useState<ContentMaster | null>(null)
  const [channels, setChannels] = useState<ContentChannel[]>(['instagram', 'linkedin', 'facebook'])
  const [versions, setVersions] = useState<ContentChannelVersion[]>([])
  const [packages, setPackages] = useState<ContentPackage[]>([])
  const [extraContext, setExtraContext] = useState('')
  const [workingLabel, setWorkingLabel] = useState('Writing the story')
  const [schemaError, setSchemaError] = useState<string | null>(null)

  const [sources, setSources] = useState<ContentSource[]>([])
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loadingSources, setLoadingSources] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [usage, setUsage] = useState<ContentUsageFilter>('all')
  const [loadingLibrary, setLoadingLibrary] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportingChannel, setExportingChannel] = useState<ContentChannel | null>(null)
  const [chrome, setChrome] = useState<GraphicChrome>({ logo: false, orgName: false, title: false, metric: false, location: false })
  const [copy, setCopy] = useState<GraphicCopy>({ orgName: '', title: '', metricText: '', metricLabel: '', location: '' })
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const loadReq = useRef(0)

  const selected = useMemo(
    () => sources.find(s => sourceKey(s) === selectedKey) || master?.source || null,
    [sources, selectedKey, master]
  )
  const graphicOpts = useMemo(() => ({ chrome, copy, layout: layoutFromChrome(chrome) }), [chrome, copy])

  const fail = (error: unknown, fallback: string) => {
    const err = error as Error & { code?: string }
    if (err.code === 'SCHEMA_MISSING') setSchemaError(err.message)
    notify.error(err.message || fallback)
  }

  const loadSources = useCallback(async (reset: boolean) => {
    const req = ++loadReq.current
    if (reset) setLoadingSources(true)
    else setLoadingMore(true)
    try {
      const result = await apiService.getContentSources({
        offset: reset ? 0 : sourcesRef.current.length,
        limit: PAGE_SIZE,
        source_type: typeFilter,
        usage: usage === 'unused' || usage === 'used' ? usage : 'all',
      })
      if (req !== loadReq.current) return
      setSources(prev => reset ? result.sources : [...prev, ...result.sources])
      setHasMore(result.has_more)
    } catch (error) {
      if (req !== loadReq.current) return
      fail(error, 'Failed to load photos')
      if (reset) setSources([])
    } finally {
      if (req === loadReq.current) {
        setLoadingSources(false)
        setLoadingMore(false)
      }
    }
  }, [typeFilter, usage, activeOrganization?.id])

  useEffect(() => {
    if (step === 'material') loadSources(true)
  }, [step, loadSources])

  useEffect(() => {
    if (step !== 'library') return
    let cancelled = false
    setLoadingLibrary(true)
    apiService.getContentPackages()
      .then(rows => { if (!cancelled) setPackages(rows) })
      .catch(error => { if (!cancelled) fail(error, 'Failed to load library') })
      .finally(() => { if (!cancelled) setLoadingLibrary(false) })
    return () => { cancelled = true }
  }, [step, activeOrganization?.id])

  const runRecommend = async (type?: ContentStoryType) => {
    setBackStep(type ? 'control' : 'home')
    setWorkingLabel('Picking the strongest story')
    setStep('working')
    try {
      const next = await apiService.recommendContent(type)
      setMaster(hydrateMaster(next))
      setStoryType(next.story_type)
      setChrome(chromeForMaster(next))
      setCopy(copyForMaster(next, activeOrganization?.name || ''))
      setVersions([])
      setExtraContext('')
      setStep('master')
    } catch (error) {
      fail(error, 'Could not pick a story')
      setStep(type ? 'control' : 'home')
    }
  }

  const runMasterFromPick = async () => {
    if (!selected) return
    setBackStep('material')
    setWorkingLabel('Writing the master story')
    setStep('working')
    try {
      const next = await apiService.generateContentMaster({
        source_type: selected.source_type,
        source_id: selected.source_id,
        story_type: storyType,
      })
      setMaster(hydrateMaster(next))
      setChrome(chromeForMaster(next))
      setCopy(copyForMaster(next, activeOrganization?.name || ''))
      setVersions([])
      setExtraContext('')
      setStep('master')
    } catch (error) {
      fail(error, 'Could not write the story')
      setStep('material')
    }
  }

  const applyContext = async () => {
    if (!master || !extraContext.trim()) return
    setWorkingLabel('Weaving in your context')
    setStep('working')
    try {
      const next = await apiService.refineContentMaster({
        source_type: master.source.source_type,
        source_id: master.source.source_id,
        story_type: master.story_type,
        hook: master.hook,
        body: master.body,
        evidence_line: master.evidence_line,
        cta: master.cta,
        context: extraContext.trim(),
        why: master.why,
      })
      setMaster(hydrateMaster({ ...master, body: next.body }))
      setVersions([])
      notify.success('Body updated')
      setStep('master')
    } catch (error) {
      fail(error, 'Could not update the story')
      setStep('master')
    }
  }

  const runVersions = async () => {
    if (!master || channels.length === 0) return
    setWorkingLabel('Adapting for each channel')
    setStep('working')
    try {
      const next = await apiService.generateContentVersions({
        source_type: master.source.source_type,
        source_id: master.source.source_id,
        story_type: master.story_type,
        hook: master.hook,
        body: master.body,
        evidence_line: master.evidence_line,
        cta: master.cta,
        context: extraContext.trim() || undefined,
        channels,
      })
      setVersions(hydrateVersions(next))
      setStep('review')
    } catch (error) {
      fail(error, 'Could not adapt the story')
      setStep('channels')
    }
  }

  const save = async (status: ContentDraftStatus) => {
    if (!master) return
    setSaving(true)
    try {
      const pkg = await apiService.saveContentPackage({
        story_type: master.story_type,
        hook: master.hook,
        body: master.body,
        evidence_line: master.evidence_line,
        cta: master.cta,
        why: master.why,
        layout: layoutFromChrome(chrome),
        status,
        source_type: master.source.source_type,
        source_id: master.source.source_id,
        versions,
      })
      notify.success('Saved')
      setPackages(prev => [pkg, ...prev.filter(p => p.id !== pkg.id)])
      setStep('library')
    } catch (error) {
      fail(error, 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    notify.success(`${label} copied`)
  }

  const downloadGraphic = async (aspect: GraphicAspect = 'square', channel?: ContentChannel) => {
    const source = master?.source
    if (!source) return
    setExporting(true)
    if (channel) setExportingChannel(channel)
    try {
      const file = await apiService.getContentGraphicFile(source.source_type, source.source_id, source.title, {
        ...graphicOpts,
        aspect,
      })
      triggerDownload(file)
      notify.success('Photo downloading')
    } catch (error) {
      fail(error, 'Could not download')
    } finally {
      setExporting(false)
      setExportingChannel(null)
    }
  }

  const resetHome = () => {
    setBackStep('home')
    setStep('home')
    setMaster(null)
    setVersions([])
    setExtraContext('')
    setSelectedKey(null)
  }

  const openPackage = (pkg: ContentPackage) => {
    const first = pkg.versions?.[0]
    const sourceType = pkg.visual_source_type || first?.source_type
    const sourceId = pkg.visual_source_id || first?.source_id
    const imageUrl = pkg.image_url || first?.image_url
    if (!sourceType || !sourceId || !imageUrl) {
      notify.error('This story is missing its photo')
      return
    }
    const next: ContentMaster = {
      story_type: pkg.story_type,
      hook: pkg.hook || '',
      body: pkg.body || '',
      evidence_line: pkg.evidence_line || '',
      cta: pkg.cta || '',
      why: pkg.why || '',
      layout: pkg.layout,
      source: {
        source_type: sourceType,
        source_id: sourceId,
        title: pkg.hook || 'Story',
        date_represented: pkg.created_at,
        image_url: imageUrl,
        initiative_id: '',
        initiative_title: '',
        overlay: first?.overlay,
        used: true,
      },
    }
    const nextVersions = hydrateVersions(
      (pkg.versions || [])
        .filter((v): v is typeof v & { channel: ContentChannel } => !!v.channel)
        .map(v => ({
          channel: v.channel,
          caption: v.caption,
          email_subject: v.email_subject,
          email_body: v.email_body,
        }))
    )
    setMaster(hydrateMaster(next))
    setStoryType(pkg.story_type)
    setChrome(chromeForMaster(next))
    setCopy(copyForMaster(next, activeOrganization?.name || ''))
    setVersions(nextVersions)
    setExtraContext('')
    if (nextVersions.length) setChannels(nextVersions.map(v => v.channel))
    setBackStep('library')
    setStep(nextVersions.length ? 'review' : 'master')
  }

  const patchVersion = (channel: ContentChannel, patch: Partial<ContentChannelVersion>) => {
    setVersions(prev => prev.map(v => v.channel === channel ? { ...v, ...patch } : v))
  }

  const hasVersions = versions.length > 0
  const subtitle =
    step === 'library' ? 'Your moments.'
      : step === 'review' ? 'Master first. Edit it, or copy a channel version.'
        : step === 'channels' ? 'Where should this go?'
          : step === 'master' ? 'Keep the story short. Add context to reshape it.'
            : 'One evidence-backed story, then every channel you need.'

  const chooser = step === 'home' || step === 'type' || step === 'control' || step === 'working'

  return (
    <div className={`h-screen overflow-hidden flex flex-col pt-6 mobile-content-padding ${
      step === 'master' ? 'px-3 sm:px-4 lg:pl-3 lg:pr-8' : 'px-4 sm:px-6 lg:px-8'
    }`}>
      <div className={`w-full flex flex-col flex-1 min-h-0 ${step === 'master' ? '' : 'max-w-6xl mx-auto'}`}>
        <PageHeader
          className={`${chooser ? 'mb-0' : 'mb-4'} shrink-0`}
          title="Content"
          subtitle={subtitle}
          help={<Help />}
          actions={
            <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100">
              <button
                type="button"
                onClick={resetHome}
                className={`h-8 px-3 rounded-lg text-[13px] font-medium ${step !== 'library' ? 'bg-white text-secondary-900 shadow-card' : 'text-secondary-500'}`}
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setStep('library')}
                className={`h-8 px-3 rounded-lg text-[13px] font-medium ${step === 'library' ? 'bg-white text-secondary-900 shadow-card' : 'text-secondary-500'}`}
              >
                Library
              </button>
            </div>
          }
        />

        {schemaError && (
          <InlineAlert tone="warning" className="mb-3 shrink-0">{schemaError}</InlineAlert>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
              transition={{ duration: 0.22, ease: EASE }}
              className={chooser ? 'w-full h-full overflow-hidden flex items-center justify-center' : 'w-full h-full overflow-y-auto overflow-x-hidden'}
            >
          {step === 'home' && (
            <div className="w-full max-w-3xl mx-auto">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">Start here</p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-secondary-900">What should Nexus make?</h2>
              <p className="mt-2 mb-7 text-center text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
                One evidence-backed story, then every channel you need.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChoiceCard
                  icon={Sparkles}
                  accent
                  kicker="Easiest"
                  title="Nexus Makes One"
                  body="No setup. Nexus picks the strongest unused story from what you already logged."
                  onClick={() => runRecommend()}
                />
                <ChoiceCard
                  icon={Camera}
                  title="I know what I want"
                  body="Pick a story type, then let Nexus choose the material or choose it yourself."
                  onClick={() => setStep('type')}
                />
              </div>
            </div>
          )}

          {step === 'type' && (
            <div className="w-full max-w-4xl mx-auto">
              <FlowBack onClick={() => setStep('home')} />
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">Story type</p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-secondary-900">What kind of story?</h2>
              <p className="mt-2 mb-7 text-center text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
                One choice. Nexus still does the storytelling.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {STORY_TYPES.map(item => (
                  <TypePickCard
                    key={item.id}
                    id={item.id}
                    icon={item.icon}
                    title={item.title}
                    body={item.body}
                    soon={item.soon}
                    onClick={() => { setStoryType(item.id); setStep('control') }}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 'control' && (
            <div className="w-full max-w-3xl mx-auto">
              <FlowBack onClick={() => setStep('type')} />
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">
                {STORY_TYPES.find(t => t.id === storyType)?.title}
              </p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-secondary-900">How much control?</h2>
              <p className="mt-2 mb-7 text-center text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
                Let Nexus pick the material, or choose the photo yourself.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChoiceCard
                  icon={Sparkles}
                  accent
                  kicker="Recommended"
                  title="Let Nexus make it"
                  body={`Nexus picks the strongest ${storyType} from your library.`}
                  onClick={() => runRecommend(storyType)}
                />
                <ChoiceCard
                  icon={ImageIcon}
                  title="Choose my material"
                  body="Pick a photo. Used just means it has been in a post before. You can reuse it."
                  onClick={() => setStep('material')}
                />
              </div>
            </div>
          )}

          {step === 'working' && <WorkingStage label={workingLabel} />}

          {step === 'material' && (
            <MaterialPicker
              sources={sources}
              selectedKey={selectedKey}
              loading={loadingSources}
              loadingMore={loadingMore}
              hasMore={hasMore}
              typeFilter={typeFilter}
              usage={usage}
              onType={setTypeFilter}
              onUsage={setUsage}
              onSelect={setSelectedKey}
              onMore={() => loadSources(false)}
              onContinue={runMasterFromPick}
              onBack={() => setStep('control')}
            />
          )}

          {step === 'master' && master && (
            <div className="grid grid-cols-1 lg:grid-cols-[24rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)] gap-6 lg:gap-10 pb-6 items-start">
              <aside className="w-full max-w-[24rem] xl:max-w-[21rem]">
                <div className="overflow-hidden rounded-xl border border-gray-200/80">
                  <LiveGraphic
                    photoUrl={master.source.image_url}
                    logoUrl={activeOrganization?.logo_url}
                    brandColor={activeOrganization?.brand_color}
                    chrome={chrome}
                    copy={copy}
                    aspect="square"
                  />
                </div>
                <OverlayBar chrome={chrome} copy={copy} onChrome={setChrome} onCopy={setCopy} />
                <button
                  type="button"
                  className="app-btn app-btn-ghost app-btn-sm mt-3"
                  onClick={() => downloadGraphic()}
                  disabled={exporting}
                >
                  {exporting ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />} Download photo
                </button>
              </aside>
              <section className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-800">
                  {STORY_TYPES.find(t => t.id === master.story_type)?.title}
                </p>
                <div className="mt-3 space-y-3.5">
                  <label className="block">
                    <span className="block text-[11px] font-medium text-secondary-500 mb-1">Hook</span>
                    <GrowField
                      value={master.hook}
                      onChange={v => setMaster({ ...master, hook: v })}
                      placeholder="Hook"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-medium text-secondary-500 mb-1">Body</span>
                    <div className="app-input min-h-[5.5rem] py-2">
                      <FitText
                        value={master.body}
                        onChange={v => setMaster({ ...master, body: v })}
                        minRows={3}
                        className="text-[13px] leading-relaxed text-secondary-800"
                      />
                    </div>
                  </label>
                  <label className="block">
                    <span className="block text-[11px] font-medium text-secondary-500 mb-1">Call To Action</span>
                    <GrowField
                      value={master.cta}
                      onChange={v => setMaster({ ...master, cta: v })}
                      placeholder="Learn more about our work."
                    />
                  </label>
                </div>
                <div className="app-card-muted mt-6 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-secondary-900">Your context</p>
                      <p className="text-[12px] text-secondary-500 mt-0.5 leading-snug">
                        This is how you steer the body. Audience, a quote, an event, tone. Nexus rewrites the body only.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="app-btn app-btn-primary app-btn-sm flex-shrink-0"
                      disabled={!extraContext.trim()}
                      onClick={applyContext}
                    >
                      Add
                    </button>
                  </div>
                  <GrowField
                    className="mt-3"
                    minRows={3}
                    value={extraContext}
                    onChange={setExtraContext}
                    placeholder="This is for last year's gala donors. Mention Friday's volunteer night."
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-5">
                  <button
                    type="button"
                    className="app-btn app-btn-primary"
                    onClick={() => setStep(hasVersions ? 'review' : 'channels')}
                  >
                    {hasVersions ? 'Versions' : 'Generate Channels'}
                  </button>
                  <button type="button" className="app-btn app-btn-ghost" onClick={() => setStep(backStep)}>Back</button>
                  {hasVersions && (
                    <button type="button" className="text-sm font-medium text-secondary-500 hover:text-primary-800" onClick={() => setStep('channels')}>
                      Change channels
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {step === 'channels' && master && (
            <div className="w-full max-w-4xl mx-auto pb-4">
              <FlowBack onClick={() => setStep('master')} />
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">Channels</p>
              <h2 className="mt-1.5 text-center text-xl font-semibold tracking-tight text-secondary-900">Where should this go?</h2>
              <p className="mt-1.5 mb-5 text-center text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
                Pick every place you want a version. Nexus writes each one differently.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {CHANNELS.map((ch, i) => {
                  const on = channels.includes(ch.id)
                  const Icon = ch.icon
                  const soon = !!ch.soon
                  return (
                    <motion.button
                      key={ch.id}
                      type="button"
                      disabled={soon}
                      onClick={soon ? undefined : () => setChannels(prev => on ? prev.filter(id => id !== ch.id) : [...prev, ch.id])}
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: reduceMotion ? 0 : i * 0.03, duration: 0.25, ease: EASE }}
                      className={`group relative min-h-[9.5rem] app-tile shadow-card px-4 py-4 flex flex-col items-center text-center ${
                        soon ? 'opacity-55 cursor-not-allowed hover:shadow-card hover:translate-y-0 grayscale' : on ? 'ring-2 ring-primary-200' : ''
                      }`}
                    >
                      <span className={`app-icon-tile w-10 h-10 rounded-xl ${on && !soon ? 'app-icon-tile-accent' : ''}`}>
                        <Icon className="w-5 h-5" />
                      </span>
                      {soon && (
                        <p className="mt-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-secondary-400">Coming soon</p>
                      )}
                      <h3 className={`text-[14px] font-semibold tracking-tight ${soon ? 'mt-1 text-secondary-600' : 'mt-2.5 text-secondary-900 group-hover:text-primary-800'}`}>
                        {ch.label}
                      </h3>
                      <p className={`mt-1 text-[12px] leading-snug ${soon ? 'text-secondary-400' : 'text-secondary-500'}`}>{ch.body}</p>
                      {!soon && (
                        <span className={`mt-auto pt-2 text-[10px] font-semibold uppercase tracking-wide ${
                          on ? 'text-primary-800' : 'text-secondary-400'
                        }`}>
                          {on ? 'Selected' : 'Tap to add'}
                        </span>
                      )}
                    </motion.button>
                  )
                })}
              </div>
              <div className="sticky bottom-0 z-10 mt-5 -mb-4 py-3 flex flex-wrap items-center justify-center gap-3 bg-[#F7F8FA]">
                <button type="button" className="app-btn app-btn-primary" disabled={channels.length === 0} onClick={runVersions}>
                  {hasVersions ? 'Regenerate' : 'Make versions'}
                </button>
                <button type="button" className="text-sm font-medium text-secondary-500 hover:text-primary-800" onClick={() => setChannels(CHANNELS.filter(c => !c.soon).map(c => c.id))}>
                  Select all
                </button>
              </div>
            </div>
          )}

          {step === 'review' && master && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="app-btn app-btn-ghost app-btn-sm"
                  onClick={() => setStep(backStep === 'library' ? 'library' : 'channels')}
                >
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => setStep('channels')}>
                  Change channels
                </button>
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" disabled={!hasVersions} onClick={runVersions}>
                  <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                </button>
                <button type="button" className="app-btn app-btn-primary app-btn-sm ml-auto" disabled={saving} onClick={() => save('ready')}>
                  {saving ? <Spinner className="w-3.5 h-3.5" /> : null} Save
                </button>
              </div>
              <div className="flex flex-wrap gap-5 justify-center items-start pb-6">
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, ease: EASE }}
                >
                  <MasterPreview
                    master={master}
                    photoUrl={master.source.image_url}
                    logoUrl={activeOrganization?.logo_url}
                    brandColor={activeOrganization?.brand_color}
                    chrome={chrome}
                    copy={copy}
                    downloading={exporting && !exportingChannel}
                    onEdit={() => setStep('master')}
                    onCopy={copyText}
                    onDownload={() => downloadGraphic()}
                  />
                </motion.div>
                {versions.map((version, i) => (
                  <motion.div
                    key={version.channel}
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 0.04 + i * 0.04, duration: 0.25, ease: EASE }}
                  >
                    <ChannelPreview
                      version={version}
                      orgName={copy.orgName || activeOrganization?.name || 'Nexus'}
                      logoUrl={activeOrganization?.logo_url}
                      brandColor={activeOrganization?.brand_color}
                      photoUrl={master.source.image_url}
                      chrome={chrome}
                      copy={copy}
                      onChange={patch => patchVersion(version.channel, patch)}
                      onCopy={copyText}
                      onDownload={() => downloadGraphic(aspectForDownload(version.channel), version.channel)}
                      downloading={exportingChannel === version.channel}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {step === 'library' && (
            <Library
              loading={loadingLibrary}
              packages={packages}
              onCreate={resetHome}
              onDelete={setDeleteId}
              onOpen={openPackage}
            />
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Remove from library"
          message="This deletes the saved story and its channel versions. The original photo stays in tracking."
          confirmLabel="Remove"
          tone="danger"
          onConfirm={async () => {
            try {
              await apiService.deleteContentPackage(deleteId)
              setPackages(prev => prev.filter(p => p.id !== deleteId))
              notify.success('Removed')
            } catch (error) {
              fail(error, 'Failed to delete')
            } finally {
              setDeleteId(null)
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

function GrowField({
  value,
  onChange,
  placeholder,
  minRows = 1,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const floor = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, floor.current, minRows * 24)}px`
  }, [value, minRows])
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={e => onChange(e.target.value)}
      onMouseUp={() => { if (ref.current) floor.current = ref.current.offsetHeight }}
      placeholder={placeholder}
      className={`app-input text-[13px] leading-relaxed resize-y overflow-hidden whitespace-pre-wrap ${className || ''}`}
    />
  )
}

const OVERLAY_CHIPS: { key: keyof GraphicChrome; label: string }[] = [
  { key: 'logo', label: 'Logo' },
  { key: 'orgName', label: 'Name' },
  { key: 'title', label: 'Title' },
  { key: 'metric', label: 'Metric' },
  { key: 'location', label: 'Place' },
]

function OverlayBar({
  chrome,
  copy,
  onChrome,
  onCopy,
}: {
  chrome: GraphicChrome
  copy: GraphicCopy
  onChrome: (next: GraphicChrome) => void
  onCopy: (next: GraphicCopy) => void
}) {
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1.5">
        {OVERLAY_CHIPS.map(item => {
          const on = chrome[item.key]
          return (
            <div key={item.key} className="inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary-700">
              <span>{item.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={item.label}
                onClick={() => onChrome({ ...chrome, [item.key]: !on })}
                className={`relative w-7 h-4 rounded-full transition-colors ${on ? 'bg-primary-600' : 'bg-gray-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-3' : ''}`} />
              </button>
            </div>
          )
        })}
      </div>
      {(chrome.orgName || chrome.title || chrome.metric || chrome.location) && (
        <div className="mt-1.5 space-y-1.5">
          {chrome.orgName && (
            <input
              className="app-input h-8 text-[13px]"
              value={copy.orgName}
              onChange={e => onCopy({ ...copy, orgName: e.target.value })}
              placeholder="Name on graphic"
            />
          )}
          {chrome.title && (
            <input
              className="app-input h-8 text-[13px]"
              value={copy.title}
              onChange={e => onCopy({ ...copy, title: e.target.value })}
              placeholder="Title"
            />
          )}
          {chrome.metric && (
            <div className="grid grid-cols-2 gap-1.5">
              <input
                className="app-input h-8 text-[13px]"
                value={copy.metricText}
                onChange={e => onCopy({ ...copy, metricText: e.target.value })}
                placeholder="47 people"
              />
              <input
                className="app-input h-8 text-[13px]"
                value={copy.metricLabel}
                onChange={e => onCopy({ ...copy, metricLabel: e.target.value })}
                placeholder="Label"
              />
            </div>
          )}
          {chrome.location && (
            <input
              className="app-input h-8 text-[13px]"
              value={copy.location}
              onChange={e => onCopy({ ...copy, location: e.target.value })}
              placeholder="Location"
            />
          )}
        </div>
      )}
    </div>
  )
}

function LiveGraphic({
  photoUrl,
  logoUrl,
  brandColor,
  chrome,
  copy,
  aspect = 'square',
}: {
  photoUrl: string
  logoUrl?: string | null
  brandColor?: string | null
  chrome: GraphicChrome
  copy: GraphicCopy
  aspect?: GraphicAspect
}) {
  const frame = aspect === 'landscape' ? 'aspect-[1.91/1]' : aspect === 'portrait' ? 'aspect-[4/5]' : 'aspect-square'
  const hasBottom = (chrome.title && !!copy.title) || (chrome.metric && !!(copy.metricText || copy.metricLabel)) || (chrome.location && !!copy.location)
  const brand = brandColor || '#c0dfa1'
  return (
    <div className={`relative w-full overflow-hidden bg-gray-900 [container-type:size] ${frame}`}>
      <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      {hasBottom && (
        <>
          <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-[7px]" style={{ backgroundColor: brand }} />
        </>
      )}
      <div className="absolute top-[4.5%] left-[4.5%] right-[4.5%] flex items-center gap-2.5 min-w-0">
        {chrome.logo && logoUrl && (
          <span className="w-[11%] min-w-[36px] max-w-[56px] aspect-square rounded-lg bg-white p-1 flex-shrink-0 overflow-hidden shadow-card">
            <img src={logoUrl} alt="" className="w-full h-full object-contain" />
          </span>
        )}
        {chrome.orgName && copy.orgName && (
          <p className="min-w-0 w-fit max-w-full text-white font-bold leading-tight truncate" style={{ fontSize: 'clamp(13px, 3.3cqw, 20px)', textShadow: '0 1px 2px rgba(0,0,0,.8)' }}>
            {copy.orgName}
          </p>
        )}
      </div>
      {hasBottom && (
        <div className="absolute inset-x-[4.5%] bottom-[6%] text-white" style={{ textShadow: '0 2px 10px rgba(0,0,0,.6)' }}>
          {chrome.title && copy.title && (
            <p className="font-bold leading-tight" style={{ fontSize: 'clamp(16px, 6.2cqw, 32px)' }}>{copy.title}</p>
          )}
          {chrome.metric && copy.metricText && (
            <p className="mt-1 font-semibold leading-tight" style={{ fontSize: 'clamp(14px, 4.2cqw, 22px)' }}>{copy.metricText}</p>
          )}
          {chrome.metric && copy.metricLabel && (
            <p className="mt-0.5 font-medium opacity-90" style={{ fontSize: 'clamp(11px, 2.6cqw, 15px)' }}>{copy.metricLabel}</p>
          )}
          {chrome.location && copy.location && (
            <p className="mt-0.5 font-medium opacity-90" style={{ fontSize: 'clamp(11px, 2.3cqw, 14px)' }}>{copy.location}</p>
          )}
        </div>
      )}
    </div>
  )
}

function MasterPreview({
  master,
  photoUrl,
  logoUrl,
  brandColor,
  chrome,
  copy,
  downloading,
  onEdit,
  onCopy,
  onDownload,
}: {
  master: ContentMaster
  photoUrl: string
  logoUrl?: string | null
  brandColor?: string | null
  chrome: GraphicChrome
  copy: GraphicCopy
  downloading?: boolean
  onEdit: () => void
  onCopy: (text: string, label: string) => void
  onDownload: () => void
}) {
  const story = [master.hook, master.body, master.cta].filter(Boolean).join('\n\n')
  return (
    <div className="w-[300px]">
      <PreviewLabel
        icon={Camera}
        label="Master"
        extra={
          <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2" onClick={onEdit}>
            <Pencil className="w-3 h-3" /> Edit
          </button>
        }
        onCopy={() => onCopy(story, 'Master')}
      />
      <article className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
        <GraphicHover onDownload={onDownload} downloading={downloading}>
          <LiveGraphic
            photoUrl={photoUrl}
            logoUrl={logoUrl}
            brandColor={brandColor}
            chrome={chrome}
            copy={copy}
            aspect="square"
          />
        </GraphicHover>
        <div className="px-3 py-2.5 space-y-1.5">
          <p className="text-[13px] font-semibold text-secondary-900 leading-snug">{master.hook}</p>
          <p className="text-[12px] text-secondary-800 leading-relaxed whitespace-pre-wrap">{master.body}</p>
          {master.cta && (
            <p className="text-[12px] font-medium text-primary-800">{master.cta}</p>
          )}
        </div>
      </article>
    </div>
  )
}

function ChannelPreview({
  version,
  orgName,
  logoUrl,
  brandColor,
  photoUrl,
  chrome,
  copy,
  onChange,
  onCopy,
  onDownload,
  downloading,
}: {
  version: ContentChannelVersion
  orgName: string
  logoUrl?: string | null
  brandColor?: string | null
  photoUrl: string
  chrome: GraphicChrome
  copy: GraphicCopy
  onChange: (patch: Partial<ContentChannelVersion>) => void
  onCopy: (text: string, label: string) => void
  onDownload: () => void
  downloading?: boolean
}) {
  const meta = CHANNELS.find(c => c.id === version.channel)
  const graphic = (
    <GraphicHover onDownload={onDownload} downloading={downloading}>
      <LiveGraphic
        photoUrl={photoUrl}
        logoUrl={logoUrl}
        brandColor={brandColor}
        chrome={chrome}
        copy={copy}
        aspect={aspectForChannel(version.channel)}
      />
    </GraphicHover>
  )
  const handle = orgHandle(orgName)
  const channel = version.channel

  if (channel === 'sms') {
    return (
      <div className="w-[248px]">
        <PreviewLabel icon={meta?.icon} label="SMS" onCopy={() => onCopy(version.caption || '', 'Caption')} />
        <div className="rounded-[1.7rem] bg-gray-100 p-3 flex flex-col">
          <div className="overflow-hidden rounded-xl mb-2 shadow-sm">
            <GraphicHover onDownload={onDownload} downloading={downloading}>
              <LiveGraphic
                photoUrl={photoUrl}
                logoUrl={logoUrl}
                brandColor={brandColor}
                chrome={chrome}
                copy={copy}
                aspect="square"
              />
            </GraphicHover>
          </div>
          <div className="self-start max-w-[92%] rounded-2xl rounded-bl-md bg-white border border-gray-200/80 px-3 py-2 shadow-sm">
            <FitText
              value={version.caption || ''}
              onChange={v => onChange({ caption: v })}
              minRows={2}
              className="text-[12px] leading-snug text-secondary-800"
            />
          </div>
        </div>
      </div>
    )
  }

  if (isEmailChannel(channel)) {
    return (
      <div className="w-[340px]">
        <PreviewLabel
          icon={meta?.icon}
          label={channelLabel(channel)}
          extra={
            <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2" onClick={() => onCopy(version.email_subject || '', 'Subject')}>
              Subject
            </button>
          }
          onCopy={() => onCopy(version.email_body || '', 'Body')}
          copyLabel="Body"
        />
        <article className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
          <div className="px-3.5 py-2.5 border-b border-gray-100">
            <p className="text-[10px] text-secondary-400 truncate">From {orgName}</p>
            <FitText
              value={version.email_subject || ''}
              onChange={v => onChange({ email_subject: v })}
              minRows={1}
              className="text-[14px] font-semibold text-secondary-900 leading-snug"
            />
          </div>
          {graphic}
          <div className="px-3.5 py-3">
            <FitText
              value={version.email_body || ''}
              onChange={v => onChange({ email_body: v })}
              minRows={8}
              className="text-[12.5px] leading-relaxed text-secondary-800"
            />
          </div>
        </article>
      </div>
    )
  }

  if (channel === 'instagram') {
    return (
      <div className="w-[248px]">
        <PreviewLabel icon={meta?.icon} label="Instagram" onCopy={() => onCopy(version.caption || '', 'Caption')} />
        <article className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-2.5 py-2">
            <OrgAvatar logoUrl={logoUrl} name={orgName} />
            <p className="text-[12px] font-semibold text-secondary-900 truncate">{handle}</p>
          </div>
          {graphic}
          <div className="px-2.5 py-2">
            <div className="flex items-center gap-2.5 text-secondary-800 mb-1.5">
              <Heart className="w-4 h-4" />
              <MessageCircle className="w-4 h-4" />
              <Send className="w-4 h-4" />
              <Bookmark className="w-4 h-4 ml-auto" />
            </div>
            <p className="text-[11px] font-semibold text-secondary-900 mb-0.5">{handle}</p>
            <FitText
              value={version.caption || ''}
              onChange={v => onChange({ caption: v })}
              minRows={4}
              className="text-[11px] leading-snug text-secondary-800"
            />
          </div>
        </article>
      </div>
    )
  }

  if (channel === 'facebook') {
    return (
      <div className="w-[280px]">
        <PreviewLabel icon={meta?.icon} label="Facebook" onCopy={() => onCopy(version.caption || '', 'Caption')} />
        <article className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <OrgAvatar logoUrl={logoUrl} name={orgName} />
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-secondary-900 truncate">{orgName}</p>
              <p className="text-[10px] text-secondary-400">Just now</p>
            </div>
          </div>
          <div className="px-3 pb-2">
            <FitText
              value={version.caption || ''}
              onChange={v => onChange({ caption: v })}
              minRows={4}
              className="text-[12px] leading-snug text-secondary-800"
            />
          </div>
          {graphic}
          <div className="flex items-center gap-4 px-3 py-2 text-[11px] font-medium text-secondary-500 border-t border-gray-100">
            <span className="inline-flex items-center gap-1"><Heart className="w-3.5 h-3.5" /> Like</span>
            <span className="inline-flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> Comment</span>
            <span className="inline-flex items-center gap-1"><Send className="w-3.5 h-3.5" /> Share</span>
          </div>
        </article>
      </div>
    )
  }

  return (
    <div className="w-[300px]">
      <PreviewLabel icon={meta?.icon} label="LinkedIn" onCopy={() => onCopy(version.caption || '', 'Caption')} />
      <article className="rounded-2xl border border-gray-200/80 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
          <OrgAvatar logoUrl={logoUrl} name={orgName} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold text-secondary-900 truncate">{orgName}</p>
            <p className="text-[10px] text-secondary-400">Nonprofit</p>
          </div>
        </div>
        <div className="px-3 pb-2">
          <FitText
            value={version.caption || ''}
            onChange={v => onChange({ caption: v })}
            minRows={5}
            className="text-[12px] leading-snug text-secondary-800"
          />
        </div>
        {graphic}
      </article>
    </div>
  )
}

function PreviewLabel({
  label,
  icon: Icon,
  onCopy,
  copyLabel = 'Copy',
  extra,
}: {
  label: string
  icon?: typeof Sparkles
  onCopy: () => void
  copyLabel?: string
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 px-0.5 pb-1.5">
      {Icon ? <Icon className="w-3.5 h-3.5 text-secondary-600" /> : null}
      <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary-500">{label}</p>
      <div className="ml-auto flex items-center gap-0.5">
        {extra}
        <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2" onClick={onCopy}>
          <Copy className="w-3 h-3" /> {copyLabel}
        </button>
      </div>
    </div>
  )
}

function GraphicHover({
  children,
  onDownload,
  downloading,
  compact,
}: {
  children: ReactNode
  onDownload: () => void
  downloading?: boolean
  compact?: boolean
}) {
  return (
    <div className="group/photo relative">
      {children}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/photo:bg-black/40">
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDownload() }}
          disabled={downloading}
          aria-label="Download photo"
          className="pointer-events-auto app-btn app-btn-primary app-btn-sm opacity-0 translate-y-1 group-hover/photo:opacity-100 group-hover/photo:translate-y-0 transition-all"
        >
          {downloading ? <Spinner className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          {compact ? null : 'Download photo'}
        </button>
      </div>
    </div>
  )
}

function OrgAvatar({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  if (logoUrl) {
    return <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-white border border-gray-200/80" />
  }
  return (
    <span className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 text-[10px] font-bold flex items-center justify-center">
      {(name || 'N').slice(0, 1).toUpperCase()}
    </span>
  )
}

function orgHandle(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'org'
}

function FitText({
  value,
  onChange,
  className,
  minRows = 2,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  minRows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const chipRef = useRef<HTMLSpanElement>(null)
  const editing = useRef(false)
  const hovering = useRef(false)
  const raf = useRef(0)
  const target = useRef({ x: 0, y: 0 })
  const current = useRef({ x: 0, y: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minRows * 16)}px`
  }, [value, minRows])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])
  const tick = () => {
    const chip = chipRef.current
    if (!chip) return
    const cur = current.current
    const next = target.current
    cur.x += (next.x - cur.x) * 0.16
    cur.y += (next.y - cur.y) * 0.16
    chip.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`
    if (hovering.current && !editing.current) raf.current = requestAnimationFrame(tick)
  }
  const moveChip = (e: MouseEvent<HTMLDivElement>) => {
    const chip = chipRef.current
    if (!chip || editing.current) return
    const box = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - box.left + 12
    const y = e.clientY - box.top - 18
    target.current = { x, y }
    if (!hovering.current) {
      hovering.current = true
      current.current = { x, y }
      chip.style.opacity = '1'
      raf.current = requestAnimationFrame(tick)
    }
  }
  const hideChip = () => {
    hovering.current = false
    cancelAnimationFrame(raf.current)
    if (chipRef.current) chipRef.current.style.opacity = '0'
  }
  return (
    <div
      className="relative"
      onMouseMove={moveChip}
      onMouseLeave={hideChip}
    >
      <textarea
        ref={ref}
        rows={minRows}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { editing.current = true; hideChip() }}
        onBlur={() => { editing.current = false }}
        className={`block w-full bg-transparent border-0 p-0 m-0 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 resize-none overflow-hidden whitespace-pre-wrap break-words ${className || ''}`}
      />
      <span
        ref={chipRef}
        className="pointer-events-none absolute left-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white shadow-card opacity-0"
        style={{ willChange: 'transform' }}
      >
        <Pencil className="w-3 h-3" />
      </span>
    </div>
  )
}

function MaterialPicker({
  sources,
  selectedKey,
  loading,
  loadingMore,
  hasMore,
  typeFilter,
  usage,
  onType,
  onUsage,
  onSelect,
  onMore,
  onContinue,
  onBack,
}: {
  sources: ContentSource[]
  selectedKey: string | null
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  typeFilter: TypeFilter
  usage: ContentUsageFilter
  onType: (v: TypeFilter) => void
  onUsage: (v: ContentUsageFilter) => void
  onSelect: (key: string) => void
  onMore: () => void
  onContinue: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-gray-200 bg-white">
          {(['all', 'unused', 'used'] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onUsage(id)}
              className={`h-full px-2.5 rounded-full text-xs font-medium ${usage === id ? 'bg-gray-100 text-secondary-900' : 'text-gray-600'}`}
            >
              {id === 'all' ? 'All' : id === 'unused' ? 'Unused' : 'Used'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-gray-200 bg-white">
          {([
            ['all', 'All'],
            ['evidence', 'Evidence'],
            ['story', 'Stories'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onType(id)}
              className={`h-full px-2.5 rounded-full text-xs font-medium ${typeFilter === id ? 'bg-gray-100 text-secondary-900' : 'text-gray-600'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="app-btn app-btn-primary app-btn-sm ml-auto" disabled={!selectedKey} onClick={onContinue}>
          Use this photo
        </button>
      </div>
      {loading && sources.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-xl" />)}
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos here"
          description="Used means it has been in a post before. You can still reuse it from All."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sources.map((source, i) => (
              <SourceTile
                key={sourceKey(source)}
                source={source}
                active={sourceKey(source) === selectedKey}
                eager={i < 6}
                onSelect={() => onSelect(sourceKey(source))}
              />
            ))}
          </div>
          {hasMore && (
            <button type="button" className="app-btn app-btn-secondary w-full" disabled={loadingMore} onClick={onMore}>
              {loadingMore ? <Spinner className="w-4 h-4" /> : null}
              {loadingMore ? 'Loading' : 'Load more'}
            </button>
          )}
        </>
      )}
    </div>
  )
}

function SourceTile({
  source,
  active,
  eager,
  onSelect,
}: {
  source: ContentSource
  active: boolean
  eager?: boolean
  onSelect: () => void
}) {
  const original = source.image_url
  const [src, setSrc] = useState(source.thumb_url || original)
  useEffect(() => { setSrc(source.thumb_url || original) }, [source.thumb_url, original])
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative overflow-hidden rounded-xl text-left border ${
        active ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200/80 hover:border-gray-300'
      }`}
    >
      <div className="aspect-square w-full bg-gray-100">
        <img
          src={src}
          alt=""
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          className="aspect-square w-full object-cover"
          onError={() => { if (src !== original) setSrc(original) }}
        />
      </div>
      <span className={`absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold ${
        source.source_type === 'story' ? 'bg-primary-600 text-white' : 'bg-evidence-600 text-white'
      }`}>
        {source.source_type === 'story' ? <BookOpen className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
        {source.source_type === 'story' ? 'Story' : 'Evidence'}
      </span>
      {source.used && (
        <span className="absolute top-1.5 right-1.5 rounded-full px-2 py-1 text-[10px] font-semibold bg-white/90 text-secondary-600">
          Used
        </span>
      )}
      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-black/55">
        <p className="text-[12px] font-medium text-white line-clamp-1">{source.title}</p>
        <p className="text-[10px] text-white/80 truncate">
          {source.initiative_title}
          {source.date_represented ? ` · ${formatDate(source.date_represented, { month: 'short', day: 'numeric' })}` : ''}
        </p>
      </div>
    </button>
  )
}

function Library({
  loading,
  packages,
  onCreate,
  onDelete,
  onOpen,
}: {
  loading: boolean
  packages: ContentPackage[]
  onCreate: () => void
  onDelete: (id: string) => void
  onOpen: (pkg: ContentPackage) => void
}) {
  if (loading) return <SectionLoader />
  return (
    <div className="space-y-3">
      {packages.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No moments yet"
          description="Nexus Makes One, then save it here."
          action={<button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={onCreate}>Create</button>}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {packages.map(pkg => (
            <article
              key={pkg.id}
              className="app-card-interactive overflow-hidden text-left cursor-pointer"
              onClick={() => onOpen(pkg)}
            >
              {pkg.image_url && <img src={pkg.image_url} alt="" className="h-40 w-full object-cover bg-gray-50" />}
              <div className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="app-chip text-[10px] uppercase tracking-wide">Moment</span>
                  <span className="ml-auto text-[11px] text-secondary-400">{formatDate(pkg.created_at, { month: 'short', day: 'numeric' })}</span>
                  <button type="button" className="app-btn app-btn-icon app-btn-ghost text-secondary-400 hover:text-red-600" onClick={e => { e.stopPropagation(); onDelete(pkg.id) }} aria-label="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm font-semibold text-secondary-900">{pkg.hook}</p>
                <p className="text-sm text-secondary-600 line-clamp-3">{pkg.body}</p>
                {(pkg.versions || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {(pkg.versions || []).map(v => (
                      <span key={v.id} className="app-chip text-[10px]">
                        {channelLabel((v.channel || 'instagram') as ContentChannel)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
