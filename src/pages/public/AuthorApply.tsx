import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  PenTool, Mail, User, FileText, Send, 
  Loader2, CheckCircle2, Lock, ArrowRight,
  Upload, X, Phone, MessageSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { uploadQualificationProof } from '@/api/storage';

export default function AuthorApply() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: profile?.full_name || '',
    email: user?.email || '',
    contact_info: '',
    collaboration_intent: '',
    genre: 'Fiction',
    experience: 'Emerging Author'
  });

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
      // 1. Upload qualification proof
      const proofPath = await uploadQualificationProof(uploadedFile, user.id);

      // 2. Submit application via API to trigger email notifications
      const response = await fetch('/api/applications?type=author', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'author',
          full_name: formData.full_name,
          email: formData.email,
          bio: formData.collaboration_intent, // Use collaboration_intent as bio for authors
          service_type: formData.genre, // Use genre as service_type for authors
          proof_url: proofPath,
          metadata: {
            genre: formData.genre,
            experience: formData.experience
          }
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to submit application');

      setIsSubmitted(true);
      toast.success('Author application submitted successfully!');
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
              You need a ReadMart account to apply for the Author Program. This allows us to track your application and set up your portal once approved.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <Link 
              to="/login"
              state={{ from: '/author-apply' }}
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
          <h2 className="text-3xl font-black">Manuscript Received!</h2>
          <p className="text-muted-foreground font-medium">
            Thank you for sharing your creative vision with ReadMart. Our editorial team will review your application and get back to you at <strong>{formData.email}</strong> within 5-7 business days.
          </p>
          <button 
            onClick={() => navigate('/author-dashboard')}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black hover:scale-105 transition-all"
          >
            Go to Author Dashboard
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
            <PenTool className="w-4 h-4" />
            Author Program
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6">Publish with Purpose</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
            Join a community of storytellers and thinkers. We provide the platform, you provide the magic.
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
                <label htmlFor="full_name" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    id="full_name"
                    name="full_name"
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
                <label htmlFor="email_address" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    id="email_address"
                    name="email_address"
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
                <label htmlFor="contact_number" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    id="contact_number"
                    name="contact_number"
                    type="tel" 
                    required
                    value={formData.contact_info}
                    onChange={(e) => setFormData({...formData, contact_info: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    placeholder="+254 794 129 958"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="experience_level" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Experience Level</label>
                <select 
                  id="experience_level"
                  name="experience_level"
                  value={formData.experience}
                  onChange={(e) => setFormData({...formData, experience: e.target.value})}
                  className="glass w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer"
                >
                  <option value="Emerging Author">Emerging Author (First Book)</option>
                  <option value="Published Author">Published Author</option>
                  <option value="Industry Professional">Industry Professional</option>
                </select>
              </div>
            </div>

            <div className="space-y-4">
              <label htmlFor="qualification_proof" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Qualification Proof</label>
              
              <div 
                className={`glass-card p-8 border-2 border-dashed transition-all space-y-4 flex flex-col items-center justify-center text-center ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-white/5'
                } ${uploadedFile ? 'bg-green-500/5 border-green-500/20' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                role="region"
                aria-label="File upload drop zone"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                  uploadedFile ? 'bg-green-500/10 text-green-500' : 'bg-primary/10 text-primary'
                }`}>
                  {uploadedFile ? <CheckCircle2 className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                </div>
                
                {uploadedFile ? (
                  <div className="space-y-4 w-full max-w-md">
                    <div className="flex items-center justify-between p-4 glass rounded-2xl border border-green-500/20">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="w-5 h-5 text-green-500 shrink-0" />
                        <span className="text-sm font-bold truncate">{uploadedFile.name}</span>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Remove uploaded file"
                      >
                        <X className="w-5 h-5 text-muted-foreground" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      File ready for upload. You can click to change it.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-black text-lg uppercase tracking-tight">Upload Proof</h4>
                      <p className="text-sm text-muted-foreground font-medium">
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
                      <div className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer hover:scale-105">
                        <Upload className="w-4 h-4" />
                        Select File
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="collaboration_intent" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Collaboration Intent</label>
              <div className="relative">
                <MessageSquare className="absolute left-6 top-6 w-5 h-5 text-muted-foreground" />
                <textarea 
                  id="collaboration_intent"
                  name="collaboration_intent"
                  required
                  value={formData.collaboration_intent}
                  onChange={(e) => setFormData({...formData, collaboration_intent: e.target.value})}
                  className="glass w-full pl-14 pr-6 py-6 rounded-3xl outline-none focus:ring-2 focus:ring-primary font-medium min-h-[160px] resize-none"
                  placeholder="Describe your vision for collaborating with ReadMart, what you hope to achieve, and why you're a great fit..."
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
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
