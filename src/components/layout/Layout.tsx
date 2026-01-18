import type { ReactNode } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import { useSettings } from '@/hooks/useSettings';
import { Megaphone, Wrench } from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { settings, isLoading } = useSettings();
  const location = useLocation();

  const isAuthRoute = ['/login', '/signup', '/admin-login', '/forgot-password', '/reset-password'].includes(location.pathname);
  const isDashboardRoute = location.pathname.includes('dashboard');
  const skipMaintenance = isAuthRoute || isDashboardRoute;

  if (!isLoading && settings?.maintenance_mode && !skipMaintenance) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-md space-y-8">
          <div className="w-24 h-24 bg-amber-100 rounded-[2.5rem] flex items-center justify-center mx-auto text-amber-600 shadow-xl shadow-amber-500/10 border border-amber-200">
            <Wrench className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">System Maintenance</h1>
            <p className="text-muted-foreground font-medium leading-relaxed">
              We're currently performing some scheduled maintenance to improve your experience. 
              Operations will resume shortly. Thank you for your patience.
            </p>
          </div>
          <div className="pt-8">
            <div className="p-6 glass rounded-3xl border-slate-200 bg-white">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Expected Recovery</p>
              <p className="font-black text-slate-900 uppercase">T-Minus 60 Minutes</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {!isLoading && settings?.announcement_text && (
        <div className="bg-primary text-white py-3 px-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-50" />
          <div className="container mx-auto flex items-center justify-center gap-3 relative z-10">
            <Megaphone className="w-4 h-4 animate-bounce" />
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-center">
              {settings.announcement_text}
            </p>
          </div>
        </div>
      )}
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
    </div>
  );
}
