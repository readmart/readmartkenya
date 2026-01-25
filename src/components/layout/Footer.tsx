import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Send, Phone, Mail, MapPin, Loader2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { CONTACT_INFO, SOCIAL_LINKS } from '@/lib/constants';
import { subscribeToNewsletter } from '@/api/newsletter';
import { toast } from 'sonner';

// Custom SVG Icons for X (Twitter) and Threads
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z" />
  </svg>
);

const ThreadsIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M14.88 11.53c-.07-.07-.15-.14-.23-.21-.43-.35-.9-.64-1.41-.86-.51-.22-1.05-.33-1.6-.33-.55 0-1.09.11-1.6.33-.51.22-.98.51-1.41.86-.08.07-.16.14-.23.21-.45.43-.81.93-1.06 1.48-.25.55-.38 1.14-.38 1.74s.13 1.19.38 1.74c.25.55.61 1.05 1.06 1.48.07.07.15.14.23.21.43.35.9.64 1.41.86.51.22 1.05.33 1.6.33.55 0 1.09-.11 1.6-.33.51-.22.98-.51 1.41-.86.08-.07.16-.14.23-.21.45-.43.81-.93 1.06-1.48.25-.55.38-1.14.38-1.74s-.13-1.19-.38-1.74c-.25-.55-.61-1.05-1.06-1.48zm-3.24 4.54c-.39 0-.77-.08-1.12-.23-.35-.15-.67-.36-.95-.63-.27-.27-.48-.59-.63-.94-.15-.35-.23-.73-.23-1.12s.08-.77.23-1.12c.15-.35.36-.67.63-.95.27-.27.59-.48.94-.63.35-.15.73-.23 1.12-.23s.77.08 1.12.23c.35.15.67.36.95.63.27.27.48.59.63.95.15.35.23.73.23 1.12s-.08.77-.23 1.12c-.15.35-.36.67-.63.94-.27.27-.59.48-.95.63-.35.15-.73.23-1.12.23zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm7.1 12c0 .94-.19 1.86-.56 2.73-.37.87-.9 1.65-1.57 2.32-.67.67-1.45 1.2-2.32 1.57-.87.37-1.79.56-2.73.56s-1.86-.19-2.73-.56c-.87-.37-1.65-.9-2.32-1.57-.67-.67-1.2-1.45-1.57-2.32-.37-.87-.56-1.79-.56-2.73 0-.44.04-.88.12-1.31.25-.13.51-.23.79-.31.28-.08.57-.12.87-.12.85 0 1.67.24 2.37.7.7.46 1.25 1.09 1.58 1.84.14-.06.29-.11.44-.15.15-.04.31-.07.47-.07.41 0 .8.1 1.16.29.36.19.67.46.91.8.24-.34.55-.61.91-.8.36-.19.75-.29 1.16-.29.16 0 .32.03.47.07.15.04.3.09.44.15.33-.75.88-1.38 1.58-1.84.7-.46 1.52-.7 2.37-.7.3 0 .59.04.87.12.28.08.54.18.79.31.08.43.12.87.12 1.31z" />
  </svg>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.302-.15-1.787-.882-2.048-.976-.261-.093-.45-.14-.64.15-.19.29-.734.976-.9 1.163-.166.187-.331.21-.632.06-.302-.15-1.274-.47-2.426-1.502-.897-.8-1.502-1.79-1.278-2.17.224-.38.023-.585-.127-.735-.135-.135-.302-.35-.453-.525-.15-.176-.2-.302-.302-.503-.101-.2-.05-.376.025-.526.075-.15.64-.1.882-.1.261 0 .45.093.64.15.19.057.29.15.453.525.15.35.503 1.25.553 1.35.05.1.083.21.017.34-.067.13-.15.21-.26.33-.101.12-.224.27-.32.36-.101.1-.21.21-.093.41.117.2.522.86 1.12 1.392.77.685 1.417.897 1.617.997.2.1.317.083.434-.05.117-.133.503-.584.64-.784.133-.2.261-.167.433-.1.172.067 1.09.514 1.278.61.187.096.312.143.357.22.046.076.046.438-.256.587zM12.001 2c-5.524 0-10 4.476-10 10 0 1.763.46 3.42 1.264 4.86L2 22l5.314-1.395c1.42.766 3.033 1.195 4.687 1.195 5.524 0 10-4.476 10-10s-4.476-10-10-10zm0 18.294c-1.554 0-3.076-.418-4.406-1.212l-.315-.188-3.277.86.874-3.195-.206-.328c-.83-1.317-1.268-2.843-1.268-4.43 0-4.632 3.768-8.4 8.4-8.4s8.4 3.768 8.4 8.4-3.768 8.4-8.4 8.4z" />
  </svg>
);

export default function Footer() {
  const { settings } = useSettings();
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    try {
      const result = await subscribeToNewsletter(email);
      if (result.success) {
        toast.success(result.message);
        setEmail('');
      } else {
        toast.error(result.error || result.message);
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

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
              <div className="space-y-2">
                <a href={`tel:${settings.contact_phone || CONTACT_INFO.phone1}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group">
                  <div className="p-2 glass rounded-lg group-hover:bg-primary/10 transition-all">
                    <Phone className="w-4 h-4" />
                  </div>
                  <span className="font-medium">{settings.contact_phone || CONTACT_INFO.phone1}</span>
                </a>
                <a href={`tel:${CONTACT_INFO.phone2}`} className="flex items-center gap-3 text-muted-foreground hover:text-primary transition-colors group ml-11">
                  <span className="font-medium">{CONTACT_INFO.phone2}</span>
                </a>
              </div>
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
              <form className="relative" onSubmit={handleSubscribe}>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address" 
                  aria-label="Email address for newsletter"
                  className="w-full glass bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
                />
                <button 
                  type="submit"
                  disabled={isSubscribing}
                  className="absolute right-1.5 top-1.5 p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all shadow-lg disabled:opacity-50"
                  aria-label="Subscribe"
                >
                  {isSubscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Connect With Us</h3>
              <div className="flex flex-wrap gap-3">
                {[
                  { icon: 'Facebook', href: settings.facebook_url || SOCIAL_LINKS.find(l => l.label === 'Facebook')?.href, label: 'Facebook', color: 'hover:bg-[#1877F2]' },
                  { icon: 'Instagram', href: settings.instagram_url || SOCIAL_LINKS.find(l => l.label === 'Instagram')?.href, label: 'Instagram', color: 'hover:bg-[#E1306C]' },
                  { icon: 'X', href: settings.twitter_url || settings.x_url || SOCIAL_LINKS.find(l => l.label === 'X (Twitter)')?.href, label: 'X (Twitter)', color: 'hover:bg-[#000000]' },
                  { icon: 'Threads', href: settings.threads_url || SOCIAL_LINKS.find(l => l.label === 'Threads')?.href, label: 'Threads', color: 'hover:bg-[#000000]' },
                  { icon: 'Linkedin', href: settings.linkedin_url || SOCIAL_LINKS.find(l => l.label === 'LinkedIn')?.href, label: 'LinkedIn', color: 'hover:bg-[#0A66C2]' },
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
                  href={settings.whatsapp_link || SOCIAL_LINKS.find(l => l.label === 'WhatsApp')?.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="WhatsApp"
                  className="p-3 glass rounded-xl transition-all duration-300 group hover:bg-[#25D366] hover:text-white hover:-translate-y-1 hover:shadow-xl"
                >
                  <WhatsAppIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
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
