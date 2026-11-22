import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type DragEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { FacebookIcon, InstagramIcon, LinkedInIcon, isQueued, socialColor } from '../../pages/studio/StudioFrame'
import {
  BookOpen,
  Check,
  Bookmark,
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Heart,
  Image as ImageIcon,
  Lightbulb,
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
import { CaptureTodos, CaptureToolbar, IdeaBrief } from './ContentIdeas'
import { ContentImpactWeb } from './ContentImpactWeb'
import { JourneyDetail, JourneyFilters, JourneyGrid, JourneyModal, PublishBadge, usePrograms, type JourneyFilter } from './ContentJourneys'
import { ContentWorkspace, NewMenu, PostToolbar, StudioBar, filterPosts, type KindFilter, type LibraryView, type SocialFilter, type StatusFilter } from './ContentWorkspace'
import { useTeam } from '../../context/TeamContext'
import { apiService } from '../../services/api'
import { notify } from '../../lib/notify'
import { useSocialAccount } from '../../pages/studio/useSocialAccount'
import { formatDate, getLocalDateString } from '../../utils'
import DateRangePicker from '../DateRangePicker'
import { triggerDownload } from '../../utils/contentExport'
import {
  EmptyState,
  InlineAlert,
  PageHeader,
  SectionLoader,
  Skeleton,
  Spinner,
} from '../ui'
import { patchStudioPackage, removeStudioJourney, removeStudioPackage, upsertStudioPackage } from '../../pages/studio/useStudioLibrary'
import SocialPostPreview from '../studio/SocialPostPreview'
import type {
  ContentChannel,
  ContentChannelVersion,
  ContentJourney,
  ContentMaster,
  ContentMediaItem,
  ContentPackage,
  ContentPublication,
  ContentSource,
  ContentSourceRef,
  ContentUsageFilter,
  GraphicAspect,
  GraphicChrome,
  GraphicCopy,
  GraphicLayout,
  Initiative,
  ContentIdea,
  ContentIdeaSelection,
  ContentIdeaStakeholder,
  ContentIdeaWeb,
} from '../../types'

type Step = 'home' | 'journeys' | 'journey' | 'idea' | 'capture' | 'todos' | 'material' | 'working' | 'master' | 'post'
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
  | { view: 'todos' }

const BASE = '/studio'
const FLOW_STEPS: Step[] = ['material', 'working', 'master']
const POST_STEPS: Step[] = ['post', 'master', 'material', 'working']

function parseView(pathname: string): View {
  const [head, id, tail] = pathname.slice(BASE.length).split('/').filter(Boolean)
  if (head === 'new') return { view: 'new' }
  if (head === 'journeys') return { view: 'journeys' }
  if (head === 'journey' && id) return tail === 'new' ? { view: 'update', journeyId: id } : { view: 'journey', journeyId: id }
  if (head === 'post' && id) return { view: 'post', postId: id }
  if (head === 'idea' && id) return { view: 'idea', ideaId: id }
  if (head === 'capture') return { view: 'capture' }
  if (head === 'todos') return { view: 'todos' }
  return { view: 'home' }
}

const PAGE_SIZE = 21
const MAX_PHOTOS = 10

type StudioDraftCache = {
  master: ContentMaster
  extraContext: string
  picked: ContentSource[]
  programFilter: string
  backStep: Step
  draftIdea: ContentIdea | null
  editingId: string | null
}

function studioDraftKey(orgId: string | undefined, pathname: string) {
  if (!orgId) return null
  return `studio-draft:${orgId}:${pathname}`
}

function readStudioDraft(key: string | null): StudioDraftCache | null {
  if (!key) return null
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StudioDraftCache
    if (!parsed?.master?.source?.source_id) return null
    return parsed
  } catch {
    return null
  }
}

function writeStudioDraft(key: string | null, draft: StudioDraftCache) {
  if (!key) return
  try { sessionStorage.setItem(key, JSON.stringify(draft)) } catch { /* full storage */ }
}

function clearStudioDraft(key: string | null) {
  if (!key) return
  try { sessionStorage.removeItem(key) } catch { /* ignore */ }
}
type ChannelIcon = ComponentType<{ className?: string; style?: CSSProperties }>

const CHANNELS: { id: ContentChannel; label: string; body: string; icon: ChannelIcon; soon?: boolean }[] = [
  { id: 'instagram', label: 'Instagram', body: 'Square post. Short lines, a few emojis.', icon: InstagramIcon },
  { id: 'facebook', label: 'Facebook', body: 'A page update people will share.', icon: FacebookIcon },
  { id: 'linkedin', label: 'LinkedIn', body: 'Professional, still human.', icon: LinkedInIcon },
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

function firstLine(text: string) {
  return text.split('\n').map(line => line.trim()).find(Boolean) || ''
}

function postCaption(master: { hook?: string | null; body?: string | null; cta?: string | null }) {
  const hook = (master.hook || '').trim()
  const body = master.body || ''
  const cta = (master.cta || '').trim()
  if (!cta && hook && body.trim().startsWith(hook)) return body
  return [hook, body.trim(), cta].filter(Boolean).join('\n\n')
}

function applyCaption(master: ContentMaster, text: string): ContentMaster {
  return { ...master, hook: firstLine(text), body: text, cta: '' }
}

function captionFromSource(source: ContentSource) {
  const title = (source.title || '').trim()
  const description = (source.description || '').trim()
  if (!title) return description
  if (!description || description === title || description.toLowerCase().startsWith(title.toLowerCase())) return description || title
  return `${title}\n\n${description}`
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
      <p>Moments are single posts. Journeys are a series of updates that follow something over time, like a class through the school year.</p>
      <p>Send a post to Instagram, Facebook, or LinkedIn once those accounts are connected. A sent post also goes on your Nexus page. A scheduled post stays a draft until it goes out.</p>
    </div>
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

function SendScreen({
  names,
  scheduling,
  whenLabel,
  done,
}: {
  names: string
  scheduling: boolean
  whenLabel: string
  done: boolean
}) {
  const reduce = useReducedMotion()
  const steps = scheduling
    ? ['Getting the post ready', `Scheduling it for ${names}`, whenLabel ? `It goes out ${whenLabel}` : 'Saving the schedule']
    : ['Getting the post ready', `Sending it to ${names}`, 'Adding it to your Nexus page']
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (done) return
    const id = window.setInterval(() => setIndex(current => Math.min(current + 1, steps.length - 2)), 1100)
    return () => window.clearInterval(id)
  }, [done, steps.length])
  const shown = done ? steps.length - 1 : index
  const progress = done ? 100 : Math.min(88, ((shown + 1) / steps.length) * 78)
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-[var(--studio-canvas)] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/Nexuslogo.png" alt="" className="w-14 h-14 mx-auto object-contain" />
        <p className="mt-6 text-xl font-semibold tracking-tight text-secondary-900">
          {scheduling ? 'Scheduling your post' : 'Posting'}
        </p>
        <p className="mt-2 text-sm text-secondary-500 min-h-5">{steps[shown]}</p>
        <div className="mt-6 h-1.5 rounded-full studio-teal-wash overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-[var(--studio-green)]"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }}
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}

