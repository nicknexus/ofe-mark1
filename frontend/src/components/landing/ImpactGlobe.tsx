import { useRef, useEffect, useState, memo } from "react";
import Globe from "react-globe.gl";

// Memoized to prevent unnecessary re-renders
const impactLocations = [
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

const arcsData = [
  { startLat: 6.5244, startLng: 3.3792, endLat: 28.6139, endLng: 77.209 },
  { startLat: -1.2921, startLng: 36.8219, endLat: 23.8103, endLng: 90.4125 },
  { startLat: -23.5505, startLng: -46.6333, endLat: 14.5995, endLng: 120.9842 },
  { startLat: -4.4419, startLng: 15.2663, endLat: -6.2088, endLng: 106.8456 },
  { startLat: 30.0444, startLng: 31.2357, endLat: 19.4326, endLng: -99.1332 },
];

const ImpactGlobe = memo(() => {
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState<{ features: any[] }>({ features: [] });
  const [isLoaded, setIsLoaded] = useState(false);

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

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.controls().enableZoom = false;
      globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.5 });
    }
  }, [dimensions]);

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
          atmosphereColor="#c0dfa1"
          atmosphereAltitude={0.2}
          polygonsData={countries.features}
          polygonCapColor={() => "rgba(192, 223, 161, 0.7)"}
          polygonSideColor={() => "rgba(192, 223, 161, 0.15)"}
          polygonStrokeColor={() => "rgba(255, 255, 255, 0.3)"}
          polygonAltitude={0.006}
          pointsData={impactLocations}
          pointAltitude={0.01}
          pointRadius={0.5}
          pointColor={() => "#ffffff"}
          pointsMerge={false}
          arcsData={arcsData}
          arcColor={() => "rgba(255, 255, 255, 0.6)"}
          arcAltitude={0.25}
          arcStroke={0.8}
          arcDashLength={0.6}
          arcDashGap={0.3}
          arcDashAnimateTime={2500}
          ringsData={impactLocations}
          ringColor={() => (t: number) => `rgba(255, 255, 255, ${0.8 - t * 0.8})`}
          ringMaxRadius={2}
          ringPropagationSpeed={1.5}
          ringRepeatPeriod={2000}
        />
      )}
    </div>
  );
});

ImpactGlobe.displayName = 'ImpactGlobe';

export default ImpactGlobe;

