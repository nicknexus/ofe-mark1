import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "../ui/button";

interface PricingSectionProps {
  onGetStarted?: () => void;
}

const TIERS = [
  {
    tier: "free",
    name: "Free",
    priceMonthly: "$0",
    priceAnnual: "$0",
    cadence: "forever",
    highlight: false,
    cta: "Start free",
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
    tier: "growth",
    name: "Growth",
    priceMonthly: "$75",
    priceAnnual: "$750",
    cadence: "per month",
    highlight: true,
    cta: "Get started",
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
    tier: "pro",
    name: "Pro",
    priceMonthly: "$240",
    priceAnnual: "$2,400",
    cadence: "per month",
    highlight: false,
    cta: "Get started",
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

const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  const [annual, setAnnual] = useState(false);

  // Remember which plan was picked so we can send the user to that plan's
  // checkout right after they sign up. Free clears any pending plan.
  const handleSelect = (tier: string) => {
    if (tier === "growth" || tier === "pro") {
      localStorage.setItem(
        "pendingPlan",
        JSON.stringify({ tier, interval: annual ? "annual" : "monthly" })
      );
    } else {
      localStorage.removeItem("pendingPlan");
    }
    onGetStarted?.();
  };

  return (
    <section id="pricing" className="pt-0 pb-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/5 to-background" />

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-4">
            Simple Pricing
          </p>
          <h2 className="text-3xl sm:text-4xl font-newsreader font-light text-foreground mb-6">
            Start free. Grow when you're ready.
          </h2>

          <div className="inline-flex rounded-full bg-muted/40 p-1 text-sm font-medium">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 rounded-full transition-colors ${!annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 rounded-full transition-colors ${annual ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              Annual <span className="text-accent">· 2 months free</span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 items-stretch">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`glass-card p-8 rounded-3xl flex flex-col relative h-full ${tier.highlight ? "border-accent/50" : ""}`}
            >
              {tier.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-semibold px-3 py-1 rounded-full">
                  MOST POPULAR
                </div>
              )}

              <h3 className="text-xl font-semibold text-foreground mb-2">{tier.name}</h3>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-newsreader font-light text-foreground">
                  {annual ? tier.priceAnnual : tier.priceMonthly}
                </span>
                <span className="text-muted-foreground">
                  {tier.name === "Free" ? tier.cadence : annual ? "per year" : tier.cadence}
                </span>
              </div>

              <ul className="space-y-3 my-6 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 mt-0.5 bg-accent/20 rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-accent" />
                    </div>
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {onGetStarted && (
                <Button
                  variant={tier.highlight ? "sage" : "sage-outline"}
                  size="lg"
                  onClick={() => handleSelect(tier.tier)}
                  className="w-full"
                >
                  {tier.cta}
                </Button>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          All plans include the public impact page and Explore listing. No credit card required to start.
        </p>
      </div>
    </section>
  );
};

export default PricingSection;
