import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { stepVariants, easeOut } from './motion'
import { useOnboarding } from '../../context/OnboardingContext'
import { useTeam } from '../../context/TeamContext'
import { useOnboardingDraft } from './useOnboardingDraft'
import ModeChooserStep from './steps/ModeChooserStep'
import ChatStep from './steps/ChatStep'
import WelcomeStep from './steps/WelcomeStep'
import CharityDescriptionStep from './steps/CharityDescriptionStep'
import BrandingStep from './steps/BrandingStep'
import LinksStep from './steps/LinksStep'
import InitiativeIntroStep from './steps/InitiativeIntroStep'
import LocationsStep from './steps/LocationsStep'
import InitiativesStep from './steps/InitiativesStep'
import SetupInitiativesStep from './steps/SetupInitiativesStep'
import ReviewStep from './steps/ReviewStep'
import './onboarding.css'

type Mode = 'choose' | 'welcome' | 'manual' | 'chat'

// Wordsee AI chat is built but hidden for now — launch straight into the manual
// setup (welcome → steps). Flip to `true` to re-enable the mode chooser + chat
// flow (all code for it is intact: ModeChooserStep, ChatStep, backend route).
const CHAT_ENABLED = false
const INITIAL_MODE: Mode = CHAT_ENABLED ? 'choose' : 'welcome'

// Manual setup is split into two parts shown as sections in the rail.
// `hideInRail` steps are interstitials (e.g. the Initiative setup intro) that
// still participate in the step machine but aren't listed in the rail.
const MANUAL_STEPS: { railLabel: string; section: string; hideInRail?: boolean }[] = [
  { railLabel: 'About you', section: 'Account setup' },
  { railLabel: 'Branding', section: 'Account setup' },
  { railLabel: 'Links', section: 'Account setup' },
  { railLabel: 'Overview', section: 'Initiative setup', hideInRail: true },
  { railLabel: 'Locations', section: 'Initiative setup' },
  { railLabel: 'Initiatives', section: 'Initiative setup' },
  { railLabel: 'Metrics & groups', section: 'Initiative setup' },
  { railLabel: 'Review', section: 'Initiative setup' },
]
const SECTIONS = ['Account setup', 'Initiative setup']
const LAST = MANUAL_STEPS.length - 1

export default function OnboardingWizard() {
  const { isActive, completeOnboarding, pauseOnboarding } = useOnboarding()
  const { ownedOrganization, activeOrganization } = useTeam()
  const org = ownedOrganization || activeOrganization
  const orgId = org?.id ?? null
  const orgName = org?.name
  const draftApi = useOnboardingDraft()

  const [mode, setMode] = useState<Mode>(INITIAL_MODE)
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)

  useEffect(() => {
    document.getElementById('onboarding-body')?.scrollTo({ top: 0 })
  }, [step, mode])

  useEffect(() => {
    if (!isActive) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') pauseOnboarding() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isActive, pauseOnboarding])

  if (!isActive) return null

  const isLast = step === LAST
  const next = () => { setDir(1); setStep(s => Math.min(s + 1, LAST)) }
  const back = () => { setDir(-1); setStep(s => Math.max(s - 1, 0)) }
  const goStep = (i: number) => { setDir(i > step ? 1 : -1); setStep(i) }

  const goManual = () => { setDir(1); setMode('welcome'); setStep(0) }
  const startSteps = () => { setDir(1); setMode('manual'); setStep(0) }
  const goChat = () => setMode('chat')
  const goChoose = () => { setDir(-1); setMode('choose') }

  const handleFinish = async () => {
    await completeOnboarding()
    setMode(INITIAL_MODE); setStep(0)
  }

  const handlePlanApplied = () => { setMode('manual'); setStep(LAST) }

  const progressPct = mode === 'manual' ? ((step + 1) / (LAST + 1)) * 100 : mode === 'chat' ? 8 : 0
  const showRail = mode === 'manual'

  const renderManualStep = (i: number) => {
    switch (i) {
      case 0: return <CharityDescriptionStep orgId={orgId} draftApi={draftApi} />
      case 1: return <BrandingStep orgId={orgId} orgName={orgName} />
      case 2: return <LinksStep orgId={orgId} />
      case 3: return <InitiativeIntroStep />
      case 4: return <LocationsStep draftApi={draftApi} />
      case 5: return <InitiativesStep draftApi={draftApi} />
      case 6: return <SetupInitiativesStep draftApi={draftApi} />
      case 7: return <ReviewStep draftApi={draftApi} onNavigate={pauseOnboarding} />
      default: return null
    }
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
        {showRail && (
          <aside className="onboarding-rail hidden lg:flex">
            <div className="onboarding-rail-brand">
              <img src="/Nexuslogo.png" alt="" className="w-5 h-5 object-contain" />
              <span className="onboarding-rail-brand-mark">Setup</span>
            </div>
            <nav className="space-y-4 flex-1">
              {SECTIONS.map((section, si) => (
                <div key={section}>
                  <p className="onboarding-rail-title">
                    <span className="onboarding-rail-section-num">{si + 1}</span>
                    {section}
                  </p>
                  <div className="space-y-0.5">
                    {MANUAL_STEPS.map((s, index) => {
                      if (s.section !== section || s.hideInRail) return null
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
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        )}

        <main id="onboarding-body" className={`onboarding-main ${mode === 'chat' ? 'onboarding-main--chat' : ''}`}>
          {mode === 'chat' ? (
            <ChatStep
              orgId={orgId}
              orgName={orgName}
              draftApi={draftApi}
              onPlanApplied={handlePlanApplied}
              onBackToOptions={goChoose}
              onSkip={completeOnboarding}
            />
          ) : mode === 'welcome' ? (
            <WelcomeStep orgName={orgName} onGetStarted={startSteps} onSkip={completeOnboarding} />
          ) : (
            <div className="onboarding-step-inner">
              <div className="onboarding-step-body">
                <AnimatePresence mode="wait" custom={dir} initial={false}>
                  <motion.div
                    key={mode === 'manual' ? `manual-${step}` : 'choose'}
                    custom={dir}
                    variants={stepVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                  >
                    {mode === 'choose' && (
                      <ModeChooserStep onChooseChat={goChat} onChooseManual={goManual} />
                    )}
                    {mode === 'manual' && renderManualStep(step)}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>

      {mode === 'manual' && (
        <nav className="onboarding-nav" aria-label="Setup navigation">
          <div>
            {step === 0 ? (
              CHAT_ENABLED ? (
                <button type="button" onClick={goChoose} className="app-btn app-btn-secondary app-btn-sm">
                  <ChevronLeft className="w-4 h-4" /> Options
                </button>
              ) : <div />
            ) : (
              <button type="button" onClick={back} className="app-btn app-btn-secondary app-btn-sm">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isLast && (
              <button type="button" onClick={completeOnboarding} className="text-sm text-secondary-400 hover:text-secondary-700 transition-colors hidden sm:block px-1 py-2">
                Skip for now
              </button>
            )}
            {isLast ? (
              <button type="button" onClick={handleFinish} className="app-btn app-btn-primary">
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
