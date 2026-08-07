import { Button } from "../ui/button";
import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { easeOut, viewportOnce } from "./motion";

interface ProblemsSectionProps {
  onGetStarted?: () => void;
}

const ladder = [
  {
    step: 1,
    title: "Invisible",
    points: ["Nothing is tracked.", "Impact goes unrecorded.", "No proof exists."],
  },
  {
    step: 2,
    title: "Scattered",
    badge: "Where most are",
    tone: "warning" as const,
    points: [
      "Tracking is inconsistent.",
      "Proof cannot be trusted.",
      "The organization does not know its own details.",
    ],
  },
  {
    step: 3,
    title: "Organized",
    points: [
      "Impact is tracked and recorded but scattered across systems.",
      "The organization shares impact reports and limited media postings.",
      "Most life-changing moments slip through.",
    ],
  },
  {
    step: 4,
    title: "Broadcasting",
    points: [
      "Data is tracked and well managed.",
      "People only see what gets broadcast.",
      "Anything deeper means asking the organization directly.",
    ],
  },
  {
    step: 5,
    title: "Full Experience & Trust",
    badge: "This is us",
    tone: "accent" as const,
    points: [
      "Every stakeholder can explore impact themselves.",
      "Every impact is backed by a story and evidence.",
      "Consolidated and open to everyone.",
    ],
  },
];

const ProblemsSection = ({ onGetStarted }: ProblemsSectionProps) => {
  return (
    <section id="problems" className="py-16 md:py-24 relative">
      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">
        <div className="rounded-3xl bg-gradient-to-b from-sage-light/30 to-background border border-border/50 p-8 sm:p-12 overflow-hidden">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light mb-2 leading-tight">
              <span className="text-foreground">What is the gap costing your mission?</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              When people can’t experience your impact, connection and support gets lost.
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
                          isAccent
                            ? "text-[#5e8380]"
                            : isWarning
                              ? "text-[#b46a3a]"
                              : "text-muted-foreground/50"
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
                    <h3 className="text-sm font-bold text-foreground mb-3 leading-snug">
                      {stage.title}
                    </h3>
                    <ul className="space-y-1.5">
                      {stage.points.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-1.5 text-xs text-muted-foreground"
                        >
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
              Close the gap
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Reveal>
        )}
      </div>
    </section>
  );
};

export default ProblemsSection;
