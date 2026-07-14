import { Plug, Share2, PlayCircle } from "lucide-react";
import { motion } from "framer-motion";
import { spring, easeOut, viewportOnce } from "./motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";

const steps = [
  {
    number: "Step 1",
    icon: Plug,
    title: "Plug in what you have",
    description:
      "Upload the stories, photos, videos, and data your team already collects — from anywhere, on any device.",
  },
  {
    number: "Step 2",
    icon: Share2,
    title: "Nexus connects the proof",
    description:
      "Everything is organized by initiative, location, outcome, and evidence — the full picture, automatically assembled.",
  },
  {
    number: "Step 3",
    icon: PlayCircle,
    title: "Press play, go live",
    description:
      "A public impact page, donor experiences, embeds, and ready-to-share reports — live in moments, updating as you work.",
  },
];

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sage-light/10 to-background" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <Reveal direction="up" className="text-center mb-12">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full mb-6">
            <span className="text-sm font-medium text-muted-foreground">How it works</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-foreground mb-4 leading-tight">
            Plug in. Nexus connects. Press play.
          </h2>
          <p className="text-lg text-muted-foreground">
            Instead of adding another task, we bring relief.
          </p>
        </Reveal>

        {/* Steps */}
        <div className="relative">
          {/* Animated connecting line behind the cards (md+ only) */}
          <motion.div
            aria-hidden
            className="hidden md:block absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-accent/0 via-accent/40 to-accent/0 origin-left"
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 1, ease: easeOut, delay: 0.15 }}
          />

          <StaggerGroup className="relative z-10 grid md:grid-cols-3 gap-5">
            {steps.map((step) => (
              <StaggerItem key={step.number}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={spring}
                  className="glass-card rounded-2xl p-6 flex flex-col hover:shadow-glass-lg transition-shadow duration-300 h-full"
                >
                  <div className="flex items-center justify-between mb-6">
                    <motion.div
                      className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center"
                      variants={{
                        hidden: { scale: 0.6, opacity: 0 },
                        visible: {
                          scale: [0.6, 1.12, 1],
                          opacity: 1,
                          transition: { duration: 0.5, ease: easeOut },
                        },
                      }}
                    >
                      <step.icon className="w-5 h-5 text-accent-foreground" />
                    </motion.div>
                    <span className="text-xs font-medium text-accent uppercase tracking-wider">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="text-lg font-fraunces font-medium text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>

        {/* Footer line */}
        <Reveal direction="up" delay={0.1}>
          <p className="text-center text-foreground/70 font-fraunces italic text-lg mt-10">
            A report is one page. Nexus helps you share the whole story.
          </p>
        </Reveal>
      </div>
    </section>
  );
};

export default HowItWorksSection;
