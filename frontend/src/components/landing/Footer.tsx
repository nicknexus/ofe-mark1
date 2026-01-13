import { Heart } from "lucide-react";
import { Heart as HeartPhosphor } from "phosphor-react";

const Footer = () => {
  return (
    <footer className="py-16 border-t border-border/50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                <Heart className="w-5 h-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-semibold text-foreground">Nexus</span>
            </div>
            <p className="text-muted-foreground max-w-sm leading-relaxed">
              Making charity transparent, simple, and deeply personal. 
              Because every act of giving deserves to be seen and felt.
            </p>
          </div>
          
          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-4">Product</h4>
            <ul className="space-y-3">
              <li><a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Benefits</a></li>
              <li><a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a></li>
              <li><a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">Pricing</a></li>
              <li><a href="#contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-foreground mb-4">Contact</h4>
            <ul className="space-y-3">
              <li><a href="mailto:liam@nexusimpacts.com" className="text-muted-foreground hover:text-foreground transition-colors">liam@nexusimpacts.com</a></li>
              <li><a href="tel:2506504221" className="text-muted-foreground hover:text-foreground transition-colors">250-650-4221</a></li>
              <li className="text-muted-foreground text-sm pt-2">Tech Support:</li>
              <li><a href="mailto:nick@nexusimpacts.com" className="text-muted-foreground hover:text-foreground transition-colors">nick@nexusimpacts.com</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border/50 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            © 2025 Nexus. Made with <HeartPhosphor className="w-4 h-4 text-accent inline" weight="fill" /> for a better world.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

