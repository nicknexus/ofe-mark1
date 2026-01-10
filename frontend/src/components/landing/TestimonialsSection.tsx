import { useState, useEffect } from "react";
import { Quote, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

const testimonials = [
  {
    quote: "For the first time, I truly see where my donations go. The updates from families I've helped bring tears to my eyes. This platform made giving personal again.",
    author: "Sarah Mitchell",
    role: "Donor since 2022",
    avatar: "SM",
    location: "San Francisco, USA",
    impact: "Helped 12 families",
    bgGradient: "from-[#c0dea0]/30 to-[#80b092]/30",
  },
  {
    quote: "As a small charity, this platform transformed how we connect with donors. They stay engaged because they see their impact. Our retention rate increased by 340%.",
    author: "David Chen",
    role: "Hope Foundation Director",
    avatar: "DC",
    location: "Toronto, Canada",
    impact: "15K+ donors connected",
    bgGradient: "from-[#80b092]/30 to-[#5e8380]/30",
  },
  {
    quote: "I started giving $10 a month. Seeing those children's smiles in my updates? Priceless. Now I give $50, and I've convinced my whole family to join.",
    author: "Emma Rodriguez",
    role: "Monthly Donor",
    avatar: "ER",
    location: "London, UK",
    impact: "5 family members joined",
    bgGradient: "from-[#5e8380]/30 to-[#c0dea0]/30",
  },
  {
    quote: "The transparency is unmatched. I can see exactly how every dollar is spent. It's not just charity—it's a partnership in creating change.",
    author: "Michael Okonkwo",
    role: "Corporate Sponsor",
    avatar: "MO",
    location: "Lagos, Nigeria",
    impact: "100+ projects funded",
    bgGradient: "from-[#c0dea0]/30 to-[#5e8380]/30",
  },
];

// Story card that looks like a social media post
const StoryCard = ({ story, isCenter }: { story: typeof testimonials[0]; isCenter: boolean }) => {
  return (
    <div 
      className={`relative transition-all duration-700 ${
        isCenter 
          ? 'scale-100 opacity-100 z-20' 
          : 'scale-90 opacity-40 z-10 blur-[1px]'
      }`}
    >
      <div className={`glass-card overflow-hidden rounded-3xl ${isCenter ? 'shadow-glass-lg' : ''}`}>
        {/* Header gradient */}
        <div className={`h-24 bg-gradient-to-br ${story.bgGradient} relative`}>
          {/* Decorative shapes */}
          <div className="absolute top-4 right-4 w-16 h-16 bg-white/20 rounded-full blur-xl" />
          <div className="absolute bottom-4 left-4 w-8 h-8 bg-white/30 rounded-lg rotate-12" />
        </div>
        
        {/* Avatar */}
        <div className="relative px-6">
          <div className="absolute -top-10 left-6 w-20 h-20 rounded-2xl bg-gradient-to-br from-foreground to-slate-light flex items-center justify-center text-2xl font-bold text-white shadow-md border-4 border-background">
            {story.avatar}
          </div>
        </div>
        
        {/* Content */}
        <div className="pt-14 px-6 pb-6">
          {/* Author info */}
          <div className="mb-4">
            <h4 className="text-lg font-bold text-foreground">{story.author}</h4>
            <p className="text-sm text-muted-foreground">{story.role}</p>
          </div>
          
          {/* Meta info */}
          <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {story.location}
            </div>
            <div className="text-muted-foreground">
              {story.impact}
            </div>
          </div>
          
          {/* Quote */}
          <div className="relative">
            <Quote className="absolute -top-2 -left-2 w-8 h-8 text-accent/20" />
            <p className="text-foreground leading-relaxed pl-4 italic">
              "{story.quote}"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const TestimonialsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrev = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  return (
    <section id="testimonials" className="py-24 md:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-sage-light/10 to-background" />
      <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-accent/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-[400px] h-[400px] bg-sage-light/20 rounded-full blur-3xl" />
      
      {/* Floating elements */}
      <div className="absolute top-20 left-[10%] w-20 h-20 border-2 border-accent/20 rounded-full animate-float" />
      <div className="absolute bottom-32 right-[15%] w-16 h-16 bg-accent/10 rounded-2xl rotate-12 animate-float-delayed" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-2 rounded-full mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-sm font-medium text-muted-foreground">Real stories from our community</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-newsreader font-extralight text-foreground mb-6">
            Stories that{" "}
            <span className="relative inline-block">
              <span className="relative z-10">inspire</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                <path d="M2 8C50 2 150 2 198 8" stroke="#c0dfa1" strokeWidth="4" strokeLinecap="round" className="animate-pulse-soft-landing"/>
              </svg>
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Hear from donors and charities who've experienced the power of connected giving
          </p>
        </div>
        
        {/* Carousel */}
        <div className="relative mb-20">
          {/* Cards container */}
          <div className="flex items-center justify-center gap-6 py-8">
            {[-1, 0, 1].map((offset) => {
              const index = (currentIndex + offset + testimonials.length) % testimonials.length;
              return (
                <div
                  key={index}
                  className={`w-full max-w-md transition-all duration-700 ${
                    offset === 0 ? '' : 'hidden md:block'
                  }`}
                >
                  <StoryCard story={testimonials[index]} isCenter={offset === 0} />
                </div>
              );
            })}
          </div>
          
          {/* Navigation */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <button
              onClick={goToPrev}
              className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-accent/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            
            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    setCurrentIndex(index);
                  }}
                  className={`transition-all duration-300 rounded-full ${
                    index === currentIndex
                      ? 'w-8 h-2 bg-accent'
                      : 'w-2 h-2 bg-border hover:bg-accent/50'
                  }`}
                />
              ))}
            </div>
            
            <button
              onClick={goToNext}
              className="w-12 h-12 rounded-full glass flex items-center justify-center hover:bg-accent/20 transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-foreground" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

