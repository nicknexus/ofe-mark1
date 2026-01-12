import { Button } from "../ui/button";
import { ArrowRight, Heart } from "lucide-react";

interface CTASectionProps {
  onGetStarted: () => void;
}

const CTASection = ({ onGetStarted }: CTASectionProps) => {
  return (
    <section className="pt-8 pb-20 md:pt-12 md:pb-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-background to-accent/10" />
      
      {/* Decorative elements */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-accent/20 rounded-full blur-3xl animate-pulse-soft-landing" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse-soft-landing" />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="glass-card p-12 md:p-16 rounded-3xl">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-accent rounded-3xl mb-8 shadow-sage border-2 border-accent/50">
            <Heart className="w-10 h-10 text-accent-foreground" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-newsreader font-extralight text-foreground mb-6 leading-tight">
            Ready for the world to experience your impact?
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10">
          People give because they want to make a difference. Help your current and future donors experience their impact today.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl" onClick={onGetStarted}>
              Start For Free
              <ArrowRight className="w-5 h-5 ml-1" />
            </Button>
            <Button variant="hero-outline" size="xl">
              Talk to Our Team
            </Button>
          </div>
          
        </div>
      </div>
    </section>
  );
};

export default CTASection;

