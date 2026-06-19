import React from 'react'
import { Sparkles, ArrowRight, Building2, Target } from 'lucide-react'

interface Props {
  orgName?: string
  onGetStarted: () => void
  onSkip: () => void
}

/**
 * Full-screen welcome shown first in the manual setup flow. Sets expectations
 * for the two parts (account, then initiatives) before dropping into the steps.
 */
export default function WelcomeStep({ orgName, onGetStarted, onSkip }: Props) {
  return (
    <div className="onboarding-welcome">
      <div className="onboarding-welcome-icon">
        <Sparkles className="w-7 h-7" />
      </div>

      <h1 className="onboarding-welcome-title">
        {orgName ? `Welcome, ${orgName}` : 'Welcome'}
      </h1>
      <p className="onboarding-welcome-sub">
        Let's get you set up in two quick parts. It only takes a few minutes, and you can skip
        anything you're not ready for.
      </p>

      <div className="onboarding-welcome-parts">
        <div className="onboarding-welcome-part">
          <span className="onboarding-welcome-part-num"><Building2 className="w-4 h-4" /></span>
          <div>
            <p className="onboarding-welcome-part-title">Account setup</p>
            <p className="onboarding-welcome-part-desc">Your description, branding and logo</p>
          </div>
        </div>
        <div className="onboarding-welcome-part">
          <span className="onboarding-welcome-part-num"><Target className="w-4 h-4" /></span>
          <div>
            <p className="onboarding-welcome-part-title">Initiative setup</p>
            <p className="onboarding-welcome-part-desc">Locations, initiatives and metrics</p>
          </div>
        </div>
      </div>

      <button type="button" onClick={onGetStarted} className="app-btn app-btn-primary app-btn-lg onboarding-welcome-cta">
        Get started <ArrowRight className="w-4 h-4" />
      </button>
      <button type="button" onClick={onSkip} className="onboarding-welcome-skip">
        Skip setup for now
      </button>
    </div>
  )
}
