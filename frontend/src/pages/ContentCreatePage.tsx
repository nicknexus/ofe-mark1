import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, Copy, Download, Image as ImageIcon, Lock, Share2, Sparkles, Trash2 } from 'lucide-react'
import UpgradeModal from '../components/UpgradeModal'
import ConfirmDialog from '../components/ConfirmDialog'
import DateRangePicker from '../components/DateRangePicker'
import { useTeam } from '../context/TeamContext'
import { SubscriptionService } from '../services/subscription'
import { apiService } from '../services/api'
import { notify } from '../lib/notify'
import { formatDate, getLocalDateString } from '../utils'
import { canShareFiles, exportPhotoWithCaption, triggerDownload } from '../utils/contentExport'
import {
  EmptyState,
  PageHeader,
  PageLoader,
  SectionLoader,
  Skeleton,
  Spinner,
} from '../components/ui'
import type { ContentPost, ContentPostKind, ContentSource, ContentSourceType, GraphicLayout } from '../types'

type View = 'social' | 'email' | 'library'
type DateFilter = { singleDate?: string; startDate?: string; endDate?: string }
type TypeFilter = 'all' | ContentSourceType
const PAGE_SIZE = 21
const LAYOUTS: { id: GraphicLayout; label: string; hint: string }[] = [
  { id: 'clean', label: 'Clean', hint: 'Logo and name on the photo' },
  { id: 'title', label: 'Title', hint: 'Adds the photo title' },
  { id: 'stats', label: 'Stats', hint: 'Title, result, and location' },
]

