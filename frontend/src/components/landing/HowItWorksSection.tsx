import { useState } from "react";
import { LineChart, Sparkles, ArrowRight, Check, Image, FileText, Camera } from "lucide-react";
import { Confetti } from "phosphor-react";

const steps = [
  {
    number: "01",
    title: "Setup Your Initiative",
    description: "Create the metrics you want the world to see.",
    icon: LineChart,
    color: "from-[#c0dea0] to-[#80b092]",
    features: ["Custom metrics", "Impact locations", "Beneficiary groups"],
    visual: "discover",
  },
  {
    number: "02",
    title: "Build Trust",
    description: "Upload proof and experiences.",
    icon: Image,
    color: "from-[#80b092] to-[#5e8380]",
    features: ["Impact claims", "Evidence", "Stories"],
    visual: "donate",
  },
  {
    number: "03",
    title: "Connect With the World",
    description: "Share real-time updates, stories, videos, and the difference your donors are making.",
    icon: Sparkles,
    color: "from-[#5e8380] to-[#80b092]",
    features: ["Live updates", "Photos, Videos, Stories", "Impact Dashboard", "AI Reports"],
    visual: "track",
  },
];

// Mock phone UI for each step
const PhoneVisual = ({ step, isActive }: { step: typeof steps[0]; isActive: boolean }) => {
  const Icon = step.icon;
  
  return (
    <div className={`relative transition-all duration-700 ${isActive ? 'scale-100 opacity-100' : 'scale-95 opacity-50'}`}>
      {/* Phone frame */}
      <div className="relative w-[280px] h-[560px] bg-foreground/95 rounded-[3rem] p-3 shadow-lg border-2 border-foreground/35">
        {/* Screen */}
        <div className="relative w-full h-full bg-background rounded-[2.5rem] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-6 py-3 bg-muted/50">
            <span className="text-xs text-muted-foreground">9:41</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-2 bg-muted-foreground/50 rounded-sm" />
              <div className="w-6 h-3 border border-muted-foreground/50 rounded-sm">
                <div className="w-4 h-full bg-accent rounded-sm" />
              </div>
            </div>
          </div>
          
          {/* Content based on step */}
          <div className="p-6 h-full">
            {step.visual === "discover" && (
              <div className="space-y-6 animate-fade-in mt-8">
                <div className="flex items-center gap-2 mb-8">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-foreground">Discover</span>
                </div>
                {["Create Metrics", "Insert Location", "Add Beneficiary Group"].map((btn, i) => (
                  <button key={btn} className={`w-full glass-card p-4 rounded-xl flex items-center justify-between transition-all duration-300 hover:shadow-glass-lg`} style={{ animationDelay: `${i * 100}ms` }}>
                    <p className="text-sm font-medium text-foreground">{btn}</p>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
            
            {step.visual === "donate" && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center gap-2 mb-6">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-foreground">Create Story</span>
                </div>
                <div className="glass-card p-3 rounded-xl">
                  <input 
                    type="text" 
                    placeholder="Story title..." 
                    className="w-full bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
                    defaultValue="Clean water reaches village"
                    readOnly
                  />
                </div>
                <div className="glass-card p-3 rounded-xl min-h-[120px]">
                  <textarea 
                    placeholder="Share your impact story..." 
                    className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none"
                    defaultValue="Today we delivered clean water to 50 families in Kenya. The joy on their faces was incredible..."
                    rows={4}
                    readOnly
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex-1 glass-card p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Camera className="w-4 h-4" />
                    <span>Add Photo</span>
                  </button>
                  <button className="flex-1 glass-card p-3 rounded-xl flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <FileText className="w-4 h-4" />
                    <span>Evidence</span>
                  </button>
                </div>
                <button className={`w-full py-3 rounded-xl bg-gradient-to-r ${step.color} text-white font-semibold text-sm shadow-md border-2 border-white/35`}>
                  Publish Story
                </button>
              </div>
            )}
            
            {step.visual === "track" && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-semibold text-foreground">Your Impact</span>
                </div>
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-accent/30 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-accent font-medium">Impact Claim</p>
                      <p className="text-sm text-foreground flex items-center gap-1">
                      A new well installed for a village in Kenya! 
                        <Confetti className="w-4 h-4 text-accent inline" weight="fill" />
                      </p>
                    </div>
                  </div>
                </div>
                <div className="glass-card p-4 rounded-xl opacity-80">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Evidence</p>
                      <p className="text-sm text-foreground">
                        8 photos
                        <br />
                        3 documents
                      </p>
                    </div>
                  </div>
                </div>
                <div className="glass-card p-4 rounded-xl opacity-60">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted flex-shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground">Story</p>
                      <p className="text-sm text-foreground">Video of family sharing their gratitude!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Home indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 bg-foreground/20 rounded-full" />
      </div>
      
      {/* Floating notification */}
      {isActive && step.visual === "track" && (
        <div className="absolute -top-4 -right-8 glass-card p-3 rounded-xl shadow-glass-lg animate-float">
          <div className="flex items-center gap-2">
            <Confetti className="w-5 h-5 text-accent" weight="fill" />
            <span className="text-xs font-medium text-foreground">Impact received!</span>
          </div>
        </div>
      )}
    </div>
  );
};

const HowItWorksSection = () => {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(210,220,230,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(210,220,230,0.15)_1px,transparent_1px)] bg-[size:40px_40px]" />
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-sage-light/20 rounded-full blur-3xl" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full mb-6">
            <span className="text-sm font-medium text-muted-foreground">Simple by design</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-newsreader font-extralight text-foreground mb-6">
            Three steps to{" "}
            <span className="bg-gradient-to-r from-foreground via-slate-light to-foreground bg-clip-text text-transparent">
              share your impact
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Show the world in seconds
          </p>
        </div>
        
        {/* Interactive content */}
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Steps list */}
          <div className="space-y-6 order-2 lg:order-1">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = activeStep === index;
              
              return (
                <div
                  key={step.number}
                  className={`relative cursor-pointer transition-all duration-500 ${isActive ? 'scale-100' : 'scale-[0.98] opacity-70 hover:opacity-90'}`}
                  onClick={() => setActiveStep(index)}
                  onMouseEnter={() => setActiveStep(index)}
                >
                  {/* Connection line */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-8 top-24 w-0.5 h-16 bg-gradient-to-b from-border to-transparent" />
                  )}
                  
                  <div className={`glass-card p-6 rounded-2xl transition-all duration-500 ${isActive ? 'shadow-glass-lg border-accent/30' : ''}`}>
                    <div className="flex items-start gap-5">
                      {/* Icon */}
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center flex-shrink-0 shadow-md border-2 border-white/35 transition-transform duration-500 ${isActive ? 'scale-110' : ''}`}>
                        <Icon className="w-7 h-7 text-white" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-bold text-accent uppercase tracking-wider">Step {step.number}</span>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                        <p className="text-muted-foreground mb-4">{step.description}</p>
                        
                        {/* Features - show when active */}
                        <div className={`grid gap-2 transition-all duration-500 ${isActive ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                          {step.features.map((feature) => (
                            <div key={feature} className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center">
                                <Check className="w-3 h-3 text-accent-foreground" />
                              </div>
                              <span className="text-sm text-muted-foreground">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Phone mockup */}
          <div className="flex justify-center order-1 lg:order-2">
            <div className="relative">
              {/* Glow behind phone */}
              <div className={`absolute inset-0 bg-gradient-to-br ${steps[activeStep].color} opacity-20 blur-3xl rounded-full scale-150`} />
              
              {/* Decorative elements */}
              <div className="absolute -top-8 -left-8 w-16 h-16 border-2 border-accent/20 rounded-2xl rotate-12 animate-float" />
              <div className="absolute -bottom-8 -right-8 w-12 h-12 bg-accent/20 rounded-full animate-float-delayed" />
              
              <PhoneVisual step={steps[activeStep]} isActive={true} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;

