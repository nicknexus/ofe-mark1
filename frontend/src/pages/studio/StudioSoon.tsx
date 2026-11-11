import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Link2, Search } from 'lucide-react'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import { InlineAlert, SectionLoader } from '../../components/ui'
import { parseLocalDate } from '../../utils'
import { SocialMarks, StudioFrame, StudioPanel, STUDIO_PLATFORMS, socialSendLabel } from './StudioFrame'
import { useStudioLibrary } from './useStudioLibrary'
import { useSocialAccount } from './useSocialAccount'

const METRICS = ['Reach', 'Engagements', 'Shares', 'Top platform']

type TimelineFilter = 'all' | 'draft' | 'public'

function dayKey(value: string) {
  const date = parseLocalDate(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function StudioCalendar() {
  const { packages, journeys, loading, error } = useStudioLibrary()
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const journeyById = useMemo(() => new Map(journeys.map(journey => [journey.id, journey])), [journeys])

  const posts = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...packages]
      .filter(pkg => {
        if (filter === 'draft' && pkg.published_at) return false
        if (filter === 'public' && !pkg.published_at) return false
        const days = [dayKey(pkg.created_at), ...(pkg.publications || []).map(item => dayKey(item.scheduled_at || item.created_at))]
        if (selectedDay && !days.includes(selectedDay)) return false
        if (q && !`${pkg.hook || ''} ${pkg.body || ''}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [packages, filter, query, selectedDay])

  const counts = useMemo(() => ({
    all: packages.length,
    draft: packages.filter(pkg => !pkg.published_at).length,
    public: packages.filter(pkg => pkg.published_at).length,
  }), [packages])

  const marked = useMemo(() => {
    const days = new Set<string>()
    for (const pkg of packages) {
      days.add(dayKey(pkg.created_at))
      for (const item of pkg.publications || []) days.add(dayKey(item.scheduled_at || item.created_at))
    }
    return days
  }, [packages])

  return (
    <StudioFrame
      title="Posts and schedule"
      subtitle="Every post you have made, and the socials it has gone to."
    >
      {error && <InlineAlert tone="warning" className="mb-4">{error}</InlineAlert>}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([
          ['all', `All (${counts.all})`],
          ['draft', `Drafts (${counts.draft})`],
          ['public', `Public page (${counts.public})`],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`studio-pill ${filter === id ? 'studio-pill-on' : ''}`}
          >
            {label}
          </button>
        ))}
        <div className="relative w-full sm:w-56 sm:ml-auto">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" />
          <input
            className="app-input h-9 pl-8 text-[13px]"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search posts"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <StudioPanel className="divide-y divide-[#14352A]/[0.06]">
          {loading ? (
            <SectionLoader />
          ) : posts.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm font-semibold text-[#1C2B24]">No posts on this view</p>
              <p className="mt-1 text-[13px] text-secondary-500">Try another day or filter.</p>
            </div>
          ) : posts.map(pkg => {
            const journey = pkg.journey_id ? journeyById.get(pkg.journey_id) : undefined
            const when = parseLocalDate(pkg.created_at)
            const sent = socialSendLabel(pkg.publications)
            return (
              <Link key={pkg.id} to={`/studio/post/${pkg.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F7FAF4]">
                {pkg.image_url ? (
                  <img src={pkg.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <span className="w-14 h-14 rounded-xl bg-[#E7F3DF] flex-shrink-0" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-[#1C2B24] truncate">{pkg.hook || 'Untitled post'}</span>
                  <span className="mt-0.5 block text-[12px] text-secondary-500 truncate">{journey?.title || 'Standalone'}</span>
                  {sent && <span className="mt-0.5 block text-[12px] font-medium text-[#2A6B4A] truncate">{sent}</span>}
                </span>
                <SocialMarks items={pkg.publications} />
                <span className="text-right flex-shrink-0">
                  <span className={`studio-pill h-6 text-[11px] ${pkg.published_at ? 'studio-pill-on' : ''}`}>
                    {pkg.published_at ? 'Public page' : 'Draft'}
                  </span>
                  <span className="block mt-1 text-[11px] text-secondary-400">
                    {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </span>
              </Link>
            )
          })}
        </StudioPanel>
        <div className="space-y-4">
          <MonthGrid
            cursor={cursor}
            marked={marked}
            selectedDay={selectedDay}
            onCursor={setCursor}
            onSelect={day => setSelectedDay(current => current === day ? null : day)}
          />
          <ScheduledList packages={packages} />
        </div>
      </div>
    </StudioFrame>
  )
}

function queueWhen(value?: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ScheduledList({ packages }: { packages: { id: string; hook?: string | null; publications?: { platform: string; status: string; scheduled_at?: string | null }[] }[] }) {
  const queued = packages.flatMap(pkg => (pkg.publications || [])
    .filter(item => item.status === 'scheduled')
    .map(item => ({ pkg, item })))
    .sort((a, b) => (a.item.scheduled_at || '').localeCompare(b.item.scheduled_at || ''))
  return (
    <StudioPanel className="px-4 py-4">
      <p className="text-[13px] font-semibold text-[#1C2B24]">Scheduled</p>
      {queued.length === 0 ? (
        <p className="mt-1 text-[12px] text-secondary-500 leading-relaxed">Nothing is queued.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {queued.map(({ pkg, item }) => (
            <Link key={`${pkg.id}-${item.platform}`} to={`/studio/post/${pkg.id}`} className="block rounded-xl px-2 py-1.5 hover:bg-[#F7FAF4]">
              <span className="block text-[13px] font-medium text-[#1C2B24] truncate">{pkg.hook || 'Untitled post'}</span>
              <span className="block text-[12px] text-secondary-500">
                {STUDIO_PLATFORMS.find(platform => platform.id === item.platform)?.label || item.platform}
                {queueWhen(item.scheduled_at) ? ` · ${queueWhen(item.scheduled_at)}` : ''}
              </span>
            </Link>
          ))}
        </div>
      )}
    </StudioPanel>
  )
}

export function StudioInsights() {
  const { account, ready } = useSocialAccount()
  return (
    <StudioFrame
      title="Insights"
      subtitle="Reach, likes, and comments from the accounts you connect."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {METRICS.map(label => (
          <StudioPanel key={label} className="px-4 py-4">
            <p className="text-[13px] text-secondary-500">{label}</p>
            <p className="mt-2 font-fraunces text-[32px] leading-none text-[#1C2B24]">–</p>
            <p className="mt-2 text-[12px] text-secondary-400">After you connect</p>
          </StudioPanel>
        ))}
      </div>
      <StudioPanel className="mt-4 px-5 py-8">
        <p className="text-[15px] font-semibold text-[#1C2B24]">Content performance</p>
        <p className="mt-1 text-sm text-secondary-500 max-w-lg leading-relaxed">
          {ready && account?.configured
            ? `Plan ${account.plan || 'free'}: ${account.usage.limit ?? 10} uploads a month. Per-post numbers wait until a post has actually published.`
            : 'Account totals show up here first. Per-post numbers wait until a post has published and we have its request id.'}
        </p>
      </StudioPanel>
    </StudioFrame>
  )
}

export function StudioAccounts() {
  const { account, error, ready, reload } = useSocialAccount()
  const { isOwner, isAdmin } = useTeam()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const canConnect = isOwner || isAdmin
  const told = useRef(false)

  useEffect(() => {
    const status = params.get('connect_status')
    if (!status || told.current) return
    told.current = true
    const platform = params.get('platform') || 'Account'
    const name = platform.charAt(0).toUpperCase() + platform.slice(1)
    if (status === 'success') notify.success(`${name} connected`)
    else if (status === 'cancelled') notify.error(`${name} connection cancelled`)
    else notify.error(params.get('error_code') || `Could not connect ${name}`)
    navigate('/studio/accounts', { replace: true })
  }, [params, navigate])

  const connect = async (platform: 'instagram' | 'facebook' | 'linkedin') => {
    setConnecting(platform)
    try {
      const { url } = await apiService.connectSocial(platform)
      window.location.assign(url)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not open the consent screen')
      setConnecting(null)
    }
  }

  const disconnect = async (platform: 'instagram' | 'facebook' | 'linkedin', label: string) => {
    setDisconnecting(platform)
    try {
      const result = await apiService.disconnectSocial(platform)
      notify.success(result.removedProfile ? `${label} disconnected. That profile slot is free.` : `${label} disconnected`)
      reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <StudioFrame
      title="Connected accounts"
      subtitle="Instagram, Facebook, and LinkedIn for this organization."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STUDIO_PLATFORMS.map(platform => {
          const Icon = platform.icon
          const linked = account?.connections?.[platform.id]
          return (
            <StudioPanel key={platform.id} className="px-4 py-4 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-[#E7F3DF] text-[#14352A] inline-flex items-center justify-center">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[#1C2B24]">{platform.label}</span>
                  {!ready ? (
                    <span className="mt-1 block h-3 w-24 rounded-full bg-[#E7F3DF] animate-pulse" />
                  ) : (
                    <span className={`block text-[12px] font-medium truncate ${linked?.connected ? 'text-[#2A6B4A]' : 'text-amber-700'}`}>
                      {linked?.connected ? (linked.label || 'Connected') : 'Not connected'}
                    </span>
                  )}
                </span>
              </div>
              {ready && canConnect && !linked?.connected && (
                <button
                  type="button"
                  className="studio-hero-btn studio-hero-btn-mint h-8 text-[13px]"
                  disabled={!!connecting || !!disconnecting || !account?.configured}
                  onClick={() => connect(platform.id)}
                >
                  {connecting === platform.id ? 'Opening' : `Connect ${platform.label}`}
                </button>
              )}
              {ready && canConnect && linked?.connected && (
                <button
                  type="button"
                  className="app-btn app-btn-secondary app-btn-sm"
                  disabled={!!connecting || !!disconnecting}
                  onClick={() => disconnect(platform.id, platform.label)}
                >
                  {disconnecting === platform.id ? 'Disconnecting' : 'Disconnect'}
                </button>
              )}
            </StudioPanel>
          )
        })}
      </div>
      <StudioPanel className="mt-4 px-5 py-4">
        {error ? (
          <p className="text-sm text-amber-800">{error}</p>
        ) : account ? (
          <p className="text-sm text-secondary-600 leading-relaxed">
            {account.configured
              ? `Upload Post account ${account.email}. Plan ${account.plan || 'free'}: ${account.usage.limit ?? 10} uploads a month. Connecting does not use an upload.`
              : 'No Upload Post key is configured.'}
          </p>
        ) : (
          <p className="text-sm text-secondary-500">Checking the Upload Post account.</p>
        )}
      </StudioPanel>
      <StudioPanel className="mt-4 px-5 py-5 flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-[#14352A] text-[#C0DFA1] inline-flex items-center justify-center flex-shrink-0">
          <Link2 className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#1C2B24]">Connect from here</p>
          <p className="mt-1 text-sm text-secondary-500 leading-relaxed max-w-xl">
            Each button opens that network's approval screen{account?.email ? ` for ${account.email}` : ''}, then brings you back here. Sending posts stays off.
          </p>
          {!canConnect && (
            <p className="mt-2 text-[13px] text-secondary-500">Only an owner or admin can connect accounts.</p>
          )}
        </div>
      </StudioPanel>
    </StudioFrame>
  )
}

function MonthGrid({
  cursor,
  marked,
  selectedDay,
  onCursor,
  onSelect,
}: {
  cursor: Date
  marked: Set<string>
  selectedDay: string | null
  onCursor: (next: Date) => void
  onSelect: (day: string) => void
}) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstWeekday = new Date(year, month, 1).getDay()
  const days = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ]
  const today = new Date()
  const label = cursor.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <StudioPanel className="p-4">
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="p-1 rounded-lg text-secondary-500 hover:bg-black/5" aria-label="Previous month" onClick={() => onCursor(new Date(year, month - 1, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-[14px] font-semibold text-[#1C2B24]">{label}</p>
        <button type="button" className="p-1 rounded-lg text-secondary-500 hover:bg-black/5" aria-label="Next month" onClick={() => onCursor(new Date(year, month + 1, 1))}>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-secondary-400 mb-1">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (!day) return <span key={index} />
          const key = `${year}-${month}-${day}`
          const has = marked.has(key)
          const selected = selectedDay === key
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`h-9 rounded-full text-[13px] flex flex-col items-center justify-center ${
                selected ? 'bg-[#14352A] text-white' : isToday ? 'bg-[#E7F3DF] text-[#14352A]' : 'text-secondary-700 hover:bg-black/5'
              }`}
            >
              {day}
              {has && <span className={`w-1 h-1 rounded-full ${selected ? 'bg-[#C0DFA1]' : 'bg-[#2A6B4A]'}`} />}
            </button>
          )
        })}
      </div>
    </StudioPanel>
  )
}
