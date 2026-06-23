import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { stepVariants, easeOut } from './motion'
import { useOnboarding } from '../../context/OnboardingContext'
import { useTeam } from '../../context/TeamContext'
import { useOnboardingDraft } from './useOnboardingDraft'
import { apiService } from '../../services/api'
import ModeChooserStep from './steps/ModeChooserStep'
import ChatStep from './steps/ChatStep'
import SetupHubStep from './steps/SetupHubStep'
import CharityDescriptionStep from './steps/CharityDescriptionStep'
import BrandingStep from './steps/BrandingStep'
import LinksStep from './steps/LinksStep'
import InitiativeIntroStep from './steps/InitiativeIntroStep'
import LocationsStep from './steps/LocationsStep'
import InitiativesStep from './steps/InitiativesStep'
import SetupInitiativesStep from './steps/SetupInitiativesStep'
import ReviewStep from './steps/ReviewStep'
import './onboarding.css'

type Track = 'account' | 'initiative'
// 'choose'/'chat' are only reachable when CHAT_ENABLED; default flow is hub → track.
type View = 'choose' | 'chat' | 'hub' | Track

// Wordsee AI chat is built but hidden for now. Flip to `true` to re-enable the
// mode chooser + chat flow (all code for it is intact).
const CHAT_ENABLED = false
const INITIAL_VIEW: View = CHAT_ENABLED ? 'choose' : 'hub'

const TRACK_STEPS: Record<Track, { railLabel: string; hideInRail?: boolean }[]> = {
  account: [
    { railLabel: 'About you' },
    { railLabel: 'Branding' },
    { railLabel: 'Links' },
  ],
  initiative: [
    { railLabel: 'Overview', hideInRail: true },
    { railLabel: 'Locations' },
    { railLabel: 'Initiatives' },
    { railLabel: 'Metrics & groups' },
    { railLabel: 'Review' },
  ],
}
const TRACK_TITLE: Record<Track, string> = { account: 'Account setup', initiative: 'Initiative setup' }

