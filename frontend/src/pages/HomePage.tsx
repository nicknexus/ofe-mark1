import { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { LandingNavbar, HeroSection } from '../components/landing';

// Lazy load below-the-fold sections for faster initial load
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const HowItWorksSection = lazy(() => import('../components/landing/HowItWorksSection'));
const TestimonialsSection = lazy(() => import('../components/landing/TestimonialsSection'));
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
    <main className="min-h-screen bg-background font-figtree landing-page">
      <LandingNavbar onGetStarted={handleGetStarted} />
      <HeroSection onGetStarted={handleGetStarted} />
      <Suspense fallback={<SectionLoader />}>
        <FeaturesSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <HowItWorksSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <TestimonialsSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <CTASection onGetStarted={handleGetStarted} />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <PricingSection />
      </Suspense>
      <Suspense fallback={<SectionLoader />}>
        <Footer />
      </Suspense>
    </main>
  );
}
