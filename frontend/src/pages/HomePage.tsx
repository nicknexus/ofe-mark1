import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingNavbar, HeroSection } from '../components/landing';

// Lazy load below-the-fold sections for faster initial load
const ExplorePromoSection = lazy(() => import('../components/landing/ExplorePromoSection'));
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const HowItWorksSection = lazy(() => import('../components/landing/HowItWorksSection'));
// const TestimonialsSection = lazy(() => import('../components/landing/TestimonialsSection'));
const CTASection = lazy(() => import('../components/landing/CTASection'));
const PricingSection = lazy(() => import('../components/landing/PricingSection'));
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

  return (
    <main className="relative min-h-screen bg-background font-figtree landing-page">
      {/* Global graph-paper grid + fade */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.2)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.2)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,transparent_0%,white_70%)]" />
      </div>
      <LandingNavbar onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <Suspense fallback={<SectionLoader />}>
        <ExplorePromoSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <FeaturesSection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <HowItWorksSection />
      </Suspense>
      {/* <Suspense fallback={<SectionLoader />}>
        <TestimonialsSection />
      </Suspense> */}
      <Suspense fallback={<SectionLoader />}>
        <CTASection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <PricingSection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </main>
  );
}
