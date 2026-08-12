import type { Transition, Variants } from 'framer-motion'

/** Shared motion for the PWA shell — short, restrained, desktop-adjacent. */
export const easeOut = [0.16, 1, 0.3, 1] as const

export const springSoft: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 40,
}

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 620,
  damping: 34,
}

export const tapScale = { scale: 0.94 }
export const tapScaleSoft = { scale: 0.98 }

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.02 } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeOut },
  },
}

export const sheetBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
}

export const sheetPanel = {
  initial: { y: '100%' },
  animate: { y: 0, transition: springSoft },
  exit: { y: '100%', transition: { duration: 0.2, ease: easeOut } },
}

export const dropdownPop = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.16, ease: easeOut },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.97,
    transition: { duration: 0.12, ease: easeOut },
  },
}
