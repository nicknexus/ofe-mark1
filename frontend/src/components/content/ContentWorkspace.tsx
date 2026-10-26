import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BarChart3, Camera, ChevronDown, Image as ImageIcon, Plus, Route, Search, X } from 'lucide-react'
import { EmptyState, PageHelpTip, SectionLoader } from '../ui'
import { formatDate } from '../../utils'
import { PublishBadge, SocialCount } from './ContentJourneys'
import type { ContentJourney, ContentPackage } from '../../types'

export type StatusFilter = 'all' | 'published' | 'draft'
export type SocialFilter = 'all' | 'has' | 'none' | 'stale'
export type KindFilter = 'all' | 'moments' | 'updates'
export type StudioMode = 'create' | 'ideas'
export type LibraryView = 'all' | 'moments' | 'journeys'

export function NewMenu({ onMoment, onJourney }: { onMoment: () => void; onJourney: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const items = [
    { id: 'moment', label: 'Moment', body: 'One post about one thing.', icon: Camera, tint: 'bg-[#c0dfa1]/20 text-[#e7f5d4]', run: onMoment },
    { id: 'journey', label: 'Journey', body: 'A folder of updates over time.', icon: Route, tint: 'bg-white/10 text-white', run: onJourney },
    { id: 'glance', label: 'Impact at a Glance', body: 'Coming soon', icon: BarChart3, tint: 'bg-white/5 text-white/35', soon: true },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="app-btn app-btn-primary app-btn-lg"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <Plus className="w-4 h-4" /> Create <ChevronDown className="w-4 h-4 opacity-60" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-white/10 bg-[#2C343B] p-1.5 z-30 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)]" role="menu">
          {items.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.soon}
                onClick={() => {
                  if (item.soon) return
                  setOpen(false)
                  item.run?.()
                }}
                className={`w-full flex items-center gap-3 rounded-xl px-2.5 py-2 text-left ${item.soon ? 'cursor-not-allowed opacity-50' : 'hover:bg-white/10'}`}
              >
                <span className={`inline-flex w-9 h-9 rounded-xl items-center justify-center flex-shrink-0 ${item.tint}`}>
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-secondary-900">{item.label}</span>
                  <span className="block text-[12px] text-secondary-500">{item.body}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Pills<T extends string>({ value, options, onChange }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-white/10 bg-white/5">
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`h-full px-2.5 rounded-full text-xs font-medium ${value === id ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white'}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

const LIBRARY_VIEWS: { id: 'all' | 'moments' | 'journeys'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'moments', label: 'Moments' },
  { id: 'journeys', label: 'Journeys' },
]

export function StudioBar({
  mode,
  view,
  onMode,
  onView,
  actions,
  help,
  toolbar,
}: {
  mode: 'create' | 'ideas'
  view: 'all' | 'moments' | 'journeys'
  onMode: (mode: 'create' | 'ideas') => void
  onView: (view: 'all' | 'moments' | 'journeys') => void
  actions?: ReactNode
  help?: ReactNode
  toolbar?: ReactNode
}) {
  return (
    <div className="relative z-20 shrink-0 pb-5 space-y-4">
      <div className="relative flex items-center justify-center min-h-12">
        {help && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2">
            <PageHelpTip label="Content">{help}</PageHelpTip>
          </span>
        )}
        <div className="inline-flex items-center gap-2" role="tablist" aria-label="Content">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            onClick={() => onMode('create')}
            className={`h-14 px-6 rounded-xl text-[15px] font-semibold tracking-tight bg-primary-500 text-white transition-opacity ${
              mode === 'create' ? 'shadow-[0_10px_18px_-6px_rgba(192,223,161,0.8)]' : 'opacity-80 hover:opacity-100'
            }`}
          >
            Create Content
          </button>
          <span className="relative">
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="h-14 px-6 rounded-xl bg-seafoam text-white text-[15px] font-semibold tracking-tight leading-tight cursor-not-allowed"
            >
              Content Ideas
              <span className="block text-[10px] font-medium tracking-normal text-white/80">Coming soon</span>
            </button>
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 h-5 px-1.5 rounded-md bg-[#3d8fd4] text-[10px] font-bold tracking-wide text-white shadow-sm pointer-events-none">
              AI
            </span>
          </span>
        </div>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">{actions}</div>
      </div>
      <div className="flex flex-wrap items-center justify-start gap-2">
        {mode === 'create' && (
          <div className="inline-flex items-center h-8 p-0.5 rounded-full border border-white/10 bg-black/20" role="tablist" aria-label="Library">
            {LIBRARY_VIEWS.map(item => {
              const active = view === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => onView(item.id)}
                  className={`h-full rounded-full text-[13px] font-medium transition-all ${
                    active ? 'px-3.5 bg-white text-[#1c242b]' : 'px-3 text-white/50 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              )
            })}
          </div>
        )}
        {toolbar}
      </div>
    </div>
  )
}

