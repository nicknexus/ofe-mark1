import { useState } from "react";
import { Play } from "lucide-react";
import { Reveal } from "./Reveal";

const YT_EMBED =
  "https://www.youtube.com/embed/izHXfWKcSNI?si=hZ5VtZhkKoxkZmyb&rel=0&modestbranding=1";

const WalkthroughSection = () => {
  // The YouTube player is ~1MB of script; only load it once someone hits play.
  const [playing, setPlaying] = useState(false);

  return (
    <section id="walkthrough" className="py-16 md:py-24 relative overflow-hidden">
      <div className="relative z-10 max-w-5xl mx-auto px-6">
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

        <Reveal direction="scale" delay={0.15}>
          <div className="relative rounded-3xl overflow-hidden glass-card p-2 shadow-glass-lg">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-ink">
              {playing ? (
                <iframe
                  src={`${YT_EMBED}&autoplay=1`}
                  title="Nexus platform walkthrough"
                  className="absolute inset-0 w-full h-full"
                  frameBorder={0}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlaying(true)}
                  aria-label="Play Nexus platform walkthrough"
                  className="group absolute inset-0 w-full h-full"
                >
                  <img
                    src="/walkthrough-thumb.webp"
                    alt=""
                    width={1024}
                    height={576}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-20 h-20 rounded-full bg-white/90 shadow-glass-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-110">
                      <Play className="w-8 h-8 text-foreground translate-x-0.5" fill="currentColor" />
                    </span>
                  </span>
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
