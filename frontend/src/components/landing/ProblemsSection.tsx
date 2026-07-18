import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button } from "../ui/button";
import { ArrowRight, Check, Heart } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { easeOut, spring, viewportOnce } from "./motion";

function useDesktopSwap() {
  const [enabled, setEnabled] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setEnabled(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return enabled;
}

/** Progress 0→1 while the pin runway scrolls through the viewport. */
function usePinProgress(ref: RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    const measure = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      if (total <= 0) {
        setProgress(0);
        return;
      }
      const next = Math.min(1, Math.max(0, -rect.top / total));
      setProgress(next);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);

  return progress;
}

interface ProblemsSectionProps {
  onGetStarted?: () => void;
}

const ILL_STROKE = "#6B8F87";
const ILL_MUTED = "#B0BABF";
const ILL_FILL = "#E8F3DF";
const ILL_SOFT = "#F3F5F4";
const ILL_OK = "#8FB49B";

function LostIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <circle cx="52" cy="38" r="11" fill={ILL_FILL} stroke={ILL_STROKE} strokeWidth="1.5" />
      <path
        d="M34 88c3-16 11-24 18-24s15 8 18 24"
        fill={ILL_SOFT}
        stroke={ILL_STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="66" y="48" width="15" height="24" rx="3" fill="#2A333A" />
      <rect x="69" y="52" width="9" height="14" rx="1.5" fill="#97C7CB" />

      <path d="M90 34h24" stroke={ILL_MUTED} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
      <path d="M90 60h24" stroke={ILL_MUTED} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
      <path d="M90 86h24" stroke={ILL_MUTED} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />

      <g opacity="0.5">
        <rect x="122" y="20" width="40" height="28" rx="3" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <rect x="132" y="34" width="5" height="8" rx="0.5" fill="#C0DFA1" />
        <rect x="140" y="30" width="5" height="12" rx="0.5" fill="#97C7CB" />
        <rect x="148" y="36" width="5" height="6" rx="0.5" fill="#8FB49B" />
      </g>
      <g opacity="0.42">
        <rect x="128" y="54" width="28" height="34" rx="3" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <path d="M135 66h14M135 74h10M135 82h12" stroke={ILL_MUTED} strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g opacity="0.35">
        <circle cx="136" cy="102" r="7" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <circle cx="152" cy="102" r="7" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <circle cx="168" cy="102" r="7" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
      </g>
    </svg>
  );
}

function BuriedIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <rect x="40" y="20" width="120" height="72" rx="7" fill="#2A333A" />
      <rect x="47" y="27" width="106" height="54" rx="3" fill={ILL_SOFT} />
      <path d="M32 92h136l-12 12H44z" fill="#3B454F" />
      <rect x="88" y="96" width="24" height="3" rx="1.5" fill={ILL_STROKE} opacity="0.35" />

      <path d="M56 42h16l5-6h26v34H56z" fill="#C0DFA1" stroke={ILL_STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="78" y="50" width="42" height="30" rx="3" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
      <path d="M78 58h42M92 50v30M106 50v30M120 50v30" stroke={ILL_MUTED} strokeWidth="1.2" />
      <rect x="108" y="40" width="38" height="26" rx="3" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
      <path d="M110 43l17 11 17-11" stroke={ILL_STROKE} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="142" cy="40" r="8" fill="#A65D57" />
      <text x="142" y="43.5" textAnchor="middle" fill="white" fontSize="7" fontWeight="700" fontFamily="system-ui">117</text>
    </svg>
  );
}

function DisconnectedIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <rect x="22" y="20" width="62" height="80" rx="5" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
      <path d="M34 36h38M34 44h26" stroke={ILL_MUTED} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="34" y="58" width="8" height="26" rx="1.5" fill="#C0DFA1" />
      <rect x="46" y="66" width="8" height="18" rx="1.5" fill="#97C7CB" />
      <rect x="58" y="54" width="8" height="30" rx="1.5" fill={ILL_STROKE} />
      <rect x="70" y="62" width="8" height="22" rx="1.5" fill="#8FB49B" />

      <path d="M106 28v64" stroke={ILL_MUTED} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
      <circle cx="106" cy="60" r="11" fill="white" stroke="#A65D57" strokeWidth="1.5" />
      <path d="M101.5 55.5l9 9M110.5 55.5l-9 9" stroke="#A65D57" strokeWidth="1.8" strokeLinecap="round" />

      <g>
        <circle cx="140" cy="44" r="8" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <path d="M128 68c2-11 7-14 12-14s10 3 12 14" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
      <g>
        <circle cx="168" cy="44" r="8" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <path d="M156 68c2-11 7-14 12-14s10 3 12 14" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
      <g>
        <circle cx="154" cy="78" r="7" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" />
        <path d="M143 100c2-10 6-13 11-13s9 3 11 13" fill={ILL_SOFT} stroke={ILL_MUTED} strokeWidth="1.5" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function CapturedIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <circle cx="48" cy="36" r="12" fill={ILL_FILL} stroke={ILL_STROKE} strokeWidth="1.5" />
      <path
        d="M28 92c4-18 12-26 20-26s16 8 20 26"
        fill={ILL_SOFT}
        stroke={ILL_STROKE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="62" y="46" width="16" height="26" rx="3" fill="#2A333A" />
      <rect x="65" y="50" width="10" height="16" rx="1.5" fill="#97C7CB" />
      <circle cx="70" cy="48" r="1.2" fill="#C0DFA1" />

      <path d="M86 34h22" stroke={ILL_OK} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
      <path d="M86 60h22" stroke={ILL_OK} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />
      <path d="M86 86h22" stroke={ILL_OK} strokeWidth="1.5" strokeDasharray="4 3" strokeLinecap="round" />

      <g>
        <rect x="116" y="18" width="44" height="30" rx="4" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
        <rect x="124" y="26" width="16" height="14" rx="1.5" fill="#C0DFA1" />
        <rect x="142" y="28" width="10" height="10" rx="1" fill="#97C7CB" />
        <circle cx="154" cy="22" r="7" fill="#8FB49B" />
        <path d="M151.5 22l1.8 1.8 3.5-3.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <rect x="120" y="50" width="36" height="28" rx="4" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
        <path d="M128 60h20M128 66h14M128 72h17" stroke={ILL_MUTED} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="154" cy="52" r="7" fill="#8FB49B" />
        <path d="M151.5 52l1.8 1.8 3.5-3.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <rect x="124" y="86" width="32" height="24" rx="4" fill="white" stroke={ILL_STROKE} strokeWidth="1.5" />
        <path d="M131 94h6M131 99h10M131 104h8" stroke={ILL_MUTED} strokeWidth="1.4" strokeLinecap="round" />
        <rect x="144" y="93" width="6" height="6" rx="1" fill="#C0DFA1" />
        <circle cx="154" cy="88" r="7" fill="#8FB49B" />
        <path d="M151.5 88l1.8 1.8 3.5-3.8" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function OrganizedIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <rect x="18" y="14" width="164" height="92" rx="8" fill="#2A333A" />
      <rect x="24" y="20" width="152" height="80" rx="4" fill="#F8FAF9" />
      <rect x="24" y="20" width="152" height="14" rx="4" fill="#E8F3DF" />
      <circle cx="32" cy="27" r="2" fill="#A65D57" />
      <circle cx="40" cy="27" r="2" fill="#C0DFA1" />
      <circle cx="48" cy="27" r="2" fill="#97C7CB" />
      <text x="58" y="30" fill="#2A333A" fontSize="6" fontWeight="600" fontFamily="system-ui">Impact Hub</text>

      <circle cx="62" cy="62" r="22" fill="#E8F3DF" stroke="#97C7CB" strokeWidth="1.2" />
      <ellipse cx="62" cy="62" rx="10" ry="22" stroke="#6B8F87" strokeWidth="1" opacity="0.5" />
      <path d="M40 62h44M62 40v44" stroke="#6B8F87" strokeWidth="0.8" opacity="0.35" />
      <circle cx="54" cy="54" r="2.5" fill="#6B8F87" />
      <circle cx="72" cy="68" r="2" fill="#97C7CB" />

      <rect x="96" y="42" width="68" height="22" rx="3" fill="white" stroke="#D5DDD8" strokeWidth="1" />
      <text x="102" y="52" fill="#6B8F87" fontSize="5" fontFamily="system-ui">Days of Education</text>
      <text x="102" y="60" fill="#2A333A" fontSize="9" fontWeight="700" fontFamily="system-ui">22k</text>

      <rect x="96" y="68" width="68" height="22" rx="3" fill="white" stroke="#D5DDD8" strokeWidth="1" />
      <text x="102" y="78" fill="#6B8F87" fontSize="5" fontFamily="system-ui">Meals Provided</text>
      <text x="102" y="86" fill="#2A333A" fontSize="9" fontWeight="700" fontFamily="system-ui">12k</text>

      <rect x="30" y="90" width="18" height="6" rx="1" fill="#C0DFA1" />
      <rect x="52" y="90" width="18" height="6" rx="1" fill="#97C7CB" />
      <rect x="74" y="90" width="18" height="6" rx="1" fill="#8FB49B" />
      <rect x="96" y="90" width="18" height="6" rx="1" fill="#E8F3DF" stroke="#C0DFA1" />
    </svg>
  );
}

