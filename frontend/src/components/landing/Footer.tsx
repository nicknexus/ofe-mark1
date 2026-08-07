import { Heart } from "lucide-react";
import { motion } from "framer-motion";
import { DEMO_BOOKING_URL } from "./constants";

const Footer = () => {
  return (
    <footer className="relative z-10 py-16 border-t border-white/10 bg-ink overflow-hidden">
      {/* Thin sage/teal accent hairline */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-seafoam/40 to-transparent" />
      {/* Subtle radial glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-[40rem] rounded-full bg-sage/5 blur-3xl" />

      <motion.div
        className="relative max-w-7xl mx-auto px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-semibold text-white">Nexus</span>
            </div>
            <p className="text-white/60 max-w-sm leading-relaxed">
              Making charity transparent, simple, and deeply personal.
              Because every act of giving deserves to be seen and felt.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-3">
              <li><a href="#why-it-matters" className="text-white/60 hover:text-white transition-colors">Benefits</a></li>
              <li><a href="#pricing" className="text-white/60 hover:text-white transition-colors">Pricing</a></li>
              <li>
                <a
                  href={DEMO_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/60 hover:text-white transition-colors"
                >
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-white/50 flex items-center gap-1">
            © 2025 Nexus. Made with <Heart className="w-4 h-4 text-accent fill-current inline" /> for a better world.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="/privacy" className="text-white/50 hover:text-white transition-colors">Privacy</a>
            <a href="/terms-of-service" className="text-white/50 hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};

export default Footer;
