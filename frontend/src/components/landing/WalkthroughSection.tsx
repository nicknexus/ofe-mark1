import { useState } from "react";
import { Play, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { easeOut } from "./motion";

// Drop a Loom (or other) embed URL here to swap the placeholder for the real walkthrough.
// e.g. "https://www.loom.com/embed/xxxxxxxxxxxx"
const WALKTHROUGH_EMBED_URL = "";

const WalkthroughSection = () => {
  const [playing, setPlaying] = useState(false);

  return (
    <section id="walkthrough" className="py-16 md:py-24 relative overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Header */}
        <Reveal className="text-center mb-12">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full mb-6">
            <span className="text-sm font-medium text-muted-foreground">Visual and visceral</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-extralight text-foreground mb-4">
            See it before you{" "}
            <span className="relative inline-block">
              <span className="bg-gradient-to-r from-foreground via-slate-light to-foreground bg-clip-text text-transparent">
                believe it
              </span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <motion.path
                  d="M2 8C50 2 150 2 198 8"
                  stroke="#c0dfa1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 1, ease: easeOut, delay: 0.3 }}
                />
              </svg>
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A two-minute walkthrough of the platform — what you plug in, how it connects, and what the world gets to experience.
          </p>
        </Reveal>

        {/* Video / walkthrough frame */}
        <Reveal direction="scale" delay={0.15}>
          <div className="relative rounded-3xl overflow-hidden glass-card p-2 shadow-glass-lg">
            <div className="relative w-full rounded-2xl overflow-hidden bg-gradient-to-br from-sage-light/40 via-background to-sage-light/20" style={{ aspectRatio: "16 / 9" }}>
              {playing && WALKTHROUGH_EMBED_URL ? (
                <iframe
                  src={WALKTHROUGH_EMBED_URL}
                  title="Nexus platform walkthrough"
                  className="absolute inset-0 w-full h-full"
                  frameBorder={0}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center group"
                >
                  {/* Ambient glow blobs — gentle drift */}
                  <motion.div
                    className="absolute top-[15%] left-[12%] w-40 h-40 bg-accent/25 rounded-full blur-3xl"
                    animate={{ x: [0, 18, 0], y: [0, -14, 0], opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <motion.div
                    className="absolute bottom-[12%] right-[15%] w-52 h-52 bg-accent/20 rounded-full blur-3xl"
                    animate={{ x: [0, -22, 0], y: [0, 16, 0], opacity: [0.6, 0.9, 0.6] }}
                    transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
                  />

                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      className="relative w-20 h-20 mb-5"
                      whileHover={{ scale: 1.12 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    >
                      {/* Pulse rings emanating from behind the play circle */}
                      {[0, 0.8].map((delay) => (
                        <motion.span
                          key={delay}
                          className="absolute inset-0 rounded-full border-2"
                          style={{ borderColor: "#c0dfa1" }}
                          initial={{ scale: 1, opacity: 0.5 }}
                          animate={{ scale: 1.8, opacity: 0 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay }}
                        />
                      ))}
                      <div className="relative w-20 h-20 rounded-full bg-white/80 backdrop-blur-xl border-2 border-white shadow-glass-lg flex items-center justify-center">
                        <Play className="w-8 h-8 text-foreground translate-x-0.5" fill="currentColor" />
                      </div>
                    </motion.div>
                    <div className="flex items-center gap-2 text-foreground/70">
                      <Fingerprint className="w-5 h-5 text-accent" />
                      <span className="text-sm font-medium">Watch the walkthrough</span>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

export default WalkthroughSection;
