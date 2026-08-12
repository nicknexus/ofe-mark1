import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";

const YT_ID = "izHXfWKcSNI";
// Hosted locally — YT maxres 404s for this video (source is 16:10, not 16:9).
const YT_THUMB = "/walkthrough-thumb.jpg";
const YT_FALLBACK_EMBED = `https://www.youtube.com/embed/${YT_ID}?autoplay=1&rel=0&modestbranding=1`;

// Source is 1728×1080. Match it so the player isn't pillarboxed.
const VIDEO_ASPECT = "16 / 10";
// YouTube derives its quality ceiling from the player's own viewport, so lay the
// player out this big and scale it back down to the container.
const RENDER_WIDTH = 1440;
const RENDER_HEIGHT = 900;
const BOOST_MIN_WIDTH = 640;

const PREFERRED_QUALITY = "hd1080";
// YT's ABR can bounce quality back down; re-assert a few times, then leave it be.
const MAX_QUALITY_ATTEMPTS = 5;

let apiPromise: Promise<any> | null = null;

function loadPlayerApi(): Promise<any> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const w = window as any;
    if (w.YT?.Player) {
      resolve(w.YT);
      return;
    }
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(w.YT);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube IFrame API failed to load"));
    document.head.appendChild(script);
  });
  return apiPromise;
}

const WalkthroughSection = () => {
  const [playing, setPlaying] = useState(false);
  const [apiFailed, setApiFailed] = useState(false);
  const [scale, setScale] = useState(1);
  const frameRef = useRef<HTMLDivElement>(null);
  const playerHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setScale(width >= BOOST_MIN_WIDTH ? width / RENDER_WIDTH : 1);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const host = playerHostRef.current;
    if (!playing || !host) return;

    let player: any;
    let cancelled = false;
    let attempts = 0;

    const forceQuality = (target: any) => {
      if (attempts >= MAX_QUALITY_ATTEMPTS) return;
      attempts += 1;
      target.setPlaybackQualityRange?.(PREFERRED_QUALITY, PREFERRED_QUALITY);
      target.setPlaybackQuality?.(PREFERRED_QUALITY);
    };

    const mount = document.createElement("div");
    host.appendChild(mount);

    loadPlayerApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(mount, {
          videoId: YT_ID,
          width: RENDER_WIDTH,
          height: RENDER_HEIGHT,
          playerVars: {
            autoplay: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              const iframe = event.target.getIframe?.();
              if (iframe) {
                iframe.setAttribute("title", "Nexus platform walkthrough");
                iframe.style.display = "block";
                iframe.style.width = "100%";
                iframe.style.height = "100%";
              }
              forceQuality(event.target);
              event.target.playVideo();
            },
            onPlaybackQualityChange: (event: any) => forceQuality(event.target),
            onStateChange: (event: any) => {
              if (event.data === YT.PlayerState.PLAYING) forceQuality(event.target);
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      player?.destroy?.();
      host.replaceChildren();
    };
  }, [playing]);

  const boosted = scale !== 1;

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
              ref={frameRef}
              className="relative w-full rounded-2xl overflow-hidden bg-ink"
              style={{ aspectRatio: VIDEO_ASPECT }}
            >
              {playing ? (
                <div
                  className="absolute inset-0 origin-top-left"
                  style={
                    boosted
                      ? { width: RENDER_WIDTH, height: RENDER_HEIGHT, transform: `scale(${scale})` }
                      : undefined
                  }
                >
                  {apiFailed ? (
                    <iframe
                      src={YT_FALLBACK_EMBED}
                      title="Nexus platform walkthrough"
                      className="block w-full h-full"
                      frameBorder={0}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      referrerPolicy="strict-origin-when-cross-origin"
                    />
                  ) : (
                    <div ref={playerHostRef} className="w-full h-full" />
                  )}
                </div>
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
