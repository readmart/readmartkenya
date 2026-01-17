import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'customer' | 'admin' | 'founder' | 'author' | 'partner';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
}

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isFounder: boolean;
  isPartner: boolean;
  isAuthor: boolean;
  hasRole: (roles: UserRole[]) => boolean;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  updatePassword: (password: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const devRole = localStorage.getItem('rm_dev_role');
      
      if (devRole && !session?.user) {
        // Mock a user if dev role is set but no session exists
        setUser({ id: 'dev-user-id', email: 'dev@readmart.com' } as any);
        fetchProfile('dev-user-id');
      } else {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const devRole = localStorage.getItem('rm_dev_role');
      
      if (devRole && !session?.user) {
        setUser({ id: 'dev-user-id', email: 'dev@readmart.com' } as any);
        fetchProfile('dev-user-id');
      } else {
        setUser(session?.user ?? null);
        if (session?.user) fetchProfile(session.user.id);
        else {
          setProfile(null);
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    // Development bypass: If localStorage has 'rm_dev_role', use that
    const devRole = localStorage.getItem('rm_dev_role') as UserRole | null;
    
    if (devRole) {
      setProfile({
        id: userId,
        full_name: 'Dev User',
        avatar_url: null,
        role: devRole
      });
      setLoading(false);
      return;
    }

    try {
      let { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Profile fetch error:', error);
        // Don't throw, just allow the user to be logged in without a profile
      }

      // If profile doesn't exist (e.g., OAuth first time), create it
      if (!data && !error) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Use upsert to avoid race conditions with the database trigger
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .upsert({
              id: userId,
              full_name: user.user_metadata?.full_name || 'New User',
              avatar_url: user.user_metadata?.avatar_url || null,
              role: 'customer'
            }, {
              onConflict: 'id'
            })
            .select()
            .single();
          
          if (createError) {
            console.error('Profile creation error:', createError);
          } else {
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('rm_dev_role');
    await supabase.auth.signOut();
    window.location.reload();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const hasRole = (roles: UserRole[]) => {
    return profile ? roles.includes(profile.role) : false;
  };

  const value = {
    user,
    profile,
    loading,
    isAdmin: profile?.role === 'admin' || profile?.role === 'founder',
    isFounder: profile?.role === 'founder',
    isPartner: profile?.role === 'partner',
    isAuthor: profile?.role === 'author',
    hasRole,
    logout,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
