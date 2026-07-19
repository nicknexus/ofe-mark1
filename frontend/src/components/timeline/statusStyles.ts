import { Link2, Unlink, Clock, CheckCircle2, type LucideIcon } from 'lucide-react'
import type { BadgeTone } from '../ui/Badge'
import type { ConnectionStatus } from '../../utils/timeline'

/**
 * Unified status vocabulary + styling for every Logs surface (Claims, Evidence,
 * Connections, summary counts). One source of truth so a claim/evidence/card
 * reads the same everywhere at a glance:
 *   green  = connected / approved
 *   red    = not connected
 *   yellow = needs review
 * Tints are intentionally very light — the goal is instant comprehension, not
 * loud colour. `review` / `approved` are wired now but not yet produced by the
 * data layer (approval flow lands later).
 */
export type LogStatus = ConnectionStatus | 'review' | 'approved'

export interface StatusStyle {
  label: string
  tone: BadgeTone
  icon: LucideIcon
  /** Light row background tint + matching hover, for list rows. */
  row: string
  rowHover: string
  /** Light card background + border tint, for cards/chips/panels. */
  card: string
  /** Icon / accent colour. */
  accent: string
  /** Optional Badge pill classes (e.g. Connections-tab gradient). */
  badge?: string
}

export const STATUS_STYLES: Record<LogStatus, StatusStyle> = {
  connected: {
    label: 'Connected',
    tone: 'impact',
    icon: Link2,
    row: 'bg-impact-50/40',
    rowHover: 'hover:bg-impact-50/70',
    card: 'bg-impact-50/40 border-impact-100',
    accent: 'text-impact-500',
    badge: 'border border-primary-300 bg-gradient-to-r from-claim-50 to-primary-50 text-gray-800',
  },
  approved: {
    label: 'Approved',
    tone: 'impact',
    icon: CheckCircle2,
    row: 'bg-impact-50/40',
    rowHover: 'hover:bg-impact-50/70',
    card: 'bg-impact-50/40 border-impact-100',
    accent: 'text-impact-500',
    badge: 'border border-primary-300 bg-gradient-to-r from-claim-50 to-primary-50 text-gray-800',
  },
  not_connected: {
    label: 'Not connected',
    tone: 'danger',
    icon: Unlink,
    row: 'bg-red-50/40',
    rowHover: 'hover:bg-red-50/70',
    card: 'bg-red-50/40 border-red-100',
    accent: 'text-red-500',
  },
  review: {
    label: 'Needs review',
    tone: 'warning',
    icon: Clock,
    row: 'bg-amber-50/50',
    rowHover: 'hover:bg-amber-50/80',
    card: 'bg-amber-50/60 border-amber-200',
    accent: 'text-amber-600',
  },
  // Evidence awaiting admin approval (review gate) — yellow everywhere.
  pending: {
    label: 'Needs approval',
    tone: 'warning',
    icon: Clock,
    row: 'bg-amber-50/50',
    rowHover: 'hover:bg-amber-50/80',
    card: 'bg-amber-50/60 border-amber-200',
    accent: 'text-amber-600',
  },
}

export function getStatusStyle(status: LogStatus): StatusStyle {
  return STATUS_STYLES[status] || STATUS_STYLES.not_connected
}
