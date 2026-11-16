import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bookmark, Heart, Lightbulb, Share2, Users } from 'lucide-react'
import { apiService } from '../../services/api'
import { useTeam } from '../../context/TeamContext'
import { InlineAlert } from '../../components/ui'
import { StudioFrame, StudioPanel, STUDIO_PLATFORMS } from './StudioFrame'

type PlatformId = 'instagram' | 'facebook' | 'linkedin'

type InsightPlatform = {
  platform: PlatformId
  label: string
  error: string | null
  followers: number | null
  reach: number | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  series: { date: string; reach: number }[]
}

type InsightPost = {
  platform: PlatformId
  packageId: string
  title: string
  postUrl: string | null
  sentAt: string
  imageUrl: string | null
  program: string | null
  reach: number | null
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
}

type ChartRow = {
  date: string
  label: string
  reach: number
  posts: InsightPost[]
}

function count(value: number | null | undefined) {
  return value || 0
}

function formatCount(value: number) {
  return value.toLocaleString('en-US')
}

function engagements(row: { likes: number | null; comments: number | null; shares: number | null; saves: number | null }) {
  return count(row.likes) + count(row.comments) + count(row.shares) + count(row.saves)
}

function dayLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function adviceFor(posts: InsightPost[]) {
  if (!posts.length) return 'Publish a post to see which stories reach people.'
  if (posts.length === 1) {
    const post = posts[0]
    const reached = formatCount(count(post.reach))
    if (post.program) {
      return `${post.title} reached ${reached} people. It came from ${post.program}. One post is a start. A pattern shows up after a few more.`
    }
    return `${post.title} reached ${reached} people. Post a few more to see what is working.`
  }
  const groups = new Map<string, number[]>()
  for (const post of posts) {
    const name = post.program || 'No program'
    const list = groups.get(name) || []
    list.push(count(post.reach))
    groups.set(name, list)
  }
  const ranked = [...groups.entries()]
    .map(([name, values]) => ({ name, avg: values.reduce((sum, value) => sum + value, 0) / values.length }))
    .sort((a, b) => b.avg - a.avg)
  if (ranked.length > 1 && ranked[0].avg > ranked[ranked.length - 1].avg) {
    return `${ranked[0].name} posts are reaching more people than ${ranked[ranked.length - 1].name}. The next post should come from ${ranked[0].name}.`
  }
  const strongest = [...posts].sort((a, b) => count(b.reach) - count(a.reach))[0]
  return `${strongest.title} is the strongest post, with ${formatCount(count(strongest.reach))} people reached. Make the next one in the same spirit.`
}

