import type { Variants } from 'framer-motion'

/**
 * Motion language for the Timeline tab. Deliberately restrained — short
 * durations, confident easing, no bounce — so the SaaS chrome feels alive
 * without getting in the way of a dense operational view.
 */
export const easeOut = [0.16, 1, 0.3, 1] as const

/** Parent for lightly staggered lists (stat cards, filter row). */
export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}

/** Standard fade-up used by cards and section blocks. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: easeOut } },
}

/** AnimatePresence config for swapping between Claims/Evidence/Connections. */
export const viewSwap = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: easeOut } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.16, ease: easeOut } },
}

/** Portal dropdown pop (add menu, filter pills). */
export const dropdownPop = {
  initial: { opacity: 0, y: -6, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: easeOut } },
  exit: { opacity: 0, y: -6, scale: 0.97, transition: { duration: 0.12, ease: easeOut } },
}

/**
 * Per-row entrance for table lists. Delay is capped so long lists don't
 * cascade forever — the first dozen rows feel staggered, the rest snap in.
 */
export const rowEntrance = (index: number) => ({
  initial: { opacity: 0, y: 6 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeOut, delay: Math.min(index * 0.03, 0.36) },
  },
})
