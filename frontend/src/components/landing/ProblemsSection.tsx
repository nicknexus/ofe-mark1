import { Button } from "../ui/button";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { easeOut, viewportOnce } from "./motion";

interface ProblemsSectionProps {
  onGetStarted?: () => void;
}

// The "gap" — what's true right now vs. what it quietly costs.
const gaps = [
  {
    now: "Your impact is scattered across spreadsheets, emails, photos, and field notes.",
    cost: "Your life-changing moments are real and happening, but only your team members truly experience them. To everyone else, they vanish.",
  },
  {
    now: "You pour weeks into reports that get skimmed once and filed away.",
    cost: "A flat PDF strips out the emotion and connection. With nothing to feel, donors drift.",
  },
  {
    now: "You have the numbers, but the stories and evidence live somewhere else.",
    cost: "Metrics with no proof behind them sit flat and weightless. No one can step in and see for themselves.",
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
      "Can share and show real impact",
      "Life-changing moments still slip through",
    ],
  },
  {
    step: 4,
    title: "Broadcasting",
    badge: "This is us",
    tone: "warning" as const,
    points: [
      "Data is tracked and well managed",
      "People only see what gets broadcast",
      "Anything deeper means asking the org directly",
    ],
  },
  {
    step: 5,
    title: "Full Experience & Trust",
    tone: "accent" as const,
    points: [
      "Every stakeholder can explore it themselves",
      "Every impact backed by story and evidence",
      "All in one place, open to everyone",
    ],
  },
];

const ProblemsSection = ({ onGetStarted }: ProblemsSectionProps) => {
  return (
    <section id="problems" className="py-16 md:py-24 relative overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">
        {/* The gap — editorial "right now / what it costs you" table */}
        <div className="rounded-3xl bg-[#f6f5f1] border border-border/50 p-8 sm:p-12 md:p-16">
          <Reveal>
            <p className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-seafoam mb-5">
              The gap you already feel
            </p>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-fraunces font-light text-ink leading-[1.08] mb-12 sm:mb-16">
              Your impact is real.
              <br />
              The world just can't see it yet.
            </h2>
          </Reveal>

          {/* Column headers */}
          <div className="hidden md:grid md:grid-cols-2 md:gap-x-10">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-[#A83A2E] pb-4">
              Right now
            </p>
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.22em] text-ink/60 pb-4 md:pl-10 md:border-l md:border-[#E4E9E6]">
              What it costs you
            </p>
          </div>

          <StaggerGroup className="border-t border-[#E4E9E6]">
            {gaps.map((gap) => (
              <StaggerItem key={gap.now}>
                <motion.div
                  className="grid md:grid-cols-2 md:gap-x-10 border-b border-[#E4E9E6]"
                  whileHover={{ x: 4 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                >
                  {/* Right now */}
                  <div className="relative py-7 sm:py-9 bg-gradient-to-r from-[#A83A2E]/[0.05] to-transparent">
                    {/* Mobile-only label */}
                    <p className="md:hidden font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#A83A2E] mb-3">
                      Right now
                    </p>
                    <div className="flex items-stretch gap-5">
                      <span className="w-[3px] shrink-0 rounded-full bg-[#A83A2E]" />
                      <p className="font-semibold text-lg sm:text-xl text-[#A83A2E] leading-snug">
                        {gap.now}
                      </p>
                    </div>
                  </div>
                  {/* What it costs you */}
                  <div className="py-7 sm:py-9 md:pl-10 md:border-l md:border-[#E4E9E6]">
                    <p className="md:hidden font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-ink/60 mb-3">
                      What it costs you
                    </p>
                    <p className="text-[#6E7883] leading-relaxed">{gap.cost}</p>
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>

        {/* Maturity ladder */}
        <div className="rounded-3xl bg-gradient-to-b from-sage-light/30 to-background border border-border/50 p-8 sm:p-12 overflow-hidden">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light mb-2 leading-tight">
              <span className="text-foreground">Where impact tracking actually stands</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Five stages. Most orgs stall at three.
            </p>
          </Reveal>

          <StaggerGroup className="relative grid gap-4 md:grid-cols-5 items-stretch" gap={0.12}>
            {/* Progress climb track (md+): fills left-to-right behind the cards */}
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
                  className={`relative rounded-2xl border-2 bg-white p-5 flex flex-col w-full ${borderClass} ${
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
                  {stage.badge && (
                    <span
                      className={`inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full mb-3 ${
                        isWarning
                          ? "bg-[#f4e2d3] text-[#b46a3a]"
                          : "bg-accent/25 text-accent-foreground"
                      }`}
                    >
                      {stage.badge}
                    </span>
                  )}
                  <span
                    className={`text-3xl font-fraunces font-light mb-2 ${
                      isAccent ? "text-[#5e8380]" : isWarning ? "text-[#b46a3a]" : "text-muted-foreground/50"
                    }`}
                  >
                    {stage.step}
                  </span>
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
