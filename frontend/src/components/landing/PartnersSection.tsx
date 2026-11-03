import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Reveal } from "./Reveal";

interface Partner {
  name: string;
  /** Path under /public (e.g. "/partners/acme.svg") or absolute URL. */
  logo: string;
  url?: string;
}

const partners: Partner[] = [
  { name: "AvoMotion", logo: "/partners/avomotion.png" },
  { name: "Richard C. Peck, The Philanthropy Guy", logo: "/partners/richard-c-peck.webp" },
  { name: "IPAR, Independent Philanthropy Advisor Referral Group", logo: "/partners/ipar.webp" },
  { name: "Generosity Collective", logo: "/partners/generosity-collective.png" },
  { name: "Philanthropy Fuel", logo: "/partners/philanthropy-fuel.webp" },
];

// Each half of the track must be wider than the viewport for a seamless loop.
const REPEATS = 2;
const half = Array.from({ length: REPEATS }, () => partners).flat();
const track = [...half, ...half];

/** Seconds for one half of the track to pass at full speed. */
const LOOP_SECONDS = 34;
/** Speed multiplier while hovered. */
const HOVER_SPEED = 0.2;
/** Easing time constant for speed changes (seconds). */
const SPEED_EASE = 0.45;

/**
 * Drives the marquee with rAF so hover can ease the speed down/up instead of
 * the hard stop a CSS animation-play-state toggle gives.
 */
function useMarquee() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const hoveredRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const viewport = viewportRef.current;
    const trackEl = trackRef.current;
    if (!viewport || !trackEl || reduceMotion) return;

    let halfWidth = trackEl.scrollWidth / 2;
    const ro = new ResizeObserver(() => {
      halfWidth = trackEl.scrollWidth / 2;
    });
    ro.observe(trackEl);

    let offset = 0;
    let speed = 1;
    let last = 0;
    let raf = 0;
    let running = false;

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
      last = now;
      const target = hoveredRef.current ? HOVER_SPEED : 1;
      speed += (target - speed) * (1 - Math.exp(-dt / SPEED_EASE));
      if (halfWidth > 0) {
        offset = (offset + (halfWidth / LOOP_SECONDS) * speed * dt) % halfWidth;
        trackEl.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running) return;
      running = true;
      last = 0;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // No frames while off screen.
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    io.observe(viewport);

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
    };
  }, [reduceMotion]);

  return {
    viewportRef,
    trackRef,
    onPointerEnter: () => {
      hoveredRef.current = true;
    },
    onPointerLeave: () => {
      hoveredRef.current = false;
    },
  };
}

const PartnerCard = ({ partner, hidden }: { partner: Partner; hidden: boolean }) => {
  const body = (
    <div className="w-[260px] h-[120px] shrink-0 mr-4 flex items-center justify-center bg-white rounded-2xl border border-border px-8 py-6 transition-colors hover:border-accent/40">
      <img
        src={partner.logo}
        alt={hidden ? "" : partner.name}
        loading="lazy"
        draggable={false}
        className="max-h-full max-w-full object-contain"
      />
    </div>
  );

  if (!partner.url) return body;
  return (
    <a
      href={partner.url}
      target="_blank"
      rel="noopener noreferrer"
      tabIndex={hidden ? -1 : undefined}
    >
      {body}
    </a>
  );
};

const PartnersSection = () => {
  const marquee = useMarquee();

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <Reveal className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-4">
            Partner network
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-foreground mb-4 leading-tight">
            Priority access.
          </h2>
          <p className="text-lg text-foreground/70 leading-relaxed">
            Charities on Nexus unlock exclusive access to our partners the moment they sign on.
          </p>
        </Reveal>
      </div>

      <Reveal direction="fade">
        <div
          ref={marquee.viewportRef}
          onPointerEnter={marquee.onPointerEnter}
          onPointerLeave={marquee.onPointerLeave}
          className="relative overflow-hidden"
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-32 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-32 bg-gradient-to-l from-background to-transparent" />

          <ul
            ref={marquee.trackRef}
            aria-label="Nexus partners"
            className="flex w-max py-2 will-change-transform"
          >
            {track.map((partner, i) => {
              const hidden = i >= partners.length;
              return (
                <li key={`${partner.name}-${i}`} aria-hidden={hidden || undefined}>
                  <PartnerCard partner={partner} hidden={hidden} />
                </li>
              );
            })}
          </ul>
        </div>
      </Reveal>
    </section>
  );
};

export default PartnersSection;
