import React, { useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, PenLine, ArrowRight, Globe, Clock, RotateCcw } from 'lucide-react'
import ModalFrame, { ModalHeader, ModalBody } from '../ModalFrame'
import { Badge } from '../ui'
import { apiService } from '../../services/api'
import { formatRelativeTime } from '../../utils'
import { useTeam } from '../../context/TeamContext'

type OfferState = 'checking' | 'offer' | 'manual'

const usedKey = (orgId: string) => `site-setup-used:${orgId}`

/** After one finished website setup, the scan only lives in Organization > Website import. */
export function markSetupUsed(orgId: string) {
  try { localStorage.setItem(usedKey(orgId), '1') } catch { /* private mode */ }
}

const lastUrlKey = (orgId: string) => `site-setup-last-url:${orgId}`

export function rememberScannedUrl(orgId: string, url: string) {
  try { localStorage.setItem(lastUrlKey(orgId), url) } catch { /* private mode */ }
}

/** Prefill for website setup: the last URL scanned in this org, else blank. */
export function lastScannedUrl(orgId: string | null | undefined): string {
  if (!orgId) return ''
  try { return localStorage.getItem(lastUrlKey(orgId)) || '' } catch { return '' }
}

interface SavedSetup {
  inputUrl: string
  draft: { programs: { existing_id?: string }[]; metrics: unknown[]; locations: unknown[] } | null
  step: number
  savedAt?: number
}

/** The unfinished scan or review SiteSetupPage left in localStorage, if any. */
function readSavedSetup(orgId: string | null | undefined): SavedSetup | null {
  if (!orgId) return null
  try {
    const saved = JSON.parse(localStorage.getItem(`site-setup:${orgId}`) || 'null') as SavedSetup | null
    return saved?.inputUrl ? saved : null
  } catch { return null }
}

export const hasSavedSetup = (orgId: string | null | undefined) => !!readSavedSetup(orgId)

export function wasSetupUsed(orgId: string | null | undefined): boolean {
  if (!orgId) return false
  try { return localStorage.getItem(usedKey(orgId)) === '1' } catch { return false }
}

/** Nothing tracked yet: no programs, metrics or locations. */
export async function isAccountEmpty(): Promise<boolean> {
  const [programs, metrics, locations] = await Promise.all([
    apiService.getInitiatives(),
    apiService.getMetricDefinitions(),
    apiService.getOrgLocations(),
  ])
  return programs.length === 0 && metrics.length === 0 && locations.length === 0
}

/**
 * While the account is empty, every create form on the tracking side first
 * offers website setup. Re-checked on each open, so deleting everything
 * brings the offer back; "manual" only applies to the form being opened.
 */
export function useSetupOffer(active: boolean) {
  const { isOwner, isAdmin, activeOrganization, ownedOrganization } = useTeam()
  const orgId = (activeOrganization || ownedOrganization)?.id
  const eligible = active && (isOwner || isAdmin) && !!orgId && !wasSetupUsed(orgId)
  const [state, setState] = useState<OfferState>('manual')

  // Layout effect so the create form never flashes before the check settles.
  useLayoutEffect(() => {
    if (!eligible) {
      setState('manual')
      return
    }
    let cancelled = false
    setState('checking')
    isAccountEmpty()
      .then(empty => { if (!cancelled) setState(empty ? 'offer' : 'manual') })
      .catch(() => { if (!cancelled) setState('manual') })
    return () => { cancelled = true }
  }, [eligible, orgId])

  return { state, goManual: () => setState('manual') }
}

