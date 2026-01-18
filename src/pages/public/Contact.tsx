import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Mail, Phone, Clock, Send, Loader2, 
  MessageSquare, Linkedin, Globe, Truck, 
  RotateCcw, Paperclip, ChevronRight, HelpCircle,
  Briefcase, Zap, MapPin
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Contact() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'General Inquiry (info@readmartke.com)',
    message: '',
    attachment: null as File | null
  });

  const subjects = [
    'General Inquiry (info@readmartke.com)',
    'Partnership Inquiry (partners@readmartke.com)',
    'Author Program (authors@readmartke.com)',
    'Order Support (orders@readmartke.com)',
    'Technical Support (support@readmartke.com)'
  ];

  const handleReset = () => {
    setFormData({
      name: '',
      email: '',
      subject: 'General Inquiry (info@readmartke.com)',
      message: '',
      attachment: null
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setFormData({ ...formData, attachment: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Simulation of file upload/form submission
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Thank you! Your message has been sent successfully.');
      handleReset();
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-6">
            <MessageSquare className="w-4 h-4" />
            Contact Us
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[0.9] tracking-tighter">
            WE'D LOVE TO <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">HEAR FROM YOU.</span>
          </h1>
          <p className="text-xl text-muted-foreground font-medium leading-relaxed">
            Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-12 max-w-7xl mx-auto">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-2 space-y-8"
          >
            <div className="glass-card p-8 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              
              <div className="relative z-10">
                <div className="mb-10">
                  <h2 className="text-3xl font-black mb-2">Send us a Message</h2>
                  <p className="text-muted-foreground font-medium">Fill out the form below and we'll get back to you shortly.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase tracking-widest ml-1">Your Name</label>
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="John Doe"
                        className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black uppercase tracking-widest ml-1">Email Address</label>
                      <input 
                        required
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="you@example.com"
                        className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest ml-1">Subject / Destination Email</label>
                    <select 
                      value={formData.subject}
                      onChange={e => setFormData({...formData, subject: e.target.value})}
                      className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium appearance-none"
                    >
                      {subjects.map(s => (
                        <option key={s} value={s} className="bg-[#0a0a0a] text-white">{s}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest ml-1">Message</label>
                    <textarea 
                      required
                      value={formData.message}
                      onChange={e => setFormData({...formData, message: e.target.value})}
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium resize-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest ml-1">Attachment (optional, max 10MB)</label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-6 py-4 glass rounded-2xl border-white/10 border-dashed hover:border-primary/50 transition-all cursor-pointer flex items-center gap-3"
                    >
                      <Paperclip className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground font-medium truncate">
                        {formData.attachment ? formData.attachment.name : 'No file chosen'}
                      </span>
                      <input 
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-5 bg-primary text-white rounded-2xl font-black hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          SEND MESSAGE
                          <Send className="w-5 h-5" />
                        </>
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={handleReset}
                      className="px-10 py-5 glass border-white/10 rounded-2xl font-black hover:bg-white/5 transition-all flex items-center justify-center gap-3"
                    >
                      RESET
                      <RotateCcw className="w-5 h-5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Shipping Info Section */}
            <div className="glass-card p-8 md:p-12">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center">
                  <Truck className="w-6 h-6" />
                </div>
                <h2 className="text-3xl font-black">Shipping Information</h2>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass-card p-8 border-white/5 hover:border-primary/20 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">Kenya (Domestic)</h4>
                      <p className="text-sm text-muted-foreground">Standard Delivery</p>
                    </div>
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5" />
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6 text-sm font-medium">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      Doorstep or Pickup
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      KES 250.00 - KES 1,500.00
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      1-3 Business Days
                    </li>
                  </ul>
                </div>

                <div className="glass-card p-8 border-white/5 hover:border-secondary/20 transition-all group">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h4 className="text-xl font-bold mb-1 group-hover:text-secondary transition-colors">Global Shipping</h4>
                      <p className="text-sm text-muted-foreground">International Courier</p>
                    </div>
                    <div className="w-10 h-10 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center">
                      <Globe className="w-5 h-5" />
                    </div>
                  </div>
                  <ul className="space-y-3 mb-6 text-sm font-medium">
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-secondary" />
                      Calculated at Checkout
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-secondary" />
                      7-14 Business Days
                    </li>
                    <li className="flex items-center gap-2">
                      <ChevronRight className="w-4 h-4 text-secondary" />
                      Worldwide Shipping Available
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Partnerships Section */}
            <div className="glass-card p-8 md:p-12 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
              <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                <div>
                  <h2 className="text-3xl font-black mb-6">Business Partnerships</h2>
                  <p className="text-muted-foreground font-medium mb-8">
                    ReadMart welcomes partnerships beyond literacy-focused businesses. We seek collaborations in:
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: 'Logistics', icon: <Truck className="w-4 h-4" /> },
                      { label: 'Technology', icon: <Zap className="w-4 h-4" /> },
                      { label: 'Retail', icon: <Briefcase className="w-4 h-4" /> },
                      { label: 'Media & Marketing', icon: <MessageSquare className="w-4 h-4" /> }
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2 text-sm font-bold">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          {item.icon}
                        </div>
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-center md:text-right">
                  <Link 
                    to="/partnership/apply"
                    className="inline-flex items-center gap-3 px-10 py-5 bg-foreground text-background rounded-2xl font-black hover:scale-105 transition-all shadow-xl"
                  >
                    INQUIRE ABOUT PARTNERSHIP
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
          >
            {/* Get in Touch */}
            <div className="glass-card p-8 space-y-8">
              <div>
                <h3 className="text-2xl font-black mb-6">Get in Touch</h3>
                <p className="text-muted-foreground font-medium text-sm leading-relaxed">
                  We're here to help and answer any questions you might have. We look forward to hearing from you.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Primary Contact</p>
                    <a href="tel:0794129958" className="text-lg font-black hover:text-primary transition-colors">0794129958</a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Alternative Contact</p>
                    <a href="tel:0741658548" className="text-lg font-black hover:text-primary transition-colors">0741658548</a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-secondary/10 text-secondary rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Email</p>
                    <a href="mailto:support@readmartke.com" className="text-lg font-black hover:text-secondary transition-colors">support@readmartke.com</a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-green-500/10 text-green-500 rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-1">Business Hours</p>
                    <p className="text-lg font-black">Open Everyday 24/7</p>
                  </div>
                </div>
              </div>
            </div>

            {/* LinkedIn Follow */}
            <div className="glass-card p-8 bg-blue-600/5 border-blue-600/20 group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Linkedin className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Follow ReadMart on LinkedIn</h3>
              </div>
              <p className="text-sm text-muted-foreground font-medium mb-6 leading-relaxed">
                Stay updated with our latest news and business insights.
              </p>
              <a 
                href="https://linkedin.com/company/readmartke" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/25"
              >
                FOLLOW US
                <Linkedin className="w-4 h-4" />
              </a>
            </div>

            {/* Leadership Section */}
            <div className="glass-card overflow-hidden group">
              <div className="aspect-square bg-secondary/10 relative">
                <img 
                  src="/assets/founder.jpg" 
                  alt="David Njambi" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=David+Njambi&size=512&background=0D8ABC&color=fff';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                  <div className="flex gap-3">
                    <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg">
                      <Linkedin className="w-4 h-4 text-white" />
                    </div>
                    <div className="p-2 bg-white/10 backdrop-blur-md rounded-lg">
                      <Mail className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h4 className="text-xl font-black mb-1">David Njambi</h4>
                <p className="text-primary font-black uppercase tracking-widest text-[10px] mb-4">Founder & CEO</p>
                <p className="text-sm text-muted-foreground italic leading-relaxed">
                  "Leading the movement to build a vibrant and inclusive reading culture across Kenya and beyond."
                </p>
              </div>
            </div>

            {/* FAQ Quick Link */}
            <Link 
              to="/help"
              className="glass-card p-8 flex items-center justify-between hover:border-primary/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold mb-1">Frequently Asked Questions</h4>
                  <p className="text-xs text-muted-foreground">Find quick answers here</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
