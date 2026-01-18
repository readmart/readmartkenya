import { Link } from 'react-router-dom';
import { Facebook, Instagram, Youtube, Linkedin, Send, Phone, Mail, MapPin, MessageCircle } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { CONTACT_INFO } from '@/lib/constants';

// Custom SVG Icons for X (Twitter) and Threads
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z" />
  </svg>
);

const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 21.6c-5.302 0-9.6-4.298-9.6-9.6s4.298-9.6 9.6-9.6 9.6 4.298 9.6 9.6-4.298 9.6-9.6 9.6zm4.8-12c0-2.651-2.149-4.8-4.8-4.8s-4.8 2.149-4.8 4.8v4.8c0 2.651 2.149 4.8 4.8 4.8s4.8-2.149 4.8-4.8v-4.8zm-2.4 0v4.8c0 1.325-1.075 2.4-2.4 2.4s-2.4-1.075-2.4-2.4v-4.8c0-1.325 1.075-2.4 2.4-2.4s2.4 1.075 2.4 2.4z" />
  </svg>
);

export default function Footer() {
  const { settings } = useSettings();
  const currentYear = new Date().getFullYear();

  const socialIcons: Record<string, any> = {
    Facebook,
    Instagram,
    Youtube,
    Linkedin,
    X: XIcon,
    Threads: ThreadsIcon
  };

  return (
    <footer className="glass border-t border-white/10 mt-20 pt-16 pb-8" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          {/* Column 1: Company Info */}
          <div className="space-y-6">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <img src={settings.site_logo} alt={settings.site_name} className="h-12 w-auto rounded-xl shadow-lg" />
            </Link>
            <p className="text-muted-foreground font-medium leading-relaxed">
              Bringing books to homes, cafes, and hearts since 2022. Experience the magic of stories with ReadMart.
            </p>
            <div className="space-y-4">
              <a href={`tel:${settings.contact_phone || CONTACT_INFO.phone1}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group">
                <div className="p-2 glass rounded-lg group-hover:bg-primary/10 transition-all">
                  <Phone className="w-4 h-4" />
                </div>
                <span className="font-medium">{settings.contact_phone || CONTACT_INFO.phone1}</span>
              </a>
              <a href={`mailto:${settings.contact_email || CONTACT_INFO.email}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group">
                <div className="p-2 glass rounded-lg group-hover:bg-primary/10 transition-all">
                  <Mail className="w-4 h-4" />
                </div>
                <span className="font-medium">{settings.contact_email || CONTACT_INFO.email}</span>
              </a>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="p-2 glass rounded-lg">
                  <MapPin className="w-4 h-4" />
                </div>
                <span className="font-medium">{settings.address || CONTACT_INFO.address}</span>
              </div>
            </div>
          </div>

          {/* Column 2: Explore */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-foreground">Explore</h3>
            <nav>
              <ul className="space-y-4">
                <li><Link to="/about" className="text-muted-foreground hover:text-primary transition-colors font-medium">About Us</Link></li>
                <li><Link to="/shop?category=All" className="text-muted-foreground hover:text-primary transition-colors font-medium">All Books</Link></li>
                <li><Link to="/shop?category=Art & Accessories" className="text-muted-foreground hover:text-primary transition-colors font-medium">Art & Accessories</Link></li>
                <li><Link to="/book-club" className="text-muted-foreground hover:text-primary transition-colors font-medium">Book Club</Link></li>
                <li><Link to="/events" className="text-muted-foreground hover:text-primary transition-colors font-medium">Events</Link></li>
              </ul>
            </nav>
          </div>

          {/* Column 3: Support */}
          <div>
            <h3 className="text-lg font-bold mb-6 text-foreground">Support</h3>
            <nav>
              <ul className="space-y-4">
                <li><Link to="/shipping" className="text-muted-foreground hover:text-primary transition-colors font-medium">Shipping Info</Link></li>
                <li><Link to="/track-order" className="text-muted-foreground hover:text-primary transition-colors font-medium">Track Your Order</Link></li>
                <li><Link to="/returns" className="text-muted-foreground hover:text-primary transition-colors font-medium">Returns & Refunds</Link></li>
                <li><Link to="/help" className="text-muted-foreground hover:text-primary transition-colors font-medium">Help Center</Link></li>
                <li><Link to="/partnership/apply" className="text-muted-foreground hover:text-primary transition-colors font-medium">Become a Partner</Link></li>
              </ul>
            </nav>
          </div>

          {/* Column 4: Newsletter & Social */}
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-bold mb-4 text-foreground">Newsletter</h3>
              <p className="text-sm text-muted-foreground mb-4">Stay updated with our latest releases.</p>
              <form className="relative" onSubmit={(e) => e.preventDefault()}>
                <input 
                  type="email" 
                  placeholder="Your email address" 
                  aria-label="Email address for newsletter"
                  className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                />
                <button 
                  type="submit"
                  className="absolute right-1.5 top-1.5 p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all shadow-lg"
                  aria-label="Subscribe"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Connect With Us</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: 'Instagram', href: settings.instagram_url, label: 'Instagram', color: 'hover:bg-[#E1306C]' },
                  { icon: 'Facebook', href: settings.facebook_url, label: 'Facebook', color: 'hover:bg-[#1877F2]' },
                  { icon: 'X', href: settings.twitter_url, label: 'X (Twitter)', color: 'hover:bg-[#000000]' },
                  { icon: 'Linkedin', href: settings.linkedin_url, label: 'LinkedIn', color: 'hover:bg-[#0A66C2]' },
                ].filter(link => link.href).map((link) => {
                  const Icon = socialIcons[link.icon];
                  return (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.label}
                      className={`p-3 glass rounded-xl transition-all duration-300 group ${link.color} hover:text-white hover:-translate-y-1 hover:shadow-xl`}
                    >
                      <Icon className="w-5 h-5 transition-transform group-hover:scale-110" />
                    </a>
                  );
                })}
                <a
                  href={settings.whatsapp_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="p-3 glass rounded-xl transition-all duration-300 group hover:bg-[#25D366] hover:text-white hover:-translate-y-1 hover:shadow-xl"
                >
                  <MessageCircle className="w-5 h-5 transition-transform group-hover:scale-110" />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-6">
            <p className="text-sm text-muted-foreground font-medium order-2 lg:order-1">
              © {currentYear} {settings.site_name}. Built for the love of reading.
            </p>
            <nav className="order-1 lg:order-2">
              <ul className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm font-medium text-muted-foreground">
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
                <li><Link to="/shipping" className="hover:text-primary transition-colors">Shipping Info</Link></li>
                <li><Link to="/returns" className="hover:text-primary transition-colors">Refund Policy</Link></li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
