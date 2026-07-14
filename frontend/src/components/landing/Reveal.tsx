import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { fadeInUp, stagger, viewportOnce } from "./motion";

type Direction = "up" | "left" | "right" | "scale" | "fade";

const directionVariants: Record<Direction, Variants> = {
  up: fadeInUp,
  fade: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94, y: 16 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
  },
  left: {
    hidden: { opacity: 0, x: -40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  },
  right: {
    hidden: { opacity: 0, x: 40 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
  },
};

interface RevealProps {
  children: ReactNode;
  /** Entrance direction. Defaults to "up". */
  direction?: Direction;
  /** Extra delay before the reveal fires (seconds). */
  delay?: number;
  className?: string;
  /** Render as a specific element for correct semantics/layout. */
  as?: "div" | "section" | "li" | "span";
}

/**
 * Scroll-triggered reveal wrapper. Fires once when the element enters the
 * viewport. Honors `prefers-reduced-motion` automatically via framer-motion's
 * `MotionConfig` / the browser reduced-motion media query.
 */
export function Reveal({ children, direction = "up", delay = 0, className, as = "div" }: RevealProps) {
  const MotionTag = motion[as];
  const base = directionVariants[direction];
  const variants: Variants = delay
    ? {
        hidden: base.hidden,
        visible: {
          ...(base.visible as object),
          transition: { ...((base.visible as any).transition ?? {}), delay },
        },
      }
    : base;

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  /** Seconds between each child's entrance. */
  gap?: number;
  as?: "div" | "ul";
}

/**
 * Reveals its children in sequence as the group scrolls into view.
 * Pair with <StaggerItem> children (or any element using the `fadeInUp`
 * variant names "hidden"/"visible").
 */
export function StaggerGroup({ children, className, gap = 0.1, as = "div" }: StaggerGroupProps) {
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      variants={{ ...stagger, visible: { transition: { staggerChildren: gap, delayChildren: 0.05 } } }}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
    >
      {children}
    </MotionTag>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
  direction?: Direction;
  as?: "div" | "li";
}

export function StaggerItem({ children, className, direction = "up", as = "div" }: StaggerItemProps) {
  const MotionTag = motion[as];
  return (
    <MotionTag className={className} variants={directionVariants[direction]}>
      {children}
    </MotionTag>
  );
}
