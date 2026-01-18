import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ChevronDown, 
  Mail, 
  Phone, 
  MessageSquare, 
  PlayCircle, 
  FileText, 
  HelpCircle, 
  BookOpen, 
  Truck, 
  CreditCard, 
  User, 
  ShieldCheck, 
  AlertTriangle,
  Send,
  Star,
  ExternalLink,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { CONTACT_INFO } from '@/lib/constants';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

// FAQ Data
const FAQ_CATEGORIES = [
  { id: 'general', label: 'General', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'orders', label: 'Orders', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'shipping', label: 'Shipping', icon: <Truck className="w-4 h-4" /> },
  { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
  { id: 'account', label: 'Account', icon: <User className="w-4 h-4" /> },
  { id: 'technical', label: 'Technical', icon: <ShieldCheck className="w-4 h-4" /> },
];

const FAQS = [
  {
    category: 'general',
    question: 'What is ReadMart?',
    answer: 'ReadMart is a comprehensive literary platform in Kenya, offering a wide range of physical books, e-books, and community events for book lovers.'
  },
  {
    category: 'orders',
    question: 'How do I track my order?',
    answer: 'Once your order is shipped, you will receive an email with a tracking number. You can also track it directly from your account dashboard under the "Orders" tab.'
  },
  {
    category: 'shipping',
    question: 'What are your delivery rates?',
    answer: 'We offer free delivery within Nairobi for orders above KSh 5,000. For other locations and smaller orders, rates vary based on weight and distance. You can see the exact cost at checkout.'
  },
  {
    category: 'payments',
    question: 'What payment methods do you accept?',
    answer: 'We accept M-Pesa, Credit/Debit Cards (Visa, Mastercard), and Direct Bank Transfers. Cash on delivery is available for select Nairobi locations.'
  },
  {
    category: 'account',
    question: 'How do I reset my password?',
    answer: 'Click on "Login", then select "Forgot Password". Enter your email address and we will send you a reset link.'
  },
  {
    category: 'technical',
    question: 'The website is not loading properly.',
    answer: 'Try clearing your browser cache or opening the site in an incognito window. If the problem persists, please contact our technical support.'
  },
];

// Tutorials Data
const TUTORIALS = [
  {
    title: 'How to Place an Order',
    steps: [
      'Browse or search for your favorite books.',
      'Click "Add to Cart" on the books you want.',
      'Review your cart and click "Checkout".',
      'Provide your shipping details and select a payment method.',
      'Confirm your order and complete the payment.'
    ],
    icon: <ShoppingCartIcon className="w-6 h-6" />
  },
  {
    title: 'Accessing Your E-books',
    steps: [
      'Log in to your ReadMart account.',
      'Go to "My Account" > "E-Books".',
      'Find your purchased e-book and click "Read Now" or "Download".',
      'Use our online reader or your favorite e-pub reader.'
    ],
    icon: <BookOpen className="w-6 h-6" />
  }
];

// Troubleshooting Data
const TROUBLESHOOTING = [
  {
    issue: 'Payment Failed',
    solution: 'Ensure you have sufficient funds and your M-Pesa/Card details are correct. If the issue persists, try an alternative payment method.',
    icon: <AlertTriangle className="w-5 h-5 text-amber-500" />
  },
  {
    issue: 'E-book not appearing',
    solution: 'Wait a few minutes for the payment to be processed. If it still doesn\'t show, try refreshing the page or logging out and back in.',
    icon: <ShieldCheck className="w-5 h-5 text-blue-500" />
  }
];

// Video Tutorials Data
const VIDEO_TUTORIALS = [
  {
    title: 'Welcome to ReadMart',
    duration: '2:15',
    thumbnail: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600',
    link: 'https://www.youtube.com/watch?v=example1'
  },
  {
    title: 'How to Join the Book Club',
    duration: '3:45',
    thumbnail: 'https://images.unsplash.com/photo-1529148482759-b35b25c5f217?auto=format&fit=crop&q=80&w=600',
    link: 'https://www.youtube.com/watch?v=example2'
  }
];

function ShoppingCartIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  );
}

