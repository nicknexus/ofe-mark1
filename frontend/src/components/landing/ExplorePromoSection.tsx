import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Search, ArrowRight, Globe, BarChart3, TrendingUp,
  BookOpen, MapPin, Camera, Calendar, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { MapContainer, TileLayer, Marker, Tooltip as LeafletTooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

delete (L.Icon.Default.prototype as any)._getIconUrl;

const CARTO_VOYAGER_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const sampleMetricData = [
  { date: "Jan", cumulative: 120 },
  { date: "Feb", cumulative: 300 },
  { date: "Mar", cumulative: 540 },
  { date: "Apr", cumulative: 850 },
  { date: "May", cumulative: 1270 },
  { date: "Jun", cumulative: 1800 },
  { date: "Jul", cumulative: 2480 },
  { date: "Aug", cumulative: 3270 },
  { date: "Sep", cumulative: 4190 },
  { date: "Oct", cumulative: 5270 },
  { date: "Nov", cumulative: 6490 },
  { date: "Dec", cumulative: 7940 },
];

const sampleLocations = [
  { id: 1, name: "Nairobi, Kenya", lat: -1.2921, lng: 36.8219, description: "East Africa Hub" },
  { id: 2, name: "Lagos, Nigeria", lat: 6.5244, lng: 3.3792, description: "West Africa Operations" },
  { id: 3, name: "São Paulo, Brazil", lat: -23.5505, lng: -46.6333, description: "South America Programs" },
  { id: 4, name: "Mumbai, India", lat: 19.076, lng: 72.8777, description: "South Asia Relief" },
  { id: 5, name: "Manila, Philippines", lat: 14.5995, lng: 120.9842, description: "Southeast Asia Outreach" },
];

function makeMarkerIcon(hovered = false) {
  const size = hovered ? 36 : 28;
  const color = "#c0dfa1";
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        ${hovered ? `<div style="position:absolute;width:38px;height:38px;border-radius:50%;background:${color};opacity:.2;animation:ping 1s cubic-bezier(0,0,.2,1) infinite"></div>` : ""}
        <div style="width:${hovered ? 22 : 18}px;height:${hovered ? 22 : 18}px;border-radius:50%;background:${color};border:3px solid white;position:relative;z-index:10;box-shadow:0 2px 8px rgba(0,0,0,.2)">
          <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:${hovered ? 8 : 6}px;height:${hovered ? 8 : 6}px;border-radius:50%;background:white"></div>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function MapMarker({ location }: { location: typeof sampleLocations[0] }) {
  const [hovered, setHovered] = useState(false);
  const icon = useMemo(() => makeMarkerIcon(hovered), [hovered]);

  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={icon}
      eventHandlers={{
        mouseover: () => setHovered(true),
        mouseout: () => setHovered(false),
      }}
    >
      <LeafletTooltip direction="top" offset={[0, -12]}>
        <div className="font-sans">
          <p className="font-semibold text-sm">{location.name}</p>
          <p className="text-xs text-gray-500">{location.description}</p>
        </div>
      </LeafletTooltip>
    </Marker>
  );
}

const slides = [
  {
    key: "stories",
    label: "Stories",
    subtitle: "Life Changing Moments",
    icon: BookOpen,
  },
  {
    key: "metrics",
    label: "Metrics",
    subtitle: "Progress Through Time",
    icon: TrendingUp,
  },
  {
    key: "locations",
    label: "Locations",
    subtitle: "Where Impact Occurs",
    icon: MapPin,
  },
  {
    key: "evidence",
    label: "Evidence",
    subtitle: "Proof Behind Claims",
    icon: Camera,
  },
] as const;

function StorySlide() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-transparent h-[430px] flex flex-col">
      <div className="flex-1 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
        <img src="/stories.jpg" alt="Life changing moment" className="w-full h-full object-cover" />
      </div>
      <div className="p-5">
        <h3 className="font-semibold text-foreground mb-2 text-base">
          The Pads Program
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          This young woman was extremely eager during the whole program. She even finished her pads early and started helping friends.
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-accent" />
            Mar 15, 2025
          </span>
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-accent" />
            Engucwini
          </span>
        </div>
      </div>
    </div>
  );
}

