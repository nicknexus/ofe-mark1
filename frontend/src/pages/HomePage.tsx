import { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { LandingNavbar, HeroSection } from '../components/landing';
import WalkthroughSection from '../components/landing/WalkthroughSection';
import ProblemsSection from '../components/landing/ProblemsSection';
import PartnersSection from '../components/landing/PartnersSection';
import LiveStoriesSection from '../components/landing/LiveStoriesSection';
import WhyItMattersSection from '../components/landing/WhyItMattersSection';
import PricingSection from '../components/landing/PricingSection';
import CTASection from '../components/landing/CTASection';
import Footer from '../components/landing/Footer';

// The landing sections are a few KB each, so they ship with this page; lazy
// boundaries per section only caused spinner-to-content layout jumps. Explore
// promo stays split because it pulls in Leaflet + Recharts.
const loadExplorePromo = () => import('../components/landing/ExplorePromoSection');
const ExplorePromoSection = lazy(loadExplorePromo);

// Fetch it during idle time so it's ready before the user scrolls to it.
function warmExplorePromo() {
  const ric = (window as any).requestIdleCallback as
    | ((cb: () => void, opts?: { timeout: number }) => number)
    | undefined;
  if (ric) ric(() => loadExplorePromo(), { timeout: 2500 });
  else setTimeout(loadExplorePromo, 300);
}

export default function HomePage() {
  const navigate = useNavigate();
  const handleSignIn = () => navigate('/login');
  const handleSignUp = () => navigate('/login?signup=true');

  useEffect(() => {
    warmExplorePromo();
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <main className="relative min-h-screen bg-background font-figtree landing-page">
      {/* Global graph-paper grid + fade */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.3)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.2)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_0%,white_70%)]" />
      </div>
      <LandingNavbar onSignIn={handleSignIn} onGetStarted={handleSignUp} />
      <HeroSection />
      <WalkthroughSection />
      <ProblemsSection onGetStarted={handleSignUp} />
      <PartnersSection />
      <Suspense fallback={<div className="min-h-[640px]" />}>
        <ExplorePromoSection />
      </Suspense>
      <LiveStoriesSection />
      <WhyItMattersSection />
      {/* <TestimonialsSection /> */}
      <PricingSection onGetStarted={handleSignUp} />
      <CTASection onGetStarted={handleSignUp} />
      <Footer />
    </main>
    </MotionConfig>
  );
}
