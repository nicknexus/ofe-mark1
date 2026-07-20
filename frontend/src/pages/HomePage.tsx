import { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { LandingNavbar, HeroSection } from '../components/landing';
import { publicApi } from '../services/publicApi';

// Warm the lazy chunk + data for the live-stories section during idle time,
// so scrolling into it never triggers a mid-scroll fetch/parse stutter.
function warmLiveStories() {
  const run = () => {
    import('../components/landing/LiveStoriesSection');
    publicApi.getShowcase(24).catch(() => {});
  };
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(run, { timeout: 2500 });
  else setTimeout(run, 300);
}

// Lazy load below-the-fold sections for faster initial load
const WalkthroughSection = lazy(() => import('../components/landing/WalkthroughSection'));
const ProblemsSection = lazy(() => import('../components/landing/ProblemsSection'));
const ExplorePromoSection = lazy(() => import('../components/landing/ExplorePromoSection'));
const LiveStoriesSection = lazy(() => import('../components/landing/LiveStoriesSection'));
const WhyItMattersSection = lazy(() => import('../components/landing/WhyItMattersSection'));
// const TestimonialsSection = lazy(() => import('../components/landing/TestimonialsSection'));
const PricingSection = lazy(() => import('../components/landing/PricingSection'));
const CTASection = lazy(() => import('../components/landing/CTASection'));
const Footer = lazy(() => import('../components/landing/Footer'));

// Simple loading placeholder
const SectionLoader = () => (
  <div className="py-20 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function HomePage() {
  const navigate = useNavigate();
  const handleGetStarted = () => navigate('/login');

  useEffect(() => {
    warmLiveStories();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <main className="relative min-h-screen bg-background font-figtree landing-page">
      {/* Global graph-paper grid + fade */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.2)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_0%,white_70%)]" />
      </div>
      <LandingNavbar onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      {/* Video walkthrough hidden for now — restore when the walkthrough is ready.
      <Suspense fallback={<SectionLoader />}>
        <WalkthroughSection />
      </Suspense>
      */}
      <Suspense fallback={<SectionLoader />}>
        <ProblemsSection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <ExplorePromoSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <LiveStoriesSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <WhyItMattersSection />
      </Suspense>
      {/* <Suspense fallback={<SectionLoader />}>
        <TestimonialsSection />
      </Suspense> */}
      <Suspense fallback={<SectionLoader />}>
        <PricingSection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <CTASection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </main>
    </MotionConfig>
  );
}
