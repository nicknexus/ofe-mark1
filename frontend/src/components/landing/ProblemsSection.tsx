import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "../ui/button";
import { ArrowRight, Check, Heart } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { easeOut, spring, viewportOnce } from "./motion";

function useDesktopSwap() {
  const [enabled, setEnabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return enabled;
}

/** Progress 0→1 while the pin runway scrolls through the viewport. */
function usePinProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const next = Math.min(1, Math.max(0, -rect.top / total));
      setProgress(next);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);

  return progress;
}

interface ProblemsSectionProps {
  onGetStarted?: () => void;
}

const painPoints = [
  {
    number: 1,
    title: "Impact gets lost.",
    description:
      "Capturing moments and evidence is slow, inconsistent, and easy to avoid.",
    footer: "Inconsistent. Incomplete. Easy to lose.",
    image: "/before%201.png",
  },
  {
    number: 2,
    title: "Proof gets buried.",
    description:
      "Progress is scattered across folders, spreadsheets, emails, and disconnected systems.",
    footer: "Hard to find. Hard to trust. Hard to prove.",
    image: "/before%202.png",
  },
  {
    number: 3,
    title: "Supporters stay disconnected.",
    description:
      "People receive reports and numbers, but cannot explore or experience the impact they helped create.",
    footer: "Reports inform. Experiences don't connect.",
    image: "/before%203.png",
  },
];

const solutionPoints = [
  {
    number: 1,
    title: "Plug In & Capture",
    description: "Plug in what you already have and capture impact easier.",
    footer: "Simple. Consistent. Easy.",
    image: "/after%201.png",
  },
  {
    number: 2,
    title: "Nexus Connects",
    description: "Everything in one consolidated location.",
    footer: "Connected. Clear. Navigable.",
    image: "/after%202.png",
  },
  {
    number: 3,
    title: "Supporters Experience Change",
    description: "From reports to a livable impact experience.",
    footer: "Reports inform. Real moments connect.",
    image: "/after%203.png",
  },
];

const ladder = [
  {
    step: 1,
    title: "Invisible",
    points: ["Nothing is tracked", "Impact goes unrecorded", "No proof exists"],
  },
  {
    step: 2,
    title: "Scattered",
    badge: "Where most are",
    tone: "warning" as const,
    points: [
      "Tracking is inconsistent",
      "Proof can't be trusted",
      "The org doesn't know its own details",
    ],
  },
  {
    step: 3,
    title: "Organized",
    points: [
      "Tracked and recorded, but scattered across systems",
      "Shares Impact reports and limited media postings",
      "Most life-changing moments slip through",
    ],
  },
  {
    step: 4,
    title: "Broadcasting",
    points: [
      "Data is tracked and well managed",
      "People only see what gets broadcast",
      "Anything deeper means asking the org directly",
    ],
  },
  {
    step: 5,
    title: "Full Experience & Trust",
    badge: "This is us",
    tone: "accent" as const,
    points: [
      "Every stakeholder can explore it themselves",
      "Every impact backed by story and evidence",
      "All in one place, open to everyone",
    ],
  },
];

type CardPoint = (typeof painPoints)[number];

function PointCard({
  point,
  tone,
  compact = false,
}: {
  point: CardPoint;
  tone: "pain" | "solution";
  compact?: boolean;
}) {
  const isSolution = tone === "solution";
  return (
    <motion.div
      whileHover={compact ? undefined : { y: -4 }}
      transition={spring}
      className="h-full rounded-2xl border border-border/60 bg-white flex flex-col overflow-hidden"
    >
      <div
        className={`flex flex-col flex-1 ${
          compact ? "p-3.5 sm:p-4" : "p-6 sm:p-7"
        }`}
      >
        <div className={`flex items-center gap-2.5 ${compact ? "mb-1.5" : "mb-3"}`}>
          <span
            className={`rounded-full text-white font-bold flex items-center justify-center shrink-0 ${
              compact ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm"
            } ${isSolution ? "bg-seafoam text-ink" : "bg-sage-deep"}`}
          >
            {point.number}
          </span>
          <h3
            className={`font-bold text-ink leading-snug ${
              compact ? "text-sm sm:text-base" : "text-lg sm:text-xl"
            }`}
          >
            {point.title}
          </h3>
        </div>
        <p
          className={`text-muted-foreground leading-relaxed ${
            compact
              ? "text-xs sm:text-[13px] mb-2 line-clamp-2"
              : "text-sm sm:text-[15px] mb-2"
          }`}
        >
          {point.description}
        </p>
        <div className={compact ? "" : "px-1"}>
          <img
            src={point.image}
            alt=""
            className={
              compact
                ? "w-full aspect-[4/3] object-cover rounded-lg"
                : "w-full h-auto rounded-lg"
            }
            loading="lazy"
          />
        </div>
      </div>
      <div
        className={`border-t border-border/40 ${
          compact ? "px-3.5 sm:px-4 py-2" : "px-6 sm:px-7 py-3.5"
        } ${isSolution ? "bg-[#EAF4F5]" : "bg-[#F3F4F6]"}`}
      >
        <p
          className={`font-medium flex items-center gap-2 ${
            compact ? "text-[11px] sm:text-xs" : "text-xs sm:text-sm"
          } ${isSolution ? "text-sage-deep" : "text-ink/70"}`}
        >
          {isSolution && (
            <Check
              className={`shrink-0 ${compact ? "w-3 h-3" : "w-3.5 h-3.5"}`}
              strokeWidth={2.5}
            />
          )}
          {point.footer}
        </p>
      </div>
    </motion.div>
  );
}

