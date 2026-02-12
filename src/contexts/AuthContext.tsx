import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, type User, type Session } from '@/lib/supabase/client';

export type UserRole = 'customer' | 'admin' | 'founder' | 'author' | 'partner';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  address: string | null;
  role: UserRole;
  is_member?: boolean;
  membership_expires_at?: string;
  membership_started_at?: string;
  preferences?: {
    sms_notifications?: boolean;
    newsletter?: boolean;
  };
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
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const columns = 'id, full_name, avatar_url, role, phone, address, preferences, created_at, updated_at';
      let { data, error } = await supabase
        .from('profiles')
        .select(columns)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        // Handle 400 Bad Request or Schema Cache issues specifically for missing columns
        const isSchemaError = 
          error.code === 'PGRST204' || 
          error.code === 'PGRST205' || 
          error.code === 'PGRST100' || 
          error.code === '42703' || 
          error.message?.includes('column') || 
          error.message?.includes('cache') || 
          (error as any).status === 404 ||
          (error as any).status === 400;

        if (isSchemaError) {
          console.warn('Advanced profile columns missing from cache, falling back to core columns');
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', userId)
            .maybeSingle();
          
          if (fallbackError) {
            console.error('Fallback profile fetch error:', fallbackError);
          } else {
            data = fallbackData as any;
          }
        } else {
          console.error('Profile fetch error:', error);
        }
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
            .select('id, full_name, avatar_url, role')
            .single();
          
          if (createError) {
            console.error('Profile creation error:', createError);
          } else {
            setProfile(newProfile as any);
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
    await supabase.auth.signOut();
    window.location.reload();
  };

  const resetPassword = async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    console.log('[Auth] Reset password request for:', email, 'Redirecting to:', redirectTo);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    try {
      if (!user) throw new Error('No user logged in');
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
      
      if (!error) {
        setProfile(prev => {
          if (!prev) return null;
          
          // Deep merge for nested objects like preferences
          const newProfile = { ...prev };
          
          Object.keys(updates).forEach(key => {
            const k = key as keyof Profile;
            if (updates[k] !== null && typeof updates[k] === 'object' && !Array.isArray(updates[k]) && prev[k]) {
              // @ts-ignore - Handle nested object merge
              newProfile[k] = { ...prev[k], ...updates[k] };
            } else {
              // @ts-ignore - Handle regular field update
              newProfile[k] = updates[k];
            }
          });
          
          return newProfile;
        });
      }
      return { error };
    } catch (error: any) {
      return { error };
    }
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
    updateProfile,
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
