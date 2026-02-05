import { useRef, useEffect, useState, memo, useMemo } from "react";
import Globe from "react-globe.gl";

// Default demo locations for homepage
const defaultLocations = [
  { lat: 6.5244, lng: 3.3792, name: "Lagos", impact: "12K meals", country: "Nigeria" },
  { lat: -1.2921, lng: 36.8219, name: "Nairobi", impact: "8K students", country: "Kenya" },
  { lat: 28.6139, lng: 77.209, name: "New Delhi", impact: "15K vaccines", country: "India" },
  { lat: -23.5505, lng: -46.6333, name: "São Paulo", impact: "5K families", country: "Brazil" },
  { lat: 14.5995, lng: 120.9842, name: "Manila", impact: "10K books", country: "Philippines" },
  { lat: -4.4419, lng: 15.2663, name: "Kinshasa", impact: "7K wells", country: "DR Congo" },
  { lat: 23.8103, lng: 90.4125, name: "Dhaka", impact: "20K shelters", country: "Bangladesh" },
  { lat: -6.2088, lng: 106.8456, name: "Jakarta", impact: "9K medical", country: "Indonesia" },
  { lat: 30.0444, lng: 31.2357, name: "Cairo", impact: "6K education", country: "Egypt" },
  { lat: 19.4326, lng: -99.1332, name: "Mexico City", impact: "4K homes", country: "Mexico" },
];

const defaultArcs = [
  { startLat: 6.5244, startLng: 3.3792, endLat: 28.6139, endLng: 77.209 },
  { startLat: -1.2921, startLng: 36.8219, endLat: 23.8103, endLng: 90.4125 },
  { startLat: -23.5505, startLng: -46.6333, endLat: 14.5995, endLng: 120.9842 },
  { startLat: -4.4419, startLng: 15.2663, endLat: -6.2088, endLng: 106.8456 },
  { startLat: 30.0444, startLng: 31.2357, endLat: 19.4326, endLng: -99.1332 },
];

// Location type for custom locations
export interface GlobeLocation {
  lat: number;
  lng: number;
  name: string;
  label?: string;
}

interface ImpactGlobeProps {
  locations?: GlobeLocation[];
  showLabels?: boolean;
  brandColor?: string;
  enableZoom?: boolean;
}

const ImpactGlobe = memo(({ locations, showLabels = false, brandColor, enableZoom = false }: ImpactGlobeProps) => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  // Use custom locations if provided, otherwise use defaults
  const pointsData = useMemo(() => {
    if (locations && locations.length > 0) {
      return locations.map(loc => ({
        lat: loc.lat,
        lng: loc.lng,
        name: loc.name,
        label: loc.label || loc.name,
      }));
    }
    return defaultLocations;
  }, [locations]);

  // Generate arcs between locations (connect sequential pairs for custom, use defaults otherwise)
  const arcsData = useMemo(() => {
    if (locations && locations.length > 1) {
      const arcs = [];
      for (let i = 0; i < Math.min(locations.length - 1, 5); i++) {
        arcs.push({
          startLat: locations[i].lat,
          startLng: locations[i].lng,
          endLat: locations[i + 1].lat,
          endLng: locations[i + 1].lng,
        });
      }
      return arcs;
    }
    return defaultArcs;
  }, [locations]);

  // Calculate initial point of view based on locations
  const initialPov = useMemo(() => {
    if (locations && locations.length > 0) {
      const avgLat = locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length;
      const avgLng = locations.reduce((sum, loc) => sum + loc.lng, 0) / locations.length;
      return { lat: avgLat, lng: avgLng, altitude: 2.2 };
    }
    return { lat: 20, lng: 0, altitude: 2.5 };
  }, [locations]);

  // Globe color based on brand color
  const globeColor = brandColor || "#c0dfa1";

  // Use a smaller, cached GeoJSON (110m is already the smallest)
  useEffect(() => {
    // Only fetch if not already cached in sessionStorage
    const cached = sessionStorage.getItem('globe-countries');
    if (cached) {
      setCountries(JSON.parse(cached));
      setIsLoaded(true);
      return;
    }

    fetch("https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson")
      .then((res) => res.json())
      .then((data) => {
        sessionStorage.setItem('globe-countries', JSON.stringify(data));
        setCountries(data);
        setIsLoaded(true);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Set up controls once when globe is ready
  const hasSetInitialPov = useRef(false);

  useEffect(() => {
    if (globeRef.current && dimensions.width > 0) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = locations ? 0.3 : 0.5;
      globeRef.current.controls().enableZoom = enableZoom;

      // Only set initial POV once
      if (!hasSetInitialPov.current) {
        globeRef.current.pointOfView(initialPov);
        hasSetInitialPov.current = true;
      }
    }
  }, [dimensions, initialPov, locations, enableZoom]);

  return (
    <div ref={containerRef} className="w-full h-full">
      {/* Loading placeholder */}
      {(!isLoaded || dimensions.width === 0) && (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-48 h-48 rounded-full bg-gradient-to-br from-accent/60 to-accent/30 animate-pulse" />
        </div>
      )}
      {dimensions.width > 0 && isLoaded && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="rgba(0,0,0,0)"
          showGlobe={false}
          showAtmosphere={true}
          atmosphereColor={globeColor}
          atmosphereAltitude={0.2}
          polygonsData={countries.features}
          polygonCapColor={() => `${globeColor}B3`}
          polygonSideColor={() => `${globeColor}26`}
          polygonStrokeColor={() => "rgba(255, 255, 255, 0.3)"}
          polygonAltitude={0.006}
          pointsData={pointsData}
          pointAltitude={0.01}
          pointRadius={locations ? 0.8 : 0.5}
          pointColor={() => "#ffffff"}
          pointsMerge={false}
          arcsData={arcsData}
          arcColor={() => "rgba(255, 255, 255, 0.6)"}
          arcAltitude={0.25}
          arcStroke={0.8}
          arcDashLength={0.6}
          arcDashGap={0.3}
          arcDashAnimateTime={2500}
          ringsData={pointsData}
          ringColor={() => (t: number) => `rgba(255, 255, 255, ${0.8 - t * 0.8})`}
          ringMaxRadius={locations ? 3 : 2}
          ringPropagationSpeed={1.5}
          ringRepeatPeriod={2000}
          // Labels for locations (only when showLabels is true)
          labelsData={showLabels ? pointsData : []}
          labelLat={(d: any) => d.lat}
          labelLng={(d: any) => d.lng}
          labelText={(d: any) => d.name}
          labelSize={1.2}
          labelDotRadius={0.4}
          labelColor={() => "rgba(255, 255, 255, 0.9)"}
          labelResolution={2}
          labelAltitude={0.02}
        />
      )}
    </div>
  );
});

ImpactGlobe.displayName = 'ImpactGlobe';

export default ImpactGlobe;

