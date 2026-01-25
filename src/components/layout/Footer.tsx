import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Phone, Mail } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { CONTACT_INFO, SOCIAL_LINKS } from '@/lib/constants';

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

  const socialIcons: Record<string, any> = {
    Facebook,
    Instagram,
    Linkedin,
    X: XIcon,
    Threads: ThreadsIcon
  };

  return (
    <footer className="glass border-t border-white/10 mt-20 pt-12 pb-8" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-12">
          {/* Logo & Info */}
          <div className="space-y-4">
            <Link to="/" className="inline-block transition-transform hover:scale-105">
              <img src={settings.site_logo} alt={settings.site_name} className="h-10 w-auto rounded-lg shadow-md" />
            </Link>
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-muted-foreground">
                <a href={`tel:${settings.contact_phone || CONTACT_INFO.phone1}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold">
                  <Phone className="w-4 h-4" />
                  <span>Primary: {settings.contact_phone || CONTACT_INFO.phone1}</span>
                </a>
                <a href={`tel:${settings.secondary_phone || CONTACT_INFO.phone2}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold">
                  <Phone className="w-4 h-4" />
                  <span>Secondary: {settings.secondary_phone || CONTACT_INFO.phone2}</span>
                </a>
                <a href={`mailto:${settings.contact_email || CONTACT_INFO.email}`} className="flex items-center gap-2 hover:text-primary transition-colors text-sm font-bold">
                  <Mail className="w-4 h-4" />
                  <span>{settings.contact_email || CONTACT_INFO.email}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Social Links */}
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
                  className={`p-2.5 glass rounded-xl transition-all duration-300 group ${link.color} hover:text-white hover:-translate-y-1`}
                >
                  <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                </a>
              );
            })}
            <a
              href={settings.whatsapp_link || SOCIAL_LINKS.find(l => l.label === 'WhatsApp')?.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="p-2.5 glass rounded-xl transition-all duration-300 group hover:bg-[#25D366] hover:text-white hover:-translate-y-1"
            >
              <WhatsAppIcon className="w-4 h-4 transition-transform group-hover:scale-110" />
            </a>
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
