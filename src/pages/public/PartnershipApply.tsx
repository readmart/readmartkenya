import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Handshake, Building2, Mail, User, FileText, Send, Loader2, CheckCircle2, Lock, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

interface Agreement {
  id: string;
  title: string;
  content: string;
  type: 'author' | 'service_provider';
}

export default function PartnershipApply() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(true);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    email: user?.email || '',
    organization: '',
    type: 'service_provider' as 'author' | 'service_provider',
    agreement_id: '',
    description: ''
  });

  useEffect(() => {
    async function fetchAgreements() {
      try {
        const { data, error } = await supabase
          .from('partnership_agreements')
          .select('*')
          .eq('is_active', true);
        
        if (error) throw error;
        setAgreements(data || []);
        if (data && data.length > 0) {
          setFormData(prev => ({ ...prev, agreement_id: data[0].id }));
        }
      } catch (error) {
        console.error('Error fetching agreements:', error);
      } finally {
        setLoadingAgreements(false);
      }
    }

    fetchAgreements();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to apply');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('partnership_applications')
        .insert([{
          user_id: user.id,
          full_name: formData.full_name,
          email: formData.email,
          organization: formData.organization,
          service_type: formData.type === 'service_provider' ? 'Logistics' : 'Content',
          type: formData.type,
          agreement_id: formData.agreement_id,
          description: formData.description,
          status: 'pending'
        }]);

      if (error) throw error;

      setIsSubmitted(true);
      toast.success('Application submitted successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 max-w-lg text-center space-y-8"
        >
          <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black">Login to Apply</h2>
            <p className="text-muted-foreground font-medium">
              You need a ReadMart account to apply for a partnership. This allows us to track your application and set up your portal once approved.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Link 
              to="/login"
              state={{ from: '/partnership/apply' }}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-all"
            >
              Login to Apply
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/signup"
              className="text-primary font-bold hover:underline"
            >
              Don't have an account? Create one
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 max-w-lg text-center space-y-6"
        >
          <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black">Application Received!</h2>
          <p className="text-muted-foreground font-medium">
            Thank you for your interest in partnering with ReadMart. Our team will review your application and get back to you at <strong>{formData.email}</strong> within 3-5 business days.
          </p>
          <button 
            onClick={() => navigate('/partner-dashboard')}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black hover:scale-105 transition-all"
          >
            Go to Partner Dashboard
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-20 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-6">
            <Handshake className="w-4 h-4" />
            Partner with Us
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Scale with ReadMart</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Join our ecosystem of logistics providers, publishers, and distributors. Let's bridge the gap between creators and readers together.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8 md:p-12"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Organization</label>
                <div className="relative">
                  <Building2 className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    required
                    value={formData.organization}
                    onChange={(e) => setFormData({...formData, organization: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    placeholder="Company Name"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Application Type</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                  className="glass w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer"
                >
                  <option value="service_provider">Logistics & Service Provider</option>
                  <option value="author">Author / Publisher</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Select Agreement</label>
              {loadingAgreements ? (
                <div className="glass w-full px-6 py-4 rounded-2xl flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading agreements...
                </div>
              ) : (
                <select 
                  required
                  value={formData.agreement_id}
                  onChange={(e) => setFormData({...formData, agreement_id: e.target.value})}
                  className="glass w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select an agreement</option>
                  {agreements.filter(a => a.type === formData.type).map(agreement => (
                    <option key={agreement.id} value={agreement.id}>
                      {agreement.title}
                    </option>
                  ))}
                </select>
              )}
              {formData.agreement_id && (
                <div className="mt-4 p-4 glass rounded-xl text-sm text-muted-foreground max-h-32 overflow-y-auto font-medium border border-white/5">
                  {agreements.find(a => a.id === formData.agreement_id)?.content}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Business Description</label>
              <div className="relative">
                <FileText className="absolute left-6 top-6 w-5 h-5 text-muted-foreground" />
                <textarea 
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="glass w-full pl-14 pr-6 py-6 rounded-3xl outline-none focus:ring-2 focus:ring-primary font-medium min-h-[160px] resize-none"
                  placeholder="Tell us about your business and how you'd like to partner with ReadMart..."
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting || loadingAgreements}
              className="w-full py-6 bg-primary text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-primary/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  Submit Application
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
