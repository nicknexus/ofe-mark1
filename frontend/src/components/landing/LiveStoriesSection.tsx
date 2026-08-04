import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, MapPin, Calendar, Play, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { publicApi, type ShowcaseStory } from "../../services/publicApi";
import { Reveal } from "./Reveal";
import { easeOut } from "./motion";

const AUTOPLAY_MS = 3000;

function resolveThumb(story: ShowcaseStory): { kind: "img" | "video" | "none"; src?: string } {
  const url = story.media_url;
  if (!url) return { kind: "none" };
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt) return { kind: "img", src: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` };
  // Vimeo URLs aren't direct video files; vumbnail resolves the poster image.
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "img", src: `https://vumbnail.com/${vimeo[1]}.jpg` };
  if (story.media_type === "photo") return { kind: "img", src: url };
  if (story.media_type === "video") return { kind: "video", src: url };
  return { kind: "none" };
}

function safeDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : format(d, "MMM d, yyyy");
}

function StoryCard({ story }: { story: ShowcaseStory }) {
  const thumb = resolveThumb(story);
  const [imgError, setImgError] = useState(false);
  const to =
    story.org_slug && story.initiative_slug
      ? `/org/${story.org_slug}/${story.initiative_slug}/story/${story.id}`
      : story.org_slug
      ? `/org/${story.org_slug}`
      : "/explore";
  const accent = story.org_brand_color || "#c0dfa1";

  return (
    <Link
      to={to}
      className="group flex flex-col h-full rounded-2xl overflow-hidden bg-white border border-border/50 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28),0_4px_10px_-6px_rgba(70,83,96,0.18)] hover:border-accent/40 hover:shadow-[0_22px_48px_-14px_rgba(70,83,96,0.4)] transition-[box-shadow,border-color] duration-300"
    >
      <div className="relative flex-1 min-h-0 overflow-hidden bg-gradient-to-br from-sage-light/40 to-accent/10">
        {thumb.kind === "img" && !imgError && (
          <img
            src={thumb.src}
            alt={story.title}
            loading="eager"
            decoding="async"
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {thumb.kind === "video" && (
          <video
            src={thumb.src}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}
        {(thumb.kind === "none" || (thumb.kind === "img" && imgError)) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-fraunces text-xl font-light text-foreground/40 px-6 text-center line-clamp-3">
              {story.title}
            </span>
          </div>
        )}
        {story.media_type === "video" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-11 h-11 rounded-full bg-white/90 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-110">
              <Play className="w-4 h-4 text-foreground translate-x-0.5" fill="currentColor" />
            </div>
          </div>
        )}
        <span
          className="absolute top-2.5 left-2.5 w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-md ring-2 ring-white/90"
          style={{ backgroundColor: story.org_logo_url ? "#fff" : `${accent}26` }}
        >
          {story.org_logo_url ? (
            <img src={story.org_logo_url} alt="" decoding="async" className="w-full h-full object-cover" />
          ) : (
            <Building2 className="w-4 h-4 text-foreground/60" />
          )}
        </span>
      </div>

      <div className="px-3 py-2.5 flex flex-col gap-1 shrink-0">
        <span className="text-[11px] font-medium text-muted-foreground truncate">
          {story.org_name || "Nexus organization"}
        </span>

        <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">
          {story.title}
        </h3>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          {story.location_name ? (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-accent flex-shrink-0" />
              <span className="truncate">{story.location_name}</span>
            </span>
          ) : (
            <span />
          )}
          {safeDate(story.date_represented) && (
            <span className="flex items-center gap-1 flex-shrink-0">
              <Calendar className="w-3 h-3 text-accent" />
              {safeDate(story.date_represented)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

const SkeletonCard = () => (
  <div className="flex flex-col h-full rounded-2xl overflow-hidden bg-white border border-border/60 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28)]">
    <div className="flex-1 bg-muted animate-pulse" />
    <div className="px-3 py-2.5 space-y-1.5 shrink-0">
      <div className="h-2.5 w-1/3 bg-muted rounded animate-pulse" />
      <div className="h-3.5 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-2.5 w-1/2 bg-muted rounded animate-pulse" />
    </div>
  </div>
);

/**
 * Warm the browser cache for every thumbnail during idle time, off the main
 * scroll path. `.decode()` forces the decode now (async) so painting a card
 * as it scrolls into the carousel is instant and never janks.
 */
function prefetchThumbs(stories: ShowcaseStory[]) {
  const run = () => {
    for (const story of stories) {
      const thumb = resolveThumb(story);
      if (thumb.kind !== "img" || !thumb.src) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = thumb.src;
      img.decode?.().catch(() => {});
    }
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 2000 });
  else setTimeout(run, 200);
}

/** Fisher–Yates shuffle. */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const LiveStoriesSection = () => {
  const [stories, setStories] = useState<ShowcaseStory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const reduceMotion = useReducedMotion();

  const sectionRef = useRef<HTMLElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [paused, setPaused] = useState(false); // set once the user takes control

  // `pos` walks forward/backward through the middle copy; it's normalized back
  // into [0, n) after each move so the offset never runs away. Because we
  // render three identical copies, snapping is visually seamless.
  const [pos, setPos] = useState(0);
  const [animate, setAnimate] = useState(false);
  const [step, setStep] = useState(0); // px per card (incl. gutter)

  useEffect(() => {
    let alive = true;
    publicApi
      .getShowcase(24)
      .then((res) => {
        if (!alive) return;
        const list = res?.stories ?? [];
        if (list.length === 0) {
          setStatus("empty");
          return;
        }
        setStories(shuffle(list));
        prefetchThumbs(list);
        setStatus("ready");
      })
      .catch(() => alive && setStatus("empty"));
    return () => {
      alive = false;
    };
  }, []);

  const n = stories.length;
  // Triple the list so there's always a full screen of cards on both sides of
  // the middle copy — enables seamless looping in either direction.
  const loopStories = useMemo(
    () => (n > 0 ? [...stories, ...stories, ...stories] : []),
    [stories, n]
  );

  // Measure one card's width (including its horizontal gutter) so the track
  // translate stays pixel-accurate across breakpoints.
  //
  // This must be resilient: if the first measurement lands before layout has
  // settled (can happen when the lazy chunk mounts), width reads 0 and the
  // track can't move — which looked like "the buttons don't work until I
  // refresh". So we retry via rAF until we get a real width, and keep a
  // ResizeObserver for subsequent breakpoint/resize changes.
  useLayoutEffect(() => {
    if (status !== "ready") return;
    let raf = 0;
    const readWidth = () => slideRef.current?.getBoundingClientRect().width ?? 0;
    const measure = () => {
      const w = readWidth();
      if (w > 0) {
        setStep(w);
      } else {
        raf = requestAnimationFrame(measure);
      }
    };
    measure();
    const el = slideRef.current;
    const ro = el
      ? new ResizeObserver(() => {
          const w = readWidth();
          if (w > 0) setStep(w);
        })
      : null;
    if (el && ro) ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [status, inView, n]);

  // Visibility gate — no autoplay work while off screen.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: "0px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Re-enable the transition on the frame after a seamless snap / first layout.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const autoplayActive = status === "ready" && inView && !paused && !hovered && !reduceMotion && n > 1;

  useEffect(() => {
    if (!autoplayActive) return;
    const timer = setInterval(() => setPos((p) => p + 1), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [autoplayActive]);

  // After a move settles, fold `pos` back into [0, n) without animating so the
  // translate offset never grows unbounded (the copies make this invisible).
  const handleRest = useCallback(() => {
    setPos((p) => {
      if (p >= n || p < 0) {
        const normalized = ((p % n) + n) % n;
        if (normalized !== p) setAnimate(false);
        return normalized;
      }
      return p;
    });
  }, [n]);

  const step1 = useCallback((dir: 1 | -1) => {
    setPaused(true); // user took over — stop the auto timer for good
    setPos((p) => p + dir);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      setPaused(true);
      setPos(target);
    },
    []
  );

  const activeIndex = n > 0 ? ((pos % n) + n) % n : 0;
  // Start in the middle copy so there's room to loop both ways.
  const x = -(n + pos) * step;

  if (status === "empty") return null;

  return (
    <section ref={sectionRef} className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sage-light/10 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <Reveal className="max-w-3xl mb-10">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Live on Nexus right now
          </p>
          <h2 className="text-3xl sm:text-4xl font-fraunces font-light text-foreground leading-snug">
            Real organizations. Real moments. Real impact.
          </h2>
        </Reveal>

        {status === "loading" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[520px]">
                <SkeletonCard />
              </div>
            ))}
          </div>
        ) : (
          <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => step1(-1)}
                aria-label="Previous"
                className="shrink-0 w-10 h-10 rounded-full bg-accent border-2 border-accent/60 shadow-glass-lg hover:bg-accent/90 flex items-center justify-center transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 text-accent-foreground" />
              </button>

              <div
                className="flex-1 min-w-0 overflow-hidden py-6"
                style={{
                  // Feather only the outermost edge to transparent so the edge
                  // cards' shadows aren't sliced into a hard vertical line by the
                  // overflow clip. Transparent (reveals page bg) — not a white wash.
                  WebkitMaskImage:
                    "linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%)",
                  maskImage:
                    "linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%)",
                }}
              >
                <motion.div
                  className="flex"
                  style={{ willChange: "transform" }}
                  animate={{ x }}
                  transition={animate ? { duration: 0.95, ease: easeOut } : { duration: 0 }}
                  onAnimationComplete={handleRest}
                >
                  {loopStories.map((story, i) => (
                    <div
                      key={`${story.id}-${i}`}
                      ref={i === 0 ? slideRef : undefined}
                      className="shrink-0 w-[280px] sm:w-[320px] px-3 h-[520px]"
                    >
                      <motion.div
                        className="h-full"
                        whileHover={reduceMotion ? undefined : { y: -8 }}
                        transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      >
                        <StoryCard story={story} />
                      </motion.div>
                    </div>
                  ))}
                </motion.div>
              </div>

              <button
                onClick={() => step1(1)}
                aria-label="Next"
                className="shrink-0 w-10 h-10 rounded-full bg-accent border-2 border-accent/60 shadow-glass-lg hover:bg-accent/90 flex items-center justify-center transition-all active:scale-95"
              >
                <ChevronRight className="w-5 h-5 text-accent-foreground" />
              </button>
            </div>

            {n <= 12 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {stories.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === activeIndex ? "w-6 bg-accent" : "w-2 bg-accent/25 hover:bg-accent/40"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <Reveal className="flex justify-center mt-12" delay={0.1}>
          <Link
            to="/explore"
            className="group inline-flex items-center justify-center gap-2 px-8 h-14 rounded-2xl bg-accent text-accent-foreground text-lg font-medium hover:bg-accent/90 transition-all duration-300 border-2 border-accent/50 shadow-sage hover:shadow-md hover:-translate-y-0.5"
          >
            Explore every organization
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
};

export default LiveStoriesSection;
