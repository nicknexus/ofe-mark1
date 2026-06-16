import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, ListChecks, ArrowRight, MessageSquareText } from 'lucide-react'
import { fadeInUp, stagger } from '../motion'

interface Props {
  onChooseChat: () => void
  onChooseManual: () => void
}

export default function ModeChooserStep({ onChooseChat, onChooseManual }: Props) {
  return (
    <motion.div className="onboarding-hero" variants={stagger} initial="hidden" animate="visible">
      {/* ── Copy column ──────────────────────────────────────────────── */}
      <div className="onboarding-hero-copy">
        <motion.h1 variants={fadeInUp} className="onboarding-hero-title">
          Let&apos;s set up your{' '}
          <span className="onboarding-gradient-text">impact tracking</span>
        </motion.h1>

        <motion.p variants={fadeInUp} className="onboarding-hero-desc">
          Two ways to begin — let WorldSee AI build it from a quick chat about your work,
          or set everything up yourself, step by step.
        </motion.p>

        <motion.div variants={fadeInUp} className="onboarding-mode-grid">
          <button
            type="button"
            onClick={onChooseChat}
            className="onboarding-mode-card onboarding-mode-card--featured group"
          >
            <div className="onboarding-step-header-icon mb-4">
              <MessageSquareText className="w-5 h-5" />
            </div>
            <div className="flex items-center gap-2 mb-1.5">
              <h2 className="text-base font-bold text-secondary-900">Chat with WorldSee AI</h2>
              <span className="app-chip app-chip-accent text-[11px] font-semibold">Fastest</span>
            </div>
            <p className="text-sm text-secondary-500 leading-relaxed flex-1">
              Tell it about your charity in plain words. It drafts your locations, initiatives and
              metrics — you review and approve before anything is created.
            </p>
            <span className="onboarding-mode-card-cta">
              Start chatting{' '}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>

          <button type="button" onClick={onChooseManual} className="onboarding-mode-card group">
            <div className="onboarding-step-header-icon mb-4">
              <ListChecks className="w-5 h-5" />
            </div>
            <h2 className="text-base font-semibold text-secondary-900 mb-1.5">Set up manually</h2>
            <p className="text-sm text-secondary-500 leading-relaxed flex-1">
              Go through it yourself, one section at a time — locations, initiatives, metrics, tags
              and groups. Full control over every detail.
            </p>
            <span className="onboarding-mode-card-cta">
              Start setup{' '}
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </span>
          </button>
        </motion.div>

        <motion.p variants={fadeInUp} className="onboarding-hero-foot">
          <Sparkles className="w-3.5 h-3.5 text-[var(--ob-accent)]" />
          You can switch modes or skip at any time
        </motion.p>
      </div>
    </motion.div>
  )
}
