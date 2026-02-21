import { Link } from "react-router-dom";
import { Search, ArrowRight, Globe, BarChart3, TrendingUp, Users, Heart } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";

const sampleChartData = [
  { date: "Jan", donations: 120, beneficiaries: 45 },
  { date: "Feb", donations: 180, beneficiaries: 72 },
  { date: "Mar", donations: 240, beneficiaries: 110 },
  { date: "Apr", donations: 310, beneficiaries: 165 },
  { date: "May", donations: 420, beneficiaries: 230 },
  { date: "Jun", donations: 530, beneficiaries: 310 },
  { date: "Jul", donations: 680, beneficiaries: 405 },
  { date: "Aug", donations: 790, beneficiaries: 520 },
  { date: "Sep", donations: 920, beneficiaries: 640 },
  { date: "Oct", donations: 1080, beneficiaries: 780 },
  { date: "Nov", donations: 1250, beneficiaries: 920 },
  { date: "Dec", donations: 1450, beneficiaries: 1100 },
];

const sampleMetrics = [
  { value: "12.4K", label: "Beneficiaries Reached", icon: Users },
  { value: "98%", label: "Verified Claims", icon: TrendingUp },
  { value: "1.2M", label: "Impact Tracked", icon: BarChart3 },
  { value: "340+", label: "Active Initiatives", icon: Heart },
];

const ExplorePromoSection = () => {
  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-accent/5 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left — copy + CTA */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/15 text-accent-foreground text-sm font-medium mb-6">
              <Globe className="w-4 h-4" />
              Transparency Explorer
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-newsreader font-light text-foreground mb-6 leading-tight">
              Discover verified organizations{" "}
              <span className="relative inline-block">
                making real impact
                <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                  <path d="M2 8C75 2 225 2 298 8" stroke="#c0dfa1" strokeWidth="4" strokeLinecap="round" className="animate-pulse-soft-landing" />
                </svg>
              </span>
            </h2>

            <p className="text-lg sm:text-xl text-muted-foreground max-w-lg leading-relaxed mb-8">
              View all our organizations through our transparency explore page. See their initiatives, verified evidence, and real impact — all in one place.
            </p>

            <Link
              to="/explore"
              className="inline-flex items-center justify-center gap-2 px-8 h-14 rounded-2xl bg-accent/15 text-foreground text-lg font-medium hover:bg-accent/25 transition-all duration-300 border border-accent/30 hover:shadow-lg hover:-translate-y-0.5 group"
            >
              <Search className="w-5 h-5 text-accent-foreground" />
              Explore Our Organizations
              <ArrowRight className="w-5 h-5 text-accent-foreground transition-transform group-hover:translate-x-1" />
            </Link>

            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mt-8">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-accent-foreground" />
                <span>Public impact data</span>
              </div>
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-accent-foreground" />
                <span>Full transparency</span>
              </div>
            </div>
          </div>

          {/* Right — visuals */}
          <div className="flex flex-col gap-4">
            {/* Chart card */}
            <div className="glass-card rounded-2xl border border-accent/20 shadow-glass-lg p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/15">
                  <BarChart3 className="w-4 h-4 text-accent-foreground" />
                </div>
                <h3 className="font-semibold text-foreground text-sm">Cumulative Impact</h3>
              </div>
              <div className="h-[200px] sm:h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sampleChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="promo-grad-1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c0dfa1" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#c0dfa1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="promo-grad-2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8ecae6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#8ecae6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9ca3af" }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`)}
                    />
                    <Area
                      type="monotone"
                      dataKey="donations"
                      stroke="#c0dfa1"
                      strokeWidth={2.5}
                      fill="url(#promo-grad-1)"
                      dot={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="beneficiaries"
                      stroke="#8ecae6"
                      strokeWidth={2.5}
                      fill="url(#promo-grad-2)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-5 mt-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#c0dfa1]" />
                  <span className="text-xs text-muted-foreground">Donations</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#8ecae6]" />
                  <span className="text-xs text-muted-foreground">Beneficiaries</span>
                </div>
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3">
              {sampleMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="glass-card p-4 rounded-2xl border border-accent/10 flex items-center gap-3 hover:shadow-glass-lg transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center flex-shrink-0">
                    <metric.icon className="w-4.5 h-4.5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground leading-none">{metric.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{metric.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExplorePromoSection;
