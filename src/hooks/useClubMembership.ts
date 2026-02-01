import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useClubMembership(clubId?: string) {
  const { user, isAdmin, isFounder } = useAuth();
  const [isMember, setIsMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clubId) {
      setIsLoading(false);
      return;
    }

    if (isAdmin || isFounder) {
      setIsMember(true);
      setIsLoading(false);
      return;
    }

    if (!user) {
      setIsMember(false);
      setIsLoading(false);
      return;
    }

    const currentUser = user; // Capture for narrowing

    async function checkMembership() {
      try {
        let { data, error } = await supabase
          .from('club_members')
          .select('payment_status, status')
          .eq('club_id', clubId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) {
          if (error.code === 'PGRST204' || error.message?.includes('column') || error.message?.includes('cache')) {
            console.warn('Club members schema cache issue, falling back to core');
            const { data: fallbackData, error: fallbackError } = await supabase
              .from('club_members')
              .select('status')
              .eq('club_id', clubId)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            
            if (fallbackError) throw fallbackError;
            data = fallbackData as any;
          } else {
            throw error;
          }
        }

        // status check is primary, payment_status check is secondary (and might be missing in fallback)
        const isActive = data?.status === 'active';
        const isPaid = !data || !('payment_status' in data) || data.payment_status === 'paid' || data.payment_status === null;

        if (data && isActive && isPaid) {
          setIsMember(true);
        } else {
          setIsMember(false);
        }
      } catch (error) {
        console.error('Error checking club membership:', error);
        setIsMember(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkMembership();
  }, [clubId, user, isAdmin, isFounder]);

  return { isMember, isLoading };
}
