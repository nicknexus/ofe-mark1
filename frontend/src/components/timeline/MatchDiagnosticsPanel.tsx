import React, { useEffect, useState } from 'react'
import { AlertCircle, CalendarRange, MapPin, Tag as TagIcon, Users, BarChart3, Pencil, Link2 } from 'lucide-react'
import { MatchReason } from '../../types'
import { formatDate } from '../../utils'
import { SectionLoader } from '../ui'

/** Plain-language label for each gate the server checks. */
const REASON_META: Record<MatchReason, { icon: typeof MapPin; label: string }> = {
  metric: { icon: BarChart3, label: 'different metric' },
  location: { icon: MapPin, label: 'different location' },
  date: { icon: CalendarRange, label: 'dates don\'t overlap' },
  tag: { icon: TagIcon, label: 'different tag' },
  groups: { icon: Users, label: 'different groups' },
}

export interface DiagnosticRow {
  id: string
  title: string
  subtitle?: string
  date?: string | null
  reasons: MatchReason[]
  linked: boolean
}

interface MatchDiagnosticsPanelProps {
  /** What we're diagnosing, in the user's words ("this evidence" / "this claim"). */
  subject: 'evidence' | 'claim'
  /** Loads candidates from the diagnostics endpoint; called once on mount. */
  load: () => Promise<DiagnosticRow[]>
  /** Opens the editor prefilled so the user can fix the scope. */
  onFix?: () => void
  /** Manual connect (re-scope + link) when the user would rather pick. */
  onConnect?: () => void
}

/**
 * "Why isn't this connected?" Lists the nearest records on the same metric
 * with the gates that failed, so a silent zero becomes a one-line fix.
 * Candidates come from the server (same code path as the auto-matcher).
 */
export default function MatchDiagnosticsPanel({ subject, load, onFix, onConnect }: MatchDiagnosticsPanelProps) {
  const [rows, setRows] = useState<DiagnosticRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    load()
      .then(r => { if (!cancelled) setRows(r) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const other = subject === 'evidence' ? 'claims' : 'evidence'
  const nearMisses = (rows || []).filter(r => !r.linked && r.reasons.length > 0).slice(0, 5)
  const totalNear = (rows || []).filter(r => !r.linked && r.reasons.length > 0).length

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-800">Why isn't this connected?</p>
          {rows === null && !error && <SectionLoader label="Checking matches" className="py-2" />}
          {error && (
            <p className="text-xs text-amber-700 mt-0.5">Couldn't check right now. Try again in a moment.</p>
          )}
          {rows !== null && !error && (
            <>
              {rows.length === 0 ? (
                <p className="text-xs text-amber-700 mt-0.5">
                  There {other === 'claims' ? 'are no claims' : 'is no evidence'} on this metric yet. It will connect automatically when matching {other} {other === 'claims' ? 'are' : 'is'} added.
                </p>
              ) : nearMisses.length === 0 ? (
                <p className="text-xs text-amber-700 mt-0.5">
                  {other === 'claims' ? 'Claims on this metric all' : 'Evidence on this metric all'} match, but the link hasn't been made yet. Reconnect from the Connections view, or edit and save to re-run matching.
                </p>
              ) : (
                <>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Nearest {other} on this metric, and what doesn't line up:
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {nearMisses.map(r => (
                      <li key={r.id} className="flex items-start gap-2 text-xs">
                        <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-gray-800 truncate">
                            <span className="font-medium">{r.title}</span>
                            {r.subtitle && <span className="text-gray-500"> · {r.subtitle}</span>}
                            {r.date && <span className="text-gray-400"> · {formatDate(r.date)}</span>}
                          </p>
                          <p className="text-amber-700 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                            {r.reasons.map(reason => {
                              const meta = REASON_META[reason]
                              const Icon = meta.icon
                              return (
                                <span key={reason} className="inline-flex items-center gap-1">
                                  <Icon className="w-3 h-3" /> {meta.label}
                                </span>
                              )
                            })}
                          </p>
                        </div>
                      </li>
                    ))}
                    {totalNear > nearMisses.length && (
                      <li className="text-xs text-amber-700/80 pl-3">and {totalNear - nearMisses.length} more</li>
                    )}
                  </ul>
                </>
              )}
              {(onFix || onConnect) && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {onFix && (
                    <button type="button" onClick={onFix} className="app-btn app-btn-secondary app-btn-sm">
                      <Pencil className="w-3.5 h-3.5" /> Fix scope
                    </button>
                  )}
                  {onConnect && (
                    <button type="button" onClick={onConnect} className="app-btn app-btn-ghost app-btn-sm">
                      <Link2 className="w-3.5 h-3.5" /> Connect manually
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
