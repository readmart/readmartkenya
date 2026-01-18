import { motion } from 'framer-motion';
import { 
  BookOpen, Users, Star, Calendar, 
  Heart, Shield, TrendingUp, Mail, 
  ArrowRight, MessageSquare, Briefcase, 
  PenTool, Send
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

export default function About() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });

  const stats = [
    { label: 'Years of Experience', value: '2+', icon: <Star className="w-6 h-6" /> },
    { label: 'Books in Collection', value: '5000+', icon: <BookOpen className="w-6 h-6" /> },
    { label: 'Happy Readers', value: '10k+', icon: <Users className="w-6 h-6" /> },
    { label: 'Community Events', value: '50+', icon: <Calendar className="w-6 h-6" /> },
  ];

  const values = [
    {
      title: "Passion for Reading",
      description: "We live and breathe books. Our love for literature drives every decision we make.",
      icon: <Heart className="w-8 h-8" />
    },
    {
      title: "Community First",
      description: "We're building more than a bookstore – we're nurturing a community of readers.",
      icon: <Users className="w-8 h-8" />
    },
    {
      title: "Continuous Growth",
      description: "We constantly evolve to better serve our readers and stay ahead of the curve.",
      icon: <TrendingUp className="w-8 h-8" />
    }
  ];

  const handleQuickInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('contact_messages')
        .insert([{
          full_name: formData.name,
          email: formData.email,
          subject: 'Partnership Inquiry from About Page',
          message: formData.message,
          status: 'New',
          priority: 'Medium'
        }]);

      if (error) throw error;
      
      toast.success('Thank you! Your message has been sent.');
      setFormData({ name: '', email: '', message: '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-20 overflow-hidden">
      {/* Hero Section */}
      <section className="container mx-auto px-4 mb-24">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest mb-8"
          >
            <Shield className="w-4 h-4" />
            About ReadMart
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black mb-8 leading-[0.9] tracking-tighter"
          >
            PASSIONATE ABOUT <br />
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CONNECTING READERS
            </span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed"
          >
            We're passionate about connecting readers with their next favorite book. 
            Since 2022, we've been on a mission to make quality literature accessible to everyone.
          </motion.p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-4 mb-32">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-12">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass-card p-8 text-center group hover:border-primary/50 transition-all"
            >
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
              <div className="text-4xl md:text-5xl font-black mb-2 tracking-tighter">{stat.value}</div>
              <div className="text-muted-foreground font-bold text-sm uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Our Story Section */}
      <section className="container mx-auto px-4 mb-32 relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-primary/5 rounded-full blur-[120px] -z-10" />
        
        <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary/10 text-secondary text-sm font-black uppercase tracking-widest">
              <BookOpen className="w-4 h-4" />
              Our Story
            </div>
            <h2 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter">
              HOW THE STORY <br />
              <span className="text-primary">BEGAN.</span>
            </h2>
            <div className="space-y-6 text-lg text-muted-foreground font-medium leading-relaxed">
              <p>
                READMART Bookstore began with a simple belief: Stories are meant to meet people — everywhere life happens.
              </p>
              <p>
                We looked around and saw something missing. Readers searching for comfort. Dreamers looking for inspiration. People craving connection in a fast, restless world. Books had the power to meet those needs, but only if they could reach the people who needed them most.
              </p>
              <p>
                So we asked ourselves: What if books could travel? What if stories could find you—not just at home, but in cafés, hospitals, offices, campuses, and every space in between?
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="glass-card p-12 bg-primary/5 border-primary/20 space-y-8"
          >
            <p className="text-xl text-foreground font-bold leading-relaxed italic">
              "READMART Bookstore is more than a bookstore. It is a movement to make reading a living, breathing part of daily life. A movement to build a vibrant and inclusive reading culture across Kenya and beyond."
            </p>
            <div className="space-y-6 text-muted-foreground font-medium">
              <p>
                Through doorstep deliveries, curated reading corners, community events, and thoughtful book experiences, we bring stories closer—right into the heart of everyday moments.
              </p>
              <p>
                Every book we place in someone's hands is a small reminder of what stories can do: They heal. They connect. They inspire. They change us—sometimes softly, sometimes all at once.
              </p>
            </div>
            <Link 
              to="/shop" 
              className="inline-flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-2xl font-black hover:scale-105 transition-all shadow-lg shadow-primary/25"
            >
              EXPLORE COLLECTION
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Values Section */}
      <section className="bg-secondary/5 py-32 mb-32">
        <div className="container mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter">OUR VALUES</h2>
            <p className="text-xl text-muted-foreground font-medium">These core values guide everything we do at ReadMart</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-card p-10 text-center space-y-6 hover:bg-white/5 transition-all border-white/5"
              >
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mx-auto mb-6">
                  {value.icon}
                </div>
                <h3 className="text-2xl font-black">{value.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  {value.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="container mx-auto px-4 mb-32">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tighter uppercase">Meet Our Team</h2>
            <p className="text-xl text-muted-foreground font-medium">The passionate individuals behind ReadMart's mission.</p>
          </div>

          <div className="grid md:grid-cols-1 justify-center max-w-md mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="glass-card overflow-hidden group"
            >
              <div className="aspect-[4/5] bg-secondary/10 relative overflow-hidden">
                <img 
                  src="/assets/founder.jpg" 
                  alt="David Njambi" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=David+Njambi&size=512&background=0D8ABC&color=fff';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-8">
                  <div className="flex gap-4">
                    <a href="#" className="p-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-primary transition-colors">
                      <MessageSquare className="w-5 h-5 text-white" />
                    </a>
                    <a href="#" className="p-3 bg-white/10 backdrop-blur-md rounded-xl hover:bg-primary transition-colors">
                      <Mail className="w-5 h-5 text-white" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="p-8 text-center">
                <h3 className="text-2xl font-black mb-1">David Njambi</h3>
                <p className="text-primary font-black uppercase tracking-widest text-sm">Founder & CEO</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Collaborate Section */}
      <section className="container mx-auto px-4 mb-32">
        <div className="glass-card p-8 md:p-16 lg:p-24 relative overflow-hidden rounded-[3.5rem]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2" />
          
          <div className="grid lg:grid-cols-2 gap-20 relative z-10">
            <div className="space-y-10">
              <div className="space-y-6">
                <h2 className="text-4xl md:text-6xl font-black leading-[0.9] tracking-tighter">
                  COLLABORATE <br />
                  <span className="text-primary">WITH READMART</span>
                </h2>
                <p className="text-xl text-muted-foreground font-medium leading-relaxed">
                  We believe in the power of stories to transform spaces and connect people. 
                  Whether you're a business, an author, or an event host, there's a place for you in our community.
                </p>
              </div>

              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shrink-0">
                    <Briefcase className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">For Businesses</h4>
                    <p className="text-muted-foreground font-medium">
                      Host literary events, set up curated reading corners in your cafes or offices, and attract a vibrant community of readers to your space.
                    </p>
                  </div>
                </div>

                <div className="flex gap-6">
                  <div className="w-16 h-16 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center shrink-0">
                    <PenTool className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold mb-2">For Authors</h4>
                    <p className="text-muted-foreground font-medium">
                      Get your book featured, connect with 10,000+ readers, and organize launches through our innovative platform and community events.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <Link 
                  to="/partnership/apply" 
                  className="px-10 py-5 bg-primary text-white rounded-[2rem] font-black hover:scale-105 transition-all text-center shadow-lg shadow-primary/25 flex items-center justify-center gap-3"
                >
                  PARTNER WITH US
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <div className="flex items-center gap-4 px-8 py-5 glass rounded-[2rem] border-white/10">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-bold uppercase tracking-widest text-xs">Always open for new ideas</span>
                </div>
              </div>
            </div>

            <div className="glass-card p-8 md:p-12 bg-white/5 border-white/10 rounded-[3rem]">
              <div className="mb-10">
                <h3 className="text-3xl font-black mb-2">Let's Collaborate</h3>
                <p className="text-muted-foreground font-medium">Quick inquiry or formal application? Choose your path.</p>
              </div>

              <form onSubmit={handleQuickInquiry} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest ml-1">Name</label>
                    <input 
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="Your Name"
                      className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-black uppercase tracking-widest ml-1">Email</label>
                    <input 
                      type="email"
                      required
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      placeholder="your@email.com"
                      className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-black uppercase tracking-widest ml-1">How can we partner?</label>
                  <textarea 
                    required
                    value={formData.message}
                    onChange={e => setFormData({...formData, message: e.target.value})}
                    placeholder="Tell us about your book or organization..."
                    rows={4}
                    className="w-full px-6 py-4 glass rounded-2xl border-white/10 focus:border-primary/50 transition-all outline-none font-medium resize-none"
                  />
                </div>
                <button 
                  disabled={isSubmitting}
                  className="w-full py-5 bg-foreground text-background rounded-2xl font-black hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  ) : (
                    <>
                      SEND PARTNERSHIP REQUEST
                      <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
                <p className="text-center text-sm text-muted-foreground font-medium">
                  Or email us directly at <a href="mailto:partners@readmartke.com" className="text-primary hover:underline">partners@readmartke.com</a>
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="container mx-auto px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="p-12 md:p-20 bg-primary rounded-[3.5rem] relative overflow-hidden group text-white text-center shadow-2xl"
        >
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-white/10 rounded-full blur-[80px] group-hover:bg-white/20 transition-all duration-700" />
          
          <div className="relative z-10 max-w-2xl mx-auto space-y-8">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-8">
              <Mail className="w-10 h-10" />
            </div>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter leading-none">STAY IN THE LOOP</h2>
            <p className="text-xl font-medium text-white/80">
              Join our community to receive updates on new releases, exclusive events, and literary news.
            </p>
            
            <form className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto" onSubmit={(e) => {
              e.preventDefault();
              toast.success('Thanks for subscribing!');
            }}>
              <input 
                type="email"
                required
                placeholder="your@email.com"
                className="flex-1 px-8 py-5 rounded-[2rem] bg-white/10 backdrop-blur-md border border-white/20 text-white placeholder:text-white/50 focus:bg-white/20 transition-all outline-none font-bold"
              />
              <button className="px-10 py-5 bg-white text-primary rounded-[2rem] font-black hover:scale-105 transition-all shadow-xl">
                SUBSCRIBE
              </button>
            </form>
          </div>
        </motion.div>
      </section>
    </div>
  );
}
