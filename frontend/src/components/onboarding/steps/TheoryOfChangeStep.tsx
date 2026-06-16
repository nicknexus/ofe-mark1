import React from 'react'
import { Compass } from 'lucide-react'
import StepHeader from '../StepHeader'

/**
 * Placeholder slot for the Theory of Change step. Reserved at the beginning of
 * the flow so it can be built out later (writing problem_statement +
 * theory_of_change + theory_of_change_stages via updateOrgContext) without
 * re-sequencing the wizard. For now it is purely informational and skippable.
 */
export default function TheoryOfChangeStep() {
  return (
    <div>
      <StepHeader
        icon={Compass}
        title="Theory of Change"
        subtitle="Coming soon"
        pill="Optional"
        description="Soon you'll map your problem statement and the stages of change your work drives — right here in setup."
      />

      <div className="onboarding-empty max-w-2xl">
        <span className="onboarding-empty-icon"><Compass className="w-5 h-5" /></span>
        <p className="onboarding-empty-text">
          This step isn't ready yet. You can set up your Theory of Change anytime from the
          <span className="font-medium text-secondary-700"> Context</span> page. Hit <span className="font-medium text-secondary-700">Next</span> to keep going.
        </p>
      </div>
    </div>
  )
}
