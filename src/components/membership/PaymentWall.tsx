import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Zap, CheckCircle2, ShieldCheck, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useClubMembership } from '@/hooks/useClubMembership';
import { getBookClubById } from '@/api/community';

interface PaymentWallProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  clubId?: string;
}

/**
 * A wrapper component that hides content behind a payment wall
 * if the global membership wall is active or if it's a specific paid club.
 */
export const PaymentWall: React.FC<PaymentWallProps> = ({ 
  children, 
  title, 
  description,
  clubId
}) => {
  const { profile, isAdmin, isFounder } = useAuth();
  const { settings, isLoading: settingsLoading } = useSettings();
  const { formatPrice } = useCurrency();
  const { isMember: isClubMember, isLoading: clubLoading } = useClubMembership(clubId);
  const [club, setClub] = useState<any>(null);

  useEffect(() => {
    if (clubId) {
      getBookClubById(clubId).then(setClub);
    }
  }, [clubId]);

  // If settings or club status are still loading, show a skeleton or nothing
  if (settingsLoading || (clubId && clubLoading)) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // 1. Check if the wall is globally active
  const isGlobalWallActive = settings?.membership_wall_active;
  
  // 2. Check if user is exempt (Admin, Founder)
  const isExempt = isAdmin || isFounder;

  // 3. Check site-wide membership
  const isSiteMember = profile?.is_member;

  // 4. Logic for club gating vs global gating
  let shouldShowWall = false;
  let wallTitle = title;
  let wallDescription = description;
  let wallPrice = settings?.membership_price || 1000;
  let wallDuration = `${settings?.membership_duration_days || 30} Days`;
  let unlockLink = '/membership';

  if (!isExempt) {
    if (clubId) {
      // It's a club wall
      if (!isClubMember) {
        shouldShowWall = true;
        wallTitle = wallTitle || club?.name || 'Club Content';
        wallDescription = wallDescription || club?.description || 'Join this book club to access discussions and exclusive content.';
        wallPrice = club?.membership_price || 0;
        wallDuration = 'Lifetime';
        unlockLink = `/membership?club=${clubId}`;
      }
    } else if (isGlobalWallActive && !isSiteMember) {
      // It's the global site wall
      shouldShowWall = true;
    }
  }

  // If wall is not active or user is exempt/member, show the content
  if (!shouldShowWall) {
    return <>{children}</>;
  }

  // Otherwise, show the payment wall UI
  return (
    <div className="relative min-h-[400px]">
      {/* Blurred background content */}
      <div className="filter blur-xl opacity-20 pointer-events-none select-none">
        {children}
      </div>

      {/* The Wall UI */}
      <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass max-w-lg w-full p-8 md:p-12 rounded-[3rem] shadow-2xl border-white/10 text-center relative overflow-hidden"
        >
          {/* Decorative background elements */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-secondary/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <Lock className="w-10 h-10 text-primary" />
            </div>

            <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter mb-4">
              {wallTitle || settings?.membership_title || 'Exclusive Content'}
            </h2>
            
            <p className="text-muted-foreground font-medium mb-8 leading-relaxed">
              {wallDescription || settings?.membership_description || 'Join our premium community to unlock this feature and many more exclusive benefits.'}
            </p>

            <div className="grid gap-4 mb-10 text-left">
              {[
                clubId ? 'Club Exclusive Discussions' : 'Access to Private Book Clubs',
                clubId ? 'Direct Author/Founder Access' : 'Deep Dive Literary Insights',
                clubId ? 'Priority Club Event Access' : 'Early Bird Event Invitations',
                clubId ? 'Exclusive Club Resources' : 'Member-Only Discounts'
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="p-1 rounded-full bg-green-500/10 text-green-500">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="glass p-6 rounded-2xl mb-8 bg-white/5 border-white/10">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  {clubId ? 'Club Access' : 'Premium Plan'}
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-primary">Limited Offer</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black">{formatPrice(wallPrice)}</span>
                <span className="text-muted-foreground font-bold text-sm">/ {wallDuration}</span>
              </div>
            </div>

            <Link 
              to={unlockLink}
              className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary/30"
            >
              Unlock Now <Zap className="w-5 h-5 fill-current" />
            </Link>

            <p className="mt-6 text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2">
              <ShieldCheck className="w-3 h-3" /> Secure Payment via M-Pesa
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
