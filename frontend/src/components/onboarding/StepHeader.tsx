import React from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, stagger } from './motion'

interface StepHeaderProps {
  icon: React.ComponentType<any>
  /** Big green gradient word(s) — sole headline when `title` is omitted. */
  headline?: string
  title?: string
  subtitle?: string
  description?: string
  pill?: string
}

/** Splits inline title so the final word(s) get the signature gradient treatment. */
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(' ')
  if (words.length <= 2) return ['', title]
  const accent = words.slice(-2).join(' ')
  const lead = words.slice(0, -2).join(' ')
  return [lead, accent]
}

/** Last word gets gradient; earlier words stay dark ink. */
function splitHeadline(text: string): [string, string] {
  const words = text.trim().split(' ')
  if (words.length <= 1) return ['', text]
  return [words.slice(0, -1).join(' '), words[words.length - 1]]
}

export default function StepHeader({ icon: Icon, headline, title, description }: StepHeaderProps) {
  const [lead, accent] = splitTitle(title ?? '')
  const [headlineLead, headlineAccent] = splitHeadline(headline ?? '')

  if (headline) {
    return (
      <motion.div
        className="onboarding-step-header onboarding-step-header--hero"
        variants={stagger}
        initial="hidden"
        animate="visible"
      >
        <motion.h1 variants={fadeInUp} className="onboarding-step-hero-headline">
          {headlineLead && <>{headlineLead} </>}
          <span className="onboarding-gradient-text">{headlineAccent}</span>
        </motion.h1>
        {title && (
          <motion.h2 variants={fadeInUp} className="onboarding-step-hero-subtitle">
            {title}
          </motion.h2>
        )}
        {description && (
          <motion.p variants={fadeInUp} className="onboarding-step-header-desc">
            {description}
          </motion.p>
        )}
      </motion.div>
    )
  }

  if (!title) return null

  return (
    <motion.div
      className="onboarding-step-header"
      variants={stagger}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp} className="onboarding-step-header-row">
        <span className="onboarding-step-header-icon">
          <Icon className="w-5 h-5" />
        </span>
        <h2 className="onboarding-step-header-title">
          {lead && <>{lead} </>}
          <span className="onboarding-gradient-text">{accent}</span>
        </h2>
      </motion.div>

      {description && (
        <motion.p variants={fadeInUp} className="onboarding-step-header-desc">
          {description}
        </motion.p>
      )}
    </motion.div>
  )
}
