import { useState } from "react";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";

const YT_ID = "izHXfWKcSNI";
// Hosted locally — YT maxres 404s for this video and returns a 120×90 grey stub.
const YT_THUMB = "/walkthrough-thumb.jpg";
const YT_EMBED = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&rel=0&modestbranding=1`;

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
            What Is Nexus?
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch this 2-minute video with our founder Liam to understand what Nexus can do for your organization.
          </p>
        </Reveal>

        {/* Video / walkthrough frame */}
        <Reveal direction="scale" delay={0.15}>
          <div className="relative rounded-3xl overflow-hidden glass-card p-2 shadow-glass-lg">
            <div
              className="relative w-full rounded-2xl overflow-hidden bg-ink"
              style={{ aspectRatio: "16 / 9" }}
            >
              {playing ? (
                <iframe
                  src={YT_EMBED}
                  title="Nexus platform walkthrough"
                  className="absolute inset-0 w-full h-full"
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  className="absolute inset-0 w-full h-full flex flex-col items-center justify-center group"
                  aria-label="Play walkthrough video"
                >
                  <img
                    src={YT_THUMB}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                    loading="lazy"
                  />

                  <div className="relative z-10 flex flex-col items-center">
                    <motion.div
                      className="mb-5"
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.96 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    >
                      <div className="w-20 h-20 rounded-full bg-white/90 backdrop-blur-xl border-2 border-white shadow-glass-lg flex items-center justify-center">
                        <Play className="w-8 h-8 text-foreground translate-x-0.5" fill="currentColor" />
                      </div>
                    </motion.div>
                    <div className="rounded-full bg-ink/55 backdrop-blur-md px-3.5 py-1.5 text-white shadow-glass">
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
