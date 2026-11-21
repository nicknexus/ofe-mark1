import type { CSSProperties, ReactNode } from 'react'
import { Sparkles } from 'lucide-react'
import { siFacebook, siInstagram } from 'simple-icons'
import { cn } from '../../lib/utils'
import type { ContentPublication } from '../../types'

const LINKEDIN_PATH = 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124zM7.119 20.452H3.56V9h3.559v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'

function BrandMark({ path, className, style }: { path: string; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden>
      <path fill="currentColor" d={path} />
    </svg>
  )
}

export function InstagramIcon(props: { className?: string; style?: CSSProperties }) {
  return <BrandMark path={siInstagram.path} {...props} />
}

export function FacebookIcon(props: { className?: string; style?: CSSProperties }) {
  return <BrandMark path={siFacebook.path} {...props} />
}

export function LinkedInIcon(props: { className?: string; style?: CSSProperties }) {
  return <BrandMark path={LINKEDIN_PATH} {...props} />
}

export const STUDIO_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: InstagramIcon, color: `#${siInstagram.hex}` },
  { id: 'facebook', label: 'Facebook', icon: FacebookIcon, color: `#${siFacebook.hex}` },
  { id: 'linkedin', label: 'LinkedIn', icon: LinkedInIcon, color: '#0A66C2' },
] as const

export function socialColor(id: string) {
  return STUDIO_PLATFORMS.find(platform => platform.id === id)?.color
}

export function StudioFrame({
  title,
  subtitle,
  actions,
  brand,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  brand?: boolean
  children: ReactNode
}) {
  return (
    <div className="min-h-screen px-5 sm:px-8 lg:px-10 pt-8 pb-16">
      <div className="max-w-[1120px] mx-auto">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div className="min-w-0">
            <p className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${brand ? 'studio-accent-text' : 'text-[#2A6B4A]'}`}>
              <Sparkles className="w-3.5 h-3.5" />
              Content Studio
            </p>
            <h1 className={`mt-1.5 font-fraunces text-[34px] sm:text-[42px] font-medium tracking-tight leading-[1.05] ${brand ? 'studio-ink-text' : 'text-[#1C2B24]'}`}>
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-[15px] text-secondary-500 max-w-xl leading-relaxed">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0 pt-8">{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}

export function StudioPanel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('studio-panel', className)}>{children}</div>
}

const LIVE = new Set(['accepted', 'scheduled', 'published'])

export function isQueued(item: { status: string; scheduled_at?: string | null }) {
  if (item.status === 'published' || item.status === 'failed') return false
  if (item.status === 'scheduled') return true
  if (!item.scheduled_at) return false
  const time = new Date(item.scheduled_at).getTime()
  return !Number.isNaN(time) && time > Date.now()
}

export function livePublications(items?: ContentPublication[]) {
  return (items || []).filter(item => LIVE.has(item.status))
}

export function socialSendLabel(items?: ContentPublication[]) {
  const live = livePublications(items)
  if (!live.length) return null
  const names = STUDIO_PLATFORMS.filter(platform => live.some(item => item.platform === platform.id)).map(platform => platform.label)
  const scheduled = live.every(item => item.status === 'scheduled')
  if (names.length === 1) return scheduled ? `Scheduled for ${names[0]}` : `Sent to ${names[0]}`
  return scheduled ? `Scheduled for ${names.length} accounts` : `Sent to ${names.length} accounts`
}

export function SocialMarks({ items }: { items?: ContentPublication[] }) {
  const live = livePublications(items)
  if (!live.length) return null
  return (
    <span className="inline-flex items-center gap-1">
      {STUDIO_PLATFORMS.filter(platform => live.some(item => item.platform === platform.id)).map(platform => {
        const Icon = platform.icon
        const sent = live.find(item => item.platform === platform.id)
        return (
          <span
            key={platform.id}
            title={sent?.status === 'scheduled' ? `${platform.label} scheduled` : `Sent to ${platform.label}`}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-black/5"
          >
            <Icon className="w-3.5 h-3.5" style={{ color: platform.color }} />
          </span>
        )
      })}
    </span>
  )
}