export function PostToolbar({
  query,
  status,
  social,
  filtered,
  shown,
  total,
  scope,
  onQuery,
  onStatus,
  onSocial,
  onClear,
}: {
  query: string
  status: StatusFilter
  social: SocialFilter
  filtered: boolean
  shown: number
  total: number
  scope: 'all' | 'moments'
  onQuery: (value: string) => void
  onStatus: (value: StatusFilter) => void
  onSocial: (value: SocialFilter) => void
  onClear: () => void
}) {
  const [focused, setFocused] = useState(false)
  const wide = focused || !!query.trim()
  return (
    <div className="contents">
      <div className={`relative ${wide ? 'w-full sm:w-64' : 'w-full sm:w-36'} transition-[width] duration-200`}>
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          className="app-input h-8 pl-8 text-[13px]"
          value={query}
          onChange={e => onQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={scope === 'moments' ? 'Search moments' : 'Search posts'}
        />
      </div>
      <Pills value={status} onChange={onStatus} options={[['all', 'All'], ['published', 'Published'], ['draft', 'Drafts']] as const} />
      <select
        className="app-input h-8 w-auto py-0 text-[13px]"
        value={social}
        onChange={e => onSocial(e.target.value as SocialFilter)}
      >
        <option value="all">Any social</option>
        <option value="has">Has social posts</option>
        <option value="none">No social posts</option>
        <option value="stale">Outdated social</option>
      </select>
      <span className="text-[12px] text-white/40 tabular-nums">
        {filtered ? `${shown} of ${total}` : total}
      </span>
      {filtered && (
        <button type="button" className="h-8 px-2.5 rounded-lg text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 inline-flex items-center gap-1" onClick={onClear}>
          <X className="w-3.5 h-3.5" /> Clear
        </button>
      )}
    </div>
  )
}

export function filterPosts(
  packages: ContentPackage[],
  query: string,
  kind: KindFilter,
  status: StatusFilter,
  social: SocialFilter,
) {
  const q = query.trim().toLowerCase()
  return packages.filter(pkg => {
    if (kind === 'moments' && pkg.journey_id) return false
    if (kind === 'updates' && !pkg.journey_id) return false
    if (status === 'published' && !pkg.published_at) return false
    if (status === 'draft' && pkg.published_at) return false
    const count = pkg.versions?.length || 0
    if (social === 'has' && !count) return false
    if (social === 'none' && count) return false
    if (social === 'stale' && !pkg.channels_stale) return false
    if (q && !`${pkg.hook || ''} ${pkg.body || ''}`.toLowerCase().includes(q)) return false
    return true
  })
}

export function ContentWorkspace({
  packages,
  journeys,
  loading,
  query,
  kind,
  status,
  social,
  onOpenPost,
  onOpenJourney,
  onNewMoment,
  onClear,
}: {
  packages: ContentPackage[]
  journeys: ContentJourney[]
  loading: boolean
  query: string
  kind: KindFilter
  status: StatusFilter
  social: SocialFilter
  onOpenPost: (pkg: ContentPackage) => void
  onOpenJourney: (journey: ContentJourney) => void
  onNewMoment: () => void
  onClear: () => void
}) {
  const journeyById = useMemo(() => new Map(journeys.map(j => [j.id, j])), [journeys])

  const visible = useMemo(
    () => filterPosts(packages, query, kind, status, social),
    [packages, kind, status, social, query],
  )

  if (loading && packages.length === 0) return <SectionLoader />

  if (packages.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="No posts yet"
        description="Moments and journey updates show up here. Each one is a post for your public page."
        action={<button type="button" className="app-btn app-btn-primary app-btn-sm" onClick={onNewMoment}>Make a moment</button>}
      />
    )
  }

  if (visible.length === 0) {
    return (
      <EmptyState
        icon={Search}
        title="Nothing matches"
        description="Try a different filter."
        action={<button type="button" className="app-btn app-btn-secondary app-btn-sm" onClick={onClear}>Clear filters</button>}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pb-8">
      {visible.map(pkg => {
        const journey = pkg.journey_id ? journeyById.get(pkg.journey_id) : undefined
        return (
          <PostCard
            key={pkg.id}
            pkg={pkg}
            journey={journey}
            onOpen={() => (journey ? onOpenJourney(journey) : onOpenPost(pkg))}
          />
        )
      })}
    </div>
  )
}

function PostCard({ pkg, journey, onOpen }: { pkg: ContentPackage; journey?: ContentJourney; onOpen: () => void }) {
  const isUpdate = !!pkg.journey_id
  return (
    <article
      className={`overflow-hidden rounded-2xl border border-white/10 bg-white/5 text-left cursor-pointer flex flex-col transition-colors hover:bg-white/[0.08] hover:border-white/20 border-l-2 ${isUpdate ? 'border-l-[#97C7CB]' : 'border-l-[#c0dfa1]'}`}
      onClick={onOpen}
    >
      <div className="relative bg-white/5">
        {pkg.image_url ? (
          <img src={pkg.image_url} alt="" className="h-40 w-full object-cover" />
        ) : (
          <div className="h-40 w-full" />
        )}
        {(pkg.media?.length || 0) > 1 && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-black/60 text-white">
            <ImageIcon className="w-3 h-3" /> {pkg.media!.length}
          </span>
        )}
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`app-chip py-0.5 ${isUpdate ? 'app-chip-accent' : 'app-chip-impact'}`}>
            {isUpdate ? <Route className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
            {isUpdate ? 'Journey update' : 'Moment'}
          </span>
          <span className="ml-auto text-[11px] text-white/55 flex-shrink-0">
            {formatDate(pkg.published_at || pkg.created_at, { month: 'short', day: 'numeric' })}
          </span>
        </div>
        {isUpdate && (
          <p className="text-[13px] font-medium text-white truncate">
            In {journey?.title || 'a journey'}
          </p>
        )}
        <p className="text-[15px] font-semibold text-white leading-snug line-clamp-2">{pkg.hook}</p>
        <p className="text-[13px] text-white/80 leading-snug line-clamp-2">{pkg.body}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-0.5">
          <PublishBadge published={!!pkg.published_at} />
          <SocialCount count={pkg.versions?.length || 0} stale={pkg.channels_stale} />
        </div>
      </div>
    </article>
  )
}
