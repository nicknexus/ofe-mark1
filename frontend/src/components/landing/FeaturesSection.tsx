import { Eye, Heart, BarChart3, Clock } from "lucide-react";

const features = [
  {
    icon: Eye,
    title: "Complete Transparency",
    description: "Let donors see and experience the impact and proof of their generosity.",
  },
  {
    icon: Heart,
    title: "Emotional Connection",
    description: "Share personal stories, photos, and updates from those whose lives your charity has touched.",
  },
  {
    icon: BarChart3,
    title: "Simple Dashboard",
    description: "One glance tells you everything. Your impact, beautifully visualized without complexity.",
  },
  {
    icon: Clock,
    title: "Time Saved",
    description: "Evidence and impact claims auto connected, AI driven reports made in seconds.",
  },
];

const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 md:py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-muted/30 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-newsreader font-extralight text-foreground mb-4">
            Impact sharing made{" "}
            <span className="relative inline-block">
              simple
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C50 2 150 2 198 8" stroke="#c0dfa1" strokeWidth="4" strokeLinecap="round" className="animate-pulse-soft-landing"/>
              </svg>
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            No complicated spreadsheets. No confusing reports. Just clarity and connection.
          </p>
        </div>
        
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <div 
              key={feature.title}
              className="glass-card p-8 rounded-2xl hover:shadow-glass-lg transition-all duration-300 hover:-translate-y-1 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 bg-accent/20 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-accent/30 transition-colors duration-300">
                <feature.icon className="w-7 h-7 text-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

