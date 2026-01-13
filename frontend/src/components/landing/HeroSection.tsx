import { Button } from "../ui/button";
import { ArrowRight, Play, TrendingUp, ArrowUpRight, Users, Heart, DollarSign } from "lucide-react";
import { Suspense, lazy } from "react";

// Lazy load the heavy globe component
const ImpactGlobe = lazy(() => import("./ImpactGlobe"));

interface HeroSectionProps {
  onGetStarted: () => void;
}

const HeroSection = ({ onGetStarted }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-32 lg:pt-24">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating geometric shapes */}
        <div className="absolute top-1/4 left-[5%] w-24 h-24 border-2 border-accent/20 rounded-2xl rotate-12 animate-float" />
        <div className="absolute top-[15%] right-[15%] w-16 h-16 bg-accent/15 rounded-full animate-float-delayed" />
        <div className="absolute bottom-1/4 left-[3%] w-12 h-12 bg-sage-light/40 rounded-xl rotate-45 animate-float-slow" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.2)_1px,transparent_1px)] bg-[size:60px_60px]" />
        
        {/* Radial gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_0%,white_70%)]" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-4 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            {/* Main headline with creative typography */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-newsreader font-light text-foreground leading-[1.1] mb-6 fade-in-scale">
              Share your{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-foreground via-slate-light to-foreground bg-clip-text text-transparent">
                  impact
                </span>
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                  <path d="M2 8C50 2 150 2 198 8" stroke="#c0dfa1" strokeWidth="4" strokeLinecap="round" className="animate-pulse-soft-landing"/>
                </svg>
              </span>
              {" "}with the world.
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto lg:mx-0 mb-10 fade-in-scale-delay-1 leading-relaxed">
              People give because they want to make a difference.<br />
              When they can't see that difference, connection fades, and so does their support.
            </p>
            
            {/* CTA buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start fade-in-scale-delay-2">
              <Button variant="hero" size="xl" className="group" onClick={onGetStarted}>
                Build Donor Trust
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
              {/* <Button variant="hero-outline" size="xl" className="group">
                <Play className="w-4 h-4 mr-2 transition-transform group-hover:scale-110" />
                Watch Story
              </Button> */}
            </div>
            
            {/* Social proof with icons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6 sm:gap-8 mt-12 justify-center lg:justify-start fade-in-scale-delay-2">
              <div className="flex items-center justify-center sm:justify-start gap-3 w-full max-w-[280px] mx-auto sm:max-w-none sm:mx-0 sm:w-auto border border-border/50 sm:border-0 rounded-xl p-3 sm:p-0">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-[120px] text-center sm:text-left">
                  <p className="text-2xl font-bold text-foreground flex items-center justify-center sm:justify-start gap-1">
                    23%
                    <ArrowUpRight className="w-4 h-4 text-accent" />
                  </p>
                  <p className="text-xs text-muted-foreground">More Donors</p>
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3 w-full max-w-[280px] mx-auto sm:max-w-none sm:mx-0 sm:w-auto border border-border/50 sm:border-0 rounded-xl p-3 sm:p-0">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Heart className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-[120px] text-center sm:text-left">
                  <p className="text-2xl font-bold text-foreground flex items-center justify-center sm:justify-start gap-1">
                    36%
                    <ArrowUpRight className="w-4 h-4 text-accent" />
                  </p>
                  <p className="text-xs text-muted-foreground">Donor Retention</p>
                </div>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-3 w-full max-w-[280px] mx-auto sm:max-w-none sm:mx-0 sm:w-auto border border-border/50 sm:border-0 rounded-xl p-3 sm:p-0">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="w-5 h-5 text-accent-foreground" />
                </div>
                <div className="min-w-[120px] text-center sm:text-left">
                  <p className="text-2xl font-bold text-foreground flex items-center justify-center sm:justify-start gap-1">
                    22%
                    <ArrowUpRight className="w-4 h-4 text-accent" />
                  </p>
                  <p className="text-xs text-muted-foreground">Larger Donations</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right content - 3D Globe */}
          <div className="relative order-1 lg:order-2 slide-in-right h-[400px] sm:h-[500px] lg:h-[600px]">
            {/* Globe container with glass effect */}
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Glow behind globe */}
              <div className="absolute w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] bg-accent/20 rounded-full blur-3xl animate-pulse-soft-landing" />
              
              {/* 3D Globe */}
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-48 h-48 rounded-full bg-gradient-to-br from-foreground/80 to-foreground/60 animate-pulse" />
                </div>
              }>
                <ImpactGlobe />
              </Suspense>
            </div>
            
            {/* Floating info cards around globe */}
            <div className="absolute top-8 left-0 glass-card p-3 rounded-xl animate-float shadow-glass-lg z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-accent to-sage-light rounded-lg flex items-center justify-center">
                  <span className="text-sm">🇰🇪</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Nairobi, Kenya</p>
                  <p className="text-[10px] text-muted-foreground">8K students educated</p>
                </div>
              </div>
            </div>
            
            <div className="absolute bottom-16 right-0 glass-card p-3 rounded-xl animate-float-delayed shadow-glass-lg z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-sage-light to-accent/50 rounded-lg flex items-center justify-center">
                  <span className="text-sm">🇮🇳</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">New Delhi, India</p>
                  <p className="text-[10px] text-muted-foreground">15K vaccines delivered</p>
                </div>
              </div>
            </div>
            
            <div className="absolute top-1/2 -left-4 glass-card p-3 rounded-xl animate-float-slow shadow-glass-lg z-10 hidden md:block">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-accent/60 to-sage-light rounded-lg flex items-center justify-center">
                  <span className="text-sm">🇧🇷</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">São Paulo, Brazil</p>
                  <p className="text-[10px] text-muted-foreground">5K families housed</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

