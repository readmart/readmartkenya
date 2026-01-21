import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Handshake, Building2, Mail, User, FileText, Send, 
  Loader2, CheckCircle2, Lock, ArrowRight, Download, Upload, X 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { uploadSignedAgreement } from '@/api/storage';

interface Agreement {
  id: string;
  title: string;
  content: string;
  type: 'author' | 'service_provider';
  file_url?: string; // Add file_url for downloads
}

export default function PartnershipApply() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loadingAgreements, setLoadingAgreements] = useState(true);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
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
          const firstOfType = data.find(a => a.type === formData.type);
          if (firstOfType) {
            setFormData(prev => ({ ...prev, agreement_id: firstOfType.id }));
          }
        }
      } catch (error) {
        console.error('Error fetching agreements:', error);
      } finally {
        setLoadingAgreements(false);
      }
    }

    fetchAgreements();
  }, [formData.type]); // Refetch/reset when type changes

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF document');
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type !== 'application/pdf') {
        toast.error('Please upload a PDF document');
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleDownloadAgreement = () => {
    const agreement = agreements.find(a => a.id === formData.agreement_id);
    if (!agreement) return;

    if (agreement.file_url) {
      window.open(agreement.file_url, '_blank');
    } else {
      // Fallback: Create a text file if no PDF is linked
      const blob = new Blob([agreement.content], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${agreement.title.replace(/\s+/g, '_')}.txt`;
      a.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to apply');
      return;
    }

    if (!uploadedFile) {
      toast.error('Please upload the signed agreement');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload the signed document
      const documentPath = await uploadSignedAgreement(uploadedFile, user.id);

      // 2. Submit application
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
          signed_agreement_url: documentPath, // Store the storage path
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

            <div className="space-y-4">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Partnership Agreement</label>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Download Section */}
                <div className="glass-card p-6 border-white/5 space-y-4">
                  <div className="flex items-center gap-3 text-primary">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">1. Download</h4>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Get the agreement</p>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <select 
                      required
                      value={formData.agreement_id}
                      onChange={(e) => setFormData({...formData, agreement_id: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary text-sm font-bold appearance-none cursor-pointer"
                    >
                      <option value="" disabled>Select version</option>
                      {agreements.filter(a => a.type === formData.type).map(agreement => (
                        <option key={agreement.id} value={agreement.id}>
                          {agreement.title}
                        </option>
                      ))}
                    </select>

                    <button 
                      type="button"
                      onClick={handleDownloadAgreement}
                      disabled={!formData.agreement_id}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Download className="w-4 h-4" />
                      Download for Signing
                    </button>
                  </div>
                </div>

                {/* Upload Section */}
                <div 
                  className={`glass-card p-6 border-2 border-dashed transition-all space-y-4 ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-white/5'
                  } ${uploadedFile ? 'bg-green-500/5 border-green-500/20' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className={`flex items-center gap-3 ${uploadedFile ? 'text-green-500' : 'text-primary'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      uploadedFile ? 'bg-green-500/10' : 'bg-primary/10'
                    }`}>
                      {uploadedFile ? <CheckCircle2 className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-black text-sm uppercase tracking-tight">2. Upload</h4>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Signed document (PDF)</p>
                    </div>
                  </div>

                  {uploadedFile ? (
                    <div className="flex items-center justify-between p-3 glass rounded-xl border border-green-500/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-xs font-bold truncate">{uploadedFile.name}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="p-1 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf"
                        onChange={handleFileChange}
                      />
                      <div className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Select Signed PDF
                      </div>
                    </label>
                  )}
                </div>
              </div>
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
