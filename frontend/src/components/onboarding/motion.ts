import type { Variants, Transition } from 'framer-motion'

/**
 * Shared motion language for the setup/onboarding flow.
 * "Minimalist Modern" easing — confident, smooth, never bouncy.
 */
export const easeOut = [0.16, 1, 0.3, 1] as const

export const spring: Transition = { type: 'spring', stiffness: 380, damping: 30, mass: 0.7 }

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
}

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease: easeOut } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
}

export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.06 } },
}

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

/** Directional step transition for the wizard body. */
export const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 36 : -36 }),
  center: { opacity: 1, x: 0, transition: { duration: 0.42, ease: easeOut } },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -36 : 36, transition: { duration: 0.28, ease: easeOut } }),
}

/** Chat bubble entrance — user bubbles drift from the right, AI from the left. */
export const bubbleVariants = {
  hidden: (fromUser: boolean) => ({ opacity: 0, y: 14, x: fromUser ? 18 : -18, scale: 0.96 }),
  visible: { opacity: 1, y: 0, x: 0, scale: 1, transition: { duration: 0.45, ease: easeOut } },
}
