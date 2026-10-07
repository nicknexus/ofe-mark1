import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  BookOpen,
  Check,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Facebook,
  Globe,
  Heart,
  Image as ImageIcon,
  Instagram,
  Lightbulb,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Route,
  Send,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import ConfirmDialog from '../ConfirmDialog'
import ContentUploadModal from './ContentUploadModal'
import { CaptureQueue, CaptureToolbar, IdeaBrief } from './ContentIdeas'
import { JourneyDetail, JourneyFilters, JourneyGrid, JourneyModal, PublishBadge, PublishSoon, usePrograms, type JourneyFilter } from './ContentJourneys'
import { ContentWorkspace, NewMenu, PostToolbar, StudioBar, filterPosts, type KindFilter, type LibraryView, type SocialFilter, type StatusFilter } from './ContentWorkspace'
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
  ContentJourney,
  ContentMaster,
  ContentMediaItem,
  ContentPackage,
  ContentSource,
  ContentSourceRef,
  ContentUsageFilter,
  GraphicAspect,
  GraphicChrome,
  GraphicCopy,
  GraphicLayout,
  Initiative,
  ContentIdea,
} from '../../types'

type Step = 'home' | 'moment' | 'journeys' | 'journey' | 'idea' | 'capture' | 'material' | 'working' | 'master' | 'post'
type TypeFilter = 'all' | ContentSource['source_type']
type View =
  | { view: 'home' }
  | { view: 'journeys' }
  | { view: 'journey'; journeyId: string }
  | { view: 'update'; journeyId: string }
  | { view: 'new' }
  | { view: 'post'; postId: string }
  | { view: 'idea'; ideaId: string }
  | { view: 'capture' }

const BASE = '/share/content'
const FLOW_STEPS: Step[] = ['moment', 'material', 'working', 'master']
const POST_STEPS: Step[] = ['post', 'master', 'material', 'working']

function parseView(pathname: string): View {
  const [head, id, tail] = pathname.slice(BASE.length).split('/').filter(Boolean)
  if (head === 'new') return { view: 'new' }
  if (head === 'journeys') return { view: 'journeys' }
  if (head === 'journey' && id) return tail === 'new' ? { view: 'update', journeyId: id } : { view: 'journey', journeyId: id }
  if (head === 'post' && id) return { view: 'post', postId: id }
  if (head === 'idea' && id) return { view: 'idea', ideaId: id }
  if (head === 'capture') return { view: 'capture' }
  return { view: 'home' }
}

const PAGE_SIZE = 21
const MAX_PHOTOS = 10
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

function refsOf(sources: ContentSource[] | undefined): ContentSourceRef[] {
  return (sources || []).map(s => ({ source_type: s.source_type, source_id: s.source_id }))
}

function photosOf(master: ContentMaster): ContentSource[] {
  return [master.source, ...(master.extras || [])]
}

function emptyMaster(storyType: ContentMaster['story_type'], source: ContentSource): ContentMaster {
  return { story_type: storyType, hook: '', body: '', evidence_line: '', cta: '', why: '', layout: 'clean', source }
}

function withPhotos(master: ContentMaster, photos: ContentSource[]): ContentMaster {
  const [source, ...extras] = photos
  return { ...master, source, extras }
}

function masterFromPackage(pkg: ContentPackage): ContentMaster | null {
  const media = pkg.media || []
  if (!media[0]) return null
  const toSource = (item: ContentMediaItem): ContentSource => ({
    source_type: item.source_type,
    source_id: item.source_id,
    title: item.title || 'Photo',
    date_represented: pkg.created_at,
    image_url: item.image_url,
    initiative_id: '',
    initiative_title: '',
    used: true,
  })
  return {
    story_type: pkg.story_type,
    hook: pkg.hook || '',
    body: pkg.body || '',
    evidence_line: pkg.evidence_line || '',
    cta: pkg.cta || '',
    why: pkg.why || '',
    layout: pkg.layout,
    source: { ...toSource(media[0]), title: pkg.hook || media[0].title || 'Story', overlay: pkg.versions?.[0]?.overlay },
    extras: media.slice(1).map(toSource),
  }
}

function versionsOf(pkg: ContentPackage): ContentChannelVersion[] {
  return hydrateVersions(
    (pkg.versions || [])
      .filter((v): v is typeof v & { channel: ContentChannel } => !!v.channel)
      .map(v => ({
        channel: v.channel,
        caption: v.caption,
        email_subject: v.email_subject,
        email_body: v.email_body,
      }))
  )
}

