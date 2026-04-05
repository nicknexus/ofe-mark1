import { useState, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft, Globe } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const slides = [
  { title: "Explore Our Charities", subtitle: "Browse verified organizations and discover who's making a difference.", image: "/explore1.png" },
  { title: "Charity Dashboards", subtitle: "See real-time metrics, goals, and progress all in one place.", image: "/explore2.png" },
  { title: "See Stories, Progress & More", subtitle: "Follow along with updates, milestones, and the people behind the impact.", image: "/explore3.png" },
  { title: "Charity Initiative Dashboard", subtitle: "Dive into individual initiatives and track exactly where resources go.", image: "/explore4.png" },
  { title: "See Evidence for Yourself", subtitle: "View verified photos, documents, and proof of real-world outcomes.", image: "/explore5.png" },
];

const ExplorePromoSection = () => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 10000, stopOnInteraction: true }),
  ]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 text-accent-foreground text-sm font-medium mb-6">
            <Globe className="w-4 h-4" />
            Transparency Explorer
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-newsreader font-light text-foreground leading-tight">
            See What Transparency{" "}
            <span className="relative inline-block">
              Looks Like
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path
                  d="M2 8C75 2 225 2 298 8"
                  stroke="#c0dfa1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-pulse-soft-landing"
                />
              </svg>
            </span>
          </h2>
        </div>

        {/* Carousel */}
        <div className="relative">
          <div ref={emblaRef} className="overflow-hidden rounded-2xl">
            <div className="flex">
              {slides.map((slide) => (
                <div key={slide.image} className="flex-[0_0_100%] min-w-0 px-2">
                  <div className="relative aspect-[16/9] rounded-2xl overflow-hidden border border-accent/20 shadow-glass-lg bg-muted/30">
                    <img
                      src={slide.image}
                      alt={slide.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-20 pb-6 px-6">
                      <p className="text-white text-xl sm:text-2xl font-semibold drop-shadow-lg">
                        {slide.title}
                      </p>
                      <p className="text-white/75 text-sm sm:text-base mt-1 drop-shadow">
                        {slide.subtitle}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={scrollPrev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-accent/20 flex items-center justify-center hover:bg-background transition-colors shadow-lg"
            aria-label="Previous slide"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <button
            onClick={scrollNext}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur border border-accent/20 flex items-center justify-center hover:bg-background transition-colors shadow-lg"
            aria-label="Next slide"
          >
            <ArrowRight className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => emblaApi?.scrollTo(idx)}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === selectedIndex ? "w-8 bg-accent-foreground" : "w-2 bg-accent/30"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="flex justify-center mt-10">
          <Link
            to="/explore"
            className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-2xl bg-accent/15 text-foreground text-lg font-medium hover:bg-accent/25 transition-all duration-300 border border-accent/30 hover:shadow-lg hover:-translate-y-0.5 group"
          >
            Explore Our Organizations
            <ArrowRight className="w-5 h-5 text-accent-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ExplorePromoSection;