function ReachChart({ rows }: { rows: ChartRow[] }) {
  if (!rows.length) {
    return <p className="text-sm text-secondary-500">Daily reach shows up after Instagram has a few days of data.</p>
  }
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="reachFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#C0DFA1" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#C0DFA1" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(20,53,42,0.08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const row = payload[0].payload as ChartRow
              return (
                <div className="rounded-xl bg-[#14352A] px-3 py-2 text-[12px] text-[#F4F7F2] shadow-lg max-w-[220px]">
                  <p className="font-semibold">{row.label}</p>
                  <p className="text-[#C0DFA1]">{formatCount(row.reach)} account reach</p>
                  {row.posts.map(post => (
                    <p key={`${post.packageId}-${post.platform}`} className="mt-1 text-white/80">
                      {post.title}: {formatCount(count(post.reach))} reach
                    </p>
                  ))}
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="reach"
            stroke="#14352A"
            strokeWidth={2.5}
            fill="url(#reachFill)"
            dot={(props: { cx?: number; cy?: number; payload?: ChartRow }) => {
              const { cx, cy, payload } = props
              if (cx == null || cy == null || !payload?.posts.length) return <g key={`${payload?.date || 'empty'}-dot`} />
              return <circle key={`${payload.date}-post`} cx={cx} cy={cy} r={6} fill="#14352A" stroke="#C0DFA1" strokeWidth={2} />
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function StudioInsights() {
  const { activeOrganization } = useTeam()
  const orgId = activeOrganization?.id || ''
  const [platforms, setPlatforms] = useState<InsightPlatform[] | null>(null)
  const [posts, setPosts] = useState<InsightPost[]>([])
  const [removed, setRemoved] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!orgId) return
    let cancelled = false
    setPlatforms(null)
    setError(null)
    apiService.getSocialInsights()
      .then(result => {
        if (cancelled) return
        setPlatforms(result.platforms)
        setPosts(result.posts || [])
        setRemoved(result.removed || 0)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load insights')
      })
    return () => { cancelled = true }
  }, [orgId])

  const live = (platforms || []).filter(row => !row.error)
  const loading = platforms === null && !error
  const reach = live.reduce((sum, row) => sum + count(row.reach), 0)
  const likes = live.reduce((sum, row) => sum + count(row.likes), 0)
  const comments = live.reduce((sum, row) => sum + count(row.comments), 0)
  const shares = live.reduce((sum, row) => sum + count(row.shares), 0)
  const saves = live.reduce((sum, row) => sum + count(row.saves), 0)
  const followers = live.reduce((sum, row) => sum + count(row.followers), 0)
  const engagementTotal = likes + comments + shares + saves
  const top = [...live].sort((a, b) => engagements(b) - engagements(a))[0]
  const topShare = top && engagementTotal ? Math.round((engagements(top) / engagementTotal) * 100) : 0
  const averageReach = posts.length ? posts.reduce((sum, post) => sum + count(post.reach), 0) / posts.length : 0

  const chart = useMemo(() => {
    const byDate = new Map<string, ChartRow>()
    for (const row of (platforms || []).filter(item => !item.error)) {
      for (const point of row.series || []) {
        const current = byDate.get(point.date) || { date: point.date, label: dayLabel(point.date), reach: 0, posts: [] }
        current.reach += point.reach
        byDate.set(point.date, current)
      }
    }
    for (const post of posts) {
      const date = post.sentAt.slice(0, 10)
      const current = byDate.get(date) || { date, label: dayLabel(date), reach: 0, posts: [] }
      current.posts.push(post)
      byDate.set(date, current)
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }, [platforms, posts])

  const programs = useMemo(() => {
    const totals = new Map<string, number>()
    for (const post of posts) {
      if (!post.program) continue
      totals.set(post.program, (totals.get(post.program) || 0) + count(post.reach))
    }
    return [...totals.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [posts])
  const programMax = programs[0]?.value || 1
  const rankedPosts = [...posts].sort((a, b) => count(b.reach) - count(a.reach))

  const cards = [
    { label: 'Reach', value: reach, hint: 'People who saw you', icon: Users, className: 'bg-[#14352A] text-[#F4F7F2]' },
    { label: 'Engagements', value: engagementTotal, hint: 'Likes, comments, shares, saves', icon: Heart, className: 'bg-[#C0DFA1] text-[#14352A]' },
    { label: 'Shares', value: shares, hint: 'Passed along', icon: Share2, className: 'bg-[#97C7CB] text-[#14352A]' },
    { label: 'Saves', value: saves, hint: 'Kept for later', icon: Bookmark, className: 'bg-[#2A6B4A] text-[#F4F7F2]' },
  ]

  return (
    <StudioFrame
      title="Insights"
      subtitle="See what is working, and where people are responding."
    >
      {error && <InlineAlert tone="warning" className="mb-4">{error}</InlineAlert>}

      {live.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {live.map(row => {
            const platform = STUDIO_PLATFORMS.find(item => item.id === row.platform)
            const Icon = platform?.icon
            return (
              <div key={row.platform} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 shadow-sm border border-[#14352A]/10">
                {Icon && <Icon className="w-3.5 h-3.5 text-[#14352A]" />}
                <span className="text-[13px] font-semibold text-[#1C2B24]">{row.label}</span>
                <span className="text-[12px] text-secondary-500">{formatCount(count(row.reach))} reach</span>
              </div>
            )
          })}
          {followers > 0 && (
            <span className="inline-flex items-center text-[12px] text-secondary-500 px-1">{formatCount(followers)} followers</span>
          )}
        </div>
      )}

      <div className={`grid grid-cols-2 ${live.length > 1 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
        {cards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`rounded-[22px] px-4 py-4 shadow-sm ${card.className}`}>
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 opacity-80" />
                <p className="text-[13px] font-medium opacity-80">{card.label}</p>
              </div>
              {loading ? (
                <p className="mt-3 h-8 w-16 rounded-lg bg-white/25 animate-pulse" />
              ) : (
                <p className="mt-2 font-fraunces text-[34px] leading-none">{live.length ? formatCount(card.value) : '–'}</p>
              )}
              <p className="mt-2 text-[12px] opacity-70">{live.length ? card.hint : 'After you connect'}</p>
            </div>
          )
        })}
        {live.length > 1 && top && (
          <div className="rounded-[22px] px-4 py-4 shadow-sm bg-[#E7F3DF] text-[#14352A]">
            <p className="text-[13px] font-medium opacity-80">Top network</p>
            <p className="mt-2 font-fraunces text-[28px] leading-none">{top.label}</p>
            <p className="mt-2 text-[12px] opacity-70">{topShare}% of engagements</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,0.8fr)] gap-4 mt-4 items-stretch">
        <StudioPanel className="px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[15px] font-semibold text-[#1C2B24]">Content performance</p>
            <span className="rounded-full bg-[#E7F3DF] px-3 py-1 text-[12px] font-medium text-[#14352A]">Last 30 days</span>
          </div>
          <p className="text-[12px] text-secondary-500 mb-2">The line is account reach. A dot is a post, on the day it went out.</p>
          {loading ? <div className="h-64 rounded-2xl bg-[#E7F3DF] animate-pulse" /> : <ReachChart rows={chart} />}
        </StudioPanel>

        <div className="rounded-[28px] bg-[#14352A] text-[#F4F7F2] p-6 flex flex-col relative overflow-hidden">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#C0DFA1]/20" />
          <div className="relative">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#C0DFA1] text-[#14352A]">
              <Lightbulb className="w-4 h-4" />
            </span>
            <p className="mt-4 text-[18px] font-semibold">What to post next</p>
            <p className="mt-2 text-[14px] leading-relaxed text-white/80">
              {loading ? 'Looking at your posts.' : adviceFor(posts)}
            </p>
            <Link to="/studio/new" state={{ studioStart: 'diy' }} className="studio-hero-btn studio-hero-btn-mint mt-5">
              Create a post
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)] gap-4 mt-4 items-start">
        <StudioPanel className="px-4 py-4 sm:px-5">
          <p className="text-[15px] font-semibold text-[#1C2B24]">Top performing posts</p>
          {loading ? (
            <div className="mt-4 h-16 rounded-xl bg-[#E7F3DF] animate-pulse" />
          ) : rankedPosts.length === 0 ? (
            <p className="mt-3 text-[13px] text-secondary-500">No live posts yet. Publish one and it will show up here.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#14352A]/[0.06]">
              {rankedPosts.map(post => {
                const platform = STUDIO_PLATFORMS.find(item => item.id === post.platform)
                const Icon = platform?.icon
                const above = posts.length > 1 && count(post.reach) >= averageReach
                return (
                  <div key={`${post.packageId}-${post.platform}`} className="flex items-center gap-3 py-3">
                    {post.imageUrl ? (
                      <img src={post.imageUrl} alt="" className="h-12 w-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <span className="h-12 w-12 rounded-xl bg-[#E7F3DF] flex-shrink-0" />
                    )}
                    <Link to={`/studio/post/${post.packageId}`} className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold text-[#1C2B24] truncate">{post.title}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-secondary-500">
                        {Icon && <Icon className="w-3 h-3" />}
                        {platform?.label}
                        {' · '}
                        {dayLabel(post.sentAt.slice(0, 10))}
                        {posts.length > 1 && (
                          <span className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${above ? 'bg-[#C0DFA1] text-[#14352A]' : 'bg-amber-100 text-amber-800'}`}>
                            {above ? 'Working' : 'Quiet'}
                          </span>
                        )}
                      </span>
                    </Link>
                    <div className="hidden sm:flex items-center gap-4 text-right flex-shrink-0">
                      <span><span className="block text-[14px] font-semibold text-[#1C2B24]">{formatCount(count(post.reach))}</span><span className="block text-[11px] text-secondary-400">Reach</span></span>
                      <span><span className="block text-[14px] font-semibold text-[#1C2B24]">{formatCount(engagements(post))}</span><span className="block text-[11px] text-secondary-400">Engagements</span></span>
                      <span><span className="block text-[14px] font-semibold text-[#1C2B24]">{formatCount(count(post.shares))}</span><span className="block text-[11px] text-secondary-400">Shares</span></span>
                    </div>
                    {post.postUrl && (
                      <a href={post.postUrl} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#2A6B4A] flex-shrink-0">View</a>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {removed > 0 && (
            <p className="mt-2 text-[12px] text-secondary-400">
              {removed === 1 ? '1 post was removed on Instagram, so it has no numbers.' : `${removed} posts were removed, so they have no numbers.`}
            </p>
          )}
        </StudioPanel>

        <div className="rounded-[28px] bg-[#E7F3DF] px-5 py-5">
          <p className="text-[15px] font-semibold text-[#14352A]">Best by program</p>
          {loading ? (
            <div className="mt-4 h-16 rounded-xl bg-white/60 animate-pulse" />
          ) : programs.length === 0 ? (
            <p className="mt-3 text-[13px] text-[#14352A]/70">Programs show up when a sent post comes from one.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {programs.map(program => (
                <div key={program.name}>
                  <div className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="font-medium text-[#14352A] truncate">{program.name}</span>
                    <span className="font-semibold text-[#14352A]">{formatCount(program.value)}</span>
                  </div>
                  <div className="mt-1.5 h-2.5 rounded-full bg-white/80">
                    <div className="h-2.5 rounded-full bg-[#2A6B4A]" style={{ width: `${Math.max(8, Math.round((program.value / programMax) * 100))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </StudioFrame>
  )
}
