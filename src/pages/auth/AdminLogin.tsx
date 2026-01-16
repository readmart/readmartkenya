import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Shield, Mail, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();

  // Redirect if already logged in as admin/founder
  useEffect(() => {
    if (!authLoading && profile) {
      if (profile.role === 'founder' || profile.role === 'admin') {
        navigate('/founder-dashboard');
      }
    }
  }, [profile, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Special check for founder credentials from .env
    const founderEmail = import.meta.env.VITE_FOUNDER_EMAIL || 'admin@readmart.com';
    const isDev = import.meta.env.DEV;

    try {
      // If it's the founder email and we are in dev, we can offer a bypass if Supabase fails
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // If Supabase auth fails (e.g. no API key or user doesn't exist)
        // check if credentials match the hardcoded founder ones for dev convenience
        if (isDev && email === founderEmail) {
          console.log('Using dev bypass for founder login');
          localStorage.setItem('rm_dev_role', 'founder');
          window.location.reload();
          return;
        }
        throw authError;
      }

      // Check if user has admin/founder role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.role !== 'founder' && profile.role !== 'admin') {
        await supabase.auth.signOut();
        throw new Error('Access denied. Admin or Founder role required.');
      }

      navigate(profile.role === 'founder' ? '/founder-dashboard' : '/');
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      
      // If it failed due to missing API key, show a more helpful message
      if (err.message?.includes('API key')) {
        setError('Supabase API Key is missing or invalid. Please check your .env file or use the Demo buttons below.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Development helper
  const handleDemoLogin = async (role: 'founder' | 'author' | 'partner') => {
    setLoading(true);
    try {
      // Set the dev role in localStorage
      localStorage.setItem('rm_dev_role', role);
      
      // Refresh to apply changes
      window.location.reload();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-200px)]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-md p-8 md:p-12"
      >
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Admin Portal</h1>
          <p className="text-muted-foreground">Founder & Administrator Access</p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Admin Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@readmart.com" 
                className="glass w-full pl-12 pr-6 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" 
                className="glass w-full pl-12 pr-6 py-3 rounded-2xl outline-none focus:ring-2 focus:ring-primary"
                required
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white h-14 rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
              <>
                Enter Control Center
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-white/10 text-center">
          <p className="text-xs text-muted-foreground mb-4">Development Shortcuts</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button 
              onClick={() => handleDemoLogin('founder')}
              className="px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Demo Founder
            </button>
            <button 
              onClick={() => handleDemoLogin('author')}
              className="px-3 py-1.5 glass rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition-colors"
            >
              Demo Author
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