function sourceKey(s: Pick<ContentSource, 'source_type' | 'source_id'>) {
  return `${s.source_type}:${s.source_id}`
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
  onSelect: (source: ContentSource) => void
}) {
  const original = source.image_url
  const [src, setSrc] = useState(source.thumb_url || original)

  useEffect(() => {
    setSrc(source.thumb_url || original)
  }, [source.thumb_url, original])

  return (
    <button
      type="button"
      onClick={() => onSelect(source)}
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
          fetchPriority={eager ? 'high' : 'low'}
          className="aspect-square w-full object-cover"
          onError={() => {
            if (src !== original) setSrc(original)
          }}
        />
      </div>
      <SourceTypeChip type={source.source_type} className="absolute top-1.5 left-1.5" />
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

function SourceTypeChip({ type, className = '' }: { type: ContentSourceType; className?: string }) {
  const isStory = type === 'story'
  const Icon = isStory ? BookOpen : Camera
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold shadow-card ${
        isStory ? 'bg-primary-600 text-white' : 'bg-evidence-600 text-white'
      } ${className}`}
    >
      <Icon className="w-3 h-3" />
      {isStory ? 'Story' : 'Evidence'}
    </span>
  )
}

function Help({ view }: { view: View }) {
  return (
    <div className="space-y-3 text-sm text-secondary-600 leading-relaxed">
      {view === 'email' ? (
        <p>Pick a photo. Generate a subject and body, copy them, then paste into Gmail or Mailchimp. Nexus does not send email for you.</p>
      ) : view === 'library' ? (
        <p>Drafts you saved. Download the graphic or copy the caption again anytime.</p>
      ) : (
        <p>Pick a photo. We stamp your logo and color on it. Generate a caption, copy it, download the graphic, then paste both into Instagram, Facebook, or LinkedIn. Nexus does not post for you.</p>
      )}
    </div>
  )
}

export default function ContentCreatePage() {
  const { isOwner, activeOrganization } = useTeam()
  const [isFree, setIsFree] = useState(false)
  const [gated, setGated] = useState(false)
  const [featuresLoaded, setFeaturesLoaded] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    let cancelled = false
    SubscriptionService.getFeatures()
      .then(f => {
        if (cancelled) return
        const locked = !f.contentStudio && !activeOrganization?.is_demo
        setIsFree(f.tier === 'free')
        setGated(locked)
        setFeaturesLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setFeaturesLoaded(true)
      })
    return () => { cancelled = true }
  }, [activeOrganization?.id, activeOrganization?.is_demo])

  if (!featuresLoaded) return <PageLoader />

  if (gated) {
    return (
      <>
        <GatedEmpty isOwner={isOwner} isFree={isFree} onUpgrade={() => setShowUpgrade(true)} />
        <UpgradeModal
          isOpen={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          title="Impact content is a paid feature"
          subtitle="Upgrade to Growth or Pro to turn tracked photos into posts and email."
        />
      </>
    )
  }

  return <ContentStudio />
}

function GatedEmpty({
  isOwner,
  isFree,
  onUpgrade,
}: {
  isOwner: boolean
  isFree: boolean
  onUpgrade: () => void
}) {
  return (
    <div className="min-h-screen pt-8 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="app-card overflow-hidden">
          <div className="px-8 pt-10 pb-8">
            <div className="flex items-center gap-2">
              {isFree && (
                <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-800">
                  <Lock className="w-3 h-3" />
                  Growth & Pro
                </span>
              )}
            </div>
            <div className="flex items-start gap-3 mt-4">
              <div className="app-icon-tile app-icon-tile-accent mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[28px] font-semibold tracking-tight text-secondary-900 leading-tight">
                  Impact content
                </h1>
                <p className="text-sm text-secondary-500 mt-2 leading-relaxed max-w-xl">
                  Turn a photo you already logged into a caption or an email. Proof in, post out.
                </p>
              </div>
            </div>
          </div>
          <div className="px-8 py-5 border-t border-gray-100 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center gap-3">
            <p className="text-sm text-secondary-600 leading-relaxed flex-1">
              {isOwner
                ? 'Not included on the Free plan. Upgrade to Growth or Pro to unlock it.'
                : 'Not included on the Free plan. Ask the organization owner to upgrade to Growth or Pro.'}
            </p>
            {isOwner ? (
              <button type="button" onClick={onUpgrade} className="app-btn app-btn-primary app-btn-sm flex-shrink-0">
                See plans
              </button>
            ) : (
              <Link to="/tracking/programs" className="app-btn app-btn-secondary app-btn-sm flex-shrink-0">
                Keep tracking
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ContentStudio() {
  const { activeOrganization } = useTeam()
  const [view, setView] = useState<View>('social')
  const [sources, setSources] = useState<ContentSource[]>([])
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loadingSources, setLoadingSources] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [buildingGraphic, setBuildingGraphic] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>({})
  const [layout, setLayout] = useState<GraphicLayout>('clean')
  const previewSourceRef = useRef<string | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const preferShare = canShareFiles()
  const kind: ContentPostKind = view === 'email' ? 'email' : 'social'

  const selected = useMemo(
    () => sources.find(s => sourceKey(s) === selectedKey) || null,
    [sources, selectedKey]
  )

  const filtersActive = typeFilter !== 'all' || !!(dateFilter.singleDate || dateFilter.startDate || dateFilter.endDate)
  const visibleSources = useMemo(
    () => typeFilter === 'all' ? sources : sources.filter(s => s.source_type === typeFilter),
    [sources, typeFilter]
  )
  const sourcesRef = useRef(sources)
  sourcesRef.current = sources
  const loadReq = useRef(0)

  useEffect(() => {
    if (!selected || view === 'library') {
      setImageFile(null)
      setPreviewUrl(null)
      setBuildingGraphic(false)
      previewSourceRef.current = null
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
      return
    }
    const key = sourceKey(selected)
    const sourceChanged = previewSourceRef.current !== key
    previewSourceRef.current = key
    if (view === 'email' || sourceChanged) {
      setPreviewUrl(selected.image_url)
      setImageFile(null)
    } else {
      setImageFile(null)
    }
    setBuildingGraphic(view === 'social')
    let cancelled = false
    const load = view === 'email'
      ? apiService.getContentImageFile(selected.source_type, selected.source_id, selected.title)
      : apiService.getContentGraphicFile(selected.source_type, selected.source_id, selected.title, layout)
    load
      .then(file => {
        const url = URL.createObjectURL(file)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = url
        setImageFile(file)
        setPreviewUrl(url)
      })
      .catch(() => {
        if (!cancelled && view === 'social') notify.error('Could not build branded graphic')
      })
      .finally(() => {
        if (!cancelled) setBuildingGraphic(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, view, layout])

  const loadSources = useCallback(async (reset: boolean) => {
    const req = ++loadReq.current
    if (reset) setLoadingSources(true)
    else setLoadingMore(true)
    try {
      const result = await apiService.getContentSources({
        offset: reset ? 0 : sourcesRef.current.length,
        limit: PAGE_SIZE,
        singleDate: dateFilter.singleDate,
        startDate: dateFilter.startDate,
        endDate: dateFilter.endDate,
      })
      if (req !== loadReq.current) return
      setSources(prev => reset ? result.sources : [...prev, ...result.sources])
      setHasMore(result.has_more)
    } catch (error) {
      if (req !== loadReq.current) return
      notify.error((error as Error).message || 'Failed to load photos')
      if (reset) setSources([])
    } finally {
      if (req === loadReq.current) {
        setLoadingSources(false)
        setLoadingMore(false)
      }
    }
  }, [dateFilter, activeOrganization?.id])

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true)
    try {
      setPosts(await apiService.getContentPosts())
    } catch (error) {
      notify.error((error as Error).message || 'Failed to load library')
    } finally {
      setLoadingPosts(false)
    }
  }, [activeOrganization?.id])

  useEffect(() => { loadSources(true) }, [loadSources])
  useEffect(() => {
    setSelectedKey(null)
    setCaption('')
    setEmailSubject('')
    setEmailBody('')
  }, [activeOrganization?.id])
  useEffect(() => {
    if (view === 'library') loadPosts()
  }, [view, loadPosts])

  const selectSource = (source: ContentSource) => {
    setSelectedKey(sourceKey(source))
    setCaption('')
    setEmailSubject('')
    setEmailBody('')
  }

  const generate = async () => {
    if (!selected) return
    setGenerating(true)
    try {
      const next = await apiService.generateContentCopy(selected.source_type, selected.source_id)
      setCaption(next.caption_short || next.caption_linkedin)
      setEmailSubject(next.email_subject)
      setEmailBody(next.email_body)
    } catch (error) {
      const err = error as Error & { code?: string }
      if (err.code === 'AI_REPORT_LIMIT_REACHED') notify.error(err.message)
      else notify.error(err.message || 'Failed to generate copy')
    } finally {
      setGenerating(false)
    }
  }

  const save = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await apiService.createContentPost({
        kind,
        format: kind === 'email' ? 'email' : 'ig_square',
        source_type: selected.source_type,
        source_id: selected.source_id,
        caption: kind === 'social' ? caption : null,
        email_subject: kind === 'email' ? emailSubject : null,
        email_body: kind === 'email' ? emailBody : null,
      })
      notify.success(kind === 'email' ? 'Email saved to library' : 'Post saved to library')
    } catch (error) {
      notify.error((error as Error).message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) return
    await navigator.clipboard.writeText(text)
    notify.success(`${label} copied`)
  }

  const downloadExport = async (
    sourceType: ContentSource['source_type'],
    sourceId: string,
    title: string,
    branded: boolean,
  ) => {
    setExporting(true)
    try {
      const cached = view !== 'library'
        && selected
        && selected.source_type === sourceType
        && selected.source_id === sourceId
        && imageFile
        ? imageFile
        : null
      const file = cached || (branded
        ? await apiService.getContentGraphicFile(sourceType, sourceId, title, layout)
        : await apiService.getContentImageFile(sourceType, sourceId, title))
      triggerDownload(file)
      notify.success(branded ? 'Graphic downloading' : 'Photo downloading')
    } catch (error) {
      notify.error((error as Error).message || 'Could not download')
    } finally {
      setExporting(false)
    }
  }

  const exportPost = async (
    sourceType: ContentSource['source_type'],
    sourceId: string,
    title: string,
    text: string,
    branded: boolean,
  ) => {
    setExporting(true)
    try {
      const cached = view !== 'library'
        && selected
        && selected.source_type === sourceType
        && selected.source_id === sourceId
        && imageFile
        ? imageFile
        : null
      const file = cached || (branded
        ? await apiService.getContentGraphicFile(sourceType, sourceId, title, layout)
        : await apiService.getContentImageFile(sourceType, sourceId, title))
      const result = await exportPhotoWithCaption({ file, caption: text, preferShare })
      if (result === 'shared') notify.success(text.trim() ? 'Caption copied. Pick Instagram, Facebook, or LinkedIn' : 'Pick Instagram, Facebook, or LinkedIn')
      else if (result === 'downloaded') notify.success(text.trim() ? 'Caption copied. Graphic downloading' : 'Graphic downloading')
    } catch (error) {
      notify.error((error as Error).message || 'Could not prepare graphic')
    } finally {
      setExporting(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    try {
      await apiService.deleteContentPost(deleteId)
      setPosts(prev => prev.filter(p => p.id !== deleteId))
      notify.success('Removed')
    } catch (error) {
      notify.error((error as Error).message || 'Failed to delete')
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col pt-6 px-4 sm:px-6 lg:px-8 mobile-content-padding">
      <div className="max-w-6xl mx-auto w-full flex flex-col flex-1 min-h-0">
        <PageHeader
          className="mb-4 shrink-0"
          title="Content"
          subtitle={
            view === 'email'
              ? 'Pick a photo, generate an email, paste it yourself.'
              : view === 'library'
                ? 'Saved drafts.'
                : 'Pick a photo. Download a branded graphic. Copy a caption.'
          }
          help={<Help view={view} />}
          actions={
            <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100">
              {([
                ['social', 'Socials'],
                ['email', 'Email'],
                ['library', 'Library'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setView(id)}
                  className={`h-8 px-3 rounded-lg text-[13px] font-medium ${view === id ? 'bg-white text-secondary-900 shadow-card' : 'text-secondary-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
        />

        {view === 'library' ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
          {loadingPosts ? <SectionLoader /> : (
            posts.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="Nothing saved yet"
                description="Create a post from a photo, then save it here."
                action={
                  <button type="button" onClick={() => setView('social')} className="app-btn app-btn-primary app-btn-sm">
                    Create a post
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {posts.map(post => (
                  <article key={post.id} className="app-card overflow-hidden flex flex-col">
                    {post.image_url ? (
                      <img src={post.image_url} alt="" className="h-40 w-full object-cover bg-gray-50" />
                    ) : (
                      <div className="h-40 bg-gray-50 flex items-center justify-center text-secondary-400">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                    <div className="p-4 flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="app-chip text-[10px] uppercase tracking-wide">
                          {post.kind === 'email' ? 'Email' : 'Social'}
                        </span>
                        <span className="text-[11px] text-secondary-400 tabular-nums">
                          {formatDate(post.created_at, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-secondary-800 line-clamp-3">
                        {post.kind === 'email' ? (post.email_subject || post.email_body) : post.caption}
                      </p>
                      <div className="mt-auto pt-2 flex items-center gap-1">
                        {post.kind === 'email' ? (
                          <>
                            <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => copyText(post.email_subject || '', 'Subject')}>
                              Subject
                            </button>
                            <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => copyText(post.email_body || '', 'Body')}>
                              Body
                            </button>
                            {post.email_html && (
                              <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => copyText(post.email_html || '', 'HTML')}>
                                HTML
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <button type="button" className="app-btn app-btn-ghost app-btn-sm" onClick={() => copyText(post.caption || '', 'Caption')}>
                              <Copy className="w-3.5 h-3.5" />
                              Caption
                            </button>
                            <button
                              type="button"
                              className="app-btn app-btn-ghost app-btn-sm"
                              disabled={exporting}
                              onClick={() => downloadExport(post.source_type, post.source_id, post.caption || 'impact-photo', true)}
                            >
                              {exporting ? <Spinner className="w-4 h-4" /> : <Download className="w-3.5 h-3.5" />}
                              Graphic
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="app-btn app-btn-icon app-btn-ghost ml-auto text-secondary-400 hover:text-red-600"
                          onClick={() => setDeleteId(post.id)}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-12 lg:gap-4">
            <div className="lg:col-span-7 min-h-0 flex flex-col gap-3 order-2 lg:order-1">
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <div className={`inline-flex items-center h-7 md:h-9 p-0.5 rounded-full border ${
                  typeFilter !== 'all' ? 'border-primary-300 bg-primary-50' : 'border-gray-200 bg-white'
                }`}>
                  {([
                    ['all', 'All', null],
                    ['evidence', 'Evidence', Camera],
                    ['story', 'Stories', BookOpen],
                  ] as const).map(([id, label, Icon]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTypeFilter(id)}
                      className={`h-full px-2.5 md:px-3 rounded-full text-xs md:text-sm font-medium inline-flex items-center gap-1 ${
                        typeFilter === id
                          ? typeFilter === 'all'
                            ? 'bg-gray-100 text-secondary-900'
                            : 'bg-primary-100 text-primary-800'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {Icon && <Icon className="w-3 h-3" />}
                      {label}
                    </button>
                  ))}
                </div>
                <DateRangePicker
                  value={dateFilter}
                  onChange={setDateFilter}
                  maxDate={getLocalDateString(new Date())}
                  placeholder="Date"
                  variant="pill"
                />
              </div>
              {loadingSources && sources.length === 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full rounded-xl" />
                  ))}
                </div>
              ) : visibleSources.length === 0 ? (
                <EmptyState
                  icon={ImageIcon}
                  title={filtersActive ? 'No photos match' : 'No photos to share yet'}
                  description={
                    filtersActive
                      ? 'Try a different date range or type.'
                      : 'Upload visual evidence or a photo story in a program. Approved photos show up here.'
                  }
                  action={
                    filtersActive ? (
                      <button
                        type="button"
                        className="app-btn app-btn-secondary app-btn-sm"
                        onClick={() => {
                          setTypeFilter('all')
                          setDateFilter({})
                        }}
                      >
                        Clear filters
                      </button>
                    ) : (
                      <Link to="/tracking/programs" className="app-btn app-btn-primary app-btn-sm">
                        Go to programs
                      </Link>
                    )
                  }
                />
              ) : (
                <div className="space-y-3 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {visibleSources.map((source, i) => (
                      <SourceTile
                        key={sourceKey(source)}
                        source={source}
                        active={sourceKey(source) === selectedKey}
                        eager={i < 6}
                        onSelect={selectSource}
                      />
                    ))}
                  </div>
                  {hasMore && (
                    <button
                      type="button"
                      className="app-btn app-btn-secondary w-full"
                      disabled={loadingMore}
                      onClick={() => loadSources(false)}
                    >
                      {loadingMore ? <Spinner className="w-4 h-4" /> : null}
                      {loadingMore ? 'Loading' : 'Load more'}
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 min-h-0 flex flex-col order-1 lg:order-2">
              <div className="app-card p-5 flex flex-col gap-4 lg:h-full lg:min-h-0 lg:overflow-y-auto">
                {!selected ? (
                  <p className="text-sm text-secondary-500">
                    {view === 'email' ? 'Pick a photo on the left to write an email.' : 'Pick a photo on the left to make a post.'}
                  </p>
                ) : (
                  <>
                    {view === 'social' ? (
                      <div className="relative overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50 w-full shrink-0">
                        <img
                          src={previewUrl || selected.image_url}
                          alt=""
                          className="w-full aspect-square object-cover"
                        />
                        {buildingGraphic && (
                          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                            <Spinner className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <img src={selected.image_url} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-50 flex-shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold text-secondary-900 truncate">{selected.title}</p>
                            <SourceTypeChip type={selected.source_type} className="flex-shrink-0 shadow-none" />
                          </div>
                          <p className="text-xs text-secondary-500 truncate mt-0.5">
                            {selected.initiative_title}
                            {selected.date_represented ? ` · ${formatDate(selected.date_represented, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                          </p>
                        </div>
                      </div>
                    )}

                    {view === 'social' && (
                      <>
                        <div className="flex flex-col gap-1.5">
                          <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-gray-200 bg-white w-fit mx-auto">
                            {LAYOUTS.map(opt => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => setLayout(opt.id)}
                                className={`h-full px-2.5 rounded-full text-[12px] font-medium ${
                                  layout === opt.id ? 'bg-gray-100 text-secondary-900' : 'text-gray-600 hover:text-gray-900'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[11px] text-secondary-400 text-center">
                            {LAYOUTS.find(opt => opt.id === layout)?.hint}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="text-sm font-semibold text-secondary-900 truncate">{selected.title}</p>
                          <SourceTypeChip type={selected.source_type} className="flex-shrink-0 shadow-none" />
                        </div>
                      </>
                    )}

                    {view === 'email' ? (
                      <>
                        <label className="block">
                          <span className="app-label">Subject</span>
                          <input
                            className="app-input mt-1"
                            value={emailSubject}
                            onChange={e => setEmailSubject(e.target.value)}
                            placeholder="Subject line"
                          />
                        </label>
                        <label className="block">
                          <span className="app-label">Body</span>
                          <textarea
                            className="app-input mt-1 min-h-[160px] resize-y"
                            value={emailBody}
                            onChange={e => setEmailBody(e.target.value)}
                            placeholder="Paste-ready email body"
                          />
                        </label>
                      </>
                    ) : (
                      <label className="block">
                        <span className="app-label">Caption</span>
                        <textarea
                          className="app-input mt-1 min-h-[88px] resize-y"
                          value={caption}
                          onChange={e => setCaption(e.target.value)}
                          placeholder="Write a caption, or generate one from the proof"
                        />
                      </label>
                    )}

                    <div className="flex flex-wrap items-center gap-2 shrink-0 mt-auto">
                      <button
                        type="button"
                        onClick={generate}
                        disabled={generating}
                        className="app-btn app-btn-primary app-btn-sm"
                      >
                        {generating ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-3.5 h-3.5" />}
                        {generating ? 'Writing' : 'Generate'}
                      </button>
                      {view === 'email' ? (
                        <>
                          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => copyText(emailSubject, 'Subject')} disabled={!emailSubject.trim()}>
                            <Copy className="w-3.5 h-3.5" />
                            Subject
                          </button>
                          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => copyText(emailBody, 'Body')} disabled={!emailBody.trim()}>
                            Body
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn-ghost app-btn-sm"
                            disabled={exporting}
                            onClick={() => downloadExport(selected.source_type, selected.source_id, selected.title, false)}
                          >
                            {exporting ? <Spinner className="w-4 h-4" /> : <Download className="w-3.5 h-3.5" />}
                            Photo
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={() => copyText(caption, 'Caption')} disabled={!caption.trim()}>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </button>
                          <button
                            type="button"
                            className="app-btn app-btn-secondary app-btn-sm"
                            disabled={exporting || buildingGraphic}
                            onClick={() => downloadExport(selected.source_type, selected.source_id, selected.title, true)}
                          >
                            {exporting ? <Spinner className="w-4 h-4" /> : <Download className="w-3.5 h-3.5" />}
                            Graphic
                          </button>
                          {preferShare && (
                            <button
                              type="button"
                              className="app-btn app-btn-ghost app-btn-sm"
                              disabled={exporting || buildingGraphic}
                              onClick={() => exportPost(selected.source_type, selected.source_id, selected.title, caption, true)}
                            >
                              {exporting ? <Spinner className="w-4 h-4" /> : <Share2 className="w-3.5 h-3.5" />}
                              Share
                            </button>
                          )}
                        </>
                      )}
                      <button
                        type="button"
                        onClick={save}
                        disabled={saving || (view === 'email' ? !emailBody.trim() : !caption.trim())}
                        className="app-btn app-btn-ghost app-btn-sm ml-auto"
                      >
                        {saving ? <Spinner className="w-4 h-4" /> : null}
                        Save
                      </button>
                    </div>
                    <p className="app-help">
                      {view === 'social'
                        ? 'Download the branded graphic, copy the caption, then paste both into Instagram, Facebook, or LinkedIn.'
                        : 'Copy the text, download the photo, then paste into Gmail or Mailchimp.'}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {deleteId && (
        <ConfirmDialog
          title="Remove from library"
          message="This deletes the saved draft. The original photo stays in tracking."
          confirmLabel="Remove"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
