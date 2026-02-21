import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Loader2, Menu, X } from "lucide-react";
import { Organization } from "../../types";

interface LandingNavbarProps {
  onGetStarted: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const LandingNavbar = ({ onGetStarted }: LandingNavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto">
          <div className="glass rounded-2xl px-4 sm:px-6 py-3 flex items-center justify-between">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform duration-300 overflow-hidden">
                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
              </div>
              <span className="text-lg sm:text-xl font-newsreader font-extralight text-foreground">Nexus Impacts</span>
            </a>
            
            {/* Desktop Navigation - centered */}
            <div className="hidden lg:flex items-center justify-center flex-1">
              <div className="flex items-center gap-6">
                <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">Benefits</a>
                <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">How It Works</a>
                <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm">Pricing</a>
                <Link 
                  to="/explore" 
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/15 text-accent-foreground text-sm font-medium hover:bg-accent/25 transition-colors duration-200 border border-accent/30"
                >
                  <Search className="w-3.5 h-3.5" />
                  Explore
                </Link>
              </div>
            </div>
            
            {/* Desktop buttons */}
            <div className="hidden lg:flex items-center gap-3">
              <Button variant="ghost" onClick={onGetStarted}>Sign In</Button>
              <Button variant="sage" onClick={onGetStarted}>Get Started</Button>
            </div>

            {/* Mobile menu button */}
            <button 
              className="lg:hidden p-2 -mr-2 text-foreground hover:bg-black/5 rounded-xl transition-colors"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="absolute top-[72px] left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 overflow-hidden animate-fade-in">
            <div className="p-4 space-y-1">
              <a 
                href="#features" 
                className="block px-4 py-3 text-foreground rounded-xl hover:bg-black/5 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Benefits
              </a>
              <a 
                href="#how-it-works" 
                className="block px-4 py-3 text-foreground rounded-xl hover:bg-black/5 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How It Works
              </a>
              <a 
                href="#pricing" 
                className="block px-4 py-3 text-foreground rounded-xl hover:bg-black/5 transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </a>
            </div>
            <div className="px-4 pb-2">
              <Link 
                to="/explore" 
                className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-accent/15 text-accent-foreground font-medium rounded-xl hover:bg-accent/25 transition-colors border border-accent/30"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Search className="w-4 h-4" />
                Explore Organizations
              </Link>
            </div>
            <div className="p-4 pt-2 border-t border-gray-100 space-y-2">
              <button 
                className="w-full px-4 py-3 text-foreground font-medium rounded-xl hover:bg-black/5 transition-colors text-center"
                onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}
              >
                Sign In
              </button>
              <button 
                className="w-full px-4 py-3 bg-primary-500 text-gray-700 font-medium rounded-xl hover:bg-primary-400 transition-colors text-center"
                onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LandingNavbar;

