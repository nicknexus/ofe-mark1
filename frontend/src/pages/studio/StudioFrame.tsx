import type { ReactNode } from 'react'
import { Facebook, Instagram, Linkedin, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ContentPublication } from '../../types'

export const STUDIO_PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
] as const

export function StudioFrame({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-screen px-5 sm:px-8 lg:px-10 pt-8 pb-16">
      <div className="max-w-[1120px] mx-auto">
        <div className="flex items-start justify-between gap-4 mb-7">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#2A6B4A]">
              <Sparkles className="w-3.5 h-3.5" />
              Content Studio
            </p>
            <h1 className="mt-1.5 font-fraunces text-[34px] sm:text-[42px] font-medium tracking-tight text-[#1C2B24] leading-[1.05]">
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
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E7F3DF] text-[#14352A]"
          >
            <Icon className="w-3.5 h-3.5" />
          </span>
        )
      })}
    </span>
  )
}
