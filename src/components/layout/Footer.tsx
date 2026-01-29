import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Phone, Mail, Sparkles, ArrowRight, Music2 } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { CONTACT_INFO, SOCIAL_LINKS } from '@/lib/constants';
import StoryModal from './StoryModal';

// Custom SVG Icons for X (Twitter) and Threads
const XIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.494h2.039L6.486 3.24H4.298l13.311 17.407z" />
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
  const [isStoryOpen, setIsStoryOpen] = useState(false);

  const socialIcons: Record<string, any> = {
    Facebook,
    Instagram,
    Linkedin,
    X: XIcon,
    TikTok: Music2
  };

  return (
    <footer className="glass border-t border-white/10 mt-20 pt-12 pb-8" aria-labelledby="footer-heading">
      <StoryModal isOpen={isStoryOpen} onClose={() => setIsStoryOpen(false)} />
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      <div className="container mx-auto px-4">
        {/* About Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-12 pb-12 border-b border-white/5">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-primary/80">About ReadMart</h3>
              <button 
                onClick={() => setIsStoryOpen(true)}
                className="group flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary hover:text-black transition-all"
              >
                <Sparkles className="w-3 h-3" />
                Our Full Story
                <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
            <p className="text-lg font-bold text-white/90 leading-relaxed max-w-2xl">
              Since 2022, READMARTKE has been building a world where stories are part of daily life — through innovation, community, personalized services and unforgettable literary experiences that foster a vibrant, inclusive reading culture.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <button 
              onClick={() => setIsStoryOpen(true)}
              className="group space-y-4 p-6 glass rounded-3xl border-white/5 hover:border-primary/30 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-12 h-12 text-primary" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 group-hover:text-primary transition-colors">Our Mission</h4>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed italic group-hover:text-white/90 transition-colors">
                "To reimagine how books meet people — at home, in cafes, hospitals and beyond."
              </p>
            </button>
            <button 
              onClick={() => setIsStoryOpen(true)}
              className="group space-y-4 p-6 glass rounded-3xl border-white/5 hover:border-secondary/30 transition-all text-left relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Sparkles className="w-12 h-12 text-secondary" />
              </div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/60 group-hover:text-secondary transition-colors">Our Vision</h4>
              <p className="text-sm font-medium text-muted-foreground leading-relaxed group-hover:text-white/90 transition-colors">
                To lead a reading revolution where books live everywhere and belong to everyone.
              </p>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          {/* Logo & Info */}
          <div className="space-y-4">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <img src={settings.site_logo} alt={settings.site_name} className="h-10 w-auto rounded-lg shadow-md" />
            </Link>
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-muted-foreground">
                {/* Primary Number */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Primary Support</span>
                  <div className="flex items-center gap-4">
                    <a href={`tel:${settings.contact_phone || CONTACT_INFO.phone1}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold" title="Call Primary">
                      <Phone className="w-4 h-4" />
                      <span>{settings.contact_phone || CONTACT_INFO.phone1}</span>
                    </a>
                    <a 
                      href={`https://wa.me/${(settings.contact_phone || CONTACT_INFO.phone1).replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 transition-colors"
                      title="WhatsApp Primary"
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Secondary Number */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Secondary Support</span>
                  <div className="flex items-center gap-4">
                    <a href={`tel:${settings.secondary_phone || CONTACT_INFO.phone2}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold" title="Call Secondary">
                      <Phone className="w-4 h-4" />
                      <span>{settings.secondary_phone || CONTACT_INFO.phone2}</span>
                    </a>
                    <a 
                      href={`https://wa.me/${(settings.secondary_phone || CONTACT_INFO.phone2).replace(/\D/g, '')}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-green-500 hover:text-green-600 transition-colors"
                      title="WhatsApp Secondary"
                    >
                      <WhatsAppIcon className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Email Address</span>
                  <a href={`mailto:${settings.contact_email || CONTACT_INFO.email}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold">
                    <Mail className="w-4 h-4" />
                    <span>{settings.contact_email || CONTACT_INFO.email}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Social Links */}
          <div className="flex flex-wrap gap-3">
            {[
              { icon: 'Facebook', href: settings.facebook_url || SOCIAL_LINKS.find(l => l.label === 'Facebook')?.href, label: 'Facebook', color: 'hover:bg-[#1877F2]' },
              { icon: 'Instagram', href: settings.instagram_url || SOCIAL_LINKS.find(l => l.label === 'Instagram')?.href, label: 'Instagram', color: 'hover:bg-[#E1306C]' },
              { icon: 'TikTok', href: settings.tiktok_url || SOCIAL_LINKS.find(l => l.label === 'TikTok')?.href, label: 'TikTok', color: 'hover:bg-[#000000]' },
              { icon: 'X', href: settings.twitter_url || settings.x_url || SOCIAL_LINKS.find(l => l.label === 'X (Twitter)')?.href, label: 'X (Twitter)', color: 'hover:bg-[#000000]' },
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
                  className={`p-2.5 glass rounded-xl transition-all duration-300 group ${link.color} hover:text-white hover:-translate-y-1`}
                >
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold uppercase tracking-widest text-muted-foreground/60">
            <p>© {currentYear} {settings.site_name}. All Rights Reserved.</p>
            <nav>
              <ul className="flex flex-wrap justify-center gap-6">
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms</Link></li>
                <li><Link to="/shipping" className="hover:text-primary transition-colors">Shipping</Link></li>
                <li><Link to="/returns" className="hover:text-primary transition-colors">Refunds</Link></li>
                <li><Link to="/help" className="hover:text-primary transition-colors">Help</Link></li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
