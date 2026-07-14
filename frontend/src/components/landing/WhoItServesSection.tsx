import { Button } from "../ui/button";
import { Reveal, StaggerGroup, StaggerItem } from "./Reveal";
import { TiltCard } from "./TiltCard";

interface WhoItServesSectionProps {
  onGetStarted?: () => void;
}

const audiences = [
  {
    label: "Donors",
    headerClass: "bg-accent/30",
    title: "See the change their support creates",
    description:
      "A vivid, personal window into the difference they made — the story between campaigns, not just the ask.",
  },
  {
    label: "Community",
    headerClass: "bg-sage-light",
    title: "See themselves represented and valued",
    description:
      "Real voices and faces reflected back — the pride and connection that sustain a mission.",
  },
  {
    label: "Grantees & funders",
    headerClass: "bg-accent/15",
    title: "Review clear, connected proof faster",
    description:
      "Evidence organized for confident funding conversations — progress they can verify at a glance.",
  },
];

const WhoItServesSection = ({ onGetStarted }: WhoItServesSectionProps) => {
  return (
    <section id="features" className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sage-light/10 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <Reveal className="mb-12">
          <p className="text-xs font-semibold text-accent uppercase tracking-[0.2em] mb-4">
            Who it serves
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-fraunces font-light text-foreground leading-tight">
            One page. Every audience.
          </h2>
        </Reveal>

        <StaggerGroup className="grid md:grid-cols-3 gap-6">
          {audiences.map((audience) => (
            <StaggerItem key={audience.label}>
              <TiltCard className="relative overflow-hidden rounded-2xl border border-border/60 bg-white shadow-glass h-full">
                <div className={`${audience.headerClass} px-6 py-4`}>
                  <span className="text-lg font-fraunces font-medium text-foreground">{audience.label}</span>
                </div>
                <div className="p-6">
                  <h3 className="font-semibold text-foreground mb-2">{audience.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{audience.description}</p>
                </div>
              </TiltCard>
            </StaggerItem>
          ))}
        </StaggerGroup>

        {onGetStarted && (
          <Reveal direction="up" delay={0.15} className="flex justify-center mt-12">
            <Button variant="sage" size="lg" onClick={onGetStarted}>
              Get started
            </Button>
          </Reveal>
        )}
      </div>
    </section>
  );
};

export default WhoItServesSection;
