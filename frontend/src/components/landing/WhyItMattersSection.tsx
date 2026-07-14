import { motion } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { AnimatedNumber } from "./AnimatedNumber";
import { hoverSpring } from "./motion";

const primaryStats = [
  {
    value: "60%",
    headline: "See impact, give again",
    description: "of donors say seeing the impact of their gift motivates them to give again.",
    source: "BetterWorld, 2025",
  },
  {
    value: "40%",
    headline: "More donors retained",
    description:
      "Charities that report outcomes quarterly retain up to 40% more donors than annual-only reporters.",
    source: "BetterWorld, 2025",
  },
  {
    value: "91%",
    headline: "More likely to give",
    description:
      "of donors are more likely to support a charity when confident in its transparency and accountability.",
    source: "Charity Navigator",
  },
];

const supportingStats = [
  {
    value: "97%",
    description:
      "of donors say knowing the impact of their contribution is a major factor in their decision to give.",
    source: "CCS Fundraising, via Neon One",
  },
  {
    value: "81%",
    description: "of first-time donors never give a second gift (2020 new-donor retention: 19.3%).",
    source: "Fundraising Effectiveness Project",
  },
  {
    value: "7.5×",
    description: "more costly to acquire a donor than retain one ($1.50 vs $0.20 per dollar raised).",
    source: "Neon One / FEP",
  },
  {
    value: "88%",
    description: "of donors most want to hear about the program outcomes their gift produced.",
    source: "Candid / GuideStar",
  },
  {
    value: "73%",
    description: "of donors base their giving decisions on trust in the nonprofit.",
    source: "BBB Wise Giving Alliance",
  },
  {
    value: "~1 in 4",
    description:
      "donors have stopped giving because a nonprofit wasn't transparent about how their gift was used.",
    source: "BetterWorld, Donor Trust",
  },
  {
    value: "4%",
    description: "the recapture rate for lapsed donors. Once they're gone, they're usually gone.",
    source: "Fundraising Effectiveness Project",
  },
];

/**
 * Parses a clean integer-percentage value string (e.g. "60%") into a number +
 * suffix so it can count up. Returns null for values that don't cleanly parse
 * (e.g. "7.5×", "~1 in 4"), which stay as plain text.
 */
const parsePercent = (raw: string): { value: number; suffix: string } | null => {
  const match = raw.match(/^(\d+)(%)$/);
  if (!match) return null;
  return { value: Number(match[1]), suffix: match[2] };
};

const WhyItMattersSection = () => {
  return (
    <section id="why-it-matters" className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-steel-light to-ink-soft" />

      {/* Soft blurred accent glows for depth */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-seafoam/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 w-[28rem] h-[28rem] rounded-full bg-sage/10 blur-3xl" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <Reveal className="max-w-2xl mb-14">
          <p className="text-xs font-semibold text-seafoam uppercase tracking-[0.2em] mb-4">
            Why it matters
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-white leading-tight">
            When people experience the change they make, connection and giving follows.
          </h2>
        </Reveal>

        {/* Primary stats */}
        <StaggerGroup className="grid md:grid-cols-3 gap-5 mb-16">
          {primaryStats.map((stat) => {
            const parsed = parsePercent(stat.value);
            return (
              <StaggerItem key={stat.headline}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={hoverSpring}
                  className="h-full bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm p-8"
                >
                  <p className="mb-4">
                    {parsed ? (
                      <AnimatedNumber
                        value={parsed.value}
                        suffix={parsed.suffix}
                        className="text-5xl font-fraunces font-light text-seafoam"
                      />
                    ) : (
                      <span className="text-5xl font-fraunces font-light text-seafoam">
                        {stat.value}
                      </span>
                    )}
                  </p>
                  <h3 className="font-semibold text-white mb-2">{stat.headline}</h3>
                  <p className="text-sm text-white/70 leading-relaxed mb-4">
                    {stat.description}
                  </p>
                  <p className="text-xs text-white/40 uppercase tracking-wider">
                    {stat.source}
                  </p>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        {/* Supporting stats — auto-scrolling marquee */}
        <div className="group relative overflow-hidden">
          {/* Edge fade masks — fade into the dark band edges */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 sm:w-24 bg-gradient-to-r from-[#42505B] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 sm:w-24 bg-gradient-to-l from-[#2F3A43] to-transparent" />

          <div
            className="flex w-max py-2 [animation:why-marquee_36s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:[animation:none]"
          >
            {[...supportingStats, ...supportingStats].map((stat, i) => (
              <div
                key={`${stat.description}-${i}`}
                className="w-[300px] shrink-0 mr-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm p-6 shadow-glass"
              >
                <p className="text-3xl font-fraunces font-light text-white mb-3">
                  {stat.value}
                </p>
                <p className="text-sm text-white/70 leading-relaxed mb-3">
                  {stat.description}
                </p>
                <p className="text-xs text-white/40 uppercase tracking-wider">
                  {stat.source}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes why-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
};

export default WhyItMattersSection;
