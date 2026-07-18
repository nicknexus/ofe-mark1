import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useReducedMotion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, MapPin, Calendar, Play, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { publicApi, type Showcase, type ShowcaseStory } from "../../services/publicApi";
import { Reveal } from "./Reveal";

type EmblaApi = NonNullable<ReturnType<typeof useEmblaCarousel>[1]>;

function resolveThumb(story: ShowcaseStory): { kind: "img" | "video" | "none"; src?: string } {
  const url = story.media_url;
  if (!url) return { kind: "none" };
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (yt) return { kind: "img", src: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg` };
  if (story.media_type === "photo") return { kind: "img", src: url };
  if (story.media_type === "video") return { kind: "video", src: url };
  return { kind: "none" };
}

function safeDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "" : format(d, "MMM d, yyyy");
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

const TWEEN_FACTOR = 0.9;

function StoryCard({
  story,
  active,
}: {
  story: ShowcaseStory;
  active?: boolean;
}) {
  const thumb = resolveThumb(story);
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
      className={`group relative block h-full rounded-2xl overflow-hidden bg-white border transition-[box-shadow,border-color] duration-300 ${
        active
          ? "border-accent/40 shadow-[0_18px_40px_-12px_rgba(70,83,96,0.35),0_8px_16px_-8px_rgba(70,83,96,0.2),0_0_0_1px_rgba(192,223,161,0.25)]"
          : "border-border/50 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28),0_4px_10px_-6px_rgba(70,83,96,0.18)]"
      }`}
      style={{
        transformStyle: "preserve-3d",
        backgroundImage:
          "linear-gradient(180deg, rgba(255,255,255,1) 0%, rgba(255,255,255,0.96) 100%)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px z-20"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-3 left-[8%] right-[8%] h-6 rounded-[100%] blur-md z-0"
        style={{
          background: active ? "rgba(70,83,96,0.28)" : "rgba(70,83,96,0.16)",
        }}
      />

      <div className="relative z-10">
        <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-sage-light/40 to-accent/10">
          {thumb.kind === "img" && (
            <img
              src={thumb.src}
              alt={story.title}
              loading="lazy"
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
          {thumb.kind === "none" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-fraunces text-xl font-light text-foreground/40 px-6 text-center line-clamp-3">
                {story.title}
              </span>
            </div>
          )}
          {story.media_type === "video" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-white/85 backdrop-blur flex items-center justify-center shadow-lg">
                <Play className="w-4 h-4 text-foreground translate-x-0.5" fill="currentColor" />
              </div>
            </div>
          )}
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/85 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            Live
          </span>
        </div>

        <div className="p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accent}26` }}
            >
              {story.org_logo_url ? (
                <img src={story.org_logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 className="w-3 h-3 text-foreground/60" />
              )}
            </span>
            <span className="text-xs font-medium text-muted-foreground truncate">
              {story.org_name || "Nexus organization"}
            </span>
          </div>

          <h3 className="font-semibold text-sm text-foreground mb-1 leading-snug line-clamp-2">
            {story.title}
          </h3>
          {story.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5">{story.description}</p>
          )}

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
      </div>
    </Link>
  );
}

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden bg-white border border-border/60 shadow-[0_12px_28px_-10px_rgba(70,83,96,0.28)]">
    <div className="aspect-[16/10] bg-muted animate-pulse" />
    <div className="p-3.5 space-y-2">
      <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
      <div className="h-3.5 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-3 w-full bg-muted rounded animate-pulse" />
    </div>
  </div>
);

