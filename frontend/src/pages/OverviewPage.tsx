import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BarChart3, ChevronRight, Compass, Eye, Globe, LayoutDashboard } from 'lucide-react'
import { apiService } from '../services/api'
import { Initiative, Location, MetricDefinitionWithUsage, OrganizationContext } from '../types'
import { useTeam } from '../context/TeamContext'
import { useTutorial } from '../context/TutorialContext'
import { useOnboarding } from '../context/OnboardingContext'
import { AppCard, PageLoader, InlineAlert } from '../components/ui'
import LocationMap from '../components/LocationMap'
import { getKPIColor } from '../components/metricsDashboard/metricColorPalette'
import { fadeUp, staggerContainer, easeOut } from '../components/timeline/motion'
import { shouldHoldTutorialAutostart } from '../lib/layoutIntro'

type CheckItem = { id: string; label: string; done: boolean; to: string }
type StepTone = 'tracking' | 'share'

function NextStepList({ items, tone }: { items: CheckItem[]; tone: StepTone }) {
  const tracking = tone === 'tracking'
  return (
    <ol className="space-y-0.5">
      {items.map((s, i) => (
        <li key={s.id}>
          <Link
            to={s.to}
            className={`group flex items-center gap-3 px-2 py-2 rounded-xl transition-colors ${
              tracking ? 'hover:bg-primary-50/50' : 'hover:bg-claim-50/60'
            }`}
          >
            <span className={`w-6 h-6 rounded-lg text-[11px] font-semibold tabular-nums flex items-center justify-center flex-shrink-0 ${
              tracking
                ? 'bg-primary-50 text-primary-800 group-hover:bg-primary-100'
                : 'bg-claim-50 text-claim-700 group-hover:bg-claim-100'
            }`}>
              {i + 1}
            </span>
            <span className={`text-sm text-secondary-800 flex-1 truncate ${
              tracking ? 'group-hover:text-primary-800' : 'group-hover:text-claim-700'
            }`}>
              {s.label}
            </span>
            <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 ${
              tracking ? 'group-hover:text-primary-600' : 'group-hover:text-claim-600'
            }`} />
          </Link>
        </li>
      ))}
    </ol>
  )
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 560)
      setN(Math.round(value * (1 - (1 - t) ** 3)))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n}</>
}

function OrgMark({ name, src, brand }: { name: string; src?: string | null; brand?: string }) {
  const [broken, setBroken] = useState(false)
  const showImg = !!src && !broken
  return (
    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white ring-1 ring-gray-200/80 shadow-card flex items-center justify-center">
      {showImg ? (
        <img src={src} alt="" className="w-full h-full object-contain" onError={() => setBroken(true)} />
      ) : (
        <span className="text-lg font-semibold text-secondary-700" style={brand ? { color: brand } : undefined}>
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  )
}

function ProgressRing({ pct, stroke }: { pct: number; stroke: string }) {
  const r = 13
  const c = 2 * Math.PI * r
  return (
    <svg className="w-9 h-9 -rotate-90 flex-shrink-0" viewBox="0 0 36 36" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="none" className="stroke-gray-100" strokeWidth="3" />
      <motion.circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct / 100) }}
        transition={{ duration: 0.7, ease: easeOut, delay: 0.2 }}
      />
    </svg>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-impact-500' : pct >= 50 ? 'bg-amber-500' : 'bg-primary-400'
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.55, ease: easeOut, delay: 0.15 }}
      />
    </div>
  )
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { startTutorial, needsTutorial, isActive: tutorialActive } = useTutorial()
  const { hasCompletedOnboarding, isActive: onboardingActive } = useOnboarding()
  const {
    isSharedMember,
    organizationName,
    ownedOrganization,
    activeOrganization,
  } = useTeam()
  const dashboardOrg = activeOrganization || ownedOrganization

  const [initiatives, setInitiatives] = useState<Initiative[]>([])
  const [metrics, setMetrics] = useState<MetricDefinitionWithUsage[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [evidenceCount, setEvidenceCount] = useState(0)
  const [orgContext, setOrgContext] = useState<OrganizationContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    const handler = () => {
      apiService.clearCache()
      setReloadTick(t => t + 1)
    }
    window.addEventListener('onboarding-updated', handler)
    return () => window.removeEventListener('onboarding-updated', handler)
  }, [])

  useEffect(() => {
    if (!dashboardOrg?.id) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([
      apiService.getInitiatives(),
      apiService.getMetricDefinitions(),
      apiService.getLocations(),
      apiService.getEvidence(),
      apiService.getOrgContext(dashboardOrg.id).catch(() => null),
    ])
      .then(([inits, defs, locs, evidence, ctx]) => {
        if (cancelled) return
        setInitiatives(inits)
        setMetrics(defs)
        setLocations(locs)
        setEvidenceCount(evidence.length)
        setOrgContext(ctx)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load overview')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [dashboardOrg?.id, reloadTick])

  useEffect(() => {
    if (!needsTutorial || tutorialActive) return
    if (!hasCompletedOnboarding || onboardingActive) return
    if (shouldHoldTutorialAutostart()) return
    const t = setTimeout(() => startTutorial(), 900)
    return () => clearTimeout(t)
  }, [needsTutorial, tutorialActive, hasCompletedOnboarding, onboardingActive, startTutorial])

  const firstInit = initiatives[0]?.id
  const o = dashboardOrg
  const orgName = o?.name || organizationName || 'Home'
  const brand = o?.brand_color || '#c0dfa1'

  const proveChecks = useMemo<CheckItem[]>(() => [
    { id: 'initiative', label: 'Create an initiative', done: initiatives.length > 0, to: '/tracking/initiatives?new=1' },
    { id: 'metric', label: 'Add a metric', done: metrics.length > 0, to: firstInit ? `/initiatives/${firstInit}?tab=metrics` : '/metrics' },
    { id: 'location', label: 'Add a location', done: locations.length > 0, to: '/locations' },
    { id: 'evidence', label: 'Add evidence', done: evidenceCount > 0, to: firstInit ? `/initiatives/${firstInit}?tab=logs&view=evidence` : '/tracking/initiatives' },
  ], [initiatives.length, metrics.length, locations.length, evidenceCount, firstInit])

  const shareChecks = useMemo<CheckItem[]>(() => {
    const hasText = (v?: string | null) => !!(v && v.trim().length > 0)
    const hasList = (v?: unknown[] | null) => Array.isArray(v) && v.length > 0
    const c = orgContext
    return [
      { id: 'logo', label: 'Upload a logo', done: !!o?.logo_url, to: '/share/org?tab=brand' },
      { id: 'brand', label: 'Set brand color', done: !!o?.brand_color && o.brand_color !== '#c0dfa1', to: '/share/org?tab=brand' },
      { id: 'statement', label: 'Write a mission', done: hasText(o?.statement), to: '/share/org?tab=about' },
      { id: 'support', label: 'Add a support link', done: hasText(o?.donation_url), to: '/share/org?tab=links' },
      { id: 'context', label: 'Finish context', done: hasText(c?.problem_statement) && (hasText(c?.theory_of_change) || hasList(c?.theory_of_change_stages)), to: '/share/context' },
      { id: 'public', label: 'Publish', done: !!o?.is_public, to: '/share/public' },
    ]
  }, [o?.logo_url, o?.brand_color, o?.statement, o?.donation_url, o?.is_public, orgContext])

  const proveNext = useMemo(() => proveChecks.filter(c => !c.done), [proveChecks])
  const shareNext = useMemo(() => shareChecks.filter(c => !c.done), [shareChecks])

  const provePct = proveChecks.length ? Math.round((proveChecks.filter(c => c.done).length / proveChecks.length) * 100) : 0
  const sharePct = shareChecks.length ? Math.round((shareChecks.filter(c => c.done).length / shareChecks.length) * 100) : 0
  const rankedMetrics = useMemo(() =>
    [...metrics].sort((a, b) => {
      if (a.update_count > 0 !== b.update_count > 0) return a.update_count > 0 ? -1 : 1
      return b.total_value - a.total_value
    }).slice(0, 2)
  , [metrics])

  if (loading) return <PageLoader />

  if (error) {
    return (
      <div className="max-w-lg mx-auto pt-16 px-4">
        <InlineAlert tone="error">{error}</InlineAlert>
      </div>
    )
  }

  const publicHref = o?.is_demo && o?.slug
    ? `/demo/${o.slug}`
    : o?.is_public && o?.slug
      ? `/org/${o.slug}`
      : null

  return (
    <div className="relative min-h-screen lg:h-screen lg:overflow-hidden pt-6 pb-6 px-4 sm:px-6 lg:px-8 flex flex-col">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40"
        style={{ background: `radial-gradient(ellipse 55% 90% at 8% 0%, ${brand}2e 0%, transparent 70%)` }}
      />
      <div className="relative max-w-[1600px] mx-auto w-full flex-1 min-h-0 flex flex-col gap-4">
        <motion.div
          className="flex items-center gap-3 flex-shrink-0 min-w-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
        >
          <OrgMark name={orgName} src={o?.logo_url} brand={brand} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="app-page-title truncate">{orgName}</h1>
              {isSharedMember && (
                <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-gray-100 text-secondary-500">
                  Team
                </span>
              )}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {publicHref && (
              <a
                href={publicHref}
                target="_blank"
                rel="noreferrer"
                className="app-btn app-btn-secondary app-btn-sm"
              >
                <Eye className="w-3.5 h-3.5" />
                Public view
              </a>
            )}
            <Link to="/explore" className="app-btn app-btn-secondary app-btn-sm">
              <Compass className="w-3.5 h-3.5" />
              Explore
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-shrink-0"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fadeUp}>
            <Link to="/tracking/initiatives" className="app-card-interactive p-4 h-full flex gap-3">
              <div className="app-icon-tile app-icon-tile-accent">
                <LayoutDashboard className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-2xl font-semibold text-secondary-900 tabular-nums leading-none">
                  <CountUp value={initiatives.length} />
                </p>
                <p className="text-xs text-secondary-500 mt-1">Initiative{initiatives.length === 1 ? '' : 's'}</p>
                {initiatives[0] && (
                  <p className="text-[11px] text-secondary-400 mt-1.5 truncate">{initiatives[0].title}{initiatives.length > 1 ? ` +${initiatives.length - 1}` : ''}</p>
                )}
              </div>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Link to="/metrics" className="app-card-interactive p-4 h-full flex gap-3">
              <div className="app-icon-tile bg-claim-50 text-claim-700">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-2xl font-semibold text-secondary-900 tabular-nums leading-none">
                    <CountUp value={metrics.length} />
                  </p>
                  <p className="text-xs text-secondary-500">Metric{metrics.length === 1 ? '' : 's'}</p>
                </div>
                {rankedMetrics.length > 0 ? (
                  <div className="mt-2.5 space-y-1">
                    {rankedMetrics.map((m, i) => {
                      const color = getKPIColor(m.category, i)
                      return (
                        <div key={m.id} className="flex items-center gap-2 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-[11px] text-secondary-600 truncate flex-1">{m.title}</span>
                          <span className="text-[11px] font-semibold tabular-nums flex-shrink-0" style={{ color }}>
                            {m.total_value.toLocaleString()}{m.metric_type === 'percentage' ? '%' : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-[11px] text-secondary-400 mt-2">None yet</p>
                )}
              </div>
            </Link>
          </motion.div>

          <motion.div variants={fadeUp}>
            <Link to="/share/public" className="app-card-interactive p-4 h-full flex gap-3">
              <div className={`app-icon-tile ${o?.is_public ? 'bg-impact-50 text-impact-700' : 'bg-amber-50 text-amber-700'}`}>
                <Globe className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
                    {o?.is_public && (
                      <span className="absolute inset-0 rounded-full bg-impact-400 animate-ping opacity-50" />
                    )}
                    <span className={`relative h-1.5 w-1.5 rounded-full ${o?.is_public ? 'bg-impact-500' : 'bg-amber-400'}`} />
                  </span>
                  <p className="text-sm font-semibold text-secondary-900">
                    {o?.is_public ? 'Public page live' : 'Public page not live'}
                  </p>
                </div>
                <p className="text-xs text-secondary-500 mt-2 leading-relaxed">
                  {o?.is_public ? 'Visitors can see the work you tracked.' : 'Publish when there is something to show.'}
                </p>
              </div>
            </Link>
          </motion.div>
        </motion.div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            className="lg:col-span-4 flex flex-col min-h-0 gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.08 }}
          >
            <AppCard padded className="flex flex-col min-h-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 mb-3 flex-shrink-0">
                <h2 className="app-card-title">Next steps</h2>
              </div>
              {proveNext.length === 0 && shareNext.length === 0 ? (
                <div className="flex-1 flex flex-col justify-center py-6">
                  <p className="text-sm font-medium text-secondary-800">You are set</p>
                  <p className="text-xs text-secondary-500 mt-1 mb-4">Tracking and sharing look complete.</p>
                  <Link to="/tracking/initiatives" className="app-btn app-btn-primary app-btn-sm w-fit">Open tracking</Link>
                </div>
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
                  {proveNext.length > 0 && (
                    <div>
                      <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wide text-primary-800">Tracking</p>
                      <NextStepList items={proveNext} tone="tracking" />
                    </div>
                  )}
                  {shareNext.length > 0 && (
                    <div>
                      <p className="px-2 mb-1 text-[11px] font-bold uppercase tracking-wide text-claim-700">Share</p>
                      <NextStepList items={shareNext} tone="share" />
                    </div>
                  )}
                </div>
              )}
            </AppCard>

            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              <Link to="/tracking/initiatives" className="app-card p-3 hover:border-primary-200 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <ProgressRing pct={provePct} stroke="#789a59" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-primary-800">Tracking</p>
                    <p className="text-[11px] tabular-nums text-secondary-400">{proveChecks.filter(c => c.done).length}/{proveChecks.length}</p>
                  </div>
                </div>
                <ProgressBar pct={provePct} />
              </Link>
              <Link to="/share/public" className="app-card p-3 hover:border-claim-200 transition-colors">
                <div className="flex items-center gap-2.5 mb-2">
                  <ProgressRing pct={sharePct} stroke="#97C7CB" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-claim-700">Share</p>
                    <p className="text-[11px] tabular-nums text-secondary-400">{shareChecks.filter(c => c.done).length}/{shareChecks.length}</p>
                  </div>
                </div>
                <ProgressBar pct={sharePct} />
              </Link>
            </div>
          </motion.div>

          <motion.div
            className="lg:col-span-8 flex flex-col min-h-0"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut, delay: 0.12 }}
          >
            <div className="relative isolate flex-1 min-h-[220px] rounded-xl overflow-hidden border border-gray-200/80 shadow-card">
              <LocationMap
                locations={locations}
                onLocationClick={(loc) => {
                  const id = loc.initiative_id || loc.initiative_ids?.[0]
                  if (id) navigate(`/initiatives/${id}?tab=location`)
                }}
                hideEmptyBanner
                autoFit
              />
            </div>
            <div className="flex items-center gap-2 mt-2.5 min-h-8 flex-shrink-0">
              <h2 className="app-section-title">Your locations</h2>
              <Link to="/locations" className="ml-auto text-xs font-medium text-primary-700 hover:text-primary-800">
                {locations.length} location{locations.length === 1 ? '' : 's'}
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
