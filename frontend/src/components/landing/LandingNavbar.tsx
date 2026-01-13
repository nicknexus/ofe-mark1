import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2 } from "lucide-react";
import { Organization } from "../../types";

interface LandingNavbarProps {
  onGetStarted: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LandingNavbar = ({ onGetStarted }: LandingNavbarProps) => {
  // const [searchQuery, setSearchQuery] = useState('');
  // const [searchResults, setSearchResults] = useState<Organization[]>([]);
  // const [isSearching, setIsSearching] = useState(false);
  // const [showResults, setShowResults] = useState(false);

  // Search
  // useEffect(() => {
  //   if (searchQuery.trim().length >= 2) {
  //     setIsSearching(true);
  //     const timeoutId = setTimeout(async () => {
  //       try {
  //         const response = await fetch(`${API_URL}/api/organizations/public/search?q=${encodeURIComponent(searchQuery)}`);
  //         if (response.ok) {
  //           const data = await response.json();
  //           setSearchResults(data);
  //           setShowResults(true);
  //         }
  //       } catch (err) {
  //         console.error(err);
  //       } finally {
  //         setIsSearching(false);
  //       }
  //     }, 300);
  //     return () => clearTimeout(timeoutId);
  //   } else {
  //     setSearchResults([]);
  //     setShowResults(false);
  //   }
  // }, [searchQuery]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto">
        <div className="glass rounded-2xl px-6 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden">
              <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
          </a>
          
          {/* Search */}
          {/* <div className="relative w-full max-w-xs mx-4 hidden xl:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              placeholder="Search organizations"
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/50 backdrop-blur-sm rounded-xl border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            {isSearching &&
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-accent w-4 h-4" />
            }

            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 mt-2 w-full glass-card p-0 overflow-hidden">
                {searchResults.map((org) => (
                  <Link
                    key={org.id}
                    to={`/org/${org.slug}`}
                    onClick={() => {
                      setShowResults(false);
                      setSearchQuery('');
                    }}
                    className="block px-4 py-3 hover:bg-accent/10 transition-colors border-b border-border/30 last:border-0"
                  >
                    <p className="font-medium text-foreground">{org.name}</p>
                    {org.description &&
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{org.description}</p>
                    }
                  </Link>
                ))}
              </div>
            )}

            {showResults && searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
              <div className="absolute z-50 mt-2 w-full glass-card p-4 text-sm text-muted-foreground text-center">
                No organizations found
              </div>
            )}
          </div> */}
          
          <div className="hidden lg:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">Benefits</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">How It Works</a>
            {/* <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">Stories</a> */}
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">Pricing</a>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={onGetStarted}>Sign In</Button>
            <Button variant="sage" onClick={onGetStarted}>Get Started</Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default LandingNavbar;

