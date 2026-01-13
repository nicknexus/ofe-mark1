import { Mail, Phone, Wrench } from "lucide-react";

const ContactSection = () => {
  return (
    <section id="contact" className="py-20 bg-muted/30">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Get in Touch
          </h2>
          <p className="text-muted-foreground text-lg">
            We'd love to hear from you
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {/* General Contact */}
          <div className="bg-card rounded-2xl p-8 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">General Inquiries</h3>
            </div>
            <div className="space-y-3">
              <a href="mailto:liam@nexusimpacts.com" className="block text-muted-foreground hover:text-foreground transition-colors">
                liam@nexusimpacts.com
              </a>
              <a href="tel:2506504221" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="w-4 h-4" />
                250-650-4221
              </a>
            </div>
          </div>
          
          {/* Tech Support */}
          <div className="bg-card rounded-2xl p-8 border border-border/50">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center">
                <Wrench className="w-5 h-5 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">Tech Support</h3>
            </div>
            <a href="mailto:nick@nexusimpacts.com" className="block text-muted-foreground hover:text-foreground transition-colors">
              nick@nexusimpacts.com
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