function ConnectedIllustration() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-auto" fill="none" aria-hidden>
      <rect x="28" y="12" width="52" height="96" rx="8" fill="#2A333A" />
      <rect x="32" y="20" width="44" height="80" rx="3" fill="white" />
      <rect x="36" y="26" width="36" height="28" rx="2" fill="#C0DFA1" />
      <circle cx="48" cy="38" r="6" fill="#E8F3DF" stroke="#6B8F87" strokeWidth="1" />
      <path d="M42 48c2-4 4-5 6-5s4 1 6 5" fill="#E8F3DF" stroke="#6B8F87" strokeWidth="1" />
      <path d="M38 60h28M38 66h20M38 72h24" stroke={ILL_MUTED} strokeWidth="1.4" strokeLinecap="round" />
      <rect x="38" y="80" width="28" height="12" rx="2" fill="#E8F3DF" />
      <text x="52" y="88" textAnchor="middle" fill="#6B8F87" fontSize="5" fontWeight="600" fontFamily="system-ui">Story</text>

      <path d="M88 36h18" stroke="#97C7CB" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M88 60h18" stroke="#97C7CB" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M88 84h18" stroke="#97C7CB" strokeWidth="1.4" strokeDasharray="3 3" strokeLinecap="round" />

      <g>
        <circle cx="130" cy="36" r="12" fill={ILL_FILL} stroke={ILL_STROKE} strokeWidth="1.4" />
        <circle cx="130" cy="32" r="5" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <path d="M120 48c2-8 6-10 10-10s8 2 10 10" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <circle cx="142" cy="28" r="6" fill="#97C7CB" />
        <path d="M140 28.5c0-1 0.8-1.8 1.8-1.8s1.8 0.8 1.8 1.8c0 1.6-1.8 2.8-1.8 2.8s-1.8-1.2-1.8-2.8z" fill="white" />
      </g>
      <g>
        <circle cx="148" cy="60" r="12" fill={ILL_FILL} stroke={ILL_STROKE} strokeWidth="1.4" />
        <circle cx="148" cy="56" r="5" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <path d="M138 72c2-8 6-10 10-10s8 2 10 10" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <circle cx="160" cy="52" r="6" fill="#8FB49B" />
        <path d="M157.5 52.5l2 2 3.5-4" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g>
        <circle cx="130" cy="88" r="12" fill={ILL_FILL} stroke={ILL_STROKE} strokeWidth="1.4" />
        <circle cx="130" cy="84" r="5" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <path d="M120 100c2-8 6-10 10-10s8 2 10 10" fill="#E8F3DF" stroke={ILL_STROKE} strokeWidth="1" />
        <circle cx="142" cy="80" r="6" fill="#97C7CB" />
        <path d="M140 80.5c0-1 0.8-1.8 1.8-1.8s1.8 0.8 1.8 1.8c0 1.6-1.8 2.8-1.8 2.8s-1.8-1.2-1.8-2.8z" fill="white" />
      </g>
    </svg>
  );
}

const painPoints = [
  {
    number: 1,
    title: "Impact gets lost.",
    description:
      "Capturing moments and evidence is slow, inconsistent, and easy to avoid.",
    footer: "Inconsistent. Incomplete. Easy to lose.",
    Illustration: LostIllustration,
  },
  {
    number: 2,
    title: "Proof gets buried.",
    description:
      "Progress is scattered across folders, spreadsheets, emails, and disconnected systems.",
    footer: "Hard to find. Hard to trust. Hard to prove.",
    Illustration: BuriedIllustration,
  },
  {
    number: 3,
    title: "Supporters stay disconnected.",
    description:
      "People receive reports and numbers, but cannot explore or experience the impact they helped create.",
    footer: "Reports inform. Experiences don't connect.",
    Illustration: DisconnectedIllustration,
  },
];

