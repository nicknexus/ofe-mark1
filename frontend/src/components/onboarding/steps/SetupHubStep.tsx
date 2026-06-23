import React from 'react'
import { motion } from 'framer-motion'
import { Building2, Target, ArrowRight, Check } from 'lucide-react'
import { fadeInUp, stagger } from '../motion'

interface Props {
  completed: { account: boolean; initiative: boolean }
  onSelect: (track: 'account' | 'initiative') => void
  onFinish: () => void
}

export default function SetupHubStep({ completed, onSelect, onFinish }: Props) {
  return (
    <motion.div className="onboarding-hero" variants={stagger} initial="hidden" animate="visible">
      <div className="onboarding-hero-copy">
        <motion.h1 variants={fadeInUp} className="onboarding-hero-title">
          Set up your <span className="onboarding-gradient-text">account</span>
        </motion.h1>

        <motion.p variants={fadeInUp} className="onboarding-hero-desc">
          Two parts to get you going. Start with your account, then set up your initiatives —
          do them in any order, and pick up where you left off anytime.
        </motion.p>

        <motion.div variants={fadeInUp} className="onboarding-mode-grid">
          <HubCard
            icon={Building2}
            title="Account setup"
            desc="Your description, branding and links."
            done={completed.account}
            onClick={() => onSelect('account')}
          />
          <HubCard
            icon={Target}
            title="Initiative setup"
            desc="Locations, initiatives, metrics and groups."
            done={completed.initiative}
            onClick={() => onSelect('initiative')}
          />
        </motion.div>

        {(completed.account || completed.initiative) && (
          <motion.button
            variants={fadeInUp}
            type="button"
            onClick={onFinish}
            className="onboarding-hero-foot onboarding-hub-finish"
          >
            I'm done for now
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

function HubCard({ icon: Icon, title, desc, done, onClick }: {
  icon: React.ComponentType<any>
  title: string
  desc: string
  done: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} className={`onboarding-mode-card group ${done ? 'onboarding-mode-card--done' : ''}`}>
      <div className="onboarding-hub-card-top">
        <div className="onboarding-step-header-icon mb-0">
          <Icon className="w-5 h-5" />
        </div>
        {done && (
          <span className="onboarding-hub-check" title="Completed">
            <Check className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      <h2 className="text-base font-semibold text-secondary-900 mb-1.5 mt-4">{title}</h2>
      <p className="text-sm text-secondary-500 leading-relaxed flex-1">{desc}</p>
      <span className="onboarding-mode-card-cta">
        {done ? 'Review or add more' : 'Start'}{' '}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
      </span>
    </button>
  )
}
