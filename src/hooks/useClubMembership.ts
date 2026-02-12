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
        const { data, error } = await supabase
          .from('book_club_memberships')
          .select('status')
          .eq('club_id', clubId)
          .eq('user_id', currentUser.id)
          .maybeSingle();

        if (error) throw error;

        const isActive = data?.status === 'active';
        
        if (data && isActive) {
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
