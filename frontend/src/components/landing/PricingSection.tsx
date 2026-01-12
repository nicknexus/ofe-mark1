import { Check } from "lucide-react";
import { Button } from "../ui/button";

interface PricingSectionProps {
  onGetStarted?: () => void;
}

const PricingSection = ({ onGetStarted }: PricingSectionProps) => {
  const features = [
    "10 Logins",
    "Unlimited AI Reports",
    "Unlimited Metrics",
    "Unlimited Locations",
    "250 GB of Storage",
  ];

  return (
    <section id="pricing" className="pt-0 pb-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-accent/5 to-background" />
      
      <div className="relative z-10 max-w-md mx-auto px-6 text-center">
        <div className="glass-card p-10 md:p-12 rounded-3xl">
          <p className="text-sm font-medium text-accent uppercase tracking-wider mb-4">
            Simple Pricing
          </p>
          
          <div className="flex items-baseline justify-center gap-2 mb-2">
            <span className="text-5xl sm:text-6xl font-newsreader font-light text-foreground">$2</span>
            <span className="text-xl text-muted-foreground">/ day</span>
          </div>
          
          <p className="text-lg text-muted-foreground mb-10">
            per initiative
          </p>
          
          <div className="flex flex-col items-center">
            <p className="text-sm font-medium text-foreground uppercase tracking-wider mb-6">
              Includes
            </p>
            <ul className="space-y-4 inline-block text-left">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-accent/20 rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-accent" />
                  </div>
                  <span className="text-lg text-muted-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground mt-6">
              Contact us for more storage or logins.
            </p>
          </div>

          {onGetStarted && (
            <div className="mt-8">
              <Button variant="sage" size="lg" onClick={onGetStarted} className="w-full">
                Sign up
              </Button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;