/** Scroll-linked exit: cards fly off in different directions. */
const EXIT_DIR = [
  { x: -130, y: 18 },
  { x: 0, y: -110 },
  { x: 130, y: 18 },
] as const;

function phase(progress: number, start: number, end: number) {
  if (progress <= start) return 0;
  if (progress >= end) return 1;
  const t = (progress - start) / (end - start);
  return t * t * (3 - 2 * t);
}

function ScrollSwapPanel({ onGetStarted }: { onGetStarted?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = usePinProgress(containerRef);

  // Compact runway: hold → swap → short settle, then release sticky
  const headerOut = phase(progress, 0.18, 0.42);
  const headerIn = phase(progress, 0.32, 0.55);
  const showingSolution = headerIn >= 0.5;

  return (
    <div ref={containerRef} className="relative h-[155vh]">
      <div className="sticky top-14 z-10 flex h-[calc(100vh-3.5rem)] items-center py-2">
        <div className="w-full max-h-full overflow-hidden rounded-3xl border border-border/50 shadow-glass bg-white">
          <div className="relative bg-ink px-5 sm:px-8 md:px-12 pt-3 sm:pt-4 pb-5 sm:pb-6">
            <div className="flex items-center justify-center gap-3 mb-4 sm:mb-5">
              <span
                className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ${
                  showingSolution ? "text-white/35" : "text-seafoam"
                }`}
              >
                Without Nexus
              </span>
              <div className="relative h-1 w-16 sm:w-24 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-seafoam to-lp-sage"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ${
                  showingSolution ? "text-seafoam" : "text-white/35"
                }`}
              >
                With Nexus
              </span>
            </div>

            <div className="relative min-h-[5.5rem] sm:min-h-[6.25rem]">
              <motion.div
                className="absolute inset-0"
                style={{ opacity: 1 - headerOut, y: headerOut * -28 }}
                transition={{ type: false }}
                aria-hidden={showingSolution}
              >
                <PainHeader compact />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                style={{ opacity: headerIn, y: (1 - headerIn) * 28 }}
                transition={{ type: false }}
                aria-hidden={!showingSolution}
              >
                <SolutionHeader compact />
              </motion.div>
            </div>
          </div>

          <div className="bg-white px-4 sm:px-6 md:px-8 py-4 sm:py-5 overflow-hidden">
            <div className="grid md:grid-cols-3 gap-3 lg:gap-4">
              {painPoints.map((pain, i) => {
                const exitT = phase(progress, 0.18 + i * 0.04, 0.45 + i * 0.04);
                const enterT = phase(progress, 0.34 + i * 0.04, 0.62 + i * 0.04);
                const dir = EXIT_DIR[i];
                return (
                  <div key={pain.number} className="relative">
                    <motion.div
                      style={{
                        opacity: 1 - exitT,
                        x: `${dir.x * exitT}%`,
                        y: `${dir.y * exitT}%`,
                        scale: 1 - exitT * 0.08,
                        rotate: dir.x === 0 ? 0 : dir.x * exitT * 0.04,
                      }}
                      transition={{ type: false }}
                      className="relative z-10"
                      aria-hidden={exitT > 0.85}
                    >
                      <PointCard point={pain} tone="pain" compact />
                    </motion.div>
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        opacity: enterT,
                        x: `${dir.x * (1 - enterT)}%`,
                        y: `${(dir.y < 0 ? 90 : -dir.y) * (1 - enterT)}%`,
                        scale: 0.94 + enterT * 0.06,
                      }}
                      transition={{ type: false }}
                      aria-hidden={enterT < 0.15}
                    >
                      <PointCard point={solutionPoints[i]} tone="solution" compact />
                    </motion.div>
                  </div>
                );
              })}
            </div>

            <div className="relative mt-4 min-h-[4.25rem] sm:min-h-[3.75rem]">
              <motion.div
                className="absolute inset-0"
                style={{ opacity: 1 - headerOut, y: headerOut * -16 }}
                transition={{ type: false }}
                aria-hidden={showingSolution}
              >
                <PainFooter onGetStarted={onGetStarted} compact />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                style={{ opacity: headerIn, y: (1 - headerIn) * 16 }}
                transition={{ type: false }}
                aria-hidden={!showingSolution}
              >
                <SolutionFooter onGetStarted={onGetStarted} compact />
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PainHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center">
      <p
        className={`font-mono font-semibold uppercase tracking-[0.28em] text-seafoam ${
          compact ? "text-[10px] sm:text-[11px] mb-2.5" : "text-[11px] sm:text-xs mb-5"
        }`}
      >
        The challenge
      </p>
      <h2
        className={`font-fraunces font-light text-white leading-[1.15] max-w-3xl mx-auto ${
          compact
            ? "text-xl sm:text-2xl lg:text-3xl mb-1.5"
            : "text-3xl sm:text-4xl lg:text-5xl mb-4"
        }`}
      >
        Three pain points stand in the way of lasting impact.
      </h2>
      <p
        className={`text-white/60 max-w-xl mx-auto ${
          compact ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        Too much impact is lost, buried, or invisible.
      </p>
    </div>
  );
}

function SolutionHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="text-center">
      <p
        className={`font-mono font-semibold uppercase tracking-[0.28em] text-seafoam ${
          compact ? "text-[10px] sm:text-[11px] mb-2.5" : "text-[11px] sm:text-xs mb-5"
        }`}
      >
        The shift
      </p>
      <h2
        className={`font-fraunces font-light text-white leading-[1.15] max-w-3xl mx-auto ${
          compact
            ? "text-xl sm:text-2xl lg:text-3xl mb-1.5"
            : "text-3xl sm:text-4xl lg:text-5xl mb-4"
        }`}
      >
        With Nexus, impact stays{" "}
        <span className="bg-gradient-to-r from-seafoam via-[#B8D9B0] to-lp-sage bg-clip-text text-transparent">
          visible.
        </span>
      </h2>
      <p
        className={`text-white/60 max-w-xl mx-auto ${
          compact ? "text-sm" : "text-base sm:text-lg"
        }`}
      >
        Moments are captured, proof is organized, and supporters can finally experience the change.
      </p>
    </div>
  );
}

function PainFooter({
  onGetStarted,
  compact = false,
}: {
  onGetStarted?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-[#F3F4F6] flex flex-col sm:flex-row items-start sm:items-center ${
        compact ? "px-4 py-3 gap-3" : "px-5 sm:px-7 py-5 sm:py-6 gap-5"
      }`}
    >
      <div
        className={`rounded-full bg-sage-deep flex items-center justify-center shrink-0 ${
          compact ? "w-9 h-9" : "w-12 h-12"
        }`}
      >
        <Heart className={compact ? "w-4 h-4 text-white" : "w-5 h-5 text-white"} strokeWidth={1.75} />
      </div>
      <p
        className={`flex-1 text-foreground leading-relaxed ${
          compact ? "text-xs sm:text-sm" : "text-sm sm:text-base"
        }`}
      >
        We believe{" "}
        <span className="font-bold text-sage-deep">real impact</span>{" "}
        should never be invisible. It should be easy to capture, clear to understand,
        and possible for anyone to experience.
      </p>
      {onGetStarted && (
        <Button
          variant="hero"
          size={compact ? "default" : "lg"}
          className="group shrink-0 w-full sm:w-auto"
          onClick={onGetStarted}
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function SolutionFooter({
  onGetStarted,
  compact = false,
}: {
  onGetStarted?: () => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-[#F3F4F6] flex flex-col sm:flex-row items-start sm:items-center ${
        compact ? "px-4 py-3 gap-3" : "px-5 sm:px-7 py-5 sm:py-6 gap-5"
      }`}
    >
      <div className="flex-1">
        <p
          className={`text-foreground leading-snug mb-0.5 ${
            compact ? "text-sm sm:text-base" : "text-base sm:text-lg"
          }`}
        >
          Impact stays{" "}
          <span className="font-bold bg-gradient-to-r from-seafoam via-[#7AADA8] to-sage-deep bg-clip-text text-transparent">
            visible
          </span>{" "}
          with Nexus.
        </p>
        <p className={`text-muted-foreground ${compact ? "text-xs" : "text-sm"}`}>
          Capture it. Prove it. Let people experience it.
        </p>
      </div>
      {onGetStarted && (
        <Button
          variant="hero"
          size={compact ? "default" : "lg"}
          className="group shrink-0 w-full sm:w-auto"
          onClick={onGetStarted}
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function StaticPanel({
  tone,
  points,
  header,
  footer,
}: {
  tone: "pain" | "solution";
  points: CardPoint[];
  header: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="rounded-3xl overflow-hidden border border-border/50 shadow-glass">
      <div className="bg-ink px-6 sm:px-10 md:px-16 py-12 sm:py-16">{header}</div>
      <div className="bg-white px-6 sm:px-10 md:px-12 py-10 sm:py-14">
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {points.map((point) => (
            <PointCard key={point.number} point={point} tone={tone} />
          ))}
        </div>
        <div className="mt-10">{footer}</div>
      </div>
    </div>
  );
}

const ProblemsSection = ({ onGetStarted }: ProblemsSectionProps) => {
  const prefersReducedMotion = useReducedMotion();
  const desktopSwap = useDesktopSwap();
  const useScrollSwap = desktopSwap && !prefersReducedMotion;

  return (
    <section id="problems" className="py-16 md:py-24 relative">
      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">
        {useScrollSwap ? (
          <ScrollSwapPanel onGetStarted={onGetStarted} />
        ) : (
          <div className="space-y-10">
            <Reveal>
              <StaticPanel
                tone="pain"
                points={painPoints}
                header={<PainHeader />}
                footer={<PainFooter onGetStarted={onGetStarted} />}
              />
            </Reveal>
            <Reveal>
              <StaticPanel
                tone="solution"
                points={solutionPoints}
                header={<SolutionHeader />}
                footer={<SolutionFooter onGetStarted={onGetStarted} />}
              />
            </Reveal>
          </div>
        )}

        {/* Maturity ladder */}
        <div className="rounded-3xl bg-gradient-to-b from-sage-light/30 to-background border border-border/50 p-8 sm:p-12 overflow-hidden">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light mb-2 leading-tight">
              <span className="text-foreground">Where impact tracking actually stands</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Five stages. Most orgs stall at two.
            </p>
          </Reveal>

          <StaggerGroup className="relative grid gap-4 md:grid-cols-5 items-stretch" gap={0.12}>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-0.5 origin-left -translate-y-1/2 rounded-full bg-gradient-to-r from-[#c0dfa1]/40 via-[#c0dfa1] to-[#5e8380] md:block"
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={viewportOnce}
              transition={{ duration: 1, ease: easeOut }}
            />
            {ladder.map((stage) => {
              const isWarning = stage.tone === "warning";
              const isAccent = stage.tone === "accent";
              const borderClass = isWarning
                ? "border-[#dca07a]"
                : isAccent
                ? "border-accent"
                : "border-border/60";
              return (
                <StaggerItem key={stage.step} className="relative z-10 flex">
                <motion.div
                  className={`relative rounded-2xl border-2 bg-white p-5 flex flex-col w-full min-h-[300px] ${borderClass} ${
                    isAccent || isWarning ? "shadow-glass-lg" : "shadow-glass"
                  }`}
                  {...(isAccent
                    ? {
                        animate: {
                          boxShadow: [
                            "0 0 0 0 rgba(192,223,161,0)",
                            "0 0 0 6px rgba(192,223,161,0.28)",
                            "0 0 0 0 rgba(192,223,161,0)",
                          ],
                        },
                        transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
                      }
                    : {})}
                >
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <span
                      className={`text-3xl font-fraunces font-light shrink-0 ${
                        isAccent ? "text-[#5e8380]" : isWarning ? "text-[#b46a3a]" : "text-muted-foreground/50"
                      }`}
                    >
                      {stage.step}
                    </span>
                    {stage.badge && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full leading-tight ${
                          isWarning
                            ? "bg-[#f4e2d3] text-[#b46a3a]"
                            : "bg-accent/25 text-accent-foreground"
                        }`}
                      >
                        {stage.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-3 leading-snug">{stage.title}</h3>
                  <ul className="space-y-1.5">
                    {stage.points.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        {isAccent ? (
                          <Check className="w-3 h-3 mt-0.5 text-accent-foreground flex-shrink-0" />
                        ) : (
                          <span
                            className={`mt-0.5 leading-none ${
                              isWarning ? "text-[#b46a3a]" : "text-muted-foreground/50"
                            }`}
                          >
                            •
                          </span>
                        )}
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>

        {onGetStarted && (
          <Reveal className="flex justify-center">
            <Button variant="hero" size="xl" className="group" onClick={onGetStarted}>
              Move up the ladder
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Reveal>
        )}
      </div>
    </section>
  );
};

export default ProblemsSection;
