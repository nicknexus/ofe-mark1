import React from 'react'
import { Target, MapPin, BarChart3, Users } from 'lucide-react'

const POINTS = [
  { icon: MapPin, title: 'Locations' },
  { icon: Target, title: 'Initiatives' },
  { icon: BarChart3, title: 'Metrics' },
  { icon: Users, title: 'Groups' },
]

/**
 * Title / explainer screen when entering the Initiative setup section.
 * Advances via the wizard's normal Next button.
 */
export default function InitiativeIntroStep() {
  return (
    <div className="onboarding-section-intro">
      <p className="onboarding-section-intro-eyebrow">Part 2 · Initiative setup</p>

      <h1 className="onboarding-section-intro-headline">
        <span className="onboarding-gradient-text">Initiatives</span>
      </h1>

      <p className="onboarding-section-intro-desc">
        An <strong>initiative</strong> is one of your programs or projects — like “Youth Training 2025” or
        “Clean Water.” Each one holds its own metrics, evidence and reports. In this part you'll add the
        places you work, create your initiatives, and define what you measure inside them.
      </p>

      <div className="onboarding-section-intro-cards">
        {POINTS.map(({ icon: Icon, title }) => (
          <div key={title} className="onboarding-section-intro-card">
            <span className="onboarding-section-intro-card-icon">
              <Icon className="w-5 h-5" />
            </span>
            <span className="onboarding-section-intro-card-title">{title}</span>
          </div>
        ))}
      </div>

      <p className="onboarding-section-intro-hint">Hit “Next” when you're ready — you can skip any step.</p>
    </div>
  )
}
