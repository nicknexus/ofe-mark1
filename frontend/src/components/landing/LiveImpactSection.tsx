import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ArrowRight, MapPin, Calendar, Play, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { publicApi, type Showcase, type ShowcaseStory } from "../../services/publicApi";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { AnimatedNumber } from "./AnimatedNumber";
import { easeOut } from "./motion";

// Resolve a usable thumbnail for a story's media.
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

const StatCard = ({ value, label, delay }: { value: number; label: string; delay: number }) => (
  <StaggerItem>
    <motion.div
      className="glass-card rounded-2xl px-5 py-6 text-center h-full"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: easeOut }}
    >
      <p className="text-3xl sm:text-4xl font-fraunces font-light text-sage-deep mb-1">
        <AnimatedNumber value={value} duration={1.6 + delay} />
      </p>
      <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
    </motion.div>
  </StaggerItem>
);

const StoryCard = ({ story }: { story: ShowcaseStory }) => {
  const thumb = resolveThumb(story);
  const to =
    story.org_slug && story.initiative_slug
      ? `/org/${story.org_slug}/${story.initiative_slug}/story/${story.id}`
      : story.org_slug
      ? `/org/${story.org_slug}`
      : "/explore";
  const accent = story.org_brand_color || "#c0dfa1";

  return (
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="h-full"
      >
        <Link
          to={to}
          className="group block h-full rounded-2xl overflow-hidden bg-white border border-border/60 shadow-glass hover:shadow-glass-lg transition-shadow"
        >
          {/* Media */}
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sage-light/40 to-accent/10">
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
                <span className="font-fraunces text-2xl font-light text-foreground/40 px-6 text-center line-clamp-3">
                  {story.title}
                </span>
              </div>
            )}
            {(story.media_type === "video") && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-white/85 backdrop-blur flex items-center justify-center shadow-lg">
                  <Play className="w-5 h-5 text-foreground translate-x-0.5" fill="currentColor" />
                </div>
              </div>
            )}
            {/* Live badge */}
            <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[10px] font-semibold uppercase tracking-wider text-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              Live
            </span>
          </div>

          {/* Body */}
          <div className="p-5">
            {/* Org row */}
            <div className="flex items-center gap-2 mb-3">
              <span
                className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${accent}26` }}
              >
                {story.org_logo_url ? (
                  <img src={story.org_logo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-foreground/60" />
                )}
              </span>
              <span className="text-xs font-medium text-muted-foreground truncate">
                {story.org_name || "Nexus organization"}
              </span>
            </div>

            <h3 className="font-semibold text-foreground mb-2 leading-snug line-clamp-2">
              {story.title}
            </h3>
            {story.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{story.description}</p>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              {story.location_name ? (
                <span className="flex items-center gap-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="truncate">{story.location_name}</span>
                </span>
              ) : (
                <span />
              )}
              {safeDate(story.date_represented) && (
                <span className="flex items-center gap-1 flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  {safeDate(story.date_represented)}
                </span>
              )}
            </div>
          </div>
        </Link>
      </motion.div>
  );
};

const SkeletonCard = () => (
  <div className="rounded-2xl overflow-hidden bg-white border border-border/60 shadow-glass">
    <div className="aspect-[4/3] bg-muted animate-pulse" />
    <div className="p-5 space-y-3">
      <div className="h-3 w-1/3 bg-muted rounded animate-pulse" />
      <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
      <div className="h-3 w-full bg-muted rounded animate-pulse" />
    </div>
  </div>
);

const LiveImpactSection = () => {
  const [data, setData] = useState<Showcase | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  const reduceMotion = useReducedMotion();

  // Horizontal carousel — shows 3 cards at a time and scrolls through the rest.
  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", containScroll: "trimSnaps" },
    reduceMotion ? [] : [autoplay.current]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snaps, setSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    const onReInit = () => {
      setSnaps(emblaApi.scrollSnapList());
      onSelect();
    };
    onReInit();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onReInit);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onReInit);
    };
  }, [emblaApi, data]);

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

  // If there's genuinely nothing to show (fresh install / API down), render
  // nothing rather than an awkward empty band.
  if (status === "empty") return null;

  const stats = data?.stats;
  const statCards = stats
    ? [
        { value: stats.organizations, label: stats.organizations === 1 ? "Organization" : "Organizations" },
        { value: stats.stories, label: "Moments captured" },
        { value: stats.countries, label: stats.countries === 1 ? "Country" : "Countries" },
        { value: stats.locations, label: "Locations" },
      ].filter((s) => s.value > 0)
    : [];

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sage-light/10 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <Reveal className="max-w-2xl mb-10">
          <p className="inline-flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-4">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Live on Nexus right now
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-foreground leading-tight">
            Real organizations. Real moments. Happening as you read this.
          </h2>
        </Reveal>

        {/* Live stats */}
        {statCards.length > 0 && (
          <StaggerGroup className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12" gap={0.08}>
            {statCards.map((s, i) => (
              <StatCard key={s.label} value={s.value} label={s.label} delay={i * 0.05} />
            ))}
          </StaggerGroup>
        )}

        {/* Story cards — horizontal carousel, 3 in view */}
        {status === "loading" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Viewport */}
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex -ml-6">
                {data!.stories.map((story) => (
                  <div
                    key={story.id}
                    className="min-w-0 flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] pl-6"
                  >
                    <StoryCard story={story} />
                  </div>
                ))}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-6">
              {/* Dots */}
              <div className="flex items-center gap-2">
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
              {/* Arrows */}
              <div className="flex items-center gap-2">
                <button
                  onClick={scrollPrev}
                  aria-label="Previous"
                  className="w-10 h-10 rounded-xl bg-white border border-border/60 shadow-glass hover:shadow-glass-lg hover:border-accent/40 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={scrollNext}
                  aria-label="Next"
                  className="w-10 h-10 rounded-xl bg-white border border-border/60 shadow-glass hover:shadow-glass-lg hover:border-accent/40 flex items-center justify-center transition-all active:scale-95"
                >
                  <ChevronRight className="w-5 h-5 text-foreground" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
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