function applyCoverflow(
  emblaApi: EmblaApi,
  slideNodes: HTMLElement[],
  reduceMotion: boolean | null
) {
  const scrollProgress = emblaApi.scrollProgress();
  const engine = emblaApi.internalEngine();
  const snapCount = emblaApi.scrollSnapList().length;

  emblaApi.scrollSnapList().forEach((scrollSnap: number, snapIndex: number) => {
    let diffToTarget = scrollSnap - scrollProgress;
    const slidesInSnap = engine.slideRegistry[snapIndex] as number[];

    slidesInSnap.forEach((slideIndex: number) => {
      const node = slideNodes[slideIndex];
      if (!node) return;

      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((loopItem: { index: number; target: () => number }) => {
          const target = loopItem.target();
          if (slideIndex === loopItem.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress);
            if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress);
          }
        });
      }

      if (reduceMotion) {
        node.style.transform = "";
        node.style.opacity = "1";
        node.style.zIndex = String(Math.round(1 - Math.abs(diffToTarget) * 10));
        return;
      }

      const abs = Math.abs(diffToTarget);
      const proximity = clamp(1 - abs * TWEEN_FACTOR * snapCount, 0, 1);
      const scale = 0.78 + proximity * 0.3;
      const rotateY = clamp(diffToTarget * snapCount * -18, -28, 28);
      const translateY = (1 - proximity) * 28;
      const opacity = 0.55 + proximity * 0.45;

      node.style.transform = `translateY(${translateY}px) scale(${scale}) rotateY(${rotateY}deg)`;
      node.style.opacity = String(opacity);
      node.style.zIndex = String(Math.round(proximity * 20));
    });
  });
}

const LiveImpactSection = () => {
  const [data, setData] = useState<Showcase | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  const reduceMotion = useReducedMotion();
  const slideNodesRef = useRef<HTMLElement[]>([]);

  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", containScroll: false, skipSnaps: false },
    reduceMotion ? [] : [autoplay.current]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  const setSlideRef = useCallback((el: HTMLDivElement | null, index: number) => {
    if (el) slideNodesRef.current[index] = el;
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const tween = () => applyCoverflow(emblaApi, slideNodesRef.current, reduceMotion);
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    const onReInit = () => {
      setSnaps(emblaApi.scrollSnapList());
      onSelect();
      tween();
    };

    onReInit();
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", tween);
    emblaApi.on("reInit", onReInit);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("scroll", tween);
      emblaApi.off("reInit", onReInit);
    };
  }, [emblaApi, data, reduceMotion]);

  useEffect(() => {
    let alive = true;
    publicApi
      .getShowcase(9)
      .then((res) => {
        if (!alive) return;
        if (res && res.stories && res.stories.length > 0) {
          setData(res);
          setStatus("ready");
        } else {
          setStatus("empty");
        }
      })
      .catch(() => alive && setStatus("empty"));
    return () => {
      alive = false;
    };
  }, []);

  if (status === "empty") return null;

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
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

        {status === "loading" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="relative">
            <div
              className="overflow-hidden py-6"
              ref={emblaRef}
              style={{ perspective: reduceMotion ? undefined : 1200 }}
            >
              <div className="flex touch-pan-y" style={{ transformStyle: "preserve-3d" }}>
                {data!.stories.map((story, i) => (
                  <div
                    key={story.id}
                    ref={(el) => setSlideRef(el, i)}
                    className="min-w-0 flex-[0_0_82%] sm:flex-[0_0_52%] lg:flex-[0_0_38%] px-3 sm:px-4 will-change-transform"
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <StoryCard story={story} active={i === selectedIndex} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-2 px-1">
              <button
                onClick={scrollPrev}
                aria-label="Previous"
                className="w-10 h-10 shrink-0 rounded-xl bg-white border border-border/60 shadow-glass hover:shadow-glass-lg hover:border-accent/40 flex items-center justify-center transition-all active:scale-95"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>

              <div className="flex items-center justify-center gap-2 flex-1">
                {snaps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollTo(i)}
                    aria-label={`Go to slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === selectedIndex ? "w-6 bg-accent" : "w-2 bg-accent/25 hover:bg-accent/40"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={scrollNext}
                aria-label="Next"
                className="w-10 h-10 shrink-0 rounded-xl bg-white border border-border/60 shadow-glass hover:shadow-glass-lg hover:border-accent/40 flex items-center justify-center transition-all active:scale-95"
              >
                <ChevronRight className="w-5 h-5 text-foreground" />
              </button>
            </div>
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

export default LiveImpactSection;
