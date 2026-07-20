import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, animate } from "framer-motion";

interface AnimatedNumberProps {
  /** Final numeric value to count up to. */
  value: number;
  /** Digits after the decimal point. Defaults to 0. */
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Duration of the count-up in seconds. */
  duration?: number;
  className?: string;
  /** Insert thousands separators (e.g. 7,940). Defaults to true. */
  separator?: boolean;
}

/**
 * Counts up from 0 to `value` the first time it scrolls into view.
 * Falls back to the final value immediately for reduced-motion users.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 1.6,
  className,
  separator = true,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const motionValue = useMotionValue(0);
  const reduceMotion = useReducedMotion();

  const format = (n: number) => {
    const fixed = n.toFixed(decimals);
    if (!separator) return `${prefix}${fixed}${suffix}`;
    const [intPart, decPart] = fixed.split(".");
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${prefix}${decPart ? `${withSep}.${decPart}` : withSep}${suffix}`;
  };

  useEffect(() => {
    if (!ref.current) return;
    if (reduceMotion || !inView) {
      if (ref.current) ref.current.textContent = format(reduceMotion ? value : 0);
      if (reduceMotion) return;
    }
    if (!inView) return;
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        if (ref.current) ref.current.textContent = format(latest);
      },
    });
    return controls.stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduceMotion]);

  return <span ref={ref} className={className}>{format(0)}</span>;
}