function MetricsSlide() {
  return (
    <div className="glass-card rounded-2xl border border-accent/20 overflow-hidden h-[430px] flex flex-col">
      <div className="px-5 py-4 border-b border-accent/10 flex items-center justify-between flex-shrink-0">
        <h3 className="font-semibold text-foreground flex items-center gap-2 text-sm">
          <TrendingUp className="w-4 h-4 text-accent" />
          Cumulative Progress
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground bg-accent/10 px-3 py-1 rounded-full">
            All time
          </span>
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-baseline gap-2 mb-3 flex-shrink-0">
          <span className="text-3xl font-bold text-foreground">7,940</span>
          <span className="text-sm text-muted-foreground">Meals Provided</span>
        </div>
        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sampleMetricData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="promo-metric-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c0dfa1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#c0dfa1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                width={35}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#c0dfa1"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#promo-metric-grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function LocationsSlide() {
  return (
    <div className="glass-card rounded-2xl border border-accent/20 overflow-hidden h-[430px] flex flex-col">
      <div className="flex-1">
        <MapContainer
          center={[5, 40]}
          zoom={2}
          className="w-full h-full"
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          attributionControl={false}
        >
          <TileLayer
            attribution={CARTO_ATTRIBUTION}
            url={CARTO_VOYAGER_URL}
            subdomains={["a", "b", "c", "d"]}
            maxZoom={20}
          />
          {sampleLocations.map((loc) => (
            <MapMarker key={loc.id} location={loc} />
          ))}
        </MapContainer>
      </div>
      <div className="px-5 py-3 flex items-center gap-4 border-t border-accent/10">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#c0dfa1] border-2 border-white shadow-sm" />
          <span className="text-xs text-muted-foreground">{sampleLocations.length} active locations</span>
        </div>
        <span className="text-xs text-muted-foreground">across 4 continents</span>
      </div>
    </div>
  );
}

function EvidenceSlide() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden border border-transparent h-[430px] flex flex-col">
      <div className="flex-1 bg-gradient-to-br from-accent/10 to-accent/5 overflow-hidden">
        <img src="/evidence.png" alt="Visual evidence" className="w-full h-full object-cover" />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-pink-100 text-pink-800">
            Visual Support
          </span>
          <span className="text-xs text-muted-foreground">Feb 20, 2025</span>
        </div>
        <h3 className="font-semibold text-foreground text-sm mb-1">
          Students Learning to Create Pads
        </h3>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          Documenting students during the hands-on pad-making workshop.
        </p>
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded">
            Engucwini
          </span>
        </div>
      </div>
    </div>
  );
}

const AUTOPLAY_INTERVAL = 5000;

const ExplorePromoSection = () => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slides.length);
    }, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [paused]);

  const goTo = (idx: number) => {
    setActiveIndex(idx);
    setPaused(true);
    setTimeout(() => setPaused(false), 10000);
  };

  const goPrev = () => goTo((activeIndex - 1 + slides.length) % slides.length);
  const goNext = () => goTo((activeIndex + 1) % slides.length);

  const slideComponents = [
    <StorySlide key="stories" />,
    <MetricsSlide key="metrics" />,
    <LocationsSlide key="locations" />,
    <EvidenceSlide key="evidence" />,
  ];

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — copy + CTA */}
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-newsreader font-light text-foreground mb-12 leading-tight">
              The end of ineffective reporting.
            </h2>

            <div className="flex items-center gap-3 mb-14 -mt-2">
              <p className="text-2xl sm:text-3xl font-newsreader font-light text-foreground leading-snug">
                Actively Experience...
              </p>
              <svg
                className="hidden lg:block w-64 h-10 flex-shrink-0"
                viewBox="0 0 240 40"
                fill="none"
              >
                <path
                  d="M4 20Q110 38 216 20"
                  stroke="#c0dfa1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="animate-pulse-soft-landing"
                />
                <path
                  d="M214 8L234 16L218 28"
                  stroke="#c0dfa1"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="animate-pulse-soft-landing"
                />
              </svg>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-2xl bg-accent text-accent-foreground text-lg font-medium hover:bg-accent/90 transition-all duration-300 border-2 border-accent/50 shadow-sage hover:shadow-md hover:-translate-y-0.5 group"
            >
              Start for Free
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Link>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mt-8">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-accent-foreground" />
                <span>Full Transparency</span>
              </div>
            </div>
          </div>

          {/* Right — slide carousel */}
          <div
            className="flex flex-col gap-4"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {/* Slide label + arrows */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">
                  {slides[activeIndex].subtitle}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {slides[activeIndex].label}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={goPrev}
                  className="w-8 h-8 rounded-lg bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground" />
                </button>
                <button
                  onClick={goNext}
                  className="w-8 h-8 rounded-lg bg-accent/10 hover:bg-accent/20 flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-foreground" />
                </button>
              </div>
            </div>

            {/* Slide content */}
            <div className="relative min-h-[430px]">
              {slideComponents.map((component, idx) => (
                <div
                  key={slides[idx].key}
                  className={`transition-all duration-500 ${idx === activeIndex
                      ? "opacity-100 translate-y-0 relative"
                      : "opacity-0 translate-y-4 absolute inset-0 pointer-events-none"
                    }`}
                >
                  {component}
                </div>
              ))}
            </div>

            {/* Tab indicators */}
            <div className="flex gap-2">
              {slides.map((slide, idx) => {
                const Icon = slide.icon;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={slide.key}
                    onClick={() => goTo(idx)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all duration-300 ${isActive
                        ? "bg-accent/20 text-foreground border border-accent/30 shadow-sm"
                        : "bg-accent/5 text-muted-foreground hover:bg-accent/10 border border-transparent"
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{slide.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExplorePromoSection;