export default function OnboardingWizard() {
  const { isActive, completeOnboarding, pauseOnboarding } = useOnboarding()
  const { ownedOrganization, activeOrganization } = useTeam()
  const org = ownedOrganization || activeOrganization
  const orgId = org?.id ?? null
  const orgName = org?.name
  const draftApi = useOnboardingDraft()
  const { hydrate } = draftApi

  const [view, setView] = useState<View>(INITIAL_VIEW)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [completed, setCompleted] = useState({ account: false, initiative: false })
  const hydratedFor = useRef<string | null>(null)

  // Hydrate existing org data once per activation so re-opening setup shows
  // prior work (with those items locked, create-only).
  useEffect(() => {
    if (!isActive || !orgId || hydratedFor.current === orgId) return
    hydratedFor.current = orgId
    let cancelled = false
    ;(async () => {
      try {
        const [organization, initiatives, kpis, groups, locations] = await Promise.all([
          apiService.getOrganization(orgId).catch(() => null),
          apiService.getInitiatives().catch(() => []),
          apiService.getKPIs().catch(() => []),
          apiService.getBeneficiaryGroups().catch(() => []),
          apiService.getLocations().catch(() => []),
        ])
        if (cancelled) return

        const metricsByInitiative: Record<string, any[]> = {}
        const groupsByInitiative: Record<string, any[]> = {}
        initiatives.forEach(i => { if (i.id) { metricsByInitiative[i.id] = []; groupsByInitiative[i.id] = [] } })
        kpis.forEach(k => { if (k.initiative_id) (metricsByInitiative[k.initiative_id] ||= []).push(k) })
        groups.forEach(g => { if (g.initiative_id) (groupsByInitiative[g.initiative_id] ||= []).push(g) })

        hydrate({
          description: organization?.description || '',
          statement: organization?.statement || '',
          locations,
          initiatives,
          metricsByInitiative,
          groupsByInitiative,
        })

        // Reflect what's already there as completed on the hub.
        const accountDone = !!(organization?.description || organization?.statement || organization?.logo_url || organization?.brand_color || organization?.website_url || organization?.donation_url)
        setCompleted({ account: accountDone, initiative: initiatives.length > 0 })
      } catch { /* non-fatal — start empty */ }
    })()
    return () => { cancelled = true }
  }, [isActive, orgId, hydrate])

  // When the wizard closes, reset so re-opening always lands on the selection
  // hub (not wherever you left off) and re-pulls fresh data.
  useEffect(() => {
    if (!isActive) {
      hydratedFor.current = null
      setView(INITIAL_VIEW)
      setStep(0)
      setDir(1)
    }
  }, [isActive])

  useEffect(() => {
    document.getElementById('onboarding-body')?.scrollTo({ top: 0 })
  }, [step, view])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') pauseOnboarding() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, pauseOnboarding])

  if (!isActive) return null

  const isTrack = view === 'account' || view === 'initiative'
  const track = isTrack ? (view as Track) : null
  const steps = track ? TRACK_STEPS[track] : []
  const lastStep = steps.length - 1
  const isLastStep = step === lastStep

  const next = () => { setDir(1); setStep(s => Math.min(s + 1, lastStep)) }
  const back = () => { setDir(-1); setStep(s => Math.max(s - 1, 0)) }
  const goStep = (i: number) => { setDir(i > step ? 1 : -1); setStep(i) }

  const goHub = () => { setDir(-1); setView('hub'); setStep(0) }
  const selectTrack = (t: Track) => { setDir(1); setView(t); setStep(0) }

  // Finishing the account track returns to the hub with a check; finishing the
  // initiative track completes onboarding.
  const finishAccount = () => { setCompleted(c => ({ ...c, account: true })); goHub() }
  const completeAll = async () => { await completeOnboarding() }

  const progressPct = isTrack ? ((step + 1) / steps.length) * 100 : 0
  const showRail = isTrack

  const renderTrackStep = () => {
    if (track === 'account') {
      switch (step) {
        case 0: return <CharityDescriptionStep orgId={orgId} draftApi={draftApi} />
        case 1: return <BrandingStep orgId={orgId} orgName={orgName} />
        case 2: return <LinksStep orgId={orgId} />
      }
    }
    if (track === 'initiative') {
      switch (step) {
        case 0: return <InitiativeIntroStep />
        case 1: return <LocationsStep draftApi={draftApi} />
        case 2: return <InitiativesStep draftApi={draftApi} />
        case 3: return <SetupInitiativesStep draftApi={draftApi} />
        case 4: return <ReviewStep draftApi={draftApi} onNavigate={pauseOnboarding} />
      }
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

      <button
        type="button"
        onClick={pauseOnboarding}
        className="onboarding-close app-btn app-btn-icon app-btn-ghost shadow-card"
        title="Close (resume later)"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="onboarding-layout">
        {showRail && track && (
          <aside className="onboarding-rail hidden lg:flex">
            <button type="button" onClick={goHub} className="onboarding-rail-brand onboarding-rail-back" title="Back to setup menu">
              <ChevronLeft className="w-4 h-4 text-secondary-400" />
              <span className="onboarding-rail-brand-mark">Setup menu</span>
            </button>
            <p className="onboarding-rail-title">{TRACK_TITLE[track]}</p>
            <nav className="space-y-0.5 flex-1">
              {steps.map((s, index) => {
                if (s.hideInRail) return null
                const done = index < step
                const current = index === step
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goStep(index)}
                    className={`onboarding-rail-item ${current ? 'onboarding-rail-item--current'
                        : done ? 'onboarding-rail-item--done'
                          : 'onboarding-rail-item--upcoming'
                      }`}
                  >
                    <span className={`onboarding-rail-dot ${current ? 'onboarding-rail-dot--current'
                        : done ? 'onboarding-rail-dot--done'
                          : 'onboarding-rail-dot--upcoming'
                      }`}>
                      {done ? <Check className="w-3 h-3" /> : index + 1}
                    </span>
                    <span className="truncate">{s.railLabel}</span>
                  </button>
                )
              })}
            </nav>
          </aside>
        )}

        <main id="onboarding-body" className={`onboarding-main ${view === 'chat' ? 'onboarding-main--chat' : ''}`}>
          {view === 'chat' ? (
            <ChatStep
              orgId={orgId}
              orgName={orgName}
              draftApi={draftApi}
              onPlanApplied={() => { setView('initiative'); setStep(TRACK_STEPS.initiative.length - 1) }}
              onBackToOptions={() => setView('choose')}
              onSkip={completeOnboarding}
            />
          ) : (
            <div className="onboarding-step-inner">
              <div className="onboarding-step-body">
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div
                    key={isTrack ? `${view}-${step}` : view}
                    custom={dir}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {view === 'choose' && (
                      <ModeChooserStep onChooseChat={() => setView('chat')} onChooseManual={() => setView('hub')} />
                    )}
                    {view === 'hub' && (
                      <SetupHubStep completed={completed} onSelect={selectTrack} onFinish={completeAll} />
                    )}
                    {isTrack && renderTrackStep()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>

      {isTrack && (
        <nav className="onboarding-nav" aria-label="Setup navigation">
          <div>
            {step === 0 ? (
              <button type="button" onClick={goHub} className="app-btn app-btn-secondary app-btn-sm">
                <ChevronLeft className="w-4 h-4" /> Menu
              </button>
            ) : (
              <button type="button" onClick={back} className="app-btn app-btn-secondary app-btn-sm">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {track === 'account' ? (
              isLastStep ? (
                <button type="button" onClick={finishAccount} className="app-btn app-btn-primary">
                  Done <Check className="w-4 h-4" />
                </button>
              ) : (
                <button type="button" onClick={next} className="app-btn app-btn-primary">
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              )
            ) : isLastStep ? (
              <button type="button" onClick={completeAll} className="app-btn app-btn-primary">
                Finish & start adding data <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button type="button" onClick={next} className="app-btn app-btn-primary">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>
      )}
    </motion.div>
  )
}