export function StudioBoot() {
  return (
    <div className="h-screen flex items-center justify-center">
      <Spinner className="w-8 h-8" />
    </div>
  )
}

export default function ContentEngine() {
  const [compactComposer, setCompactComposer] = useState(() => window.innerWidth < 1024)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 1023px)')
    const update = () => setCompactComposer(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
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
  const { account: socialAccount, ready: socialReady } = useSocialAccount()
  const [journeyFilter, setJourneyFilter] = useState<JourneyFilter>('all')
  const [ideas, setIdeas] = useState<ContentIdea[]>([])
  const [ideasState, setIdeasState] = useState<'loading' | 'ready' | 'refreshing' | 'off'>('loading')
  const [web, setWeb] = useState<ContentIdeaWeb | null>(null)
  const [webLoading, setWebLoading] = useState(false)
  const [busyStakeholder, setBusyStakeholder] = useState<ContentIdeaStakeholder | null>(null)
  const [swapping, setSwapping] = useState(false)
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

  useEffect(() => {
    if (step !== 'capture' || web || webLoading) return
    loadWeb()
  }, [step, web, webLoading])

  const captureRedirect = useRef({ org: '', armed: false })

  useEffect(() => {
    captureRedirect.current = { org: activeOrganization?.id || '', armed: true }
    setJourneysReady(false)
    setPackagesReady(false)
    setJourneys([])
    setPackages([])
    setIdeas([])
    setIdeasState('loading')
    setWeb(null)
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

  useEffect(() => {
    const key = studioDraftKey(activeOrganization?.id, location.pathname)
    if (!key || step !== 'master' || !master) return
    if (route.view !== 'new' && route.view !== 'update' && route.view !== 'post') return
    writeStudioDraft(key, {
      master,
      extraContext,
      picked,
      programFilter,
      backStep,
      draftIdea,
      editingId,
    })
  }, [activeOrganization?.id, location.pathname, route.view, step, master, extraContext, picked, programFilter, backStep, draftIdea, editingId])

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
    if (activeOrganization?.id) upsertStudioPackage(activeOrganization.id, pkg)
  }

  const startMoment = () => go(`${BASE}/new`)

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
    const cached = readStudioDraft(studioDraftKey(activeOrganization?.id, location.pathname))
    const keepEdit = cached?.editingId === pkg.id && !!cached.master
    applyMaster(keepEdit ? cached.master : next)
    setPost(pkg)
    setVersions(nextVersions)
    setVersionsDirty(false)
    setPickerOpen(false)
    setEditingId(keepEdit ? pkg.id : null)
    setPicked(keepEdit ? cached.picked || [] : [])
    setExtraContext(keepEdit ? cached.extraContext || '' : '')
    setSocialContext('')
    if (nextVersions.length) setChannels(nextVersions.map(v => v.channel))
    if (keepEdit) setBackStep('post')
    setStep(keepEdit ? 'master' : 'post')
    return true
  }

  const openPost = (pkg: ContentPackage) => {
    if (showPost(pkg)) go(`${BASE}/post/${pkg.id}`)
  }

  const leavePost = () => goBack(post?.journey_id ? journeyPath(post.journey_id) : BASE)

  const dropIdea = (id: string) => setIdeas(prev => prev.filter(i => i.id !== id))

  const openIdea = (idea: ContentIdea) => {
    go(`${BASE}/idea/${idea.id}`)
  }

  const loadWeb = async () => {
    setWebLoading(true)
    try {
      setWeb(await apiService.getContentIdeaWeb())
    } catch (error) {
      if ((error as { code?: string }).code !== 'SCHEMA_MISSING') fail(error, 'Could not load your impact web')
    } finally {
      setWebLoading(false)
    }
  }

  const openStakeholder = async (stakeholder: ContentIdeaStakeholder) => {
    setBusyStakeholder(stakeholder)
    try {
      const idea = await apiService.generateIdeaForStakeholder(stakeholder)
      setIdeas(prev => (prev.some(i => i.id === idea.id) ? prev : [...prev, idea]))
      go(`${BASE}/idea/${idea.id}`)
    } catch (error) {
      fail(error, 'Could not find a story for that group')
    } finally {
      setBusyStakeholder(null)
    }
  }

  const anotherIdea = async (idea: ContentIdea) => {
    setSwapping(true)
    try {
      const next = await apiService.anotherContentIdea(idea.id)
      setIdeas(prev => [...prev.filter(i => i.id !== idea.id), next])
      setWeb(prev => (prev ? { ...prev, featured: next } : prev))
      if (stepRef.current === 'idea') navigate(`${BASE}/idea/${next.id}`, { replace: true })
    } catch (error) {
      fail(error, 'Could not find another idea')
    } finally {
      setSwapping(false)
    }
  }

  const saveIdea = async (idea: ContentIdea, selection: ContentIdeaSelection) => {
    try {
      const saved = await apiService.updateContentIdea(idea.id, { status: 'accepted', selection })
      setIdeas(prev => [...prev.filter(i => i.id !== saved.id), saved])
      notify.success('Saved to your to-dos.')
      go(`${BASE}/todos`)
    } catch (error) {
      fail(error, 'Could not save the card')
    }
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
      await loadWeb()
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
    if (route.view === 'home' || route.view === 'journeys' || route.view === 'journey' || route.view === 'idea' || route.view === 'capture' || route.view === 'todos') {
      resetDraft()
      setStep(route.view)
      return
    }
    if (route.view === 'new' || route.view === 'update') {
      const fromIdea = location.state as { idea?: ContentIdea; photos?: ContentSource[] } | null
      const studioStart = (location.state as { studioStart?: 'diy' | 'nexus' } | null)?.studioStart
      const draftKey = studioDraftKey(activeOrganization?.id, location.pathname)
      const cached = readStudioDraft(draftKey)
      if (route.view === 'new' && studioStart === 'diy') {
        clearStudioDraft(draftKey)
        resetDraft()
        setProgramFilter('')
        setStep('material')
        return
      }
      if (route.view === 'new' && studioStart === 'nexus') {
        clearStudioDraft(draftKey)
        resetDraft()
        setBackStep('home')
        setWorkingLabel('Picking the strongest story')
        setStep('working')
        let cancelled = false
        apiService.recommendContent('moment')
          .then(next => {
            if (cancelled) return
            applyMaster(next)
            setExtraContext('')
            setStep('master')
          })
          .catch(error => {
            if (cancelled) return
            fail(error, 'Could not pick a story')
            setStep('material')
          })
        return () => { cancelled = true }
      }
      if (!studioStart && cached?.master) {
        applyMaster(cached.master)
        setExtraContext(cached.extraContext || '')
        setPicked(cached.picked || [])
        setProgramFilter(cached.programFilter || '')
        setBackStep(cached.backStep || 'material')
        setDraftIdea(cached.draftIdea || null)
        setEditingId(cached.editingId)
        setStep('master')
        return
      }
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
      if (route.view === 'update') {
        setProgramFilter(journeysRef.current.find(j => j.id === route.journeyId)?.initiative_id || '')
      }
      setStep('material')
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
  }, [route, activeOrganization?.id])

  const editPost = () => {
    if (!post) return
    setEditingId(post.id)
    setBackStep('post')
    setStep('master')
  }

  const cancelEdit = () => {
    clearStudioDraft(studioDraftKey(activeOrganization?.id, location.pathname))
    if (editingId && post) {
      const original = masterFromPackage(post)
      if (original) applyMaster(original)
      setEditingId(null)
      setStep('post')
      return
    }
    if (backStep === 'material') setStep('material')
    else goBack(BASE)
  }

  const materialBack = () => {
    if (master) setStep('master')
    else if (draftIdea) goBack(`${BASE}/idea/${draftIdea.id}`)
    else if (route.view === 'update') goBack(journeyPath(route.journeyId))
    else goBack(BASE)
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
    let next = withPhotos(base, picked)
    if (!master) {
      next = applyCaption(next, captionFromSource(picked[0]))
      setBackStep('material')
      applyMaster(next)
    } else if (sourceKey(master.source) !== sourceKey(next.source)) applyMaster(next)
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

  const draftFrom = async (current: ContentMaster, targetJourneyId: string | null, ideaId?: string | null, context?: string) => {
    const note = context?.trim() || ''
    setWorkingLabel(ideaId ? 'Building the post around what they said' : note ? 'Drafting with your context' : targetJourneyId ? 'Drafting the next update' : 'Drafting with Nexus')
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
        context: note || undefined,
        hook: note ? firstLine(postCaption(current)) : undefined,
        body: note ? postCaption(current) : undefined,
        cta: note ? '' : undefined,
      })
      applyMaster({ ...next, extras: next.extras?.length ? next.extras : current.extras })
      setStep('master')
    } catch (error) {
      fail(error, 'Could not draft it')
      setStep('master')
    }
  }

  const draftWithNexus = () => {
    if (master) draftFrom(master, journeyId, editingId ? null : draftIdea?.id, extraContext)
  }

  const save = async () => {
    if (!master) return
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
      })
      notify.success(editingId ? 'Saved' : 'Saved as a draft')
      clearStudioDraft(studioDraftKey(activeOrganization?.id, location.pathname))
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
  const hasCopy = !!master && !!postCaption(master).trim()
  const nexusLabel = hasCopy ? 'Redraft with Nexus' : 'Draft with Nexus'
  const contextField = (
    <label className="block flex-1 min-w-0">
      <span className="block text-[11px] font-medium text-secondary-400 mb-1">Context for Nexus</span>
      <GrowField
        minRows={1}
        maxRows={2}
        value={extraContext}
        onChange={setExtraContext}
        placeholder="A quote, who it's for, a detail to keep."
        className="focus:!ring-1 focus:!ring-inset"
      />
    </label>
  )
  const saveActions = (
    <>
      <button type="button" className="studio-hero-btn studio-hero-btn-mint justify-center shrink-0" disabled={!hasCopy || saving} onClick={() => save()}>
        {saving ? <Spinner className="w-3.5 h-3.5" /> : null} {editingId ? 'Save changes' : 'Save draft'}
      </button>
      <button type="button" className="app-btn app-btn-ghost app-btn-sm shrink-0" onClick={cancelEdit}>
        {editingId ? 'Cancel' : 'Back'}
      </button>
    </>
  )
  const published = !!post?.published_at
  const draftLabel = journey ? `Update · ${journey.title}` : 'Moment'
  const subtitle =
    step === 'journey' ? 'Add updates as they happen. Show the journey on your public page when it is ready.'
      : step === 'idea' ? 'A story worth capturing. Who to find, what to ask, and how to get the photo.'
        : step === 'material' ? (journey ? `Pick photos for the next update to ${journey.title}.` : 'Pick or upload photos. The first one is the cover.')
          : step === 'post' ? 'Sending it puts it on your Nexus page. Scheduling does not.'
            : step === 'master' ? undefined
              : 'A post is one story. Nexus can write it, or you can.'

  const chooser = step === 'working'
  const library = step === 'home' || step === 'journeys' || step === 'capture' || step === 'todos'
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
    const path = tab === 'posts' ? `${BASE}/library` : tab === 'journeys' ? `${BASE}/journeys` : `${BASE}/capture`
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

  const darkStudio = step === 'capture' || step === 'todos' || step === 'idea' || step === 'journeys' || step === 'journey' || step === 'home'
  const headerTitle = step === 'master'
    ? 'Craft your post'
    : step === 'post'
    ? 'Your post'
      : step === 'material'
        ? 'Choose a photo'
        : 'Content'

  if (!revealed) return <StudioBoot />

  return (
    <div className={`${darkStudio ? 'content-studio' : ''} relative h-screen overflow-hidden flex flex-col`}>
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
            mode={step === 'capture' || step === 'todos' ? 'ideas' : 'create'}
            view={libraryView}
            onMode={next => (next === 'ideas' ? openStudio('capture') : openCreate())}
            onView={setLibraryView}
            help={<Help />}
            actions={<NewMenu onMoment={startMoment} onJourney={newJourney} />}
            toolbar={step === 'capture' || step === 'todos' ? (
              <CaptureToolbar
                refreshing={ideasState === 'refreshing'}
                unavailable={ideasState === 'off'}
                saved={ideas.filter(i => i.status === 'accepted').length}
                onRefresh={refreshIdeas}
                onTodos={() => go(`${BASE}/todos`)}
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
            className={`${chooser ? 'mb-0' : step === 'master' ? 'mb-2' : 'mb-4'} shrink-0`}
            title={headerTitle}
            subtitle={subtitle}
            help={<Help />}
            actions={step === 'journey' ? <NewMenu onMoment={startMoment} onJourney={newJourney} /> : undefined}
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
              className={`w-full h-full overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable] ${chooser ? 'flex items-center justify-center' : ''} ${step === 'post' || step === 'journey' ? 'pr-8' : ''}`}
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
            <ContentImpactWeb
              web={web}
              ideas={ideas}
              loading={webLoading || ideasState === 'loading'}
              busyStakeholder={busyStakeholder}
              logoUrl={activeOrganization?.logo_url}
              swapping={swapping}
              onOpenStakeholder={openStakeholder}
              onOpenIdea={openIdea}
              onAnother={anotherIdea}
            />
          )}

          {step === 'todos' && (
            <CaptureTodos
              ideas={ideas}
              loading={ideasState === 'loading'}
              onOpen={openIdea}
              onBack={() => go(`${BASE}/capture`)}
            />
          )}

          {step === 'idea' && route.view === 'idea' && (
            <IdeaBrief
              ideaId={route.ideaId}
              onBack={() => goBack(`${BASE}/capture`)}
              onSave={saveIdea}
              onCapture={captureFromIdea}
              onUsePhotos={idea => startFromIdea(idea)}
              onLater={snoozeIdea}
              onDismiss={dismissIdea}
              onAnother={anotherIdea}
              onOpenPost={id => go(`${BASE}/post/${id}`)}
            />
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
                action={<button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => navigate(BASE)}>Back to studio</button>}
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
              onTogglePublished={() => patchJourney(
                { published: !journey.published_at },
                journey.published_at ? 'Journey hidden from your public page' : 'Journey is on your public page'
              )}
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
            <div className="flex flex-col gap-4 pb-4 lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[340px_minmax(0,1fr)] lg:overflow-hidden lg:pb-0">
              <div className="order-2 lg:order-none lg:h-full lg:min-h-0">
                <SocialPostPreview
                  only="instagram"
                  fill={!compactComposer}
                  caption={postCaption(master)}
                  parts={{ hook: '', body: postCaption(master), cta: '' }}
                  media={[master.source, ...(master.extras || [])].filter(item => item.image_url).map(item => ({ url: item.image_url }))}
                  profileName={activeOrganization?.name || 'Your account'}
                  profileImage={activeOrganization?.logo_url}
                  names={{ instagram: socialAccount?.connections?.instagram?.label }}
                />
              </div>

              <div className="min-w-0 flex flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-hidden">
                <section className="studio-panel px-4 py-3 shrink-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[15px] font-semibold studio-ink-text">Photos</p>
                    <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={addMorePhotos}>Change photos</button>
                  </div>
                  <PhotoStrip photos={photosOf(master)} onChange={setPhotos} onAdd={addMorePhotos} />
                  {draftIdea && !editingId && (
                    <span className="app-chip app-chip-accent text-[11px] inline-flex items-center gap-1 max-w-full mt-2">
                      <Lightbulb className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{draftIdea.card.title}</span>
                      <button type="button" className="flex-shrink-0 p-0.5 rounded hover:bg-black/5" onClick={() => setDraftIdea(null)} aria-label="Unlink idea">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </section>

                <section className="studio-panel p-4 flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                  <div className="flex flex-wrap lg:flex-nowrap items-end gap-2 shrink-0">
                    <button type="button" className="studio-hero-btn studio-hero-btn-mint w-full lg:w-auto justify-center shrink-0" onClick={draftWithNexus}>
                      <Sparkles className="w-4 h-4" /> {nexusLabel}
                    </button>
                    {compactComposer ? (
                      <details className="w-full">
                        <summary className="cursor-pointer py-2 text-xs font-medium text-secondary-600">Draft with more context</summary>
                        {contextField}
                      </details>
                    ) : contextField}
                    {!compactComposer && saveActions}
                  </div>

                  <div className="mt-2 flex flex-col px-1 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
                    <label className="flex flex-col min-h-0 flex-1">
                      <span className="block text-[11px] font-medium text-secondary-400 mb-1 shrink-0">Post Content</span>
                      <GrowField
                        fill={!compactComposer}
                        value={postCaption(master)}
                        onChange={v => setMaster(applyCaption(master, v))}
                        placeholder="Write the post."
                        minRows={compactComposer ? 3 : 8}
                        className="text-[14px] leading-relaxed focus:!ring-1 focus:!ring-inset"
                      />
                    </label>
                  </div>
                  {compactComposer && <div className="mt-3 flex flex-wrap items-center gap-2">{saveActions}</div>}
                </section>
              </div>
            </div>
          )}

          {step === 'post' && !post && loadingPost && <SectionLoader />}

          {step === 'post' && post && master && (
            <div className="space-y-4 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={leavePost}>
                  <ChevronLeft className="w-4 h-4" /> Back
                </button>
                <PublishBadge published={published} liveLabel="Posted" />
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
                  <button type="button" className="studio-hero-btn studio-hero-btn-mint h-8 px-3 text-[13px]" onClick={editPost}>
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button type="button" className="app-btn app-btn-ghost app-btn-sm is-danger" onClick={() => setDeleteId(post.id)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 items-start pb-8">
                <div className="w-full lg:w-[340px] lg:shrink-0">
                  <SocialPostPreview
                    caption={postCaption(master)}
                    media={[master.source, ...(master.extras || [])].filter(item => item.image_url).map(item => ({ url: item.image_url }))}
                    profileName={activeOrganization?.name || 'Your account'}
                    profileImage={activeOrganization?.logo_url}
                    names={{
                      instagram: socialAccount?.connections?.instagram?.label,
                      facebook: socialAccount?.connections?.facebook?.label,
                      linkedin: socialAccount?.connections?.linkedin?.label,
                    }}
                  />
                </div>
                <div className="w-full sm:w-[320px]">
                  <SendPanel
                    packageId={post.id}
                    publications={post.publications}
                    connections={socialAccount?.connections}
                    loaded={socialReady}
                    onSent={(publications, publishedAt) => {
                      setPost(current => current && current.id === post.id ? {
                        ...current,
                        publications,
                        published_at: publishedAt || current.published_at,
                      } : current)
                      setPackages(prev => prev.map(pkg => pkg.id === post.id ? {
                        ...pkg,
                        publications,
                        published_at: publishedAt || pkg.published_at,
                      } : pkg))
                      if (activeOrganization?.id) patchStudioPackage(activeOrganization.id, post.id, publications, publishedAt)
                      if (publishedAt) loadJourneys()
                    }}
                  />
                </div>
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
              if (activeOrganization?.id) removeStudioPackage(activeOrganization.id, deleteId)
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
              if (activeOrganization?.id) removeStudioJourney(activeOrganization.id, journey.id)
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

const SHARE_CHANNELS: { id: ContentChannel; label: string; icon: typeof InstagramIcon }[] = [
  { id: 'facebook', label: 'Facebook', icon: FacebookIcon },
  { id: 'instagram', label: 'Instagram', icon: InstagramIcon },
  { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon },
]

function accountList(names: string[]) {
  if (names.length <= 1) return names[0] || ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function scheduleStamp(day: string, hour: string, minute: string, meridiem: 'AM' | 'PM') {
  let h = Number(hour) % 12
  if (meridiem === 'PM') h += 12
  const stamp = `${day}T${String(h).padStart(2, '0')}:${minute}`
  const parsed = new Date(stamp)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now() + 60_000) return ''
  return stamp
}

function scheduleLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${day} at ${time}`
}

function mergePublications(current: ContentPublication[] | undefined, incoming: ContentPublication[]) {
  const rank = { failed: 0, accepted: 1, scheduled: 2, published: 3 }
  const live = new Map<string, ContentPublication>()
  const scheduled = new Map<string, ContentPublication>()
  for (const item of [...(current || []), ...incoming]) {
    const bucket = item.status === 'scheduled' ? scheduled : live
    const prev = bucket.get(item.platform)
    if (!prev || (item.status === 'scheduled'
      ? (item.scheduled_at || '') > (prev.scheduled_at || '')
      : rank[item.status] > rank[prev.status] || (item.post_url && !prev.post_url))) {
      bucket.set(item.platform, item)
    }
  }
  return [...live.values(), ...scheduled.values()]
}

function sentWhen(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function SendPanel({
  packageId,
  publications,
  connections,
  loaded,
  onSent,
}: {
  packageId: string
  publications?: ContentPublication[]
  connections?: Record<string, { connected: boolean; label: string | null }>
  loaded: boolean
  onSent: (publications: ContentPublication[], publishedAt: string | null) => void
}) {
  const linked = loaded ? SHARE_CHANNELS.filter(channel => connections?.[channel.id]?.connected) : []
  const missing = loaded ? SHARE_CHANNELS.filter(channel => !connections?.[channel.id]?.connected) : []
  const connectedKey = linked.map(channel => channel.id).join(',')
  const sentKey = (publications || [])
    .filter(item => item.status !== 'failed')
    .map(item => item.platform)
    .sort()
    .join(',')
  const [checked, setChecked] = useState<ContentChannel[]>([])
  const [scheduling, setScheduling] = useState(false)
  const [scheduleDate, setScheduleDate] = useState<{ singleDate?: string }>({})
  const [scheduleHour, setScheduleHour] = useState('9')
  const [scheduleMinute, setScheduleMinute] = useState('00')
  const [scheduleMeridiem, setScheduleMeridiem] = useState<'AM' | 'PM'>('AM')
  const [sending, setSending] = useState(false)
  const [sendDone, setSendDone] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [unscheduling, setUnscheduling] = useState<string | null>(null)
  const [panelError, setPanelError] = useState<string | null>(null)

  useEffect(() => {
    if (!loaded) return
    const sent = new Set(sentKey ? sentKey.split(',') : [])
    const next = (connectedKey ? connectedKey.split(',') : []).filter(id => !sent.has(id)) as ContentChannel[]
    setChecked(next)
  }, [connectedKey, sentKey, loaded])

  const chosen = SHARE_CHANNELS.filter(channel => checked.includes(channel.id))
  const names = accountList(chosen.map(channel => channel.label))
  const sentNames = accountList(
    SHARE_CHANNELS.filter(channel => sentKey.split(',').includes(channel.id)).map(channel => channel.label)
  )
  const when = scheduleDate.singleDate
    ? scheduleStamp(scheduleDate.singleDate, scheduleHour, scheduleMinute, scheduleMeridiem)
    : ''
  const whenLabel = scheduleLabel(when)
  const scheduleMax = (() => {
    const date = new Date()
    date.setFullYear(date.getFullYear() + 2)
    return getLocalDateString(date)
  })()
  const canSend = loaded && chosen.length > 0 && (!scheduling || !!when)
  const confirmLabel = scheduling ? `Confirm schedule for ${whenLabel}` : `Confirm post to ${names}`
  const button = sending
    ? `Sending to ${names}`
    : confirming && canSend
    ? confirmLabel
    : !loaded
    ? 'Checking accounts'
    : chosen.length === 0
    ? (sentNames ? `Sent to ${sentNames}` : linked.length === 0 ? 'Connect an account' : 'Select an account')
    : scheduling
      ? (whenLabel ? `Schedule for ${whenLabel}` : scheduleDate.singleDate ? 'Pick a future time' : 'Pick a date')
      : `Post now to ${names}`

  useEffect(() => {
    setConfirming(false)
  }, [names, when, scheduling, chosen.length])

  const toggle = (id: ContentChannel) => {
    setChecked(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])
  }

  const send = async () => {
    if (!canSend || sending) return
    if (!confirming) {
      setConfirming(true)
      return
    }
    setSending(true)
    setSendDone(false)
    setPanelError(null)
    try {
      const result = await apiService.publishSocial(packageId, {
        platforms: chosen
          .map(channel => channel.id)
          .filter((id): id is 'instagram' | 'facebook' | 'linkedin' => id === 'instagram' || id === 'facebook' || id === 'linkedin'),
        scheduled_at: scheduling ? when : undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      const incoming: ContentPublication[] = result.results
        .filter((item): item is typeof item & { platform: ContentPublication['platform'] } =>
          item.platform === 'instagram' || item.platform === 'facebook' || item.platform === 'linkedin')
        .map(item => ({
          platform: item.platform,
          status: item.status || (item.ok ? 'accepted' : 'failed'),
          created_at: item.sentAt || new Date().toISOString(),
          scheduled_at: scheduling ? when : null,
          post_url: item.postUrl || null,
          error: item.error || null,
        }))
      onSent(mergePublications(publications, incoming), result.published_at || null)
      const failed = result.results.filter(item => !item.ok)
      const sent = result.results.filter(item => item.ok)
      if (!sent.length) {
        const message = failed[0]?.error || 'Could not post'
        setPanelError(message)
        notify.error(message)
        return
      }
      setSendDone(true)
      await new Promise(resolve => window.setTimeout(resolve, 700))
      const label = accountList(sent.map(item => SHARE_CHANNELS.find(channel => channel.id === item.platform)?.label || item.platform))
      if (failed.length) {
        const message = failed[0]?.error || 'One account failed.'
        setPanelError(message)
        notify.error(`Sent to ${label}. ${message}`)
      } else if (sent.some(item => item.status === 'scheduled')) {
        notify.success(`Scheduled for ${label}. It stays a draft until it goes out.`)
      } else if (sent.some(item => item.postUrl)) {
        notify.success(`It is on ${label} and your Nexus page.`)
      } else {
        notify.success(`Sent to ${label}. It is on your Nexus page.`)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not post'
      setPanelError(message)
      notify.error(message)
    } finally {
      setSending(false)
      setSendDone(false)
      setConfirming(false)
    }
  }

  const unschedule = async (platform: ContentPublication['platform']) => {
    setUnscheduling(platform)
    setPanelError(null)
    try {
      const next = await apiService.unscheduleSocial(packageId, platform)
      onSent(next.publications || [], next.published_at || null)
      notify.success('Removed from the schedule')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not unschedule'
      setPanelError(message)
      notify.error(message)
    } finally {
      setUnscheduling(null)
    }
  }

  const receipts = publications || []

  return (
    <aside className="studio-panel p-4 lg:sticky lg:top-4">
      {sending && (
        <SendScreen names={names} scheduling={scheduling} whenLabel={whenLabel} done={sendDone} />
      )}
      {receipts.length > 0 && (
        <div className="mb-3 space-y-2">
          {receipts.map(item => {
            const label = SHARE_CHANNELS.find(channel => channel.id === item.platform)?.label || item.platform
            const when = sentWhen(item.status === 'scheduled' ? item.scheduled_at : item.created_at)
            if (item.status === 'failed') {
              return (
                <div key={`${item.platform}-${item.status}-${item.scheduled_at || item.created_at}`} className="rounded-xl bg-red-50 px-3 py-2.5">
                  <p className="text-[13px] font-semibold text-red-700">{label} did not send</p>
                  <p className="mt-0.5 text-[12px] text-red-700 leading-snug">{item.error || 'Could not post'}</p>
                </div>
              )
            }
            const scheduled = isQueued(item)
            const live = item.status === 'published'
            return (
              <div key={`${item.platform}-${item.status}-${item.scheduled_at || item.created_at}`} className="rounded-xl studio-teal-wash px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold studio-accent-text">
                  <Check className="w-3.5 h-3.5" />
                  {scheduled ? `Scheduled for ${label}` : live ? `On ${label}` : `Sent to ${label}`}
                </p>
                <p className="mt-0.5 text-[12px] text-[#3d4352] leading-snug">
                  {scheduled
                    ? (when ? `Goes out ${when}.` : 'Waiting for the scheduled time.')
                    : live
                      ? `Posted ${when}.`
                      : `Posted ${when}. It can take a minute to show up.`}
                </p>
                {item.post_url && (
                  <a href={item.post_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12px] font-semibold studio-accent-text">
                    View on {label}
                  </a>
                )}
                {scheduled && (
                  <button
                    type="button"
                    className="mt-2 text-[12px] font-semibold studio-accent-text disabled:opacity-50"
                    disabled={unscheduling === item.platform}
                    onClick={() => unschedule(item.platform)}
                  >
                    {unscheduling === item.platform ? 'Removing' : 'Unschedule'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[15px] font-semibold studio-ink-text">Send</p>
      <p className="mt-1 text-[12px] text-secondary-500">Checked accounts get this post. Same words on each.</p>
      {panelError && <p className="mt-2 text-[12px] font-medium text-red-700">{panelError}</p>}
      <div className="mt-3 space-y-1">
        {!loaded && SHARE_CHANNELS.map(channel => (
          <div key={channel.id} className="h-10 rounded-xl studio-teal-wash animate-pulse" />
        ))}
        {loaded && linked.map(channel => {
          const on = checked.includes(channel.id)
          const Icon = channel.icon
          const who = connections?.[channel.id]?.label
          return (
            <label key={channel.id} className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-[var(--studio-teal-wash)] cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--studio-green)]"
                checked={on}
                onChange={() => toggle(channel.id)}
              />
              <Icon className="w-4 h-4" style={{ color: socialColor(channel.id) }} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold studio-ink-text">{channel.label}</span>
                {who && <span className="block text-[12px] text-secondary-500 truncate">{who}</span>}
              </span>
              {sentKey.split(',').filter(Boolean).includes(channel.id) && (
                <span className="ml-auto text-[11px] font-semibold studio-accent-text">
                  {(publications || []).some(item => item.platform === channel.id && item.status === 'scheduled') ? 'Scheduled' : 'Sent'}
                </span>
              )}
            </label>
          )
        })}
        {loaded && missing.map(channel => (
          <div key={channel.id} className="flex items-center justify-between gap-2 px-2 py-2">
            <span className="text-[13px] text-secondary-400">{channel.label}</span>
            <Link to="/studio/accounts" className="text-[12px] font-semibold studio-accent-text">Connect</Link>
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={scheduling}
        className={scheduling
          ? 'app-btn mt-3 w-full studio-teal-wash studio-accent-text border border-[color-mix(in_srgb,var(--studio-green)_30%,transparent)]'
          : 'app-btn app-btn-secondary mt-3 w-full'}
        onClick={() => setScheduling(value => !value)}
      >
        <Calendar className="w-4 h-4" />
        {scheduling ? 'Post now instead' : 'Schedule instead'}
      </button>
      {scheduling && (
        <div className="mt-2 space-y-2">
          <DateRangePicker
            variant="pill"
            className="w-full h-9 justify-between"
            value={scheduleDate}
            minDate={getLocalDateString(new Date())}
            maxDate={scheduleMax}
            placeholder="Pick a date"
            single
            onChange={value => {
              const day = value.singleDate || value.startDate
              setScheduleDate(day ? { singleDate: day } : {})
            }}
          />
          <div className="grid grid-cols-[1fr_1fr_4.5rem] gap-2">
            <select className="app-input h-9 text-[13px]" value={scheduleHour} onChange={event => setScheduleHour(event.target.value)} aria-label="Hour">
              {Array.from({ length: 12 }, (_, index) => String(index + 1)).map(hour => (
                <option key={hour} value={hour}>{hour}</option>
              ))}
            </select>
            <select className="app-input h-9 text-[13px]" value={scheduleMinute} onChange={event => setScheduleMinute(event.target.value)} aria-label="Minute">
              {['00', '15', '30', '45'].map(minute => (
                <option key={minute} value={minute}>{minute}</option>
              ))}
            </select>
            <select className="app-input h-9 text-[13px]" value={scheduleMeridiem} onChange={event => setScheduleMeridiem(event.target.value as 'AM' | 'PM')} aria-label="AM or PM">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>
        </div>
      )}
      <button
        type="button"
        className="studio-hero-btn studio-hero-btn-mint mt-4 w-full justify-center text-center leading-tight !h-auto min-h-11 py-2.5 disabled:opacity-60"
        disabled={!canSend || sending}
        onClick={send}
      >
        {button}
      </button>
      <p className="mt-2 text-[12px] text-secondary-400 leading-snug">
        {scheduling
          ? 'A scheduled post stays a draft until it goes out. Then it goes on your Nexus page.'
          : 'Sending this also puts it on your Nexus page.'}
      </p>
      <p className="mt-1 text-[12px] text-secondary-400 leading-snug">
        {receipts.some(item => item.status !== 'failed')
          ? 'This stays on the post, in the library, and on the calendar.'
          : 'One post per checked account. A second click of the same send will not post it twice.'}
      </p>
    </aside>
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
          <div className="relative w-full aspect-[4/3] overflow-hidden studio-teal-wash">
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
                <Icon className="w-5 h-5" style={socialColor(ch.id) ? { color: socialColor(ch.id) } : undefined} />
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
  maxRows,
  className,
  plain,
  fill,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
  maxRows?: number
  className?: string
  plain?: boolean
  fill?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fill) {
      el.style.height = ''
      el.style.overflowY = ''
      return
    }
    const resize = () => {
      el.style.height = 'auto'
      const row = 22
      const chrome = 22
      const next = Math.max(el.scrollHeight, minRows * row + chrome)
      const cap = maxRows ? maxRows * row + chrome : next
      el.style.height = `${Math.min(next, cap)}px`
      el.style.overflowY = next > cap ? 'auto' : 'hidden'
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [value, minRows, maxRows, fill])
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={plain
        ? `w-full bg-transparent border-0 p-0 shadow-none resize-none overflow-hidden focus:outline-none focus:ring-0 placeholder:text-secondary-300 ${className || ''}`
        : `app-input text-[13px] leading-relaxed resize-none whitespace-pre-wrap ${fill ? 'h-full min-h-0 overflow-y-auto' : 'overflow-hidden'} ${className || ''}`}
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
        <PreviewLabel icon={meta?.icon} color={socialColor('instagram')} label="Instagram" onCopy={() => onCopy(version.caption || '', 'Caption')} />
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
        <PreviewLabel icon={meta?.icon} color={socialColor('facebook')} label="Facebook" onCopy={() => onCopy(version.caption || '', 'Caption')} />
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
      <PreviewLabel icon={meta?.icon} color={socialColor('linkedin')} label="LinkedIn" onCopy={() => onCopy(version.caption || '', 'Caption')} />
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
  const dragFrom = useRef<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const makeCover = (i: number) => onChange([photos[i], ...photos.filter((_, idx) => idx !== i)])
  const remove = (i: number) => onChange(photos.filter((_, idx) => idx !== i))
  const dropOn = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const from = dragFrom.current
    dragFrom.current = null
    setOver(null)
    if (from == null || from === index) return
    const next = [...photos]
    const [moved] = next.splice(from, 1)
    next.splice(index, 0, moved)
    onChange(next)
  }
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1.5">
        {photos.map((photo, i) => (
          <div
            key={sourceKey(photo)}
            draggable={photos.length > 1}
            onDragStart={() => { dragFrom.current = i }}
            onDragOver={event => { event.preventDefault(); setOver(i) }}
            onDrop={dropOn(i)}
            onDragEnd={() => { dragFrom.current = null; setOver(null) }}
            className={`group/thumb relative w-12 h-12 rounded-lg overflow-hidden border cursor-grab active:cursor-grabbing ${
              i === 0 ? 'border-primary-500 ring-1 ring-inset ring-primary-400' : 'border-gray-200/80'
            } ${over === i ? 'ring-1 ring-inset ring-primary-500' : ''}`}
          >
            <img src={photo.thumb_url || photo.image_url} alt="" className="w-full h-full object-cover pointer-events-none" />
            {i === 0 ? (
              <span className="absolute inset-x-0 bottom-0 bg-primary-600 text-white text-[9px] font-semibold text-center leading-4 pointer-events-none">Cover</span>
            ) : (
              <button
                type="button"
                draggable={false}
                aria-label="Make cover"
                title="Make cover"
                onClick={() => makeCover(i)}
                className="absolute bottom-0.5 left-0.5 w-4 h-4 rounded-full bg-black/65 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100"
              >
                <Star className="w-2.5 h-2.5" />
              </button>
            )}
            {photos.length > 1 && (
              <button
                type="button"
                draggable={false}
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
        <p className="mt-1 text-[11px] text-secondary-400">Drag to reorder. The first photo is the cover.</p>
      )}
    </div>
  )
}

function PreviewLabel({
  label,
  icon: Icon,
  color,
  onCopy,
  copyLabel = 'Copy',
  extra,
}: {
  label: string
  icon?: ChannelIcon
  color?: string
  onCopy: () => void
  copyLabel?: string
  extra?: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 px-0.5 pb-1.5">
      {Icon ? <Icon className="w-3.5 h-3.5 text-secondary-600" style={color ? { color } : undefined} /> : null}
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
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  minRows?: number
  placeholder?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, minRows * 16)}px`
  }, [value, minRows])
  return (
    <div className="group/edit relative">
      <textarea
        ref={ref}
        rows={minRows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`block w-full bg-transparent border-0 p-0 pr-8 m-0 shadow-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 resize-none overflow-hidden whitespace-pre-wrap break-words placeholder:text-secondary-300 ${className || ''}`}
      />
      <button
        type="button"
        aria-label="Edit"
        onMouseDown={event => event.preventDefault()}
        onClick={() => ref.current?.focus()}
        className="absolute right-0 top-0 z-10 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-500 text-white shadow-card opacity-0 group-hover/edit:opacity-100 focus:opacity-100"
      >
        <Pencil className="w-3 h-3" />
      </button>
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
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 flex flex-wrap items-center gap-2 bg-[var(--studio-canvas)]">
        <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="inline-flex items-center gap-1">
          {(['all', 'unused', 'used'] as const).map(id => (
            <button
              key={id}
              type="button"
              onClick={() => onUsage(id)}
              className={`studio-pill h-8 ${usage === id ? 'studio-pill-on' : ''}`}
            >
              {id === 'all' ? 'All' : id === 'unused' ? 'Unused' : 'Used'}
            </button>
          ))}
        </div>
        <div className="inline-flex items-center gap-1">
          {([
            ['all', 'All'],
            ['evidence', 'Evidence'],
            ['story', 'Stories'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onType(id)}
              className={`studio-pill h-8 ${typeFilter === id ? 'studio-pill-on' : ''}`}
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
