import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { stepVariants, easeOut } from './motion'
import { useOnboarding } from '../../context/OnboardingContext'
import { useTeam } from '../../context/TeamContext'
import { useOnboardingDraft } from './useOnboardingDraft'
import ModeChooserStep from './steps/ModeChooserStep'
import ChatStep from './steps/ChatStep'
import CharityDescriptionStep from './steps/CharityDescriptionStep'
import TheoryOfChangeStep from './steps/TheoryOfChangeStep'
import LocationsStep from './steps/LocationsStep'
import InitiativesStep from './steps/InitiativesStep'
import SetupInitiativesStep from './steps/SetupInitiativesStep'
import ReviewStep from './steps/ReviewStep'
import './onboarding.css'

type Mode = 'choose' | 'manual' | 'chat'

const MANUAL_STEPS = [
  { railLabel: 'About you' },
  { railLabel: 'Theory of change' },
  { railLabel: 'Locations' },
  { railLabel: 'Initiatives' },
  { railLabel: 'Metrics & groups' },
  { railLabel: 'Review' },
]
const LAST = MANUAL_STEPS.length - 1

export default function OnboardingWizard() {
  const { isActive, completeOnboarding, pauseOnboarding } = useOnboarding()
  const { ownedOrganization, activeOrganization } = useTeam()
  const org = ownedOrganization || activeOrganization
  const orgId = org?.id ?? null
  const orgName = org?.name
  const draftApi = useOnboardingDraft()

  const [mode, setMode] = useState<Mode>('choose')
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

  const goManual = () => { setDir(1); setMode('manual'); setStep(0) }
  const goChat = () => setMode('chat')
  const goChoose = () => { setDir(-1); setMode('choose') }

  const handleFinish = async () => {
    await completeOnboarding()
    setMode('choose'); setStep(0)
  }

  const handlePlanApplied = () => { setMode('manual'); setStep(LAST) }

  const progressPct = mode === 'manual' ? ((step + 1) / (LAST + 1)) * 100 : mode === 'chat' ? 8 : 0
  const showRail = mode === 'manual'

  const renderManualStep = (i: number) => {
    switch (i) {
      case 0: return <CharityDescriptionStep orgId={orgId} draftApi={draftApi} />
      case 1: return <TheoryOfChangeStep />
      case 2: return <LocationsStep draftApi={draftApi} />
      case 3: return <InitiativesStep draftApi={draftApi} />
      case 4: return <SetupInitiativesStep draftApi={draftApi} />
      case 5: return <ReviewStep draftApi={draftApi} onNavigate={pauseOnboarding} />
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
            <p className="onboarding-rail-title">Your progress</p>
            <nav className="space-y-0.5 flex-1">
              {MANUAL_STEPS.map((s, index) => {
                const done = index < step
                const current = index === step
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => goStep(index)}
                    className={`onboarding-rail-item ${
                      current ? 'onboarding-rail-item--current'
                      : done ? 'onboarding-rail-item--done'
                      : 'onboarding-rail-item--upcoming'
                    }`}
                  >
                    <span className={`onboarding-rail-dot ${
                      current ? 'onboarding-rail-dot--current'
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
              <button type="button" onClick={goChoose} className="app-btn app-btn-secondary app-btn-sm">
                <ChevronLeft className="w-4 h-4" /> Options
              </button>
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
