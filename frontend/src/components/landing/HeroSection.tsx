import { Button } from "../ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { Suspense, lazy, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from "framer-motion";
import { easeOut } from "./motion";
import { AnimatedNumber } from "./AnimatedNumber";

// Lazy load the heavy globe component
const ImpactGlobe = lazy(() => import("./ImpactGlobe"));

interface HeroSectionProps {
  onGetStarted: () => void;
}

const container = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
};

interface FloatingCardProps {
  flag: string;
  place: string;
  value: number;
  suffix: string;
  label: string;
  gradient: string;
  className: string;
  /** Parallax depth multiplier — higher = moves more with the cursor. */
  depth: number;
  delay: number;
  parallaxX: any;
  parallaxY: any;
}

const FloatingCard = ({
  flag, place, value, suffix, label, gradient, className, depth, delay, parallaxX, parallaxY,
}: FloatingCardProps) => {
  const x = useTransform(parallaxX, (v: number) => v * depth);
  const y = useTransform(parallaxY, (v: number) => v * depth);
  return (
    <motion.div
      className={`glass-card p-3 rounded-xl shadow-glass-lg z-10 ${className}`}
      style={{ x, y }}
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.6, ease: easeOut, delay }}
      whileHover={{ scale: 1.06, transition: { type: "spring", stiffness: 300, damping: 20 } }}
    >
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 bg-gradient-to-br ${gradient} rounded-lg flex items-center justify-center`}>
          <span className="text-sm">{flag}</span>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{place}</p>
          <p className="text-xs text-muted-foreground">
            <AnimatedNumber value={value} suffix={suffix} duration={2} /> {label}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);

  // Cursor-driven parallax for the globe scene.
  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const px = useSpring(mvX, { stiffness: 60, damping: 20 });
  const py = useSpring(mvY, { stiffness: 60, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reduceMotion || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    // Range roughly -20..20 px of drift.
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
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-[5%] w-24 h-24 border-2 border-accent/20 rounded-2xl rotate-12 animate-float" />
        <div className="absolute top-[15%] right-[15%] w-16 h-16 bg-accent/15 rounded-full animate-float-delayed" />
        <div className="absolute bottom-1/4 left-[3%] w-12 h-12 bg-sage-light/40 rounded-xl rotate-45 animate-float-slow" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-4 items-center">
          {/* Left content */}
          <motion.div
            className="text-center lg:text-left order-2 lg:order-1"
            variants={container}
            initial="hidden"
            animate="visible"
          >
            {/* Eyebrow tagline */}
            <motion.p variants={item} className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-sm">
                <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
                <span className="text-accent-foreground font-medium">plug-and-play impact experiences</span>
              </span>
            </motion.p>

            {/* Hero statement */}
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

            {/* CTA buttons */}
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="hero" size="xl" className="group" onClick={onGetStarted}>
                Start for Free
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          </motion.div>

          {/* Right content - 3D Globe */}
          <div className="relative order-1 lg:order-2 h-[400px] sm:h-[500px] lg:h-[600px]">
            {/* Dark "stage" panel the globe sits on */}
            <motion.div
              className="absolute inset-x-2 inset-y-6 sm:inset-x-6 rounded-[2.5rem] bg-gradient-to-br from-steel-light to-ink-soft overflow-hidden shadow-2xl ring-1 ring-white/10"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.2 }}
            >
              {/* Faint graph-paper grid inside the panel */}
              <div className="absolute inset-0 opacity-[0.12] bg-[linear-gradient(to_right,rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.5)_1px,transparent_1px)] bg-[size:36px_36px]" />
              {/* Cool teal wash from the top */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(151,199,203,0.20),transparent_60%)]" />
            </motion.div>

            <motion.div
              className="absolute inset-0 flex items-center justify-center"
              style={{ x: glowX, y: glowY }}
            >
              {/* Glow behind globe */}
              <div className="absolute w-[320px] h-[320px] sm:w-[420px] sm:h-[420px] bg-seafoam/25 rounded-full blur-3xl animate-pulse-soft-landing" />
              <div className="absolute w-[240px] h-[240px] sm:w-[320px] sm:h-[320px] bg-accent/25 rounded-full blur-3xl animate-pulse-soft-landing" />

              {/* 3D Globe */}
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full bg-gradient-to-br from-foreground/80 to-foreground/60 animate-pulse" />
                </div>
              }>
                <ImpactGlobe />
              </Suspense>
            </motion.div>

            {/* Floating info cards — drift with the cursor at varying depths */}
            <FloatingCard
              flag="🇰🇪" place="Nairobi, Kenya" value={8000} suffix="" label="students educated"
              gradient="from-accent to-sage-light" className="absolute top-8 left-0"
              depth={-0.5} delay={0.7} parallaxX={px} parallaxY={py}
            />
            <FloatingCard
              flag="🇮🇳" place="New Delhi, India" value={15000} suffix="" label="vaccines delivered"
              gradient="from-sage-light to-accent/50" className="absolute bottom-16 right-0"
              depth={0.7} delay={0.9} parallaxX={px} parallaxY={py}
            />
            <div className="hidden md:block">
              <FloatingCard
                flag="🇧🇷" place="São Paulo, Brazil" value={5000} suffix="" label="families housed"
                gradient="from-accent/60 to-sage-light" className="absolute top-1/2 -left-4"
                depth={-0.9} delay={1.1} parallaxX={px} parallaxY={py}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scroll cue */}
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
