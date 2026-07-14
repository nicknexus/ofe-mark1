import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { ArrowRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { easeOut } from "./motion";

interface CTASectionProps {
  onGetStarted: () => void;
}

const CTASection = ({ onGetStarted }: CTASectionProps) => {
  return (
    <section className="pt-8 pb-20 md:pt-12 md:pb-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-steel-light to-ink-soft" />

      {/* Slow-drifting aurora accents — warm/cool contrast on dark */}
      <motion.div
        className="absolute top-1/4 -left-20 w-64 h-64 bg-terracotta/25 rounded-full blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.15, 1], opacity: [0.6, 0.85, 0.6] }}
        transition={{ duration: 14, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-20 w-80 h-80 bg-seafoam/20 rounded-full blur-3xl"
        animate={{ x: [0, -50, 0], y: [0, -35, 0], scale: [1, 1.1, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 17, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <Reveal direction="scale" className="bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl px-8 py-12 sm:px-12 sm:py-16 shadow-glass-lg">
          <p className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-6">
            Ignite today
          </p>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-white leading-tight mb-8">
            Your impact is already happening.{" "}
            <span className="relative inline-block">
              <span className="relative z-10 italic inline-block pr-2 text-white">
                Make it easy
              </span>
              <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <motion.path
                  d="M2 8C50 2 150 2 198 8"
                  stroke="#c0dfa1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: easeOut, delay: 0.3 }}
                />
              </svg>
            </span>{" "}
            to see.
          </h2>

          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-10">
            If people could see, understand, and experience the impact the way you do, would they
            give more?
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.div className="inline-block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button variant="hero" size="xl" onClick={onGetStarted}>
                Start for Free
                <ArrowRight className="w-5 h-5 ml-1" />
              </Button>
            </motion.div>
            <motion.div className="inline-block" whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="hero-outline"
                size="xl"
                onClick={onGetStarted}
                className="!border-white/40 !text-white hover:!bg-white/10"
              >
                Book a demo
              </Button>
            </motion.div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default CTASection;
