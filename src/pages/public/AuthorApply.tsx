import { useState } from 'react';
import { motion } from 'framer-motion';
import { PenTool, Mail, User, FileText, Send, Loader2, CheckCircle2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

export default function AuthorApply() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    bio: '',
    experience: 'Emerging Author',
    genre: 'Fiction'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, type: 'author' })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Submission failed');

      setIsSubmitted(true);
      toast.success('Author application submitted!');
    } catch (error: any) {
      toast.error(error.message || 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 max-w-lg text-center space-y-6"
        >
          <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black">Manuscript Received!</h2>
          <p className="text-muted-foreground font-medium">
            Thank you for sharing your creative vision with ReadMart. Our editorial team will review your application and get back to you at <strong>{formData.email}</strong>.
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 bg-primary text-white rounded-2xl font-black hover:scale-105 transition-all"
          >
            Return Home
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
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <input 
                    type="text" 
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold"
                    placeholder="Jane Smith"
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
                    placeholder="jane@example.com"
                  />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Genre</label>
                <div className="relative">
                  <BookOpen className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <select 
                    value={formData.genre}
                    onChange={(e) => setFormData({...formData, genre: e.target.value})}
                    className="glass w-full pl-14 pr-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer"
                  >
                    <option value="Fiction">Fiction</option>
                    <option value="Non-Fiction">Non-Fiction</option>
                    <option value="Poetry">Poetry</option>
                    <option value="Academic">Academic</option>
                    <option value="Children">Children's Literature</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Experience Level</label>
                <select 
                  value={formData.experience}
                  onChange={(e) => setFormData({...formData, experience: e.target.value})}
                  className="glass w-full px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-primary font-bold appearance-none cursor-pointer"
                >
                  <option value="Emerging Author">Emerging Author (New)</option>
                  <option value="Published Author">Published Author</option>
                  <option value="Self-Published">Self-Published</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-2">Author Bio & Vision</label>
              <div className="relative">
                <FileText className="absolute left-6 top-6 w-5 h-5 text-muted-foreground" />
                <textarea 
                  required
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  className="glass w-full pl-14 pr-6 py-6 rounded-3xl outline-none focus:ring-2 focus:ring-primary font-medium min-h-[160px] resize-none"
                  placeholder="Tell us about yourself and what you're currently working on..."
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
