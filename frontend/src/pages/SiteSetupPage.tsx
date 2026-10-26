import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check, Globe, Sparkles, CheckCircle2, RotateCcw } from 'lucide-react'
import { apiService } from '../services/api'
import { SubscriptionService } from '../services/subscription'
import { useTeam } from '../context/TeamContext'
import { InlineAlert, Spinner } from '../components/ui'
import { stepVariants, easeOut, fadeInUp, stagger } from '../components/onboarding/motion'
import {
  ProgramsStep, MetricsStep, LocationsStep, StoryStep, BrandStep, DraftUpdater,
} from '../components/setup/SiteSetupSteps'
import { geocodePlace } from '../hooks/useNominatimSearch'
import { markSetupUsed, rememberScannedUrl } from '../components/setup/SetupOffer'
import { clearSWR } from '../utils/swrCache'
import { SiteSetupDraft, SiteSetupBranding, SiteSetupApplyResult, SiteSetupApplyStep, SiteSetupMetric } from '../types'
import '../components/onboarding/onboarding.css'

type Phase = 'scanning' | 'review' | 'applying' | 'done' | 'error'

const STEPS = ['Programs', 'Metrics', 'Locations', 'Your story', 'Brand']
const APPLY_STAGES = [
  { key: 'programs', label: 'Programs' },
  { key: 'metrics', label: 'Metrics' },
  { key: 'locations', label: 'Locations' },
  { key: 'profile', label: 'Brand and profile' },
] as const
type ApplyStageKey = typeof APPLY_STAGES[number]['key']
type StageCount = { done: number; total: number }
interface ApplyProgress {
  stages: Record<ApplyStageKey, StageCount>
  current: string
  startedAt: number
}