const solutionPoints = [
  {
    number: 1,
    title: "Impact gets captured.",
    description:
      "Teams can easily collect real moments and evidence as the work happens.",
    footer: "Simple. Consistent. Easy to collect.",
    Illustration: CapturedIllustration,
  },
  {
    number: 2,
    title: "Proof stays organized.",
    description:
      "Evidence, records, and progress come together in one clear, retrievable dashboard.",
    footer: "One place. Clear proof. Easy to retrieve.",
    Illustration: OrganizedIllustration,
  },
  {
    number: 3,
    title: "Supporters experience the change.",
    description:
      "People can explore real stories, moments, and proof instead of just reading reports.",
    footer: "Reports inform. Real moments connect.",
    Illustration: ConnectedIllustration,
  },
];

const ladder = [
  {
    step: 1,
    title: "Invisible",
    points: ["Nothing is tracked", "Impact goes unrecorded", "No proof exists"],
  },
  {
    step: 2,
    title: "Scattered",
    badge: "Where most are",
    tone: "warning" as const,
    points: [
      "Tracking is inconsistent",
      "Proof can't be trusted",
      "The org doesn't know its own details",
    ],
  },
  {
    step: 3,
    title: "Organized",
    points: [
      "Tracked and recorded, but scattered across systems",
      "Can share and show real impact",
      "Life-changing moments still slip through",
    ],
  },
  {
    step: 4,
    title: "Broadcasting",
    points: [
      "Data is tracked and well managed",
      "People only see what gets broadcast",
      "Anything deeper means asking the org directly",
    ],
  },
  {
    step: 5,
    title: "Full Experience & Trust",
    badge: "This is us",
    tone: "accent" as const,
    points: [
      "Every stakeholder can explore it themselves",
      "Every impact backed by story and evidence",
      "All in one place, open to everyone",
    ],
  },
];

type CardPoint = (typeof painPoints)[number];

function PointCard({
  point,
  tone,
}: {
  point: CardPoint;
  tone: "pain" | "solution";
}) {
  const isSolution = tone === "solution";
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={spring}
      className="h-full rounded-2xl border border-border/60 bg-white flex flex-col overflow-hidden"
    >
      <div className="p-6 sm:p-7 flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-3">
          <span
            className={`w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center shrink-0 ${
              isSolution ? "bg-seafoam text-ink" : "bg-sage-deep"
            }`}
          >
            {point.number}
          </span>
          <h3 className="text-lg sm:text-xl font-bold text-ink leading-snug">
            {point.title}
          </h3>
        </div>
        <p className="text-sm sm:text-[15px] text-muted-foreground leading-relaxed mb-5">
          {point.description}
        </p>
        <div className="mt-auto px-1">
          <point.Illustration />
        </div>
      </div>
      <div
        className={`px-6 sm:px-7 py-3.5 border-t border-border/40 ${
          isSolution ? "bg-[#EAF4F5]" : "bg-[#F3F4F6]"
        }`}
      >
        <p
          className={`text-xs sm:text-sm font-medium flex items-center gap-2 ${
            isSolution ? "text-sage-deep" : "text-ink/70"
          }`}
        >
          {isSolution && <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />}
          {point.footer}
        </p>
      </div>
    </motion.div>
  );
}

function PainHeader() {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-seafoam mb-5">
        The challenge
      </p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-white leading-[1.15] mb-4 max-w-3xl mx-auto">
        Three pain points stand in the way of lasting impact.
      </h2>
      <p className="text-base sm:text-lg text-white/60 max-w-xl mx-auto">
        Too much impact is lost, buried, or invisible.
      </p>
    </div>
  );
}

function SolutionHeader() {
  return (
    <div className="text-center">
      <p className="font-mono text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-seafoam mb-5">
        The shift
      </p>
      <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-white leading-[1.15] mb-4 max-w-3xl mx-auto">
        With Nexus, impact stays{" "}
        <span className="bg-gradient-to-r from-seafoam via-[#B8D9B0] to-lp-sage bg-clip-text text-transparent">
          visible.
        </span>
      </h2>
      <p className="text-base sm:text-lg text-white/60 max-w-xl mx-auto">
        Moments are captured, proof is organized, and supporters can finally experience the change.
      </p>
    </div>
  );
}