export default function Help() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);

  const filteredFaqs = useMemo(() => {
    return FAQS.filter(faq => {
      const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, activeCategory]);

  const handleFeedbackSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const category = formData.get('category') as string;
    const message = formData.get('message') as string;

    if (feedbackRating === 0) {
      toast.error('Please provide a rating');
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('help_feedback').insert({
        user_id: user?.id || null,
        rating: feedbackRating,
        category,
        message,
        metadata: {
          userAgent: navigator.userAgent,
          path: window.location.pathname
        }
      });

      if (error) throw error;
      toast.success('Thank you for your feedback!');
      (e.target as HTMLFormElement).reset();
      setFeedbackRating(0);
    } catch (error) {
      console.error('Feedback error:', error);
      toast.error('Failed to submit feedback. Please try again.');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Hero Section */}
      <section className="bg-primary text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        <div className="container mx-auto px-4 relative z-10 text-center">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-6xl font-black mb-6 tracking-tight"
          >
            HOW CAN WE HELP?
          </motion.h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-10 font-medium">
            Search our help center for answers to common questions, 
            tutorials, and troubleshooting guides.
          </p>
          
          <div className="max-w-2xl mx-auto relative group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 group-focus-within:text-primary transition-colors" />
            <input 
              type="text"
              placeholder="Search for answers..."
              className="w-full pl-16 pr-6 py-5 rounded-2xl text-slate-900 font-medium text-lg shadow-2xl focus:ring-4 focus:ring-white/20 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search help articles"
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 -mt-8 relative z-20">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-12">
            {/* FAQ Section */}
            <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl border border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-6 mb-10">
                <h2 className="text-3xl font-black flex items-center gap-3">
                  <HelpCircle className="w-8 h-8 text-primary" />
                  FREQUENTLY ASKED
                </h2>
                
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2">
                  <button 
                    onClick={() => setActiveCategory('all')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeCategory === 'all' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    All
                  </button>
                  {FAQ_CATEGORIES.map(cat => (
                    <button 
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-2 transition-all ${activeCategory === cat.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {cat.icon}
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {filteredFaqs.length > 0 ? (
                  filteredFaqs.map((faq, index) => (
                    <div 
                      key={index}
                      className={`border rounded-2xl overflow-hidden transition-all ${openFaqIndex === index ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200'}`}
                    >
                      <button 
                        onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                        className="w-full flex items-center justify-between p-6 text-left"
                        aria-expanded={openFaqIndex === index}
                      >
                        <span className="font-bold text-lg">{faq.question}</span>
                        <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${openFaqIndex === index ? 'rotate-180 text-primary' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {openFaqIndex === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="px-6 pb-6"
                          >
                            <p className="text-slate-600 leading-relaxed font-medium">
                              {faq.answer}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 font-bold">No results found for "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </section>

            {/* Tutorials Section */}
            <section className="space-y-8">
              <h2 className="text-3xl font-black flex items-center gap-3 px-4">
                <PlayCircle className="w-8 h-8 text-primary" />
                STEP-BY-STEP TUTORIALS
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {TUTORIALS.map((tut, i) => (
                  <motion.div 
                    key={i}
                    whileHover={{ y: -5 }}
                    className="bg-white rounded-[2rem] p-8 shadow-lg border border-slate-100 group"
                  >
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 group-hover:scale-110 transition-transform">
                      {tut.icon}
                    </div>
                    <h3 className="text-2xl font-black mb-6">{tut.title}</h3>
                    <div className="space-y-4">
                      {tut.steps.map((step, j) => (
                        <div key={j} className="flex gap-4">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-black">
                            {j + 1}
                          </span>
                          <p className="text-slate-600 text-sm font-medium leading-tight">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Video Tutorials Section */}
            <section className="space-y-8">
              <h2 className="text-3xl font-black flex items-center gap-3 px-4">
                <FileText className="w-8 h-8 text-primary" />
                VIDEO & DOCUMENTATION
              </h2>
              <div className="grid md:grid-cols-2 gap-6">
                {VIDEO_TUTORIALS.map((vid, i) => (
                  <div key={i} className="bg-white rounded-[2rem] overflow-hidden shadow-lg border border-slate-100 group">
                    <div className="relative aspect-video">
                      <img src={vid.thumbnail} alt={vid.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                          <PlayCircle className="w-10 h-10 fill-white" />
                        </div>
                      </div>
                      <span className="absolute bottom-4 right-4 bg-black/60 text-white text-[10px] font-black px-2 py-1 rounded-md">
                        {vid.duration}
                      </span>
                    </div>
                    <div className="p-6">
                      <h3 className="font-black text-lg mb-4">{vid.title}</h3>
                      <a 
                        href={vid.link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary font-bold text-sm hover:underline"
                      >
                        Watch on YouTube
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-8">
            {/* Contact Support */}
            <div className="bg-primary text-white rounded-[2.5rem] p-8 shadow-2xl shadow-primary/20">
              <h3 className="text-2xl font-black mb-6">DIRECT SUPPORT</h3>
              <div className="space-y-6">
                <a href={`mailto:${CONTACT_INFO.email}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 group">
                  <div className="p-3 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Email Us</p>
                    <p className="font-bold text-sm">{CONTACT_INFO.email}</p>
                  </div>
                </a>
                
                <a href={`tel:${CONTACT_INFO.phone1}`} className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 group">
                  <div className="p-3 bg-white/20 rounded-xl group-hover:scale-110 transition-transform">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Call Us</p>
                    <p className="font-bold text-sm">{CONTACT_INFO.phone1}</p>
                  </div>
                </a>

                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/10 border border-white/10">
                  <div className="p-3 bg-white/20 rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Live Chat</p>
                    <p className="font-bold text-sm">Mon-Fri: 8am - 5pm</p>
                  </div>
                </div>
              </div>
              
              <Link 
                to="/contact" 
                className="mt-8 w-full py-4 bg-white text-primary rounded-xl font-black text-center flex items-center justify-center gap-2 hover:bg-opacity-90 transition-all"
              >
                OPEN SUPPORT TICKET
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            {/* Troubleshooting */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
              <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-primary" />
                TROUBLESHOOTING
              </h3>
              <div className="space-y-6">
                {TROUBLESHOOTING.map((item, i) => (
                  <div key={i} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-3 mb-3">
                      {item.icon}
                      <p className="font-bold text-slate-900">{item.issue}</p>
                    </div>
                    <p className="text-slate-600 text-sm leading-relaxed font-medium">
                      {item.solution}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Feedback Form */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100">
              <h3 className="text-xl font-black mb-6">HELP US IMPROVE</h3>
              <form onSubmit={handleFeedbackSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Your Rating
                  </label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setFeedbackRating(star)}
                        className={`p-2 transition-all ${feedbackRating >= star ? 'text-amber-400 scale-110' : 'text-slate-200 hover:text-slate-300'}`}
                      >
                        <Star className={`w-6 h-6 ${feedbackRating >= star ? 'fill-current' : ''}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Category
                  </label>
                  <select 
                    name="category"
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Suggestion">Suggestion</option>
                    <option value="Content Issue">Content Issue</option>
                    <option value="Technical Bug">Technical Bug</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">
                    Message
                  </label>
                  <textarea 
                    name="message"
                    required
                    rows={4}
                    placeholder="Tell us how we can improve..."
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 font-medium text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmittingFeedback}
                  className="w-full py-4 bg-primary text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                >
                  {isSubmittingFeedback ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      SUBMIT FEEDBACK
                      <Send className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