/** Organization > Website import. Always available to owners and admins; only suggests what is missing. */
export function WebsiteImportPanel({ readOnly, onDiscard }: { readOnly?: boolean; onDiscard?: () => void }) {
  const navigate = useNavigate()
  const { activeOrganization, ownedOrganization } = useTeam()
  const org = activeOrganization || ownedOrganization
  const [url, setUrl] = useState(() => lastScannedUrl(org?.id))
  const [saved, setSaved] = useState(() => readSavedSetup(org?.id))

  const go = (target: string) => navigate(`/setup/website?url=${encodeURIComponent(target)}`)
  const discard = () => {
    if (org?.id) localStorage.removeItem(`site-setup:${org.id}`)
    setSaved(null)
    onDiscard?.()
  }
  const restart = (target: string) => {
    discard()
    go(target)
  }

  const scan = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || readOnly) return
    // A fresh scan replaces any unfinished one.
    restart(url.trim())
  }

  const newPrograms = saved?.draft?.programs.filter(p => !p.existing_id).length ?? 0
  const when = saved?.savedAt ? formatRelativeTime(new Date(saved.savedAt).toISOString()) : null

  return (
    <div className="space-y-4">
      {saved && !readOnly && (
        <div className="app-card p-5 ring-2 ring-amber-200">
          <div className="flex items-start gap-3">
            <div className="app-icon-tile bg-amber-50 text-amber-600 flex-shrink-0"><Clock className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="app-card-title">{saved.draft ? 'Import in progress' : 'Import stopped before it finished'}</h2>
                <Badge tone="warning">Ongoing</Badge>
              </div>
              <p className="text-sm text-secondary-500 mt-0.5 truncate">
                {saved.inputUrl.replace(/^https?:\/\//, '')}
                {when ? ` · ${when}` : ''}
              </p>
              <p className="text-sm text-secondary-600 mt-2">
                {saved.draft
                  ? `Reviewing step ${Math.min(saved.step + 1, 5)} of 5. We found ${newPrograms} new program${newPrograms === 1 ? '' : 's'}, ${saved.draft.metrics.length} metric${saved.draft.metrics.length === 1 ? '' : 's'} and ${saved.draft.locations.length} place${saved.draft.locations.length === 1 ? '' : 's'}. Nothing has been saved yet.`
                  : 'The scan was closed while it was still reading your site. Nothing has been saved.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-4">
            {saved.draft && (
              <button type="button" onClick={() => go(saved.inputUrl)} className="app-btn app-btn-primary">
                Resume review <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => restart(saved.inputUrl)} className={`app-btn ${saved.draft ? 'app-btn-secondary' : 'app-btn-primary'}`}>
              <RotateCcw className="w-4 h-4" /> Restart scan
            </button>
            <button type="button" onClick={discard} className="app-btn app-btn-ghost">Discard</button>
          </div>
        </div>
      )}

      <form onSubmit={scan} className="app-card p-6">
        <div className="flex items-start gap-3">
          <div className="app-icon-tile app-icon-tile-accent flex-shrink-0"><Sparkles className="w-5 h-5" /></div>
          <div className="min-w-0">
            <h2 className="app-card-title">Import from your website</h2>
            <p className="text-sm text-secondary-500 mt-0.5 leading-relaxed">
              We read your site and compare it with your account. You only see programs, metrics and places you do not have yet, plus anything missing from your story and brand.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <label className="app-label">Website</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input className="app-input pl-10" value={url} inputMode="url" disabled={readOnly}
                onChange={e => setUrl(e.target.value)} placeholder="yourorganization.org" />
            </div>
            <button type="submit" disabled={!url.trim() || readOnly} className="app-btn app-btn-primary flex-shrink-0">
              Scan my site <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <p className="app-help">Nothing you already have is changed or removed. You review every suggestion before it is saved.</p>
        </div>
      </form>
      {readOnly && (
        <p className="text-sm text-secondary-500">Only the organization owner or an admin can run a website import.</p>
      )}
    </div>
  )
}

const NOUN = { program: 'program', metric: 'metric', location: 'location' } as const

export function SetupOfferModal({ kind, onManual, onClose }: {
  kind: keyof typeof NOUN
  onManual: () => void
  onClose: () => void
}) {
  const navigate = useNavigate()
  const { activeOrganization, ownedOrganization } = useTeam()
  const org = activeOrganization || ownedOrganization
  const [url, setUrl] = useState(() => lastScannedUrl(org?.id))

  const build = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onClose()
    navigate(`/setup/website?url=${encodeURIComponent(url.trim())}`)
  }

  return (
    <ModalFrame zIndexClass="z-[60]" size="lg" onClose={onClose}>
      <ModalHeader
        title="How do you want to start?"
        subtitle="Your account is empty. We can set it up from your website, or you can build it yourself."
        icon={Sparkles}
        onClose={onClose}
      />
      <ModalBody>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <form onSubmit={build} className="app-card ring-2 ring-primary-200 p-5 flex flex-col">
            <div className="flex items-center gap-2.5">
              <div className="app-icon-tile app-icon-tile-accent"><Sparkles className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-secondary-900">We will build it for you</p>
                <p className="text-xs text-impact-600 font-medium">Recommended, about a minute</p>
              </div>
            </div>
            <p className="text-sm text-secondary-600 mt-3 leading-relaxed">
              Paste your website. We read it and suggest your programs, metrics and locations, plus your brand color and logo. You review everything before it is saved.
            </p>
            <div className="mt-4 relative">
              <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-400" />
              <input
                className="app-input pl-10"
                value={url}
                autoFocus
                onChange={e => setUrl(e.target.value)}
                placeholder="yourorganization.org"
                inputMode="url"
              />
            </div>
            <button type="submit" disabled={!url.trim()} className="app-btn app-btn-primary w-full mt-3">
              Build it for me <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="app-card p-5 flex flex-col">
            <div className="flex items-center gap-2.5">
              <div className="app-icon-tile"><PenLine className="w-5 h-5" /></div>
              <div>
                <p className="text-sm font-semibold text-secondary-900">Set it up manually</p>
                <p className="text-xs text-secondary-500">Full control from the start</p>
              </div>
            </div>
            <p className="text-sm text-secondary-600 mt-3 leading-relaxed">
              Create your first {NOUN[kind]} yourself and add the rest as you go.
            </p>
            <button type="button" onClick={onManual} className="app-btn app-btn-secondary w-full mt-auto">
              Create a {NOUN[kind]} manually
            </button>
          </div>
        </div>
      </ModalBody>
    </ModalFrame>
  )
}
