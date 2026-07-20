import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Search, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LandingNavbarProps {
  onGetStarted: () => void;
}

const navLinks = [
  { href: "#why-it-matters", label: "Why It Matters" },
  { href: "#pricing", label: "Pricing" },
];

const LandingNavbar = ({ onGetStarted }: LandingNavbarProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Shrink / tighten the bar once the user scrolls past the hero fold.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <motion.nav
        className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="max-w-7xl mx-auto"
          animate={{ paddingTop: scrolled ? 8 : 16, paddingBottom: scrolled ? 8 : 16 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <motion.div
            className="glass rounded-2xl px-4 sm:px-6 flex items-center justify-between"
            animate={{
              paddingTop: scrolled ? 8 : 12,
              paddingBottom: scrolled ? 8 : 12,
              boxShadow: scrolled
                ? "0 8px 30px -8px rgba(70, 83, 96, 0.18)"
                : "0 4px 16px -8px rgba(70, 83, 96, 0.08)",
            }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <a href="/" className="flex items-center gap-2 group">
              <motion.div
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center overflow-hidden"
                whileHover={{ scale: 1.08, rotate: -4 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <img src="/Nexuslogo.png" alt="Nexus" className="w-full h-full object-contain" />
              </motion.div>
              <span className="text-lg sm:text-xl font-fraunces font-extralight text-foreground">Nexus Impacts</span>
            </a>

            {/* Desktop Navigation - centered */}
            <div className="hidden lg:flex items-center justify-center flex-1">
              <div className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="group relative px-3 py-2 text-muted-foreground hover:text-foreground transition-colors duration-200 whitespace-nowrap text-sm"
                  >
                    {link.label}
                    <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full bg-accent transition-transform duration-300 group-hover:scale-x-100" />
                  </a>
                ))}
                <Link
                  to="/explore"
                  className="ml-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/15 text-accent-foreground text-sm font-medium hover:bg-accent/25 transition-colors duration-200 border border-accent/30"
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
          </motion.div>
        </motion.div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Menu Panel */}
          <motion.div
            className="absolute top-[72px] left-4 right-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/60 overflow-hidden"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="p-4 space-y-1">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block px-4 py-3 text-foreground rounded-xl hover:bg-black/5 transition-colors"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
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
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  );
};

export default LandingNavbar;

