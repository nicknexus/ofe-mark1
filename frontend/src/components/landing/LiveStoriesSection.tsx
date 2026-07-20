import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Building2, MapPin, Calendar, Play } from "lucide-react";
import { format } from "date-fns";
import { publicApi, type ShowcaseStory } from "../../services/publicApi";
import { Reveal } from "./Reveal";
import { easeOut } from "./motion";

const SLOT_COUNT = 3;
const ROTATE_MS = 3200;

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
      className="group absolute inset-0 flex flex-col rounded-2xl overflow-hidden bg-white border border-border/50 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28),0_4px_10px_-6px_rgba(70,83,96,0.18)] hover:border-accent/40 hover:shadow-[0_18px_40px_-12px_rgba(70,83,96,0.35)] transition-[box-shadow,border-color] duration-300"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-sage-light/40 to-accent/10 shrink-0">
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
            <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="w-4 h-4 text-foreground translate-x-0.5" fill="currentColor" />
            </div>
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-semibold uppercase tracking-wider text-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Live
        </span>
      </div>

      <div className="p-3.5 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${accent}26` }}
          >
            {story.org_logo_url ? (
              <img src={story.org_logo_url} alt="" decoding="async" className="w-full h-full object-cover" />
            ) : (
              <Building2 className="w-3 h-3 text-foreground/60" />
            )}
          </span>
          <span className="text-xs font-medium text-muted-foreground truncate">
            {story.org_name || "Nexus organization"}
          </span>
        </div>

        <h3 className="font-semibold text-sm text-foreground mb-1 leading-snug line-clamp-3">
          {story.title}
        </h3>
        {story.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">{story.description}</p>
        )}

        <div className="mt-auto flex items-center justify-between text-[11px] text-muted-foreground">
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
  <div className="absolute inset-0 flex flex-col rounded-2xl overflow-hidden bg-white border border-border/60 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28)]">
    <div className="aspect-[16/10] bg-muted animate-pulse shrink-0" />
    <div className="p-3.5 space-y-2">
      <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
      <div className="h-3.5 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-3 w-full bg-muted rounded animate-pulse" />
    </div>
  </div>
);

/**
 * Warm the browser cache for every thumbnail during idle time, off the main
 * scroll path. `.decode()` forces the decode to happen now (async, off the
 * critical path) so painting the image later — as the card scrolls in or
 * swaps — is instant and never janks the scroll.
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

/** Fisher–Yates shuffle of pool indices [0..n). */
function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const LiveStoriesSection = () => {
  const [pool, setPool] = useState<ShowcaseStory[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");
  const [slots, setSlots] = useState<number[]>([]); // indices into `pool`
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  const rotateSlotRef = useRef(0);
  // Timestamp of the last scroll event. Card swaps mount new DOM (images,
  // sometimes <video>), which is layout+paint work — never do it mid-scroll.
  const lastScrollRef = useRef(0);
  // Shuffled walk order over the whole pool + a pointer. Advancing the pointer
  // (and skipping only currently-visible cards) means every story is shown once
  // before any repeats — so a card that just left never pops back in next.
  const orderRef = useRef<number[]>([]);
  const orderPosRef = useRef(0);

  useEffect(() => {
    let alive = true;
    publicApi
      .getShowcase(24)
      .then((res) => {
        if (!alive) return;
        const stories = res?.stories ?? [];
        if (stories.length === 0) {
          setStatus("empty");
          return;
        }
        setPool(stories);
        prefetchThumbs(stories);
        const order = shuffledIndices(stories.length);
        orderRef.current = order;
        // Seed slots from the front of the shuffled order; the pointer starts
        // just past them so the first swaps pull brand-new stories.
        const count = Math.min(SLOT_COUNT, stories.length);
        orderPosRef.current = count;
        setSlots(order.slice(0, count));
        setStatus("ready");
      })
      .catch(() => alive && setStatus("empty"));
    return () => {
      alive = false;
    };
  }, []);

  // Only rotate while the section is on screen — no off-screen timers/work.
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

  useEffect(() => {
    if (!inView) return;
    const onScroll = () => {
      lastScrollRef.current = performance.now();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [inView]);

  useEffect(() => {
    if (status !== "ready" || !inView) return;
    if (pool.length <= slots.length) return; // nothing new to swap in

    const timer = setInterval(() => {
      // Skip the swap entirely while the user is (or just was) scrolling; the
      // next tick will pick it up once the page has settled.
      if (performance.now() - lastScrollRef.current < 500) return;
      setSlots((prev) => {
        const order = orderRef.current;
        if (order.length === 0) return prev;
        // Walk the shuffled order forward, skipping any card currently on
        // screen, until we land on a fresh one.
        let next = -1;
        for (let tries = 0; tries < order.length; tries++) {
          const cand = order[orderPosRef.current % order.length];
          orderPosRef.current += 1;
          if (!prev.includes(cand)) {
            next = cand;
            break;
          }
        }
        if (next === -1) return prev;
        const slot = rotateSlotRef.current % prev.length;
        rotateSlotRef.current += 1;
        const updated = [...prev];
        updated[slot] = next;
        return updated;
      });
    }, ROTATE_MS);

    return () => clearInterval(timer);
  }, [status, inView, pool, slots.length]);

  const slotCards = useMemo(
    () => slots.map((i) => pool[i]).filter(Boolean),
    [slots, pool]
  );

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
            Real organizations. Real moments.
            <br className="hidden sm:block" />
            {" "}Happening as you read this.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {status === "loading"
            ? Array.from({ length: SLOT_COUNT }).map((_, i) => (
                <div key={i} className="relative h-[420px]">
                  <SkeletonCard />
                </div>
              ))
            : slotCards.map((story, slot) => (
                <div key={slot} className="relative h-[420px]">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={story.id}
                      className="absolute inset-0"
                      initial={{ opacity: 0, scale: 0.96, y: 14 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98, y: -10 }}
                      transition={{ duration: 0.5, ease: easeOut }}
                    >
                      <StoryCard story={story} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              ))}
        </div>

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
