import { Button } from "../ui/button";
import { ArrowRight, Building2, MapPin, Sparkles } from "lucide-react";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { easeOut } from "./motion";
import { AnimatedNumber } from "./AnimatedNumber";
import { formatDate } from "../../utils";
import { publicApi, type ShowcaseImpactClaim } from "../../services/publicApi";
import type { GlobeLocation } from "./ImpactGlobe";
import { OrganizationGlobeErrorBoundary } from "../public/organization/OrganizationGlobeErrorBoundary";
import { DEMO_BOOKING_URL } from "./constants";

const ImpactGlobe = lazy(() => import("./ImpactGlobe"));

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
};

const CARD_SLOTS = [
  { className: "absolute top-0 left-0", depth: -0.5 },
  { className: "absolute bottom-0 right-0", depth: 0.7 },
  { className: "absolute bottom-0 left-0", depth: -0.6 },
  { className: "absolute top-0 right-0", depth: 0.5 },
  { className: "absolute top-1/2 -translate-y-1/2 left-0", depth: -0.9 },
] as const;

const CARD_ROTATION_MS = 5_000;

const FALLBACK_CLAIMS: ShowcaseImpactClaim[] = [
  {
    id: "demo-1",
    value: 8000,
    lat: -1.2921,
    lng: 36.8219,
    location_name: "Nairobi",
    country: "Kenya",
    org_name: "Education First",
    metric_title: "students educated",
    unit_of_measurement: "students",
    metric_type: "number",
    date_represented: "2024-01-01",
  },
  {
    id: "demo-2",
    value: 15000,
    lat: 28.6139,
    lng: 77.209,
    location_name: "New Delhi",
    country: "India",
    org_name: "Health Alliance",
    metric_title: "vaccines delivered",
    unit_of_measurement: "vaccines",
    metric_type: "number",
    date_represented: "2024-01-01",
  },
  {
    id: "demo-3",
    value: 5000,
    lat: -23.5505,
    lng: -46.6333,
    location_name: "São Paulo",
    country: "Brazil",
    org_name: "Shelter Network",
    metric_title: "families housed",
    unit_of_measurement: "families",
    metric_type: "number",
    date_represented: "2024-01-01",
  },
];

function formatPlace(claim: ShowcaseImpactClaim) {
  if (claim.location_name && claim.country) return `${claim.location_name}, ${claim.country}`;
  return claim.location_name || claim.country || "Impact location";
}

function formatClaimSuffix(claim: ShowcaseImpactClaim) {
  return claim.metric_type === "percentage" ? "%" : "";
}

function formatClaimValue(claim: ShowcaseImpactClaim) {
  const suffix = formatClaimSuffix(claim);
  if (claim.metric_type === "percentage") {
    return `${claim.value}${suffix}`;
  }
  const unit = claim.unit_of_measurement?.trim();
  return unit ? `${claim.value} ${unit}` : String(claim.value);
}

function formatMetricName(claim: ShowcaseImpactClaim) {
  if (claim.metric_title?.trim()) return claim.metric_title.trim();
  if (claim.label?.trim()) return claim.label.trim();
  return "";
}

function formatClaimDate(claim: ShowcaseImpactClaim) {
  if (claim.date_range_start && claim.date_range_end) {
    return `${formatDate(claim.date_range_start, { month: "short", day: "numeric" })} – ${formatDate(claim.date_range_end)}`;
  }
  if (claim.date_represented) {
    return formatDate(claim.date_represented);
  }
  return "";
}

function getOrgKey(claim: ShowcaseImpactClaim) {
  return claim.org_slug || claim.org_name || claim.id;
}

function nextActiveIndex(pool: ShowcaseImpactClaim[], currentIndex: number) {
  if (pool.length <= 1) return currentIndex + 1;

  const currentOrg = getOrgKey(pool[currentIndex % pool.length]);
  for (let step = 1; step < pool.length; step++) {
    const candidate = pool[(currentIndex + step) % pool.length];
    if (getOrgKey(candidate) !== currentOrg) {
      return currentIndex + step;
    }
  }
  return currentIndex + 1;
}

interface FloatingCardProps {
  claim: ShowcaseImpactClaim;
  gradient: string;
  className: string;
  depth: number;
  parallaxX: any;
  parallaxY: any;
}

