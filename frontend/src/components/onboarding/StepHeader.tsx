import React from 'react'
import { motion } from 'framer-motion'
import { fadeInUp, stagger } from './motion'

interface StepHeaderProps {
  icon: React.ComponentType<any>
  title: string
  subtitle?: string
  description?: string
  pill?: string
}

/** Splits the title so the final word(s) get the signature gradient treatment. */
function splitTitle(title: string): [string, string] {
  const words = title.trim().split(' ')
  if (words.length <= 2) return ['', title]
  const accent = words.slice(-2).join(' ')
  const lead = words.slice(0, -2).join(' ')
  return [lead, accent]
}

export default function StepHeader({ icon: Icon, title, description }: StepHeaderProps) {
  const [lead, accent] = splitTitle(title)
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
