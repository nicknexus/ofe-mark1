import type { Variants, Transition } from "framer-motion";

/**
 * Shared motion language for the marketing / landing surface.
 * "Confident, smooth, never bouncy" — matches the onboarding easing so the
 * public site and the app feel like one product.
 */
export const easeOut = [0.16, 1, 0.3, 1] as const;

export const spring: Transition = {
  type: "spring",
  stiffness: 340,
  damping: 30,
  mass: 0.8,
};

/** Snappier spring for hover / pointer-driven interactions. */
export const hoverSpring: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 22,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: easeOut } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.7, ease: easeOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
};

/** Container that reveals its children one after another. */
export const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

/** Shared viewport config so every section reveals with the same feel. */
export const viewportOnce = { once: true, amount: 0.25 } as const;
