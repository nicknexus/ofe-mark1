import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Link2, Search } from 'lucide-react'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import { notify } from '../../lib/notify'
import { InlineAlert, SectionLoader } from '../../components/ui'
import ModalFrame, { ModalBody, ModalFooter, ModalHeader } from '../../components/ModalFrame'
import { parseLocalDate } from '../../utils'
import { SocialMarks, StudioFrame, StudioPanel, STUDIO_PLATFORMS, isQueued, socialSendLabel } from './StudioFrame'
import { useStudioLibrary, upsertStudioPackage } from './useStudioLibrary'
import { useSocialAccount } from './useSocialAccount'

type TimelineFilter = 'all' | 'draft' | 'public'

function dayKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

export function StudioCalendar() {
  const { packages, loading, error } = useStudioLibrary()
  const { activeOrganization } = useTeam()
  const [filter, setFilter] = useState<TimelineFilter>('all')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [clearing, setClearing] = useState<string | null>(null)

  const unschedule = async (packageId: string, platform: 'instagram' | 'facebook' | 'linkedin') => {
    setClearing(`${packageId}:${platform}`)
    try {
      const next = await apiService.unscheduleSocial(packageId, platform)
      if (activeOrganization?.id) upsertStudioPackage(activeOrganization.id, next)
      notify.success('Removed from the schedule')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not unschedule')
    } finally {
      setClearing(null)
    }
  }

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
      brand
      title="Posts and schedule"
      subtitle="Every post you have made, and the socials it has gone to."
    >
      {error && <InlineAlert tone="warning" className="mb-4">{error}</InlineAlert>}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([
          ['all', `All (${counts.all})`],
          ['draft', `Drafts (${counts.draft})`],
          ['public', `Posted (${counts.public})`],
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
        <StudioPanel className="divide-y divide-[color-mix(in_srgb,var(--studio-ink)_8%,transparent)]">
          {loading ? (
            <SectionLoader />
          ) : posts.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm font-semibold studio-ink-text">No posts on this view</p>
              <p className="mt-1 text-[13px] text-secondary-500">Try another day or filter.</p>
            </div>
          ) : posts.map(pkg => {
            const when = parseLocalDate(pkg.created_at)
            const sent = socialSendLabel(pkg.publications)
            const queued = (pkg.publications || []).filter(item => isQueued(item))
            return (
              <div key={pkg.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--studio-teal-wash)]">
                <Link to={`/studio/post/${pkg.id}`} className="flex items-center gap-3 min-w-0 flex-1">
                  {pkg.image_url ? (
                    <img src={pkg.image_url} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-14 h-14 rounded-xl studio-teal-wash flex-shrink-0" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold studio-ink-text truncate">{pkg.hook || 'Untitled post'}</span>
                    {sent && <span className="mt-0.5 block text-[12px] font-medium studio-accent-text truncate">{sent}</span>}
                  </span>
                </Link>
                <SocialMarks items={pkg.publications} />
                <span className="text-right flex-shrink-0">
                  <span className={`studio-pill h-6 text-[11px] ${pkg.published_at ? 'studio-pill-on' : ''}`}>
                    {pkg.published_at ? 'Posted' : 'Draft'}
                  </span>
                  <span className="block mt-1 text-[11px] text-secondary-400">
                    {when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </span>
                {queued.map(item => (
                  <button
                    key={item.platform}
                    type="button"
                    className="text-[12px] font-semibold studio-accent-text shrink-0 disabled:opacity-50"
                    disabled={clearing === `${pkg.id}:${item.platform}`}
                    onClick={() => unschedule(pkg.id, item.platform as 'instagram' | 'facebook' | 'linkedin')}
                  >
                    {clearing === `${pkg.id}:${item.platform}` ? 'Removing' : 'Unschedule'}
                  </button>
                ))}
              </div>
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
          <ScheduledList packages={packages} clearing={clearing} onUnschedule={unschedule} />
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

function ScheduledList({
  packages,
  clearing,
  onUnschedule,
}: {
  packages: { id: string; hook?: string | null; publications?: { platform: string; status: string; scheduled_at?: string | null }[] }[]
  clearing: string | null
  onUnschedule: (packageId: string, platform: 'instagram' | 'facebook' | 'linkedin') => void
}) {
  const queued = packages.flatMap(pkg => (pkg.publications || [])
    .filter(item => isQueued(item))
    .map(item => ({ pkg, item })))
    .sort((a, b) => (a.item.scheduled_at || '').localeCompare(b.item.scheduled_at || ''))
  return (
    <StudioPanel className="px-4 py-4">
      <p className="text-[13px] font-semibold studio-ink-text">Scheduled</p>
      {queued.length === 0 ? (
        <p className="mt-1 text-[12px] text-secondary-500 leading-relaxed">Nothing is queued.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {queued.map(({ pkg, item }) => (
            <div key={`${pkg.id}-${item.platform}`} className="flex items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-[var(--studio-teal-wash)]">
              <Link to={`/studio/post/${pkg.id}`} className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium studio-ink-text truncate">{pkg.hook || 'Untitled post'}</span>
                <span className="block text-[12px] text-secondary-500">
                  {STUDIO_PLATFORMS.find(platform => platform.id === item.platform)?.label || item.platform}
                  {queueWhen(item.scheduled_at) ? ` · ${queueWhen(item.scheduled_at)}` : ''}
                </span>
              </Link>
              <button
                type="button"
                className="text-[12px] font-semibold studio-accent-text shrink-0 disabled:opacity-50"
                disabled={clearing === `${pkg.id}:${item.platform}`}
                onClick={() => onUnschedule(pkg.id, item.platform as 'instagram' | 'facebook' | 'linkedin')}
              >
                {clearing === `${pkg.id}:${item.platform}` ? 'Removing' : 'Unschedule'}
              </button>
            </div>
          ))}
        </div>
      )}
    </StudioPanel>
  )
}

export function StudioAccounts() {
  const { account, error, ready, reload } = useSocialAccount()
  const { isOwner, isAdmin } = useTeam()
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [confirmDisconnect, setConfirmDisconnect] = useState<{ id: 'instagram' | 'facebook' | 'linkedin'; label: string } | null>(null)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const canConnect = isOwner || isAdmin
  const told = useRef(false)
  const released = useRef(false)

  useEffect(() => {
    if (!canConnect || released.current) return
    if (params.get('connect_status') === 'success') return
    released.current = true
    apiService.releaseSocialProfile().catch(() => {})
  }, [canConnect, params])

  useEffect(() => {
    const status = params.get('connect_status')
    if (!status || told.current) return
    told.current = true
    const platform = params.get('platform') || 'Account'
    const name = platform.charAt(0).toUpperCase() + platform.slice(1)
    if (status === 'success') notify.success(`${name} connected`)
    else if (status === 'cancelled') notify.error(`${name} connection cancelled`)
    else notify.error(`Could not connect ${name}`)
    navigate('/studio/accounts', { replace: true })
  }, [params, navigate])

  const connect = async (platform: 'instagram' | 'facebook' | 'linkedin') => {
    setConnecting(platform)
    try {
      const { url } = await apiService.connectSocial(platform)
      window.location.assign(url)
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not open the approval screen')
      setConnecting(null)
    }
  }

  const connectedCount = STUDIO_PLATFORMS.filter(platform => account?.connections?.[platform.id]?.connected).length

  const disconnect = async (platform: 'instagram' | 'facebook' | 'linkedin', label: string) => {
    setConfirmDisconnect(null)
    setDisconnecting(platform)
    try {
      await apiService.disconnectSocial(platform)
      notify.success(`${label} disconnected`)
      reload()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Could not disconnect')
    } finally {
      setDisconnecting(null)
    }
  }

  const askDisconnect = (platform: 'instagram' | 'facebook' | 'linkedin', label: string) => {
    if (connectedCount <= 1) setConfirmDisconnect({ id: platform, label })
    else disconnect(platform, label)
  }

  return (
    <StudioFrame
      brand
      title="Connected accounts"
      subtitle="Instagram, Facebook, and LinkedIn for this organization."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {STUDIO_PLATFORMS.map(platform => {
          const Icon = platform.icon
          const linked = account?.connections?.[platform.id]
          return (
            <StudioPanel key={platform.id} className="px-3 py-3 flex items-center gap-3">
              <span className="h-10 w-10 rounded-xl bg-white border border-black/5 inline-flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5" style={{ color: platform.color }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold studio-ink-text">{platform.label}</span>
                {!ready ? (
                  <span className="mt-1 block h-3 w-20 rounded-full studio-teal-wash animate-pulse" />
                ) : (
                  <span className={`block text-[12px] font-medium truncate ${linked?.connected ? 'studio-accent-text' : 'text-secondary-500'}`}>
                    {linked?.connected ? (linked.label || 'Connected') : 'Not connected'}
                  </span>
                )}
              </span>
              {ready && canConnect && !linked?.connected && (
                <button
                  type="button"
                  className="studio-accent-fill h-10 px-3 rounded-xl text-[13px] font-semibold shrink-0 disabled:opacity-50"
                  disabled={!!connecting || !!disconnecting || !account?.configured}
                  onClick={() => connect(platform.id)}
                >
                  {connecting === platform.id ? 'Opening' : 'Connect'}
                </button>
              )}
              {ready && canConnect && linked?.connected && (
                <button
                  type="button"
                  aria-label={`Disconnect ${platform.label}`}
                  className="h-10 px-3 rounded-xl border border-black/10 text-[12px] font-semibold studio-ink-text shrink-0 disabled:opacity-50"
                  disabled={!!connecting || !!disconnecting}
                  onClick={() => askDisconnect(platform.id, platform.label)}
                >
                  {disconnecting === platform.id ? '...' : 'Disconnect'}
                </button>
              )}
            </StudioPanel>
          )
        })}
      </div>
      <StudioPanel className="mt-4 px-5 py-5 flex items-start gap-3">
        <span className="studio-accent-fill w-10 h-10 rounded-xl inline-flex items-center justify-center flex-shrink-0">
          <Link2 className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold studio-ink-text">Connect an account</p>
          {error ? (
            <p className="mt-1 text-sm text-amber-800 leading-relaxed">{error}</p>
          ) : !ready ? (
            <p className="mt-1 text-sm text-secondary-500">Checking your accounts.</p>
          ) : account && !account.configured ? (
            <p className="mt-1 text-sm text-secondary-500 leading-relaxed">Account connections are not available right now.</p>
          ) : (
            <p className="mt-1 text-sm text-secondary-500 leading-relaxed max-w-xl">
              Each button opens that network so you can approve access, then brings you back here. You can post once an account is connected.
            </p>
          )}
          {ready && !canConnect && (
            <p className="mt-2 text-[13px] text-secondary-500">Only an owner or admin can connect accounts.</p>
          )}
        </div>
      </StudioPanel>
      {confirmDisconnect && (
        <ModalFrame size="sm" onClose={() => setConfirmDisconnect(null)}>
          <ModalHeader title={`Disconnect ${confirmDisconnect.label}?`} onClose={() => setConfirmDisconnect(null)} />
          <ModalBody>
            <p className="text-sm text-secondary-600 leading-relaxed">
              This is the last account connected. Insights from posts you already sent will be removed. Connecting again starts insights over. Posts already on {confirmDisconnect.label} stay there.
            </p>
          </ModalBody>
          <ModalFooter>
            <button type="button" className="app-btn app-btn-secondary" onClick={() => setConfirmDisconnect(null)}>Cancel</button>
            <button
              type="button"
              className="app-btn app-btn-danger"
              disabled={!!disconnecting}
              onClick={() => disconnect(confirmDisconnect.id, confirmDisconnect.label)}
            >
              {disconnecting ? 'Disconnecting' : 'Disconnect'}
            </button>
          </ModalFooter>
        </ModalFrame>
      )}
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
        <p className="text-[14px] font-semibold studio-ink-text">{label}</p>
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
                selected ? 'bg-[var(--studio-green)] text-white' : isToday ? 'studio-teal-wash studio-accent-text' : 'text-secondary-700 hover:bg-black/5'
              }`}
            >
              {day}
              {has && <span className={`w-1 h-1 rounded-full ${selected ? 'bg-white' : 'bg-[var(--studio-green)]'}`} />}
            </button>
          )
        })}
      </div>
    </StudioPanel>
  )
}
