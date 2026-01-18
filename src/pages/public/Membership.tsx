import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  ShieldCheck, Zap, Star, 
  ArrowRight, Phone, Lock, Sparkles,
  BookOpen, Calendar, Users, Gift
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useCurrency } from '@/contexts/CurrencyContext';
import { initiateMembershipPayment } from '@/api/payments';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export default function Membership() {
  const { user, profile, loading: authLoading } = useAuth();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { formatPrice } = useCurrency();
  const navigate = useNavigate();
  
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If already a member, redirect to account
  if (profile?.is_member) {
    navigate('/account');
    return null;
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error('Please login to join membership');
      navigate('/login?redirect=/membership');
      return;
    }

    if (!phone) {
      toast.error('Please enter your M-Pesa phone number');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await initiateMembershipPayment(phone, settings?.membership_price || 1000);
      if (response.success) {
        toast.success('Payment request sent to your phone!');
        // In a real app, we'd poll for status or wait for webhook
      } else {
        toast.error(response.error || 'Failed to initiate payment');
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const benefits = [
    {
      icon: <BookOpen className="w-6 h-6 text-blue-500" />,
      title: "Exclusive Book Clubs",
      description: "Join curated reading circles and deep-dive discussions with fellow enthusiasts."
    },
    {
      icon: <Calendar className="w-6 h-6 text-purple-500" />,
      title: "Premium Events",
      description: "Get early access and discounted tickets to author meetups and literary festivals."
    },
    {
      icon: <Users className="w-6 h-6 text-orange-500" />,
      title: "Community Access",
      description: "Connect with a vibrant network of readers, authors, and industry experts."
    },
    {
      icon: <Gift className="w-6 h-6 text-green-500" />,
      title: "Member Discounts",
      description: "Enjoy special pricing on selected bestsellers and limited edition releases."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1507842217343-583bb7270b66?q=80&w=2000')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-900" />
        
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary text-xs font-black uppercase tracking-widest mb-8 border border-primary/30">
              <Sparkles className="w-4 h-4" /> Join the Inner Circle
            </span>
            <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight uppercase tracking-tight">
              {settings?.membership_title || 'ReadMart Premium'}
            </h1>
            <p className="text-xl text-slate-300 font-medium mb-12">
              {settings?.membership_description || 'Unlock exclusive access to book clubs, premium events, and a community of passionate readers.'}
            </p>
          </motion.div>
        </div>
      </section>

      <div className="container mx-auto px-4 -mt-20 relative z-20 pb-20">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left: Benefits */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              {benefits.map((benefit, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass p-8 rounded-[2.5rem] bg-white border-white shadow-xl shadow-slate-200/50 group hover:scale-[1.02] transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    {benefit.icon}
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-3">{benefit.title}</h3>
                  <p className="text-muted-foreground font-medium leading-relaxed">{benefit.description}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: Pricing Card */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="sticky top-32"
            >
              <div className="glass p-8 md:p-12 rounded-[3rem] bg-white border-white shadow-2xl shadow-slate-200/50 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-bl-[5rem] -mr-8 -mt-8 blur-3xl" />
                
                <header className="mb-10 text-center">
                  <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Premium Access</h2>
                  <div className="flex items-center justify-center gap-3">
                    <span className="h-px w-8 bg-slate-200" />
                    <Star className="w-4 h-4 text-primary fill-current" />
                    <span className="h-px w-8 bg-slate-200" />
                  </div>
                </header>

                <div className="glass p-8 rounded-[2rem] bg-slate-50 border-white mb-10 text-center">
                  <div className="flex items-baseline justify-center gap-2 mb-2">
                    <span className="text-5xl font-black text-slate-900">
                      {formatPrice(settings?.membership_price || 1000)}
                    </span>
                    <span className="text-slate-500 font-bold text-lg uppercase tracking-widest">
                      / {settings?.membership_duration_days || 30} Days
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 font-black uppercase tracking-widest">Full Platform Access</p>
                </div>

                <form onSubmit={handleJoin} className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-2">
                      M-Pesa Phone Number
                    </label>
                    <div className="relative group">
                      <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors">
                        <Phone className="w-5 h-5" />
                      </div>
                      <input
                        type="tel"
                        required
                        placeholder="2547XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-100 focus:border-primary focus:bg-white rounded-2xl py-5 pl-16 pr-6 font-bold transition-all outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-primary text-white py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>Processing... <Zap className="w-5 h-5 animate-pulse" /></>
                    ) : (
                      <>Join Now <ArrowRight className="w-5 h-5" /></>
                    )}
                  </button>
                </form>

                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    Secure Transaction via Kopo Kopo
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    <Lock className="w-4 h-4 text-primary" />
                    Encrypted M-Pesa Checkout
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