function frameClass(aspect: GraphicAspect) {
  return aspect === 'landscape' ? 'aspect-[1.91/1]' : aspect === 'portrait' ? 'aspect-[4/5]' : 'aspect-square'
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
      <p>Moments are single posts. Journeys are folders of updates that follow something over time, like a class through the school year.</p>
      <p>Every moment and update is a post for your public page. Save it as a draft. Publishing is coming soon.</p>
      <p>Social posts are optional. Open any post and create versions for Instagram, Facebook, LinkedIn, email, or SMS. Nexus does not post for you yet.</p>
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
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(32rem,80vw)] h-[min(32rem,80vw)] rounded-full bg-seafoam/20 blur-3xl"
        animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.28, 0.48, 0.28] }}
        transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(18rem,60vw)] h-[min(18rem,60vw)] rounded-full bg-seafoam/15 blur-2xl"
        animate={reduce ? undefined : { scale: [1.06, 0.96, 1.06], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3.1, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="relative w-32 h-32 mb-8">
        <motion.div
          className="absolute inset-0"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 7.5, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute left-1/2 top-0 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-seafoam" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-seafoam/80" />
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-seafoam/50" />
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

export function StudioBoot() {
  return (
    <div className="content-studio h-screen flex items-center justify-center">
      <Spinner className="app-spinner-blue w-8 h-8" />
    </div>
  )
}

export default function ContentEngine() {
  const { activeOrganization } = useTeam()
  const reduceMotion = useReducedMotion()
  const location = useLocation()
  const navigate = useNavigate()
  const route = useMemo(() => parseView(location.pathname), [location.pathname])
  const cameFrom = (location.state as { from?: string } | null)?.from
  const [step, setStep] = useState<Step>('home')
  const [backStep, setBackStep] = useState<Step>('home')
  const [master, setMaster] = useState<ContentMaster | null>(null)
  const [post, setPost] = useState<ContentPackage | null>(null)
  const [loadingPost, setLoadingPost] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [channels, setChannels] = useState<ContentChannel[]>(['instagram', 'linkedin', 'facebook'])
  const [versions, setVersions] = useState<ContentChannelVersion[]>([])
  const [versionsDirty, setVersionsDirty] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [packages, setPackages] = useState<ContentPackage[]>([])
  const [journeys, setJourneys] = useState<ContentJourney[]>([])
  const [packagesReady, setPackagesReady] = useState(false)
  const [journeysReady, setJourneysReady] = useState(false)
  const bootAt = useRef(Date.now())
  const [revealed, setRevealed] = useState(false)
  const stepIntro = useRef(false)
  const [extraContext, setExtraContext] = useState('')
  const [socialContext, setSocialContext] = useState('')
  const [workingLabel, setWorkingLabel] = useState('Writing the story')
  const [schemaError, setSchemaError] = useState<string | null>(null)
  const [postQuery, setPostQuery] = useState('')
  const [postKind, setPostKind] = useState<KindFilter>('all')
  const [postStatus, setPostStatus] = useState<StatusFilter>('all')
  const [postSocial, setPostSocial] = useState<SocialFilter>('all')
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>('all')
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [ideasState, setIdeasState] = useState<'loading' | 'ready' | 'refreshing' | 'off'>('loading')
  const [draftIdea, setDraftIdea] = useState<ContentIdea | null>(null)
  const [captureIdea, setCaptureIdea] = useState<ContentIdea | null>(null)

  const [sources, setSources] = useState<ContentSource[]>([])
  const [picked, setPicked] = useState<ContentSource[]>([])
  const [programFilter, setProgramFilter] = useState('')
  const [loadingSources, setLoadingSources] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [usage, setUsage] = useState<ContentUsageFilter>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleteJourneyOpen, setDeleteJourneyOpen] = useState(false)
  const [journeyModal, setJourneyModal] = useState<{ journey: ContentJourney | null } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [exportingChannel, setExportingChannel] = useState<ContentChannel | null>(null)
  const [chrome, setChrome] = useState<GraphicChrome>({ logo: false, orgName: false, title: false, metric: false, location: false })
  const [copy, setCopy] = useState<GraphicCopy>({ orgName: '', title: '', metricText: '', metricLabel: '', location: '' })
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const stepRef = useRef(step)
  stepRef.current = step
  const postRef = useRef(post)
  postRef.current = post
  const editingRef = useRef(editingId)
  editingRef.current = editingId
  const journeysRef = useRef(journeys)
  journeysRef.current = journeys
  const loadReq = useRef(0)
  const programs = usePrograms(!!journeyModal || uploadOpen || step === 'material', activeOrganization?.id)

  const graphicOpts = useMemo(() => ({ chrome, copy, layout: layoutFromChrome(chrome) }), [chrome, copy])
  const journeyId =
    route.view === 'journey' || route.view === 'update' ? route.journeyId
      : route.view === 'post' ? post?.journey_id || null
        : null
  const journey = useMemo(() => (journeyId ? journeys.find(j => j.id === journeyId) || null : null), [journeys, journeyId])
  const updates = useMemo(() => (journeyId ? packages.filter(p => p.journey_id === journeyId) : []), [packages, journeyId])
  const journeyPath = (id: string) => `${BASE}/journey/${id}`
  const go = (path: string) => navigate(path, { state: { from: location.pathname } })
  const goBack = (fallback: string) => (cameFrom ? navigate(-1) : navigate(fallback))

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
        initiativeId: programFilter || undefined,
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
  }, [typeFilter, usage, programFilter, activeOrganization?.id])

  useEffect(() => {
    if (step === 'material') loadSources(true)
  }, [step, loadSources])

  const loadJourneys = useCallback(async () => {
    try {
      setJourneys(await apiService.getContentJourneys())
    } catch (error) {
      const err = error as Error & { code?: string }
      if (err.code === 'SCHEMA_MISSING') setSchemaError(err.message)
      else notify.error(err.message || 'Failed to load journeys')
    } finally {
      setJourneysReady(true)
    }
  }, [activeOrganization?.id])

  const loadPackages = useCallback(async () => {
    try {
      setPackages(await apiService.getContentPackages())
    } catch (error) {
      fail(error, 'Failed to load posts')
    } finally {
      setPackagesReady(true)
    }
  }, [activeOrganization?.id])

  const loadIdeas = useCallback(async () => {
    try {
      setIdeas((await apiService.getContentIdeas()).ideas)
      setIdeasState('ready')
    } catch {
      setIdeasState('off')
    }
  }, [activeOrganization?.id])

  const captureRedirect = useRef({ org: '', armed: false })

  useEffect(() => {
    captureRedirect.current = { org: activeOrganization?.id || '', armed: true }
    setJourneysReady(false)
    setPackagesReady(false)
    setJourneys([])
    setPackages([])
    setIdeas([])
    setIdeasState('loading')
    loadJourneys()
    loadPackages()
    loadIdeas()
  }, [loadJourneys, loadPackages, loadIdeas, activeOrganization?.id])

  useEffect(() => {
    const pending = captureRedirect.current
    if (!pending.armed) return
    if ((activeOrganization?.id || '') !== pending.org) return
    if (!packagesReady || ideasState === 'loading') return
    pending.armed = false
    if (ideasState !== 'ready') return
    if (packages.length === 0 && ideas.length > 0 && route.view === 'home') {
      navigate(`${BASE}/capture`, { replace: true })
    }
  }, [packagesReady, ideasState, packages.length, ideas.length, route.view, activeOrganization?.id, navigate])

  const applyMaster = (next: ContentMaster) => {
    setMaster(hydrateMaster(next))
    setChrome(chromeForMaster(next))
    setCopy(copyForMaster(next, activeOrganization?.name || ''))
  }

  const resetDraft = () => {
    setMaster(null)
    setPost(null)
    setVersions([])
    setVersionsDirty(false)
    setPickerOpen(false)
    setExtraContext('')
    setSocialContext('')
    setEditingId(null)
    setPicked([])
    setDraftIdea(null)
  }

  const upsertPackage = (pkg: ContentPackage) => {
    setPackages(prev => (prev.some(p => p.id === pkg.id) ? prev.map(p => (p.id === pkg.id ? pkg : p)) : [pkg, ...prev]))
  }

  const startMoment = () => go(`${BASE}/new`)

  const startMomentDiy = () => {
    setProgramFilter('')
    setStep('material')
  }

  const startUpdate = (target: ContentJourney) => go(`${journeyPath(target.id)}/new`)
  const openJourney = (target: ContentJourney) => go(journeyPath(target.id))
  const leaveJourney = () => goBack(BASE)

  const showPost = (pkg: ContentPackage) => {
    const next = masterFromPackage(pkg)
    if (!next) {
      notify.error('This post is missing its photo')
      return false
    }
    const nextVersions = versionsOf(pkg)
    applyMaster(next)
    setPost(pkg)
    setVersions(nextVersions)
    setVersionsDirty(false)
    setPickerOpen(false)
    setEditingId(null)
    setPicked([])
    setExtraContext('')
    setSocialContext('')
    if (nextVersions.length) setChannels(nextVersions.map(v => v.channel))
    setStep('post')
    return true
  }

  const openPost = (pkg: ContentPackage) => {
    if (showPost(pkg)) go(`${BASE}/post/${pkg.id}`)
  }

  const leavePost = () => goBack(post?.journey_id ? journeyPath(post.journey_id) : BASE)

  const dropIdea = (id: string) => setIdeas(prev => prev.filter(i => i.id !== id))

  const openIdea = (idea: ContentIdea) => {
    go(`${BASE}/idea/${idea.id}`)
    if (idea.status !== 'suggested') return
    setIdeas(prev => prev.map(i => (i.id === idea.id ? { ...i, status: 'accepted' } : i)))
    apiService.updateContentIdea(idea.id, { status: 'accepted' }).catch(() => undefined)
  }

  const snoozeIdea = async (idea: ContentIdea) => {
    try {
      await apiService.updateContentIdea(idea.id, { status: 'snoozed', snooze_days: 7 })
      dropIdea(idea.id)
      notify.success('Saved for later. It comes back in a week.')
      if (stepRef.current === 'idea') goBack(BASE)
    } catch (error) {
      fail(error, 'Could not update the idea')
    }
  }

  const dismissIdea = async (idea: ContentIdea, reason: string) => {
    try {
      await apiService.updateContentIdea(idea.id, { status: 'dismissed', reason })
      dropIdea(idea.id)
      notify.success('Got it. Nexus will skip that one.')
      if (stepRef.current === 'idea') goBack(BASE)
    } catch (error) {
      fail(error, 'Could not update the idea')
    }
  }

  const refreshIdeas = async () => {
    setIdeasState('refreshing')
    try {
      setIdeas((await apiService.refreshContentIdeas()).ideas)
    } catch (error) {
      fail(error, 'Could not find new ideas')
    } finally {
      setIdeasState('ready')
    }
  }

  const startFromIdea = (idea: ContentIdea, photos?: ContentSource[]) => {
    const path = idea.journey_id ? `${journeyPath(idea.journey_id)}/new` : `${BASE}/new`
    navigate(path, { state: { from: location.pathname, idea, photos } })
  }

  const captureFromIdea = (idea: ContentIdea) => {
    setCaptureIdea(idea)
    setUploadOpen(true)
  }

  useEffect(() => {
    const current = stepRef.current
    if (route.view === 'home' || route.view === 'journeys' || route.view === 'journey' || route.view === 'idea' || route.view === 'capture') {
      resetDraft()
      setStep(route.view)
      return
    }
    if (route.view === 'new' || route.view === 'update') {
      const fromIdea = location.state as { idea?: ContentIdea; photos?: ContentSource[] } | null
      if (fromIdea?.idea && current === 'idea') {
        resetDraft()
        setDraftIdea(fromIdea.idea)
        setProgramFilter(fromIdea.idea.initiative_id || '')
        if (fromIdea.photos?.length) {
          const photos = fromIdea.photos.slice(0, MAX_PHOTOS)
          const base = withPhotos(emptyMaster(route.view === 'update' ? 'journey' : 'moment', photos[0]), photos)
          setBackStep('material')
          setPicked(photos)
          applyMaster(base)
          draftFrom(base, route.view === 'update' ? route.journeyId : null, fromIdea.idea.id)
        } else {
          setStep('material')
        }
        return
      }
      if (FLOW_STEPS.includes(current) && !editingRef.current && !postRef.current) return
      resetDraft()
      if (route.view === 'new') {
        setStep('moment')
      } else {
        setProgramFilter(journeysRef.current.find(j => j.id === route.journeyId)?.initiative_id || '')
        setStep('material')
      }
      return
    }
    if (postRef.current?.id === route.postId) {
      if (!POST_STEPS.includes(current)) setStep('post')
      return
    }
    resetDraft()
    setStep('post')
    setLoadingPost(true)
    let cancelled = false
    apiService.getContentPackage(route.postId)
      .then(pkg => {
        if (!cancelled && !showPost(pkg)) navigate(BASE, { replace: true })
      })
      .catch(error => {
        if (cancelled) return
        fail(error, 'Could not open that post')
        navigate(BASE, { replace: true })
      })
      .finally(() => {
        if (!cancelled) setLoadingPost(false)
      })
    return () => { cancelled = true }
  }, [route])

  const editPost = () => {
    if (!post) return
    setEditingId(post.id)
    setBackStep('post')
    setStep('master')
  }

  const cancelEdit = () => {
    if (editingId && post) {
      const original = masterFromPackage(post)
      if (original) applyMaster(original)
      setEditingId(null)
    }
    setStep(backStep)
  }

  const materialBack = () => {
    if (master) setStep('master')
    else if (draftIdea) goBack(`${BASE}/idea/${draftIdea.id}`)
    else if (route.view === 'update') goBack(journeyPath(route.journeyId))
    else setStep('moment')
  }

  const runRecommend = async () => {
    setBackStep('moment')
    setWorkingLabel('Picking the strongest story')
    setStep('working')
    try {
      const next = await apiService.recommendContent('moment')
      applyMaster(next)
      setExtraContext('')
      setStep('master')
    } catch (error) {
      fail(error, 'Could not pick a story')
      setStep('moment')
    }
  }

  const togglePick = (source: ContentSource) => {
    const key = sourceKey(source)
    setPicked(prev => {
      if (prev.some(s => sourceKey(s) === key)) return prev.filter(s => sourceKey(s) !== key)
      if (prev.length >= MAX_PHOTOS) {
        notify.error(`Up to ${MAX_PHOTOS} photos per post`)
        return prev
      }
      return [...prev, source]
    })
  }

  const continueFromMaterial = () => {
    if (picked.length === 0) return
    const base = master || emptyMaster(journeyId ? 'journey' : 'moment', picked[0])
    if (!master) setBackStep('material')
    const next = withPhotos(base, picked)
    if (!master || sourceKey(master.source) !== sourceKey(next.source)) applyMaster(next)
    else setMaster(next)
    setStep('master')
  }

  const setPhotos = (photos: ContentSource[]) => {
    if (!master || photos.length === 0) return
    const next = withPhotos(master, photos)
    if (sourceKey(next.source) !== sourceKey(master.source)) applyMaster(next)
    else setMaster(next)
  }

  const addMorePhotos = () => {
    if (!master) return
    setPicked(photosOf(master))
    setProgramFilter(journey?.initiative_id || '')
    setStep('material')
  }

  const draftFrom = async (current: ContentMaster, targetJourneyId: string | null, ideaId?: string | null) => {
    setWorkingLabel(ideaId ? 'Building the post around what they said' : targetJourneyId ? 'Drafting the next update' : 'Drafting with Nexus')
    setStep('working')
    try {
      const next = await apiService.generateContentMaster({
        source_type: current.source.source_type,
        source_id: current.source.source_id,
        story_type: current.story_type,
        journey_id: targetJourneyId,
        package_id: editingRef.current,
        extras: refsOf(current.extras),
        idea_id: ideaId || undefined,
      })
      applyMaster({ ...next, extras: next.extras?.length ? next.extras : current.extras })
      setStep('master')
    } catch (error) {
      fail(error, 'Could not draft it')
      setStep('master')
    }
  }

  const draftWithNexus = () => {
    if (master) draftFrom(master, journeyId, editingId ? null : draftIdea?.id)
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
        journey_id: journeyId,
        package_id: editingId,
        extras: refsOf(master.extras),
      })
      setMaster(hydrateMaster({ ...master, body: next.body }))
      notify.success('Body updated')
      setStep('master')
    } catch (error) {
      fail(error, 'Could not update the story')
      setStep('master')
    }
  }

  const save = async (publish?: boolean) => {
    if (!master) return
    const journeyWasDraft = !!journey && !journey.published_at
    setSaving(true)
    try {
      const pkg = await apiService.saveContentPackage({
        id: editingId,
        journey_id: route.view === 'update' ? route.journeyId : undefined,
        idea_id: editingId ? undefined : draftIdea?.id,
        extras: refsOf(master.extras),
        hook: master.hook,
        body: master.body,
        evidence_line: master.evidence_line,
        cta: master.cta,
        why: master.why,
        layout: layoutFromChrome(chrome),
        source_type: master.source.source_type,
        source_id: master.source.source_id,
        publish,
      })
      notify.success(
        publish
          ? journeyWasDraft ? 'Published. The journey is live too.' : 'Published to your public page'
          : editingId ? 'Saved' : 'Saved as a draft'
      )
      if (journeyId) loadJourneys()
      upsertPackage(pkg)
      if (draftIdea && !editingId) {
        dropIdea(draftIdea.id)
        setDraftIdea(null)
      }
      const wasNew = !editingId
      showPost(pkg)
      if (wasNew) navigate(`${BASE}/post/${pkg.id}`, { replace: true, state: cameFrom ? { from: cameFrom } : undefined })
    } catch (error) {
      fail(error, 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    if (!post?.published_at) return
    setPublishing(true)
    try {
      const next = await apiService.publishContentPackage(post.id, false)
      setPost(next)
      upsertPackage(next)
      if (journeyId) loadJourneys()
      notify.success('Moved to drafts')
    } catch (error) {
      fail(error, 'Could not update')
    } finally {
      setPublishing(false)
    }
  }

  const runVersions = async () => {
    if (!post || channels.length === 0 || generating) return
    const id = post.id
    setGenerating(true)
    try {
      const next = await apiService.generateContentChannels(id, {
        channels,
        context: socialContext.trim() || undefined,
      })
      upsertPackage(next)
      if (postRef.current?.id !== id) return
      setPost(next)
      setVersions(versionsOf(next))
      setVersionsDirty(false)
      setPickerOpen(false)
    } catch (error) {
      fail(error, 'Could not write the social posts')
    } finally {
      setGenerating(false)
    }
  }

  const saveChannelEdits = async () => {
    if (!post) return
    setSaving(true)
    try {
      const next = await apiService.saveContentChannels(post.id, versions)
      setPost(next)
      setVersions(versionsOf(next))
      setVersionsDirty(false)
      upsertPackage(next)
      notify.success('Social posts saved')
    } catch (error) {
      fail(error, 'Could not save the social posts')
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    notify.success(`${label} copied`)
  }

  const downloadGraphic = async (aspect: GraphicAspect, channel: ContentChannel) => {
    const source = master?.source
    if (!source) return
    setExportingChannel(channel)
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
      setExportingChannel(null)
    }
  }

  const downloadPhoto = async (source: ContentSource) => {
    try {
      const file = await apiService.getContentImageFile(source.source_type, source.source_id, source.title)
      triggerDownload(file)
      notify.success('Photo downloading')
    } catch (error) {
      fail(error, 'Could not download')
    }
  }

  const patchVersion = (channel: ContentChannel, patch: Partial<ContentChannelVersion>) => {
    setVersions(prev => prev.map(v => v.channel === channel ? { ...v, ...patch } : v))
    setVersionsDirty(true)
  }

  const saveJourney = async (input: { title: string; description: string | null; initiative_id: string | null }) => {
    const editing = journeyModal?.journey
    try {
      if (editing) {
        const next = await apiService.updateContentJourney(editing.id, input)
        setJourneys(prev => prev.map(j => j.id === next.id ? next : j))
        notify.success('Journey saved')
      } else {
        const next = await apiService.createContentJourney(input)
        setJourneys(prev => [next, ...prev])
        openJourney(next)
        notify.success('Journey created')
      }
      setJourneyModal(null)
    } catch (error) {
      fail(error, 'Could not save the journey')
    }
  }

  const patchJourney = async (patch: { status?: ContentJourney['status']; published?: boolean }, message: string) => {
    if (!journey) return
    try {
      const next = await apiService.updateContentJourney(journey.id, patch)
      setJourneys(prev => prev.map(j => j.id === next.id ? next : j))
      notify.success(message)
    } catch (error) {
      fail(error, 'Could not update the journey')
    }
  }

  const hasVersions = versions.length > 0
  const hasCopy = !!master && !!master.hook.trim() && !!master.body.trim()
  const published = !!post?.published_at
  const draftLabel = journey ? `Update · ${journey.title}` : 'Moment'
  const subtitle =
    step === 'journey' ? 'Add updates as it happens. Save each one as a draft for now.'
      : step === 'idea' ? 'A story worth capturing. Who to find, what to ask, and how to get the photo.'
        : step === 'material' ? (journey ? `Pick photos for the next update to ${journey.title}.` : 'Pick or upload photos. The first one is the cover.')
          : step === 'post' ? (published
            ? 'On your public page already. Social posts are optional versions of it.'
            : 'Saved as a draft for now. Social posts are optional versions of it.')
            : step === 'master' ? 'Save this as a draft. Social versions come after.'
              : 'Moments and journeys, saved as drafts. Social posts when you want them.'

  const chooser = step === 'moment' || step === 'working'
  const library = step === 'home' || step === 'journeys' || step === 'capture'
  const libraryView: LibraryView = step === 'journeys' ? 'journeys' : postKind === 'moments' ? 'moments' : 'all'
  const createViewRef = useRef<LibraryView>('all')
  if (step === 'home' || step === 'journeys') createViewRef.current = libraryView
  const newJourney = () => setJourneyModal({ journey: null })
  const visiblePosts = filterPosts(packages, postQuery, postKind, postStatus, postSocial)
  const postsFiltered = postStatus !== 'all' || postSocial !== 'all' || !!postQuery.trim()
  const clearPosts = () => {
    setPostQuery('')
    setPostStatus('all')
    setPostSocial('all')
  }
  const openStudio = (tab: 'posts' | 'journeys' | 'capture') => {
    const path = tab === 'posts' ? BASE : tab === 'journeys' ? `${BASE}/journeys` : `${BASE}/capture`
    if (location.pathname !== path) navigate(path)
  }
  const openCreate = () => {
    const view = createViewRef.current
    if (view === 'journeys') openStudio('journeys')
    else {
      setPostKind(view === 'moments' ? 'moments' : 'all')
      openStudio('posts')
    }
  }
  const setLibraryView = (view: LibraryView) => {
    createViewRef.current = view
    if (view === 'journeys') openStudio('journeys')
    else {
      setPostKind(view === 'moments' ? 'moments' : 'all')
      openStudio('posts')
    }
  }
  const wide = step === 'master' || step === 'post' || library

  useEffect(() => {
    if (!packagesReady || !journeysReady) return
    if (reduceMotion) {
      setRevealed(true)
      return
    }
    const wait = Math.max(0, 380 - (Date.now() - bootAt.current))
    const t = window.setTimeout(() => setRevealed(true), wait)
    return () => window.clearTimeout(t)
  }, [packagesReady, journeysReady, reduceMotion])

  useEffect(() => {
    if (revealed) stepIntro.current = true
  }, [revealed])

  if (!revealed) return <StudioBoot />

  return (
    <div className="content-studio relative h-screen overflow-hidden flex flex-col">
      <motion.div
        className={`relative z-10 w-full flex flex-col flex-1 min-h-0 pt-6 mobile-content-padding ${
        step === 'master' ? 'px-3 sm:px-4 lg:pl-3 lg:pr-8' : 'px-4 sm:px-6 lg:px-8'
      } ${!wide ? 'max-w-6xl mx-auto' : ''}`}
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        {library ? (
          <StudioBar
            mode={step === 'capture' ? 'ideas' : 'create'}
            view={libraryView}
            onMode={next => (next === 'ideas' ? openStudio('capture') : openCreate())}
            onView={setLibraryView}
            help={<Help />}
            actions={<NewMenu onMoment={startMoment} onJourney={newJourney} />}
            toolbar={step === 'capture' ? (
              <CaptureToolbar
                refreshing={ideasState === 'refreshing'}
                unavailable={ideasState === 'off'}
                onRefresh={refreshIdeas}
              />
            ) : step === 'journeys' && journeys.length > 0 ? (
              <JourneyFilters value={journeyFilter} onChange={setJourneyFilter} />
            ) : step === 'home' && packages.length > 0 ? (
              <PostToolbar
                query={postQuery}
                status={postStatus}
                social={postSocial}
                filtered={postsFiltered}
                shown={visiblePosts.length}
                total={postKind === 'moments' ? packages.filter(p => !p.journey_id).length : packages.length}
                scope={postKind === 'moments' ? 'moments' : 'all'}
                onQuery={setPostQuery}
                onStatus={setPostStatus}
                onSocial={setPostSocial}
                onClear={clearPosts}
              />
            ) : undefined}
          />
        ) : (
          <PageHeader
            className={`${chooser ? 'mb-0' : 'mb-4'} shrink-0`}
            title="Content"
            subtitle={subtitle}
            help={<Help />}
            actions={step === 'journey' || step === 'post' ? <NewMenu onMoment={startMoment} onJourney={newJourney} /> : undefined}
          />
        )}

        {schemaError && (
          <InlineAlert tone="warning" className="mb-3 shrink-0">{schemaError}</InlineAlert>
        )}

        <div className="flex-1 min-h-0 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduceMotion || !stepIntro.current ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.38, ease: EASE }}
              className={chooser ? 'w-full h-full overflow-hidden flex items-center justify-center' : `w-full h-full overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable] ${step === 'master' || step === 'post' || step === 'journey' ? 'pr-8' : ''}`}
            >
          {step === 'home' && (
            <ContentWorkspace
              packages={packages}
              journeys={journeys}
              loading={!packagesReady}
              query={postQuery}
              kind={postKind}
              status={postStatus}
              social={postSocial}
              onOpenPost={openPost}
              onOpenJourney={openJourney}
              onNewMoment={startMoment}
              onClear={clearPosts}
            />
          )}

          {step === 'capture' && (
            <CaptureQueue
              ideas={ideas}
              loading={ideasState === 'loading'}
              refreshing={ideasState === 'refreshing'}
              unavailable={ideasState === 'off'}
              onOpen={openIdea}
              onLater={snoozeIdea}
              onDismiss={dismissIdea}
            />
          )}

          {step === 'idea' && route.view === 'idea' && (
            <IdeaBrief
              ideaId={route.ideaId}
              onBack={() => goBack(BASE)}
              onCapture={captureFromIdea}
              onUsePhotos={idea => startFromIdea(idea)}
              onLater={snoozeIdea}
              onDismiss={dismissIdea}
              onOpenPost={id => go(`${BASE}/post/${id}`)}
            />
          )}

          {step === 'moment' && (
            <div className="w-full max-w-3xl mx-auto">
              <FlowBack onClick={() => goBack(BASE)} />
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-800">Moment</p>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-secondary-900">Who makes it?</h2>
              <p className="mt-2 mb-7 text-center text-sm text-secondary-500 max-w-md mx-auto leading-relaxed">
                Either way you can edit everything before you save it.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ChoiceCard
                  icon={Sparkles}
                  accent
                  kicker="Easiest"
                  title="Nexus makes it"
                  body="Nexus picks the strongest photo you have logged and writes the post."
                  onClick={runRecommend}
                />
                <ChoiceCard
                  icon={Pencil}
                  title="I'll make it"
                  body="Pick or upload photos, then write it yourself. Nexus can draft it if you want a head start."
                  onClick={startMomentDiy}
                />
              </div>
            </div>
          )}

          {step === 'journeys' && (
            <div className="pb-8">
              <JourneyGrid
                journeys={journeys}
                loading={!journeysReady}
                filter={journeyFilter}
                onOpen={openJourney}
                onAddUpdate={startUpdate}
                onCreate={newJourney}
              />
            </div>
          )}

          {step === 'journey' && !journey && (
            journeysReady ? (
              <EmptyState
                icon={Route}
                title="Journey not found"
                description="It may have been deleted, or it belongs to another organization."
                action={<button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => navigate(BASE)}>Back to content</button>}
              />
            ) : <SectionLoader />
          )}

          {step === 'journey' && journey && (
            <JourneyDetail
              journey={journey}
              updates={updates}
              loading={!packagesReady}
              onBack={leaveJourney}
              onAddUpdate={() => startUpdate(journey)}
              onOpenUpdate={openPost}
              onEdit={() => setJourneyModal({ journey })}
              onToggleStatus={() => patchJourney(
                { status: journey.status === 'completed' ? 'ongoing' : 'completed' },
                journey.status === 'completed' ? 'Marked ongoing' : 'Marked completed'
              )}
              onTogglePublished={() => {
                if (!journey.published_at) return
                patchJourney({ published: false }, 'Journey moved to drafts')
              }}
              onDelete={() => setDeleteJourneyOpen(true)}
            />
          )}

          {step === 'working' && <WorkingStage label={workingLabel} />}

          {step === 'material' && (
            <MaterialPicker
              sources={sources}
              picked={picked}
              loading={loadingSources}
              loadingMore={loadingMore}
              hasMore={hasMore}
              typeFilter={typeFilter}
              usage={usage}
              programs={programs}
              programFilter={programFilter}
              continueLabel={master ? 'Update photos' : picked.length > 1 ? `Use ${picked.length} photos` : 'Use this photo'}
              onType={setTypeFilter}
              onUsage={setUsage}
              onProgram={setProgramFilter}
              onToggle={togglePick}
              onUpload={() => setUploadOpen(true)}
              onMore={() => loadSources(false)}
              onContinue={continueFromMaterial}
              onBack={materialBack}
            />
          )}

          {step === 'master' && master && (
            <div className="grid grid-cols-1 lg:grid-cols-[24rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)] gap-6 lg:gap-10 pb-6 items-start">
              <aside className="w-full max-w-[24rem] xl:max-w-[21rem]">
                <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-200/80 bg-gray-900">
                  <img src={master.source.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                </div>
                <PhotoStrip photos={photosOf(master)} onChange={setPhotos} onAdd={addMorePhotos} />
              </aside>
              <section className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-800 truncate">{draftLabel}</p>
                  {draftIdea && !editingId && (
                    <span className="app-chip app-chip-accent text-[11px] inline-flex items-center gap-1 min-w-0 max-w-[16rem]">
                      <Lightbulb className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">From idea: {draftIdea.card.title}</span>
                      <button type="button" className="flex-shrink-0 -mr-1 p-0.5 rounded hover:bg-white/10" onClick={() => setDraftIdea(null)} aria-label="Unlink idea">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {hasCopy && (
                    <button type="button" className="app-btn app-btn-ghost app-btn-sm ml-auto" onClick={draftWithNexus}>
                      <Sparkles className="w-3.5 h-3.5" /> Redraft with Nexus
                    </button>
                  )}
                </div>
                {!master.hook.trim() && !master.body.trim() && (
                  <div className="app-card-muted mt-3 p-4 flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-semibold text-secondary-900">Write it, or let Nexus draft it</p>
                      <p className="text-[12px] text-secondary-500 mt-0.5 leading-snug">
                        {journey
                          ? 'Nexus reads the photos and the earlier updates, then writes what is new.'
                          : 'Nexus reads what you logged about these photos and writes a first draft.'}
                      </p>
                    </div>
                    <button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={draftWithNexus}>
                      <Sparkles className="w-3.5 h-3.5" /> Draft with Nexus
                    </button>
                  </div>
                )}
                <div className="studio-panel mt-3 space-y-3.5 rounded-2xl border p-4">
                  <label className="block">
                    <span className="block text-[11px] font-medium text-secondary-500 mb-1">Headline</span>
                    <GrowField
                      value={master.hook}
                      onChange={v => setMaster({ ...master, hook: v })}
                      placeholder={journey ? 'Week 12. They read a whole book.' : 'Headline'}
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
                      placeholder={journey ? 'Follow the journey.' : 'Learn more about our work.'}
                    />
                  </label>
                </div>
                {hasCopy && (
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
                      placeholder="Mention that the class picked the book themselves."
                    />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-5">
                  {editingId ? (
                    <button type="button" className="app-btn app-btn-primary" disabled={!hasCopy || saving} onClick={() => save()}>
                      {saving ? <Spinner className="w-3.5 h-3.5" /> : null} Save changes
                    </button>
                  ) : (
                    <button type="button" className="app-btn app-btn-primary" disabled={!hasCopy || saving} onClick={() => save(false)}>
                      {saving ? <Spinner className="w-3.5 h-3.5" /> : null} Save draft
                    </button>
                  )}
                  <PublishSoon />
                  <button type="button" className="app-btn app-btn-ghost" onClick={cancelEdit}>
                    {editingId ? 'Cancel' : 'Back'}
                  </button>
                </div>
                {!editingId && (
                  <p className="mt-2 text-[12px] text-secondary-400">
                    Save this as a draft. Only your team can see it until publishing is on.
                  </p>
                )}
              </section>
            </div>
          )}

          {step === 'post' && !post && loadingPost && <SectionLoader />}

          {step === 'post' && post && master && (
            <div className="space-y-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={leavePost}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <PublishBadge published={published} />
                {journey && (
                  <button
                    type="button"
                    className="text-[12px] text-secondary-500 hover:text-impact-700 truncate"
                    onClick={() => go(journeyPath(journey.id))}
                  >
                    Update in {journey.title}
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={editPost}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button type="button" className="app-btn app-btn-ghost app-btn-sm is-danger" onClick={() => setDeleteId(post.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                  {published ? (
                    <button
                      type="button"
                      className="app-btn app-btn-sm app-btn-secondary"
                      disabled={publishing}
                      onClick={togglePublish}
                    >
                      {publishing ? <Spinner className="w-3.5 h-3.5" /> : <Globe className="w-3.5 h-3.5" />}
                      Move to draft
                    </button>
                  ) : (
                    <PublishSoon small />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[22rem_minmax(0,1fr)] gap-6 lg:gap-8 items-start">
                <section>
                  <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-500">Public post</p>
                  <PublicPostPreview
                    master={master}
                    kicker={journey ? journey.title : undefined}
                    date={post.published_at || post.created_at}
                    onCopy={copyText}
                    onDownload={downloadPhoto}
                  />
                  <p className="mt-2 px-0.5 text-[12px] text-secondary-400">
                    {published ? 'Published. It will show on your public page.' : 'Draft. Only your team can see it.'}
                  </p>
                </section>

                <section className="min-w-0">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-secondary-900">Social posts</p>
                      <p className="text-[12px] text-secondary-500">Optional. Versions of this post written for each channel.</p>
                    </div>
                    {hasVersions && !generating && (
                      <div className="ml-auto flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={`app-btn app-btn-ghost app-btn-sm ${pickerOpen ? 'bg-white/10' : ''}`}
                          onClick={() => setPickerOpen(v => !v)}
                        >
                          Change channels
                        </button>
                        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={runVersions}>
                          <RefreshCw className="w-3.5 h-3.5" /> Regenerate
                        </button>
                        {versionsDirty && (
                          <button type="button" className="app-btn app-btn-primary app-btn-sm" disabled={saving} onClick={saveChannelEdits}>
                            {saving ? <Spinner className="w-3.5 h-3.5" /> : null} Save edits
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {hasVersions && post.channels_stale && !generating && (
                    <InlineAlert tone="warning" className="mt-3">
                      You edited the post after these were written. Regenerate so they match.
                    </InlineAlert>
                  )}

                  <AnimatePresence mode="wait" initial={false}>
                  {generating ? (
                    <motion.div
                      key="working"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2, ease: EASE }}
                      className="app-card-muted mt-3 h-[24rem] overflow-hidden"
                    >
                      <WorkingStage label="Writing your social posts" />
                    </motion.div>
                  ) : pickerOpen ? (
                    <ChannelPicker
                      key="picker"
                      selected={channels}
                      onChange={setChannels}
                      context={socialContext}
                      onContext={setSocialContext}
                      regenerate={hasVersions}
                      onRun={runVersions}
                      onCancel={() => setPickerOpen(false)}
                    />
                  ) : !hasVersions ? (
                    <motion.div
                      key="empty"
                      initial={reduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="app-card-muted mt-3 px-6 py-10 flex flex-col items-center text-center"
                    >
                      <span className="app-icon-tile app-icon-tile-accent">
                        <Share2 className="w-4 h-4" />
                      </span>
                      <p className="mt-3 text-[14px] font-semibold text-secondary-900">No social posts yet</p>
                      <p className="mt-1 text-[12px] text-secondary-500 max-w-sm leading-snug">
                        Nexus adapts this post for Instagram, Facebook, LinkedIn, email, and SMS. You pick which ones.
                      </p>
                      <button type="button" className="app-btn app-btn-primary app-btn-sm mt-4" onClick={() => setPickerOpen(true)}>
                        Create social posts
                      </button>
                    </motion.div>
                  ) : null}
                  </AnimatePresence>

                  {hasVersions && !generating && (
                    <>
                      <div className="studio-panel mt-3 rounded-2xl border px-3 py-2.5">
                        <p className="text-[11px] font-semibold text-secondary-700">Graphic overlay</p>
                        <OverlayBar chrome={chrome} copy={copy} onChrome={setChrome} onCopy={setCopy} />
                      </div>
                      <div className="flex flex-wrap gap-5 items-start mt-4">
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
                              extras={master.extras || []}
                              chrome={chrome}
                              copy={copy}
                              onChange={patch => patchVersion(version.channel, patch)}
                              onCopy={copyText}
                              onDownload={() => downloadGraphic(aspectForDownload(version.channel), version.channel)}
                              onDownloadExtra={downloadPhoto}
                              downloading={exportingChannel === version.channel}
                            />
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              </div>
            </div>
          )}

            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {deleteId && (
        <ConfirmDialog
          title={journey ? 'Delete update' : 'Delete moment'}
          message="This deletes the post and any social versions of it. The original photos stay in tracking."
          confirmLabel="Delete"
          tone="danger"
          onConfirm={async () => {
            try {
              await apiService.deleteContentPackage(deleteId)
              setPackages(prev => prev.filter(p => p.id !== deleteId))
              if (journeyId) loadJourneys()
              notify.success('Deleted')
              leavePost()
            } catch (error) {
              fail(error, 'Failed to delete')
            } finally {
              setDeleteId(null)
            }
          }}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {deleteJourneyOpen && journey && (
        <ConfirmDialog
          title="Delete journey"
          message={`This deletes "${journey.title}" and all ${updates.length} ${updates.length === 1 ? 'update' : 'updates'} in it, plus their social posts. The original photos stay in tracking. To hide it without deleting, move it to draft.`}
          confirmLabel="Delete journey"
          tone="danger"
          onConfirm={async () => {
            try {
              await apiService.deleteContentJourney(journey.id)
              setJourneys(prev => prev.filter(j => j.id !== journey.id))
              setPackages(prev => prev.filter(p => p.journey_id !== journey.id))
              notify.success('Journey deleted')
              leaveJourney()
            } catch (error) {
              fail(error, 'Failed to delete')
            } finally {
              setDeleteJourneyOpen(false)
            }
          }}
          onCancel={() => setDeleteJourneyOpen(false)}
        />
      )}

      {journeyModal && (
        <JourneyModal
          journey={journeyModal.journey}
          programs={programs}
          onClose={() => setJourneyModal(null)}
          onSave={saveJourney}
        />
      )}

      {uploadOpen && captureIdea && (
        <ContentUploadModal
          programs={programs}
          defaultInitiativeId={captureIdea.initiative_id || null}
          defaultTitle={captureIdea.card.title}
          subtitle="Add what you captured. Nexus drafts the post from the photos and their words."
          noteLabel="Their exact words"
          notePlaceholder="Write down what they said, word for word. Nexus builds the post around it."
          onClose={() => { setUploadOpen(false); setCaptureIdea(null) }}
          onUploaded={uploaded => {
            const idea = captureIdea
            setUploadOpen(false)
            setCaptureIdea(null)
            startFromIdea(idea, uploaded)
          }}
        />
      )}

      {uploadOpen && !captureIdea && (
        <ContentUploadModal
          programs={programs}
          defaultInitiativeId={journey?.initiative_id || programFilter || null}
          defaultTitle={journey?.title}
          onClose={() => setUploadOpen(false)}
          onUploaded={uploaded => {
            setUploadOpen(false)
            setSources(prev => [...uploaded, ...prev.filter(s => !uploaded.some(u => sourceKey(u) === sourceKey(s)))])
            setPicked(prev => [...prev, ...uploaded].slice(0, MAX_PHOTOS))
          }}
        />
      )}
    </div>
  )
}

function PublicPostPreview({
  master,
  kicker,
  date,
  onCopy,
  onDownload,
}: {
  master: ContentMaster
  kicker?: string
  date: string
  onCopy: (text: string, label: string) => void
  onDownload: (source: ContentSource) => void
}) {
  const story = [master.hook, master.body, master.cta].filter(Boolean).join('\n\n')
  return (
    <article className="app-card studio-panel overflow-hidden">
      <PhotoCarousel extras={master.extras || []} aspect="square" onDownloadExtra={onDownload}>
        <GraphicHover onDownload={() => onDownload(master.source)}>
          <div className="relative w-full aspect-square overflow-hidden bg-gray-900">
            <img src={master.source.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </GraphicHover>
      </PhotoCarousel>
      <div className="p-4 space-y-2">
        {kicker && <p className="text-[11px] font-semibold uppercase tracking-wide text-impact-700 truncate">{kicker}</p>}
        <h3 className="text-[16px] font-semibold tracking-tight text-secondary-900 leading-snug">{master.hook}</h3>
        <p className="text-[13px] text-secondary-700 leading-relaxed whitespace-pre-wrap">{master.body}</p>
        {master.cta && <p className="text-[13px] font-medium text-primary-800">{master.cta}</p>}
        <div className="flex items-center pt-1">
          <p className="text-[11px] text-secondary-400">{formatDate(date, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
          <button type="button" className="app-btn app-btn-ghost app-btn-sm h-7 px-2 ml-auto" onClick={() => onCopy(story, 'Post')}>
            <Copy className="w-3 h-3" /> Copy
          </button>
        </div>
      </div>
    </article>
  )
}

function ChannelPicker({
  selected,
  onChange,
  context,
  onContext,
  regenerate,
  onRun,
  onCancel,
}: {
  selected: ContentChannel[]
  onChange: (next: ContentChannel[]) => void
  context: string
  onContext: (value: string) => void
  regenerate: boolean
  onRun: () => void
  onCancel: () => void
}) {
  const reduce = useReducedMotion()
  const available = CHANNELS.filter(c => !c.soon).map(c => c.id)
  const allOn = available.every(id => selected.includes(id))
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 6 }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 380, damping: 30 }}
      style={{ transformOrigin: 'top center' }}
      className="app-card-elevated studio-panel mt-3 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="app-icon-tile app-icon-tile-accent flex-shrink-0">
          <Share2 className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[16px] font-semibold tracking-tight text-secondary-900">Where should this go?</p>
          <p className="text-[12px] text-secondary-500 mt-0.5">Tap every place you want a version. Nexus writes each one from the saved post.</p>
        </div>
        <button
          type="button"
          className="ml-auto text-[12px] font-medium text-secondary-500 hover:text-primary-800 flex-shrink-0"
          onClick={() => onChange(allOn ? [] : available)}
        >
          {allOn ? 'Clear' : 'Select all'}
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4">
        {CHANNELS.map((ch, i) => {
          const on = selected.includes(ch.id)
          const Icon = ch.icon
          const soon = !!ch.soon
          return (
            <motion.button
              key={ch.id}
              type="button"
              disabled={soon}
              aria-pressed={on}
              onClick={soon ? undefined : () => onChange(on ? selected.filter(id => id !== ch.id) : [...selected, ch.id])}
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduce ? 0 : 0.06 + i * 0.04, duration: 0.28, ease: EASE }}
              whileTap={soon || reduce ? undefined : { scale: 0.96 }}
              className={`group relative min-h-[7.5rem] app-tile px-3 pt-4 pb-3 flex flex-col items-center text-center transition-colors ${
                soon
                  ? 'opacity-55 cursor-not-allowed hover:shadow-card hover:translate-y-0 grayscale'
                  : on ? 'ring-2 ring-primary-400 bg-white/10' : ''
              }`}
            >
              {on && !soon && (
                <motion.span
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                  className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-700 text-white flex items-center justify-center"
                >
                  <Check className="w-3 h-3" strokeWidth={3} />
                </motion.span>
              )}
              <span className={`app-icon-tile w-10 h-10 rounded-xl transition-transform group-hover:scale-105 ${on && !soon ? 'app-icon-tile-accent' : ''}`}>
                <Icon className="w-5 h-5" />
              </span>
              <span className={`mt-2 text-[13px] font-semibold tracking-tight ${soon ? 'text-secondary-600' : 'text-secondary-900 group-hover:text-primary-800'}`}>
                {ch.label}
              </span>
              <span className={`mt-0.5 text-[11px] leading-snug line-clamp-2 ${soon ? 'text-secondary-400' : 'text-secondary-500'}`}>
                {soon ? 'Coming soon' : ch.body}
              </span>
            </motion.button>
          )
        })}
      </div>
      <label className="block mt-4">
        <span className="app-label">Anything for the social versions? (optional)</span>
        <GrowField
          minRows={2}
          value={context}
          onChange={onContext}
          placeholder="This is for last year's gala donors. Mention Friday's volunteer night."
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button type="button" className="app-btn app-btn-primary" disabled={selected.length === 0} onClick={onRun}>
          <Sparkles className="w-4 h-4" />
          {regenerate ? 'Regenerate social posts' : 'Make social posts'}
          {selected.length > 0 ? ` (${selected.length})` : ''}
        </button>
        <button type="button" className="app-btn app-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </motion.div>
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
                className={`relative w-7 h-4 rounded-full transition-colors ${on ? 'bg-seafoam' : 'bg-white/20'}`}
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
  const frame = frameClass(aspect)
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

function ChannelPreview({
  version,
  orgName,
  logoUrl,
  brandColor,
  photoUrl,
  extras,
  chrome,
  copy,
  onChange,
  onCopy,
  onDownload,
  onDownloadExtra,
  downloading,
}: {
  version: ContentChannelVersion
  orgName: string
  logoUrl?: string | null
  brandColor?: string | null
  photoUrl: string
  extras: ContentSource[]
  chrome: GraphicChrome
  copy: GraphicCopy
  onChange: (patch: Partial<ContentChannelVersion>) => void
  onCopy: (text: string, label: string) => void
  onDownload: () => void
  onDownloadExtra: (source: ContentSource) => void
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
  const carousel = (
    <PhotoCarousel extras={extras} aspect={aspectForChannel(version.channel)} onDownloadExtra={onDownloadExtra}>
      {graphic}
    </PhotoCarousel>
  )
  const handle = orgHandle(orgName)
  const channel = version.channel

  if (channel === 'sms') {
    return (
      <div className="w-[248px]">
        <PreviewLabel icon={meta?.icon} label="SMS" onCopy={() => onCopy(version.caption || '', 'Caption')} />
        <div className="rounded-[1.7rem] studio-panel border border-white/15 p-3 flex flex-col">
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
          <div className="self-start max-w-[92%] rounded-2xl rounded-bl-md bg-white/10 border border-white/10 px-3 py-2">
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
        <article className="rounded-2xl studio-panel border border-white/15 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-white/10">
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
        <article className="rounded-2xl studio-panel border border-white/15 overflow-hidden">
          <div className="flex items-center gap-2 px-2.5 py-2">
            <OrgAvatar logoUrl={logoUrl} name={orgName} />
            <p className="text-[12px] font-semibold text-secondary-900 truncate">{handle}</p>
          </div>
          {carousel}
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
        <article className="rounded-2xl studio-panel border border-white/15 overflow-hidden">
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
          {carousel}
          <div className="flex items-center gap-4 px-3 py-2 text-[11px] font-medium text-secondary-500 border-t border-white/10">
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
      <article className="rounded-2xl studio-panel border border-white/15 overflow-hidden">
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
        {carousel}
      </article>
    </div>
  )
}

function PhotoCarousel({
  children,
  extras,
  aspect,
  onDownloadExtra,
}: {
  children: ReactNode
  extras: ContentSource[]
  aspect: GraphicAspect
  onDownloadExtra: (source: ContentSource) => void
}) {
  const [index, setIndex] = useState(0)
  const total = 1 + extras.length
  useEffect(() => {
    if (index >= total) setIndex(0)
  }, [index, total])
  if (total === 1) return <>{children}</>
  const extra = index > 0 ? extras[index - 1] : null
  const go = (delta: number) => setIndex(i => (i + delta + total) % total)
  return (
    <div className="relative">
      {extra ? (
        <GraphicHover onDownload={() => onDownloadExtra(extra)}>
          <div className={`relative w-full overflow-hidden bg-gray-900 ${frameClass(aspect)}`}>
            <img src={extra.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </GraphicHover>
      ) : children}
      <span className="pointer-events-none absolute top-2 right-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
        {index + 1}/{total}
      </span>
      <button
        type="button"
        aria-label="Previous photo"
        onClick={() => go(-1)}
        className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/55 text-white border border-white/15 flex items-center justify-center hover:bg-black/70"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        type="button"
        aria-label="Next photo"
        onClick={() => go(1)}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-black/55 text-white border border-white/15 flex items-center justify-center hover:bg-black/70"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <div className="pointer-events-none absolute bottom-2 inset-x-0 z-10 flex justify-center gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/50'}`} />
        ))}
      </div>
    </div>
  )
}

function PhotoStrip({
  photos,
  onChange,
  onAdd,
}: {
  photos: ContentSource[]
  onChange: (photos: ContentSource[]) => void
  onAdd: () => void
}) {
  const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, idx) => idx !== i)])
  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i))
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {photos.map((photo, i) => (
          <div key={sourceKey(photo)} className={`group/thumb relative w-12 h-12 rounded-lg overflow-hidden border ${i === 0 ? 'border-primary-500 ring-2 ring-primary-100' : 'border-gray-200/80'}`}>
            <img src={photo.thumb_url || photo.image_url} alt="" className="w-full h-full object-cover" />
            {i === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-primary-600 text-white text-[9px] font-semibold text-center leading-4">Cover</span>
            ) : (
              <button
                type="button"
                aria-label="Make cover"
                title="Make cover"
                onClick={() => makeCover(i)}
                className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 group-hover/thumb:bg-black/45 group-hover/thumb:opacity-100 transition-all"
              >
                <Star className="w-4 h-4" />
              </button>
            )}
            {photos.length > 1 && (
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => remove(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/65 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={onAdd}
            aria-label="Add photos"
            className="w-12 h-12 rounded-lg border border-dashed border-gray-300 text-secondary-400 hover:text-primary-800 hover:border-primary-300 flex items-center justify-center"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      {photos.length > 1 && (
        <p className="mt-1 text-[11px] text-secondary-400">Carousel on Instagram, Facebook, and LinkedIn. Email and SMS use the cover.</p>
      )}
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
    <span className="w-7 h-7 rounded-full bg-white/15 text-white text-[10px] font-bold flex items-center justify-center">
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
  picked,
  loading,
  loadingMore,
  hasMore,
  typeFilter,
  usage,
  programs,
  programFilter,
  continueLabel,
  onType,
  onUsage,
  onProgram,
  onToggle,
  onUpload,
  onMore,
  onContinue,
  onBack,
}: {
  sources: ContentSource[]
  picked: ContentSource[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  typeFilter: TypeFilter
  usage: ContentUsageFilter
  programs: Initiative[]
  programFilter: string
  continueLabel: string
  onType: (v: TypeFilter) => void
  onUsage: (v: ContentUsageFilter) => void
  onProgram: (id: string) => void
  onToggle: (source: ContentSource) => void
  onUpload: () => void
  onMore: () => void
  onContinue: () => void
  onBack: () => void
}) {
  const order = new Map(picked.map((s, i) => [sourceKey(s), i + 1]))
  return (
    <div className="space-y-3 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-white/10 bg-white/5">
          {(['all', 'unused', 'used'] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onUsage(id)}
              className={`h-full px-2.5 rounded-full text-xs font-medium ${usage === id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
            >
              {id === 'all' ? 'All' : id === 'unused' ? 'Unused' : 'Used'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-white/10 bg-white/5">
          {([
            ['all', 'All'],
            ['evidence', 'Evidence'],
            ['story', 'Stories'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onType(id)}
              className={`h-full px-2.5 rounded-full text-xs font-medium ${typeFilter === id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
            >
              {label}
            </button>
          ))}
        </div>
        {programs.length > 1 && (
          <select
            className="app-input h-8 py-0 text-xs w-auto max-w-[14rem]"
            value={programFilter}
            onChange={e => onProgram(e.target.value)}
            aria-label="Program"
          >
            <option value="">All programs</option>
            {programs.filter(p => p.id).map(p => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        )}
        <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onUpload}>
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
        <div className="ml-auto flex items-center gap-2">
          {picked.length > 0 && (
            <span className="text-[12px] text-secondary-500">
              {picked.length} selected{picked.length > 1 ? ' · #1 is the cover' : ''}
            </span>
          )}
          <button type="button" className="app-btn app-btn-primary app-btn-sm" disabled={picked.length === 0} onClick={onContinue}>
            {continueLabel}
          </button>
        </div>
      </div>
      {loading && sources.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square w-full rounded-xl" />)}
        </div>
      ) : sources.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos here"
          description="Upload new photos, or switch filters. Used means it has been in a post before. You can still reuse it."
          action={<button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={onUpload}>Upload photos</button>}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {sources.map((source, i) => (
              <SourceTile
                key={sourceKey(source)}
                source={source}
                order={order.get(sourceKey(source))}
                eager={i < 6}
                onSelect={() => onToggle(source)}
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
  order,
  eager,
  onSelect,
}: {
  source: ContentSource
  order?: number
  eager?: boolean
  onSelect: () => void
}) {
  const original = source.image_url
  const [src, setSrc] = useState(source.thumb_url || original)
  useEffect(() => { setSrc(source.thumb_url || original) }, [source.thumb_url, original])
  const active = order != null
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
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
      {active ? (
        <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-primary-600 text-white text-[11px] font-bold flex items-center justify-center shadow-card">
          {order}
        </span>
      ) : source.used ? (
        <span className="absolute top-1.5 right-1.5 rounded-full px-2 py-1 text-[10px] font-semibold bg-black/55 text-white border border-white/15">
          Used
        </span>
      ) : null}
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