/** Runs fn over items with at most `limit` in flight. */
async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await fn(items[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

/** Same title twice would collide on the server; merge their programs instead. */
function dedupeMetrics(metrics: SiteSetupMetric[]): SiteSetupMetric[] {
  const byTitle = new Map<string, SiteSetupMetric>()
  for (const m of metrics) {
    const key = m.title.trim().toLowerCase()
    const prev = byTitle.get(key)
    if (prev) prev.program_ids = [...new Set([...prev.program_ids, ...m.program_ids])]
    else byTitle.set(key, { ...m, program_ids: [...m.program_ids] })
  }
  return [...byTitle.values()]
}
const SCAN_STAGES = ['Reading your website', 'Finding your programs', 'Picking metrics and places']
const DEFAULT_BRAND = '#c0dfa1'

/** Stored per org so Organization > Website import can offer resume or restart. Draft is null while scanning. */
interface SavedSession {
  inputUrl: string
  draft: SiteSetupDraft | null
  branding: SiteSetupBranding | null
  step: number
  color: string | null
  keepLogo: boolean
  includeStory: boolean
  savedAt: number
}

function hasStory(d: SiteSetupDraft): boolean {
  return !!(d.story.problem_statement || d.story.theory_of_change || d.organization.statement || d.organization.description)
}

export default function SiteSetupPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inputUrl = (params.get('url') || '').trim()
  const { activeOrganization, ownedOrganization, isOwner, isAdmin, loading: teamLoading } = useTeam()
  const org = activeOrganization || ownedOrganization
  const orgId = org?.id
  const storageKey = orgId ? `site-setup:${orgId}` : null
  const orgBrandColor = org?.brand_color
  const orgLogo = org?.logo_url

  const [phase, setPhase] = useState<Phase>('scanning')
  const [scanStage, setScanStage] = useState(0)
  const [brandingDone, setBrandingDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<SiteSetupDraft | null>(null)
  const [branding, setBranding] = useState<SiteSetupBranding | null>(null)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [color, setColor] = useState<string | null>(null)
  const [keepLogo, setKeepLogo] = useState(true)
  const [includeStory, setIncludeStory] = useState(true)
  const [programRoom, setProgramRoom] = useState(Infinity)
  const [locationRoom, setLocationRoom] = useState(Infinity)
  const [result, setResult] = useState<SiteSetupApplyResult | null>(null)
  const [applyProgress, setApplyProgress] = useState<ApplyProgress | null>(null)
  const startedFor = useRef<string | null>(null)
  const geocoding = useRef(false)

  const canSetup = isOwner || isAdmin
  const close = () => navigate('/home')

  const runScan = useCallback(async () => {
    setPhase('scanning')
    setError(null)
    setScanStage(0)
    setBrandingDone(false)
    if (storageKey) {
      const stub: SavedSession = {
        inputUrl, draft: null, branding: null, step: 0, color: null, keepLogo: false, includeStory: true, savedAt: Date.now(),
      }
      try { localStorage.setItem(storageKey, JSON.stringify(stub)) } catch { /* non-fatal */ }
    }
    try {
      const { website_url, urls } = await apiService.siteScanDiscover(inputUrl)
      const brandingPromise = apiService.siteScanBranding(website_url)
        .catch(() => ({ colors: [], logo_url: '' } as SiteSetupBranding))
        .then(b => { setBrandingDone(true); return b })
      const { context } = await apiService.siteScanScrape(website_url, urls)
      setScanStage(1)
      const extractPromise = apiService.siteScanExtract(website_url, context)
      const stageTimer = setTimeout(() => setScanStage(2), 6000)
      const [nextDraft, nextBranding] = await Promise.all([extractPromise, brandingPromise])
      clearTimeout(stageTimer)
      setDraft(nextDraft)
      setBranding(nextBranding)
      // A brand the org already set wins by default; the user can still switch.
      const hasBrand = !!orgBrandColor && orgBrandColor.toLowerCase() !== DEFAULT_BRAND
      setColor(hasBrand ? null : nextBranding.colors[0] || null)
      setKeepLogo(!!nextBranding.logo_url && !orgLogo)
      setIncludeStory(hasStory(nextDraft))
      setStep(0)
      setPhase('review')
    } catch (e: any) {
      setError(e?.message || 'We could not read that website.')
      setPhase('error')
    }
  }, [inputUrl, storageKey, orgBrandColor, orgLogo])

  useEffect(() => {
    if (!inputUrl) { navigate('/home', { replace: true }); return }
    if (teamLoading || !storageKey || !canSetup) return
    if (startedFor.current === storageKey) return
    startedFor.current = storageKey
    if (orgId) rememberScannedUrl(orgId, inputUrl)

    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as SavedSession | null
      if (saved?.draft && saved.inputUrl === inputUrl) {
        setDraft(saved.draft)
        setBranding(saved.branding)
        setStep(saved.step || 0)
        setColor(saved.color)
        setKeepLogo(saved.keepLogo)
        setIncludeStory(saved.includeStory)
        setPhase('review')
        return
      }
    } catch { /* corrupt session, rescan */ }
    runScan()
  }, [inputUrl, storageKey, orgId, teamLoading, canSetup, navigate, runScan])

  useEffect(() => {
    if (!orgId) return
    SubscriptionService.getInitiativesUsage()
      .then(u => setProgramRoom(u.limit === null ? Infinity : Math.max(u.limit - u.current, 0)))
      .catch(() => {})
    SubscriptionService.getLocationsUsage()
      .then(u => setLocationRoom(u.limit === null ? Infinity : Math.max(u.limit - u.current, 0)))
      .catch(() => {})
  }, [orgId])

  useEffect(() => {
    if (phase !== 'review' || !draft || !storageKey) return
    const session: SavedSession = { inputUrl, draft, branding, step, color, keepLogo, includeStory, savedAt: Date.now() }
    try { localStorage.setItem(storageKey, JSON.stringify(session)) } catch { /* quota, non-fatal */ }
  }, [phase, draft, branding, step, color, keepLogo, includeStory, storageKey, inputUrl])

  // Pin AI-suggested places with a real geocoder lookup while the user reviews
  // programs. Sequential with a gap: Nominatim allows ~1 request per second.
  useEffect(() => {
    if (phase !== 'review' || !draft || geocoding.current) return
    const pending = draft.locations.filter(l => !l.geo_status && !l.existing_id && l.name.trim())
    if (pending.length === 0) return
    geocoding.current = true
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
    ;(async () => {
      const query = (...parts: (string | undefined)[]) => parts.filter(Boolean).join(', ')
      for (const [i, l] of pending.entries()) {
        if (i > 0) await sleep(1100)
        // "Village, Area, Country" first so namesakes elsewhere lose; then the
        // place alone; then pin to the area itself and flag it as approximate.
        let hit = await geocodePlace(query(l.name, l.area, l.country))
        let approx = false
        if (!hit && l.area) {
          await sleep(1100)
          hit = await geocodePlace(query(l.name, l.country))
        }
        if (!hit && l.area) {
          await sleep(1100)
          hit = await geocodePlace(query(l.area, l.country))
          approx = !!hit
        }
        setDraft(d => d && {
          ...d,
          locations: d.locations.map(x => {
            if (x.id !== l.id || x.geo_status) return x
            return hit
              ? {
                ...x,
                latitude: parseFloat(hit.lat),
                longitude: parseFloat(hit.lon),
                country: x.country || hit.address?.country || '',
                place_label: hit.display_name,
                geo_status: approx ? 'approx' : 'found',
              }
              : { ...x, latitude: null, longitude: null, geo_status: 'missing' }
          }),
        })
      }
      geocoding.current = false
    })()
  }, [phase, draft])

  useEffect(() => {
    document.getElementById('site-setup-body')?.scrollTo({ top: 0 })
  }, [step, phase])

  useEffect(() => {
    if (phase !== 'applying') return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  const update: DraftUpdater = fn => setDraft(d => (d ? fn(d) : d))

  const included = draft
    ? {
      programs: draft.programs.filter(p => !p.skip),
      metrics: draft.metrics.filter(m => !m.skip),
      locations: draft.locations.filter(l => !l.skip),
    }
    : null

  const isRescan = !!draft?.programs.some(p => p.existing_id)
  const newPrograms = included?.programs.filter(p => !p.existing_id) ?? []
  const newLocations = included?.locations.filter(l => !l.existing_id) ?? []

  const stepValid = (i: number): boolean => {
    if (!included) return false
    if (i === 0) return included.programs.length > 0 && newPrograms.length <= programRoom && newPrograms.every(p => p.title.trim())
    if (i === 1) return included.metrics.every(m => m.title.trim() && (m.metric_type === 'percentage' || m.unit_of_measurement.trim()))
    if (i === 2) return newLocations.length <= locationRoom && included.locations.every(l => l.name.trim())
    return true
  }

  const goStep = (i: number) => {
    if (i > step && ![...Array(i).keys()].every(stepValid)) return
    setDir(i > step ? 1 : -1)
    setStep(i)
  }

  const apply = async () => {
    if (!draft || !included || phase === 'applying') return
    const allPrograms = included.programs.filter(p => p.title.trim())
    const programs = allPrograms.filter(p => !p.existing_id)
    const single = allPrograms.length === 1 ? [allPrograms[0].id] : null
    const metrics = dedupeMetrics(included.metrics.filter(m => m.title.trim()))
      .map(m => (single ? { ...m, program_ids: single } : m))
    const locations = included.locations
      .filter(l => l.name.trim())
      .map(l => (single ? { ...l, program_ids: single } : l))

    const stages: Record<ApplyStageKey, StageCount> = {
      programs: { done: 0, total: programs.length },
      metrics: { done: 0, total: metrics.length },
      locations: { done: 0, total: locations.length },
      profile: { done: 0, total: 1 },
    }
    const startedAt = Date.now()
    const report = (current: string) => setApplyProgress({ stages: { ...stages }, current, startedAt })
    const errors: string[] = []
    const created = { programs: 0, metrics: 0, locations: 0 }
    const programIdMap: Record<string, string> = {}
    for (const p of allPrograms) if (p.existing_id) programIdMap[p.id] = p.existing_id

    const run = async (stage: ApplyStageKey, label: string, step: SiteSetupApplyStep): Promise<string | null> => {
      try {
        const res = await apiService.siteScanApplyStep(step)
        errors.push(...res.errors)
        return res.id
      } catch (e: any) {
        errors.push(`${label}: ${e?.message || 'failed'}`)
        return null
      } finally {
        stages[stage] = { ...stages[stage], done: stages[stage].done + 1 }
        report(label)
      }
    }

    // Writes are not idempotent: drop the saved draft so a reload cannot replay them.
    if (storageKey) localStorage.removeItem(storageKey)
    if (orgId) markSetupUsed(orgId)
    setPhase('applying')
    report('')

    for (const p of programs) {
      const id = await run('programs', p.title, { kind: 'program', program: p })
      if (id) { programIdMap[p.id] = id; created.programs++ }
    }
    await runPool(metrics, 3, async m => {
      const id = await run('metrics', m.title, { kind: 'metric', metric: m, program_id_map: programIdMap })
      if (id && !m.existing_id) created.metrics++
    })
    await runPool(locations, 3, async l => {
      const id = await run('locations', l.name, { kind: 'location', location: l, program_id_map: programIdMap })
      if (id && !l.existing_id) created.locations++
    })
    await run('profile', 'Brand and profile', {
      kind: 'profile',
      website_url: draft.website_url,
      organization: includeStory
        ? draft.organization
        : { description: '', statement: '', donation_url: draft.organization.donation_url },
      story: includeStory ? draft.story : null,
      branding: {
        brand_color: color,
        logo_url: keepLogo && branding?.logo_url ? branding.logo_url : null,
      },
    })

    apiService.clearCache()
    clearSWR()
    window.dispatchEvent(new Event('onboarding-updated'))
    setResult({
      created,
      first_program_id: (programs[0] && programIdMap[programs[0].id]) || (allPrograms[0] && programIdMap[allPrograms[0].id]) || null,
      errors,
    })
    setPhase('done')
  }

  const reviewing = phase === 'review' || phase === 'applying'
  const applyPct = applyProgress ? progressFraction(applyProgress) * 100 : 0
  const progressPct = phase === 'applying'
    ? applyPct
    : reviewing ? ((step + 1) / STEPS.length) * 100 : phase === 'done' ? 100 : 0
  const isLast = step === STEPS.length - 1

  const renderStep = () => {
    if (!draft) return null
    switch (step) {
      case 0: return <ProgramsStep draft={draft} update={update} room={programRoom} />
      case 1: return <MetricsStep draft={draft} update={update} />
      case 2: return <LocationsStep draft={draft} update={update} room={locationRoom} />
      case 3: return <StoryStep draft={draft} update={update} include={includeStory} setInclude={setIncludeStory} />
      case 4: return (
        <BrandStep
          branding={branding}
          color={color}
          setColor={setColor}
          currentColor={org?.brand_color || DEFAULT_BRAND}
          keepLogo={keepLogo}
          setKeepLogo={setKeepLogo}
          currentLogo={org?.logo_url}
          orgName={org?.name}
        />
      )
    }
    return null
  }

  return (
    <motion.div
      className="onboarding-shell"
      initial={{ opacity: 0, scale: 0.985, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOut }}
    >
      <div className="onboarding-progress-track" aria-hidden>
        <div className="onboarding-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {phase !== 'applying' && (
        <button type="button" onClick={close} className="onboarding-close app-btn app-btn-icon app-btn-ghost shadow-card" title="Close (resume later)">
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="onboarding-layout">
        {reviewing && (
          <aside className="onboarding-rail hidden lg:flex">
            <div className="onboarding-rail-brand">
              <Globe className="w-4 h-4 text-secondary-400" />
              <span className="onboarding-rail-brand-mark truncate">{draft?.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
            </div>
            <p className="onboarding-rail-title">{isRescan ? 'Website update' : 'Website setup'}</p>
            <nav className="space-y-0.5 flex-1">
              {STEPS.map((label, index) => {
                const done = index < step
                const current = index === step
                const count = included ? [newPrograms, included.metrics, included.locations][index]?.length : undefined
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={phase === 'applying'}
                    onClick={() => goStep(index)}
                    className={`onboarding-rail-item ${current ? 'onboarding-rail-item--current' : done ? 'onboarding-rail-item--done' : 'onboarding-rail-item--upcoming'}`}
                  >
                    <span className={`onboarding-rail-dot ${current ? 'onboarding-rail-dot--current' : done ? 'onboarding-rail-dot--done' : 'onboarding-rail-dot--upcoming'}`}>
                      {done ? <Check className="w-3 h-3" /> : index + 1}
                    </span>
                    <span className="truncate flex-1 text-left">{label}</span>
                    {count !== undefined && <span className="text-xs tabular-nums text-secondary-400">{count}</span>}
                  </button>
                )
              })}
            </nav>
          </aside>
        )}

        <main id="site-setup-body" className="onboarding-main">
          <div className="onboarding-step-inner">
            <div className="onboarding-step-body">
              {!teamLoading && !canSetup ? (
                <div className="max-w-lg mx-auto pt-16">
                  <InlineAlert tone="warning" title="Ask your organization owner">
                    Only the owner or an admin can set up the account from a website.
                  </InlineAlert>
                </div>
              ) : phase === 'scanning' ? (
                <ScanView url={inputUrl} stage={scanStage} brandingDone={brandingDone} />
              ) : phase === 'error' ? (
                <div className="max-w-lg mx-auto pt-16 space-y-4">
                  <InlineAlert tone="error" title="We hit a snag">{error}</InlineAlert>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { startedFor.current = storageKey; runScan() }} className="app-btn app-btn-primary">
                      <RotateCcw className="w-4 h-4" /> Try again
                    </button>
                    <button type="button" onClick={close} className="app-btn app-btn-secondary">Set up manually</button>
                  </div>
                </div>
              ) : phase === 'applying' && applyProgress ? (
                <ApplyView progress={applyProgress} />
              ) : phase === 'done' && result ? (
                <DoneView
                  result={result}
                  onProgram={() => navigate('/tracking/programs')}
                  onHome={() => navigate('/home')}
                />
              ) : (
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div key={step} custom={dir} variants={stepVariants} initial="enter" animate="center" exit="exit">
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </main>
      </div>

      {phase === 'review' && canSetup && (
        <nav className="onboarding-nav" aria-label="Setup navigation">
          <div>
            {step > 0 && (
              <button type="button" onClick={() => goStep(step - 1)} className="app-btn app-btn-secondary app-btn-sm">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isLast ? (
              <button type="button" onClick={apply} className="app-btn app-btn-primary">
                {isRescan ? 'Add to my workspace' : 'Create my workspace'} <Sparkles className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={() => goStep(step + 1)} disabled={!stepValid(step)} className="app-btn app-btn-primary disabled:opacity-50">
                Looks good <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>
      )}
    </motion.div>
  )
}

function ScanView({ url, stage, brandingDone }: { url: string; stage: number; brandingDone: boolean }) {
  const rows = [...SCAN_STAGES.map((label, i) => ({ label, done: stage > i, active: stage === i })),
    { label: 'Grabbing your brand colors and logo', done: brandingDone, active: !brandingDone }]
  return (
    <motion.div className="onboarding-hero pt-10" variants={stagger} initial="hidden" animate="visible">
      <div className="onboarding-hero-copy">
        <motion.h1 variants={fadeInUp} className="onboarding-hero-title">
          Reading <span className="onboarding-gradient-text">your site</span>
        </motion.h1>
        <motion.p variants={fadeInUp} className="onboarding-hero-desc">
          We are going through {url.replace(/^https?:\/\//, '')} to find your programs, metrics and locations. This usually takes under a minute.
        </motion.p>
      </div>
      <motion.ul variants={fadeInUp} className="app-card p-5 w-full max-w-md mt-8 space-y-3">
        {rows.map(r => (
          <li key={r.label} className="flex items-center gap-3 text-sm">
            <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              {r.done
                ? <CheckCircle2 className="w-5 h-5 text-impact-600" />
                : r.active ? <Spinner className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-gray-200" />}
            </span>
            <span className={r.done ? 'text-secondary-800' : r.active ? 'text-secondary-700 font-medium' : 'text-secondary-400'}>{r.label}</span>
          </li>
        ))}
      </motion.ul>
    </motion.div>
  )
}

function progressFraction(p: ApplyProgress): number {
  const all = Object.values(p.stages)
  const total = all.reduce((s, c) => s + c.total, 0)
  return total ? all.reduce((s, c) => s + c.done, 0) / total : 0
}

function ApplyView({ progress }: { progress: ApplyProgress }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const all = Object.values(progress.stages)
  const total = all.reduce((s, c) => s + c.total, 0)
  const done = all.reduce((s, c) => s + c.done, 0)
  const pct = Math.round(progressFraction(progress) * 100)
  const elapsed = (now - progress.startedAt) / 1000
  const remaining = done >= 2 ? Math.max(Math.round((elapsed / done) * (total - done)), 1) : null
  const activeIndex = APPLY_STAGES.findIndex(s => progress.stages[s.key].done < progress.stages[s.key].total)

  return (
    <motion.div className="onboarding-hero pt-10" variants={stagger} initial="hidden" animate="visible">
      <div className="onboarding-hero-copy">
        <motion.h1 variants={fadeInUp} className="onboarding-hero-title">
          Building <span className="onboarding-gradient-text">your workspace</span>
        </motion.h1>
        <motion.p variants={fadeInUp} className="onboarding-hero-desc">
          Keep this tab open while we add everything you approved.
        </motion.p>
      </div>
      <motion.div variants={fadeInUp} className="app-card p-6 w-full max-w-md mt-8">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold text-secondary-900 tabular-nums">{pct}%</span>
          <span className="text-xs text-secondary-500">
            {remaining !== null ? `About ${remaining < 60 ? `${remaining}s` : `${Math.ceil(remaining / 60)} min`} left` : `${done} of ${total}`}
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary-500"
            initial={false}
            animate={{ width: `${Math.max(pct, 3)}%` }}
            transition={{ duration: 0.5, ease: easeOut }}
          />
        </div>
        <p className="text-xs text-secondary-500 mt-2 truncate">{progress.current ? `Added ${progress.current}` : 'Starting'}</p>

        <ul className="mt-5 pt-5 border-t border-gray-100 space-y-3">
          {APPLY_STAGES.map((s, i) => {
            const c = progress.stages[s.key]
            const finished = c.done >= c.total
            const active = i === activeIndex
            return (
              <li key={s.key} className="flex items-center gap-3 text-sm">
                <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {finished
                    ? <CheckCircle2 className="w-5 h-5 text-impact-600" />
                    : active ? <Spinner className="w-4 h-4" /> : <span className="w-2 h-2 rounded-full bg-gray-200" />}
                </span>
                <span className={`flex-1 ${finished ? 'text-secondary-800' : active ? 'text-secondary-700 font-medium' : 'text-secondary-400'}`}>{s.label}</span>
                {s.key !== 'profile' && (
                  <span className="text-xs tabular-nums text-secondary-400">{c.done}/{c.total}</span>
                )}
              </li>
            )
          })}
        </ul>
      </motion.div>
    </motion.div>
  )
}

function DoneView({ result, onProgram, onHome }: { result: SiteSetupApplyResult; onProgram: () => void; onHome: () => void }) {
  const { programs, metrics, locations } = result.created
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
  return (
    <motion.div className="onboarding-hero pt-10" variants={stagger} initial="hidden" animate="visible">
      <div className="onboarding-hero-copy">
        <motion.h1 variants={fadeInUp} className="onboarding-hero-title">
          You are <span className="onboarding-gradient-text">set up</span>
        </motion.h1>
        <motion.p variants={fadeInUp} className="onboarding-hero-desc">
          We added {plural(programs, 'program')}, {plural(metrics, 'metric')} and {plural(locations, 'location')}. Next, log your first update.
        </motion.p>
      </div>
      {result.errors.length > 0 && (
        <motion.div variants={fadeInUp} className="w-full max-w-lg mt-6">
          <InlineAlert tone="warning" title="A few things did not go through">
            <ul className="list-disc pl-4 space-y-0.5">
              {result.errors.slice(0, 6).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </InlineAlert>
        </motion.div>
      )}
      <motion.div variants={fadeInUp} className="flex gap-2 mt-8">
        <button type="button" onClick={onProgram} className="app-btn app-btn-primary">
          Go to my programs <ChevronRight className="w-4 h-4" />
        </button>
        <button type="button" onClick={onHome} className="app-btn app-btn-secondary">Home</button>
      </motion.div>
    </motion.div>
  )
}
