import { useState } from "react";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "../ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { AnimatedNumber } from "./AnimatedNumber";
import { spring } from "./motion";
import { DEMO_BOOKING_URL } from "./constants";
import { writePendingPlan, clearPendingPlan, type PendingTier } from "../../utils/pendingPlan";

interface PricingSectionProps {
  onGetStarted?: () => void;
}

type Billing = "monthly" | "annual";

interface Tier {
  name: string;
  /** Plan id carried through signup to Stripe; null for the free tier. */
  tierKey: PendingTier | null;
  monthly: number;
  priceSuffix: string;
  cta: string;
  highlighted: boolean;
  features: string[];
}

const tiers: Tier[] = [
  {
    name: "Free",
    tierKey: null,
    monthly: 0,
    priceSuffix: "forever",
    cta: "Start free",
    highlighted: false,
    features: [
      "1 initiative",
      "2 team members",
      "3 locations",
      "25 GB storage",
      "1 AI report / day",
      "Public impact page + Explore listing",
    ],
  },
  {
    name: "Growth",
    tierKey: "growth",
    monthly: 75,
    priceSuffix: "per month",
    cta: "Get started",
    highlighted: true,
    features: [
      "10 initiatives",
      "10 team members",
      "15 locations",
      "300 GB storage",
      "Unlimited AI reports",
      "Metric tags & themes",
      "Beneficiary groups",
      "Standard embeddable widget",
    ],
  },
  {
    name: "Pro",
    tierKey: "pro",
    monthly: 240,
    priceSuffix: "per month",
    cta: "Get started",
    highlighted: false,
    features: [
      "25 initiatives",
      "20 team members",
      "30 locations",
      "1 TB storage",
      "Unlimited AI reports",
      "Metric tags & themes",
      "Beneficiary groups",
      "Advanced / white-label widgets",
      "Impact auditing support",
    ],
  },
];

// Annual billing = 2 months free → 10 months' cost spread across 12.
const annualMonthly = (monthly: number) => Math.round((monthly * 10) / 12);

const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  const [billing, setBilling] = useState<Billing>("monthly");

  // Stash the picked plan before handing off to signup — TrialActivationPage
  // reads it back afterwards and offers checkout for exactly this tier and
  // billing interval. Picking Free clears any earlier choice.
  const handleTierClick = (tier: Tier) => {
    if (tier.tierKey) {
      writePendingPlan({ tier: tier.tierKey, interval: billing });
    } else {
      clearPendingPlan();
    }
    onGetStarted?.();
  };

  return (
    <section id="pricing" className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/5 to-background" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <Reveal as="div">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-foreground text-center mb-8">
            Share your impact, at your scale
          </h2>
        </Reveal>

        {/* Billing toggle */}
        <Reveal className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 p-1 rounded-full bg-white border border-border/60 shadow-glass">
            <button
              onClick={() => setBilling("monthly")}
              className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
                billing === "monthly" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {billing === "monthly" && (
                <motion.div
                  layoutId="billing-pill"
                  className="absolute inset-0 rounded-full bg-accent/20"
                  transition={spring}
                />
              )}
              <span className="relative z-10">Monthly</span>
            </button>
            <button
              onClick={() => setBilling("annual")}
              className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
                billing === "annual" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {billing === "annual" && (
                <motion.div
                  layoutId="billing-pill"
                  className="absolute inset-0 rounded-full bg-accent/20"
                  transition={spring}
                />
              )}
              <span className="relative z-10">Annual</span>
              <span className="relative z-10 text-xs text-accent-foreground bg-accent/30 px-2 py-0.5 rounded-full">
                2 months free
              </span>
            </button>
          </div>
        </Reveal>

        {/* Tiers */}
        <StaggerGroup className="grid md:grid-cols-3 gap-6 items-stretch" gap={0.12}>
          {tiers.map((tier) => {
            const displayPrice =
              tier.monthly === 0
                ? 0
                : billing === "annual"
                ? annualMonthly(tier.monthly)
                : tier.monthly;
            return (
              <StaggerItem key={tier.name} className="h-full">
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={spring}
                  className={`relative h-full rounded-3xl bg-white p-8 flex flex-col ${
                    tier.highlighted
                      ? "border-2 border-accent shadow-glass-lg md:-mt-4 md:mb-4"
                      : "border border-border/60 shadow-glass"
                  }`}
                >
                  {/* Subtle glow behind the highlighted card */}
                  {tier.highlighted && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-accent/25 blur-2xl"
                    />
                  )}

                  {tier.highlighted && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground px-3 py-1 rounded-full">
                      Most popular
                    </span>
                  )}

                  <h3 className="text-lg font-semibold text-foreground mb-2">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <AnimatedNumber
                      key={`${tier.name}-${billing}`}
                      value={displayPrice}
                      prefix="$"
                      duration={0.6}
                      className="text-4xl font-fraunces font-light text-foreground"
                    />
                    <span className="text-sm text-muted-foreground">{tier.priceSuffix}</span>
                  </div>
                  <p className="text-xs text-muted-foreground h-4 mb-6">
                    {tier.monthly !== 0 && billing === "annual" ? "billed annually" : " "}
                  </p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 mt-0.5 bg-accent/20 rounded-full flex items-center justify-center">
                          <Check className="w-3 h-3 text-accent-foreground" />
                        </div>
                        <span className="text-sm text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={tier.highlighted ? "sage" : "hero-outline"}
                    size="lg"
                    className="w-full"
                    onClick={() => handleTierClick(tier)}
                  >
                    {tier.cta}
                  </Button>
                </motion.div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        {/* Book a demo */}
        <Reveal className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-12">
          <span className="text-muted-foreground">Want a guided tour?</span>
          <Button variant="hero" size="lg" asChild>
            <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer">
              Book a demo
            </a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
};

export default PricingSection;