function PainFooter({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <div className="rounded-2xl bg-[#F3F4F6] px-5 sm:px-7 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <div className="w-12 h-12 rounded-full bg-sage-deep flex items-center justify-center shrink-0">
        <Heart className="w-5 h-5 text-white" strokeWidth={1.75} />
      </div>
      <p className="flex-1 text-sm sm:text-base text-foreground leading-relaxed">
        We believe{" "}
        <span className="font-bold text-sage-deep">real impact</span>{" "}
        should never be invisible. It should be easy to capture, clear to understand,
        and possible for anyone to experience.
      </p>
      {onGetStarted && (
        <Button
          variant="hero"
          size="lg"
          className="group shrink-0 w-full sm:w-auto"
          onClick={onGetStarted}
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function SolutionFooter({ onGetStarted }: { onGetStarted?: () => void }) {
  return (
    <div className="rounded-2xl bg-[#F3F4F6] px-5 sm:px-7 py-5 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
      <div className="flex-1">
        <p className="text-base sm:text-lg text-foreground leading-snug mb-1">
          Impact stays{" "}
          <span className="font-bold bg-gradient-to-r from-seafoam via-[#7AADA8] to-sage-deep bg-clip-text text-transparent">
            visible
          </span>{" "}
          with Nexus.
        </p>
        <p className="text-sm text-muted-foreground">
          Capture it. Prove it. Let people experience it.
        </p>
      </div>
      {onGetStarted && (
        <Button
          variant="hero"
          size="lg"
          className="group shrink-0 w-full sm:w-auto"
          onClick={onGetStarted}
        >
          Get Started
          <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
        </Button>
      )}
    </div>
  );
}

function StaticPanel({
  tone,
  points,
  header,
  footer,
}: {
  tone: "pain" | "solution";
  points: CardPoint[];
  header: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="rounded-3xl overflow-hidden border border-border/50 shadow-glass">
      <div className="bg-ink px-6 sm:px-10 md:px-16 py-12 sm:py-16">{header}</div>
      <div className="bg-white px-6 sm:px-10 md:px-12 py-10 sm:py-14">
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {points.map((point) => (
            <PointCard key={point.number} point={point} tone={tone} />
          ))}
        </div>
        <div className="mt-10">{footer}</div>
      </div>
    </div>
  );
}

function Layer({
  active,
  children,
  className = "",
}: {
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${className} transition-[opacity,transform] duration-500 ease-out ${
        active
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-3 pointer-events-none"
      }`}
      aria-hidden={!active}
    >
      {children}
    </div>
  );
}

function ScrollSwapPanel({ onGetStarted }: { onGetStarted?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const progress = usePinProgress(containerRef);
  // Hard swap past the midpoint — no dual-visible muddy crossfade
  const showingSolution = progress >= 0.42;

  return (
    <div ref={containerRef} className="relative h-[240vh]">
      <div className="sticky top-14 z-10 py-4">
        <div className="rounded-3xl overflow-hidden border border-border/50 shadow-glass bg-white">
          <div className="relative bg-ink px-6 sm:px-10 md:px-14 pt-4 sm:pt-5 pb-8 sm:pb-10">
            <div className="flex items-center justify-center gap-3 mb-6 sm:mb-7">
              <span
                className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ${
                  showingSolution ? "text-white/35" : "text-seafoam"
                }`}
              >
                Without Nexus
              </span>
              <div className="relative h-1 w-16 sm:w-24 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-seafoam to-lp-sage transition-[width] duration-150 ease-out"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
              <span
                className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ${
                  showingSolution ? "text-seafoam" : "text-white/35"
                }`}
              >
                With Nexus
              </span>
            </div>

            <div className="relative min-h-[8.5rem] sm:min-h-[9.5rem]">
              <Layer active={!showingSolution} className="absolute inset-0">
                <PainHeader />
              </Layer>
              <Layer active={showingSolution} className="absolute inset-0">
                <SolutionHeader />
              </Layer>
            </div>
          </div>

          <div className="bg-white px-5 sm:px-8 md:px-10 py-7 sm:py-9">
            <div className="relative">
              <Layer
                active={!showingSolution}
                className="grid md:grid-cols-3 gap-5 lg:gap-6"
              >
                {painPoints.map((point) => (
                  <PointCard key={`pain-${point.number}`} point={point} tone="pain" />
                ))}
              </Layer>

              <Layer
                active={showingSolution}
                className="absolute inset-0 grid md:grid-cols-3 gap-5 lg:gap-6"
              >
                {solutionPoints.map((point) => (
                  <PointCard key={`sol-${point.number}`} point={point} tone="solution" />
                ))}
              </Layer>
            </div>

            <div className="relative mt-7 min-h-[5.5rem] sm:min-h-[4.75rem]">
              <Layer active={!showingSolution} className="absolute inset-0">
                <PainFooter onGetStarted={onGetStarted} />
              </Layer>
              <Layer active={showingSolution} className="absolute inset-0">
                <SolutionFooter onGetStarted={onGetStarted} />
              </Layer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ProblemsSection = ({ onGetStarted }: ProblemsSectionProps) => {
  const prefersReducedMotion = useReducedMotion();
  const desktopSwap = useDesktopSwap();
  const useScrollSwap = desktopSwap && !prefersReducedMotion;

  return (
    <section id="problems" className="py-16 md:py-24 relative">
      <div className="relative z-10 max-w-7xl mx-auto px-6 space-y-16">
        {useScrollSwap ? (
          <ScrollSwapPanel onGetStarted={onGetStarted} />
        ) : (
          <div className="space-y-10">
            <Reveal>
              <StaticPanel
                tone="pain"
                points={painPoints}
                header={<PainHeader />}
                footer={<PainFooter onGetStarted={onGetStarted} />}
              />
            </Reveal>
            <Reveal>
              <StaticPanel
                tone="solution"
                points={solutionPoints}
                header={<SolutionHeader />}
                footer={<SolutionFooter onGetStarted={onGetStarted} />}
              />
            </Reveal>
          </div>
        )}

        {/* Maturity ladder */}
        <div className="rounded-3xl bg-gradient-to-b from-sage-light/30 to-background border border-border/50 p-8 sm:p-12 overflow-hidden">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light mb-2 leading-tight">
              <span className="text-foreground">Where impact tracking actually stands</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mb-10">
              Five stages. Most orgs stall at two.
            </p>
          </Reveal>

          <StaggerGroup className="relative grid gap-4 md:grid-cols-5 items-stretch" gap={0.12}>
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-0.5 origin-left -translate-y-1/2 rounded-full bg-gradient-to-r from-[#c0dfa1]/40 via-[#c0dfa1] to-[#5e8380] md:block"
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={viewportOnce}
              transition={{ duration: 1, ease: easeOut }}
            />
            {ladder.map((stage) => {
              const isWarning = stage.tone === "warning";
              const isAccent = stage.tone === "accent";
              const borderClass = isWarning
                ? "border-[#dca07a]"
                : isAccent
                ? "border-accent"
                : "border-border/60";
              return (
                <StaggerItem key={stage.step} className="relative z-10 flex">
                <motion.div
                  className={`relative rounded-2xl border-2 bg-white p-5 flex flex-col w-full min-h-[300px] ${borderClass} ${
                    isAccent || isWarning ? "shadow-glass-lg" : "shadow-glass"
                  }`}
                  {...(isAccent
                    ? {
                        animate: {
                          boxShadow: [
                            "0 0 0 0 rgba(192,223,161,0)",
                            "0 0 0 6px rgba(192,223,161,0.28)",
                            "0 0 0 0 rgba(192,223,161,0)",
                          ],
                        },
                        transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" },
                      }
                    : {})}
                >
                  <div className="flex items-center gap-2 mb-2 min-w-0">
                    <span
                      className={`text-3xl font-fraunces font-light shrink-0 ${
                        isAccent ? "text-[#5e8380]" : isWarning ? "text-[#b46a3a]" : "text-muted-foreground/50"
                      }`}
                    >
                      {stage.step}
                    </span>
                    {stage.badge && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full leading-tight ${
                          isWarning
                            ? "bg-[#f4e2d3] text-[#b46a3a]"
                            : "bg-accent/25 text-accent-foreground"
                        }`}
                      >
                        {stage.badge}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-3 leading-snug">{stage.title}</h3>
                  <ul className="space-y-1.5">
                    {stage.points.map((item) => (
                      <li key={item} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        {isAccent ? (
                          <Check className="w-3 h-3 mt-0.5 text-accent-foreground flex-shrink-0" />
                        ) : (
                          <span
                            className={`mt-0.5 leading-none ${
                              isWarning ? "text-[#b46a3a]" : "text-muted-foreground/50"
                            }`}
                          >
                            •
                          </span>
                        )}
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>

        {onGetStarted && (
          <Reveal className="flex justify-center">
            <Button variant="hero" size="xl" className="group" onClick={onGetStarted}>
              Move up the ladder
              <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </Reveal>
        )}
      </div>
    </section>
  );
};

export default ProblemsSection;