const FloatingCard = ({
  claim, gradient, className, depth, parallaxX, parallaxY,
}: FloatingCardProps) => {
  const x = useTransform(parallaxX, (v: number) => v * depth);
  const y = useTransform(parallaxY, (v: number) => v * depth);
  const accent = claim.org_brand_color || "#c0dfa1";
  const dateLabel = formatClaimDate(claim);

  return (
    <motion.div
      className={`relative z-20 w-[300px] sm:w-[320px] ${className}`}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 12 }}
      transition={{ duration: 0.55, ease: easeOut }}
      whileHover={{ scale: 1.06, transition: { type: "spring", stiffness: 300, damping: 20 } }}
    >
      <div
        className={`absolute -top-6 -left-6 z-20 w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden shadow-glass-lg ring-[3px] ring-white/90 ${
          claim.org_logo_url ? "bg-white" : `bg-gradient-to-br ${gradient}`
        }`}
        style={claim.org_logo_url ? undefined : { backgroundColor: `${accent}26` }}
      >
        {claim.org_logo_url ? (
          <img src={claim.org_logo_url} alt="" className="w-full h-full object-contain p-1.5" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="w-6 h-6 text-foreground/70" />
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl shadow-glass-lg p-4 pt-4 pl-11 sm:pl-14 text-left">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {claim.org_name && (
              <p className="text-sm font-semibold text-foreground truncate">{claim.org_name}</p>
            )}
            <p className={`flex items-center gap-1 text-sm truncate ${claim.org_name ? "text-muted-foreground" : "font-semibold text-foreground"}`}>
              <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0" />
              <span className="truncate">{formatPlace(claim)}</span>
            </p>
            <p className="text-sm text-muted-foreground leading-snug mt-0.5">
              <span className="font-medium text-foreground">
                <AnimatedNumber value={claim.value} suffix={formatClaimSuffix(claim)} duration={2} />
                {claim.metric_type !== "percentage" && claim.unit_of_measurement
                  ? ` ${claim.unit_of_measurement}`
                  : ""}
              </span>
              {formatMetricName(claim) && (
                <span className="block truncate">{formatMetricName(claim)}</span>
              )}
              {dateLabel && (
                <span className="block text-xs text-muted-foreground/80 mt-0.5">{dateLabel}</span>
              )}
            </p>
          </div>
          {claim.evidence_image_url && (
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl overflow-hidden flex-shrink-0 ring-1 ring-white/40">
              <img
                src={claim.evidence_image_url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const HeroSection = () => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const [claims, setClaims] = useState<ShowcaseImpactClaim[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const px = useSpring(mvX, { stiffness: 60, damping: 20 });
  const py = useSpring(mvY, { stiffness: 60, damping: 20 });

  useEffect(() => {
    let alive = true;
    publicApi
      .getShowcase(9)
      .then((res) => {
        if (!alive) return;
        if (res.impact_claims?.length) {
          setClaims(res.impact_claims);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const hasRealClaims = claims.length > 0;
  // One card per charity. Claims arrive newest-first with a per-charity
  // cooldown (see PublicService.getShowcase), so taking the first claim per
  // org keeps each charity's most recent work and preserves that ordering —
  // the busiest charities lead, dormant ones trail.
  //
  // This used to fall back to the raw claim list when fewer than 5 distinct
  // orgs came back — which fired constantly, because the server was only
  // sending 2. That made the cards ping-pong between the same two charities.
  // The dedupe is now unconditional: fewer orgs means a shorter cycle, never
  // a repeat of the same org.
  const claimPool = useMemo(() => {
    if (!hasRealClaims) return FALLBACK_CLAIMS;
    const seen = new Set<string>();
    const distinctByOrg: ShowcaseImpactClaim[] = [];
    for (const claim of claims) {
      const key = getOrgKey(claim);
      if (seen.has(key)) continue;
      seen.add(key);
      distinctByOrg.push(claim);
    }
    return distinctByOrg.length > 0 ? distinctByOrg : claims;
  }, [hasRealClaims, claims]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => nextActiveIndex(claimPool, prev));
    }, CARD_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, [reduceMotion, claimPool]);

  const activeClaim = claimPool[activeIndex % claimPool.length];
  const activeSlot = CARD_SLOTS[activeIndex % CARD_SLOTS.length];

  const globeLocations = useMemo<GlobeLocation[]>(() => {
    return claimPool.map((claim) => ({
      lat: claim.lat,
      lng: claim.lng,
      name: formatPlace(claim),
      label: formatMetricName(claim)
        ? `${formatClaimValue(claim)} · ${formatMetricName(claim)}`
        : formatClaimValue(claim),
    }));
  }, [claimPool]);

  const focusLocation = useMemo(() => {
    if (!activeClaim) return null;
    return { lat: activeClaim.lat, lng: activeClaim.lng };
  }, [activeClaim]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    mvX.set(((e.clientX - rect.left) / rect.width - 0.5) * 40);
    mvY.set(((e.clientY - rect.top) / rect.height - 0.5) * 40);
  };

  const glowX = useTransform(px, (v) => v * 0.6);
  const glowY = useTransform(py, (v) => v * 0.6);

  return (
    <section
      ref={heroRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-screen flex items-center overflow-hidden pt-32 lg:pt-24"
    >
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-[5%] w-24 h-24 border-2 border-accent/20 rounded-2xl rotate-12 animate-float" />
        <div className="absolute top-[15%] right-[15%] w-16 h-16 bg-accent/15 rounded-full animate-float-delayed" />
        <div className="absolute bottom-1/4 left-[3%] w-12 h-12 bg-sage-light/40 rounded-xl rotate-45 animate-float-slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-4 items-start lg:items-center">
          <motion.div
            className="text-center lg:text-left order-2 lg:order-1 lg:-mt-8"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            <motion.p variants={item} className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-sm">
                <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="text-accent-foreground font-medium">Plug & play impact experience engine</span>
              </span>
            </motion.p>

            <motion.h1 variants={item} className="text-4xl sm:text-5xl lg:text-6xl font-fraunces font-light text-foreground leading-[1.15] mb-8">
              Your impact is real.<br />
              Let the world{" "}
              <span className="relative inline-block">
                <span className="relative z-10 italic inline-block pr-2 bg-gradient-to-r from-foreground via-slate-light to-foreground bg-clip-text text-transparent">
                  experience
                </span>
                <motion.svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 200 12"
                  fill="none"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                >
                  <motion.path
                    d="M2 8C50 2 150 2 198 8"
                    stroke="#c0dfa1"
                    strokeWidth="4"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 0.9, ease: easeOut, delay: 0.9 }}
                  />
                </motion.svg>
              </span>{" "}
              it.
            </motion.h1>

            <motion.p variants={item} className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10 leading-relaxed">
              The data, evidence, and life-changing moments you already collect.
              Now easier to capture. All connected as a liveable impact experience.
            </motion.p>

            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button
                variant="hero"
                size="xl"
                className="group"
                onClick={() =>
                  document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Start sharing impact
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button variant="hero-outline" size="xl" asChild>
                <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
                  Book a demo
                </a>
              </Button>
            </motion.div>
          </motion.div>

          <div className="relative order-1 lg:order-2 h-[440px] sm:h-[540px] lg:h-[660px] max-lg:mt-8">
            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ x: glowX, y: glowY }}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.2 }}
            >
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center scale-[1.06]">
                  <div className="w-52 h-52 rounded-full bg-gradient-to-br from-accent/60 to-accent/30 animate-pulse" />
                </div>
              }>
                <div className="w-full h-full scale-[1.06]">
                  <OrganizationGlobeErrorBoundary>
                    <ImpactGlobe
                      locations={globeLocations}
                      focusLocation={focusLocation}
                    />
                  </OrganizationGlobeErrorBoundary>
                </div>
              </Suspense>
            </motion.div>

            <div className="absolute inset-x-0 top-10 bottom-8 sm:top-12 sm:bottom-10 z-20 pointer-events-none">
              <AnimatePresence mode="wait">
                {hasRealClaims && activeClaim && activeSlot && (
                  <FloatingCard
                    key={activeIndex}
                    claim={activeClaim}
                    gradient="from-accent to-sage-light"
                    className={`pointer-events-auto ${activeSlot.className}`}
                    depth={activeSlot.depth}
                    parallaxX={px}
                    parallaxY={py}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2 text-muted-foreground/60"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        <span className="text-xs uppercase tracking-[0.2em]">Scroll</span>
        <div className="w-5 h-8 rounded-full border-2 border-muted-foreground/40 flex justify-center pt-1.5">
          <motion.div
            className="w-1 h-1.5 rounded-full bg-accent"
            animate={{ y: [0, 8, 0], opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
