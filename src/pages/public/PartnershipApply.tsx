import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Handshake, Mail, User, FileText, Send, 
  Loader2, CheckCircle2, Lock, ArrowRight, Upload, X, Phone, MessageSquare,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { uploadQualificationProof } from '@/api/storage';
import { Helmet } from 'react-helmet-async';
import { track } from '@vercel/analytics';

export default function PartnershipApply() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    email: user?.email || '',
    organization: '',
    contact_info: '',
    collaboration_intent: '',
    type: 'service_provider' as 'author' | 'service_provider'
  });

  useEffect(() => {
    track('partnership_apply_start');
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF, Word doc, or image (JPG/PNG)');
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
      const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please upload a PDF, Word doc, or image (JPG/PNG)');
        return;
      }
      setUploadedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Please login to apply');
      return;
    }

    if (!uploadedFile) {
      toast.error('Please upload your qualification proof');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Upload the qualification proof
      const proofPath = await uploadQualificationProof(uploadedFile, user.id);

      // 2. Submit application via API to trigger email notifications
      const response = await fetch('/api/applications?type=partner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'partner',
          full_name: formData.full_name,
          email: formData.email,
          organization: formData.organization,
          service_type: formData.type === 'service_provider' ? 'Logistics' : 'Content',
          description: formData.collaboration_intent,
          proof_url: proofPath
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to submit application');

      track('partnership_apply_submit', { type: formData.type });
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
        <Helmet>
          <title>Login to Apply | ReadMart Partnerships</title>
        </Helmet>
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
              onClick={() => track('click_login_to_apply')}
              className="w-full py-4 bg-primary text-white rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-all"
            >
              Login to Apply
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/signup"
              onClick={() => track('click_signup_to_apply')}
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
        <Helmet>
          <title>Application Submitted | ReadMart Partnerships</title>
        </Helmet>
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
            onClick={() => {
              track('click_go_to_dashboard_after_apply');
              navigate('/partner-dashboard');
            }}
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
      <Helmet>
        <title>Apply for Partnership | ReadMart - Join Africa's Largest Literary Ecosystem</title>
        <meta name="description" content="Submit your partnership application to ReadMart. We're looking for logistics providers, publishers, and distributors to scale together." />
        <meta property="og:title" content="Join ReadMart as a Partner" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "ReadMart Partnership Application",
            "description": "Apply to become a ReadMart partner."
          })}
        </script>
      </Helmet>
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8 md:mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-primary/10 text-primary text-[10px] md:text-sm font-black uppercase tracking-widest mb-4 md:mb-6">
            <Handshake className="w-3 h-3 md:w-4 md:h-4" />
            Partner with Us
          </div>
          <h1 className="text-3xl md:text-6xl font-black mb-4 md:mb-6">Scale with ReadMart</h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium px-4">
            Join our ecosystem of logistics providers, publishers, and distributors. Let's bridge the gap between creators and readers together.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 md:p-12 rounded-[2rem] md:rounded-[3rem]"
        >
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2">
                <label htmlFor="full_name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                  <input 
                    id="full_name"
                    name="full_name"
                    type="text" 
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="glass w-full pl-12 md:pl-14 pr-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm md:text-base"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                  <input 
                    id="email"
                    name="email"
                    type="email" 
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="glass w-full pl-12 md:pl-14 pr-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm md:text-base"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
              <div className="space-y-2">
                <label htmlFor="contact_info" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" aria-hidden="true" />
                  <input 
                    id="contact_info"
                    name="contact_info"
                    type="tel" 
                    required
                    value={formData.contact_info}
                    onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
                    className="glass w-full pl-12 md:pl-14 pr-6 py-3.5 md:py-4 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold text-sm md:text-base"
                    placeholder="+254 794 129 958"
                    aria-required="true"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="application_type" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Application Type</label>
                <div className="relative">
                  <Handshake className="absolute left-5 md:left-6 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-muted-foreground pointer-events-none" aria-hidden="true" />
                  <select 
                    id="application_type"
                    name="application_type"
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                    className="glass w-full pl-12 md:pl-14 pr-10 py-3.5 md:py-4 rounded-xl md:rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer text-sm md:text-base"
                    aria-required="true"
                  >
                    <option value="service_provider">Logistics & Service Provider</option>
                    <option value="author">Author / Publisher</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="qualification_proof" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Qualification Proof</label>
              
              <div 
                className={`glass-card p-6 md:p-8 border-2 border-dashed transition-all space-y-4 flex flex-col items-center justify-center text-center rounded-2xl md:rounded-[2rem] ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-white/5'
                } ${uploadedFile ? 'bg-green-500/5 border-green-500/20' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                role="region"
                aria-label="File upload drop zone"
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full flex items-center justify-center mb-1 md:mb-2 ${
                  uploadedFile ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                }`}>
                  {uploadedFile ? <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8" /> : <Upload className="w-6 h-6 md:w-8 md:h-8" />}
                </div>
                
                {uploadedFile ? (
                  <div className="space-y-4 w-full max-w-md">
                    <div className="flex items-center justify-between p-3 md:p-4 glass rounded-xl md:rounded-2xl border border-green-500/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-4 h-4 md:w-5 md:h-5 text-green-500 shrink-0" />
                        <span className="text-xs md:text-sm font-bold truncate">{uploadedFile.name}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="p-1.5 md:p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Remove uploaded file"
                      >
                        <X className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-[10px] md:text-xs text-muted-foreground font-medium">
                      File ready for upload. You can click to change it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-base md:text-lg uppercase tracking-tight">Upload Proof</h4>
                      <p className="text-[10px] md:text-sm text-muted-foreground font-medium">
                        PDF, DOCX, or Images (Max 10MB)
                      </p>
                    </div>
                    <label htmlFor="qualification_proof" className="inline-block">
                      <input 
                        id="qualification_proof"
                        name="qualification_proof"
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.docx,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                      />
                      <div className="px-6 md:px-8 py-2.5 md:py-3 bg-primary text-white rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105">
                        <Upload className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        Select File
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="collaboration_intent" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">Collaboration Intent</label>
              <div className="relative">
                <MessageSquare className="absolute left-5 md:left-6 top-5 md:top-6 w-4 h-4 md:w-5 md:h-5 text-muted-foreground" />
                <textarea 
                  id="collaboration_intent"
                  name="collaboration_intent"
                  required
                  value={formData.collaboration_intent}
                  onChange={(e) => setFormData({...formData, collaboration_intent: e.target.value})}
                  className="glass w-full pl-12 md:pl-14 pr-6 py-4 md:py-6 rounded-2xl md:rounded-3xl outline-none focus:ring-2 focus:ring-primary font-medium text-sm md:text-base min-h-[140px] md:min-h-[160px] resize-none"
                  placeholder="Describe your vision for partnering with ReadMart, your organization's strengths, and how you can contribute to the ecosystem..."
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 md:py-6 bg-primary text-white rounded-xl md:rounded-2xl font-black text-base md:text-lg flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-xl shadow-primary/20"
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
