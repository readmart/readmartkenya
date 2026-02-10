import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  Handshake, Globe, ArrowRight, CheckCircle2, Building2, 
  Mail, Phone, MapPin, Search, X
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPartnershipTiers, getPartners } from '@/api/partnerships';
import { Loader2 } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { trackEvent } from '@/lib/analytics';

const CATEGORIES = [
  'All',
  'Strategic Alliance',
  'Affiliate Program',
  'Sponsorship',
  'Logistics',
  'Publishing',
  'Technology'
];

export default function Partnerships() {
  const [tiers, setTiers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  useEffect(() => {
    async function loadData() {
      try {
        const [tiersData, partnersData] = await Promise.all([
          getPartnershipTiers(),
          getPartners()
        ]);
        setTiers(tiersData);
        setPartners(partnersData);
      } catch (error) {
        console.error('Failed to load partnerships data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
    
    // Analytics tracking
    trackEvent('page_view', { page: 'partnerships' });
  }, []);

  const filteredPartners = useMemo(() => {
    return partners.filter(partner => {
      const matchesSearch = 
        partner.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        partner.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || partner.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [partners, searchQuery, selectedCategory]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <Helmet>
        <title>Partnerships | ReadMart - Building the Future of Literary Commerce</title>
        <meta name="description" content="Join our global network of partners. From strategic alliances to affiliate programs, discover how we collaborate to transform reading across Africa." />
        <meta name="keywords" content="ReadMart, Partnerships, Strategic Alliances, Affiliate Program, Sponsorships, Literary Commerce, Africa" />
        <meta property="og:title" content="ReadMart Partnerships" />
        <meta property="og:description" content="Collaborate with us to build the future of reading." />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "ReadMart Partnerships",
            "description": "ReadMart partnership tiers and partner network.",
            "publisher": {
              "@type": "Organization",
              "name": "ReadMart"
            }
          })}
        </script>
      </Helmet>

      {/* Hero Section */}
      <section className="container mx-auto px-4 mb-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-black uppercase tracking-widest"
          >
            <Handshake className="w-4 h-4" />
            Global Ecosystem
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9]"
          >
            COLLABORATE TO <br />
            <span className="text-primary">TRANSFORM READING</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed"
          >
            Join our network of logistics providers, publishers, tech partners, and local hubs. 
            Together, we're building the future of literary commerce across Africa.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <Link 
              to="/partnership/apply" 
              className="px-10 py-5 bg-primary text-white rounded-[2rem] font-black hover:scale-105 transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
            >
              BECOME A PARTNER
              <ArrowRight className="w-5 h-5" />
            </Link>
            <a 
              href="#tiers" 
              className="px-10 py-5 glass border-white/10 rounded-[2rem] font-black hover:bg-white/5 transition-all"
            >
              VIEW TIERS
            </a>
          </motion.div>
        </div>
      </section>

      {/* Filter and Search Section */}
      <section className="container mx-auto px-4 mb-12">
        <div className="glass p-6 md:p-8 rounded-[2.5rem] border-white/5 space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-black tracking-tight">EXPLORE OUR NETWORK</h2>
              <p className="text-sm text-muted-foreground font-medium">Find partners by category or search by name</p>
            </div>
            
            <div className="relative group w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Search partners..." 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.length > 2) {
                    trackEvent('partnership_search', { query: e.target.value });
                  }
                }}
                className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl focus:ring-2 focus:ring-primary/50 outline-none transition-all font-medium"
                aria-label="Search partners"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  trackEvent('partnership_filter_change', { category: cat });
                }}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                  selectedCategory === cat 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Partners Grid */}
      <section className="container mx-auto px-4 mb-32">
        <AnimatePresence mode="wait">
          {filteredPartners.length > 0 ? (
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
              {filteredPartners.map((partner, i) => (
                <motion.div 
                  key={partner.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card group overflow-hidden rounded-[2.5rem] border-white/5 hover:border-primary/20 transition-all flex flex-col h-full"
                >
                  <div className="p-8 space-y-6 flex-grow">
                    <div className="flex justify-between items-start">
                      <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center p-3">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt={partner.company_name} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Building2 className="w-8 h-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {partner.tier && (
                          <span 
                            className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/10"
                            style={{ color: partner.tier.color_code, borderColor: `${partner.tier.color_code}20` }}
                          >
                            {partner.tier.name}
                          </span>
                        )}
                        {partner.category && (
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                            {partner.category}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-xl font-black group-hover:text-primary transition-colors">{partner.company_name}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                          {partner.description || 'Verified ReadMart logistics and infrastructure partner.'}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Collaboration Benefits</p>
                        <ul className="space-y-1">
                          {(partner.benefits || ['Market Access', 'Logistics Support', 'Joint Marketing']).map((benefit: string, idx: number) => (
                            <li key={idx} className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <CheckCircle2 className="w-3 h-3 text-primary" />
                              {benefit}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="p-8 pt-0 mt-auto">
                    <div className="flex items-center justify-between pt-6 border-t border-white/5">
                      <div className="flex gap-2">
                        {partner.website_url && (
                          <a 
                            href={partner.website_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-2 glass rounded-xl hover:text-primary transition-colors"
                            aria-label={`${partner.company_name} website`}
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                        {partner.contact_email && (
                          <a 
                            href={`mailto:${partner.contact_email}`} 
                            className="p-2 glass rounded-xl hover:text-primary transition-colors"
                            aria-label={`Email ${partner.company_name}`}
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {partner.contact_phone && (
                          <a 
                            href={`tel:${partner.contact_phone}`} 
                            className="p-2 glass rounded-xl hover:text-primary transition-colors"
                            aria-label={`Call ${partner.company_name}`}
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      <Link 
                        to={`/partnerships/${partner.id}`} 
                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:translate-x-1 transition-transform flex items-center gap-2"
                      >
                        VIEW PROFILE
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-24 glass rounded-[3rem] border-white/5"
            >
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Search className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="text-2xl font-black mb-2">NO PARTNERS FOUND</h3>
              <p className="text-muted-foreground font-medium">Try adjusting your search or category filter.</p>
              <button 
                onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }}
                className="mt-8 text-primary font-black uppercase tracking-widest text-xs hover:underline"
              >
                CLEAR ALL FILTERS
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Partnership Tiers */}
      <section id="tiers" className="container mx-auto px-4 mb-32 bg-primary/5 py-24 rounded-[3.5rem]">
        <div className="max-w-4xl mx-auto text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter">PARTNERSHIP TIERS</h2>
          <p className="text-muted-foreground font-medium text-lg">Choose the level that best fits your organizational goals.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tiers.map((tier, i) => (
            <motion.div 
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`glass p-10 rounded-[3rem] border-white/10 relative overflow-hidden group hover:scale-[1.02] transition-all ${
                tier.name === 'Gold' ? 'ring-2 ring-primary/50' : ''
              }`}
            >
              {tier.name === 'Gold' && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-primary text-white text-[10px] font-black px-4 py-1 rounded-full uppercase tracking-widest">
                    Elite
                  </div>
                </div>
              )}
              
              <div className="space-y-8 relative z-10">
                <div>
                  <h3 className="text-3xl font-black mb-2" style={{ color: tier.color_code }}>{tier.name}</h3>
                  <p className="text-muted-foreground text-sm font-medium">{tier.description}</p>
                </div>

                <div className="space-y-4">
                  <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Key Benefits</p>
                  <ul className="space-y-3">
                    {(tier.benefits || []).map((benefit: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-3 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                </div>

                {tier.min_requirement && (
                  <div className="pt-6 border-t border-white/5">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Requirement</p>
                    <p className="text-sm font-bold">{tier.min_requirement}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 mb-32">
        <div className="glass p-12 md:p-24 rounded-[3.5rem] bg-foreground text-background relative overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] translate-x-1/2 -translate-y-1/2" />
          
          <div className="relative z-10 max-w-2xl space-y-8">
            <h2 className="text-5xl md:text-6xl font-black leading-none tracking-tighter">
              READY TO <br />
              PARTNER?
            </h2>
            <p className="text-xl opacity-80 font-medium">
              Take the first step towards a rewarding collaboration. Our team will review your application and match you with the ideal tier.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link 
                to="/partnership/apply" 
                className="px-10 py-5 bg-primary text-white rounded-[2rem] font-black hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
              >
                APPLY NOW
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a 
                href="mailto:partners@readmartke.com" 
                className="px-10 py-5 bg-white/10 text-white rounded-[2rem] font-black hover:bg-white/20 transition-all backdrop-blur-md"
              >
                CONTACT SALES
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Contact */}
      <section className="container mx-auto px-4 mb-24">
        <div className="grid md:grid-cols-3 gap-12">
          <div className="flex gap-6">
            <div className="p-4 glass rounded-2xl h-fit">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-black uppercase tracking-widest text-xs mb-2">Email Us</h4>
              <p className="font-bold">partners@readmartke.com</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="p-4 glass rounded-2xl h-fit">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-black uppercase tracking-widest text-xs mb-2">Call Us</h4>
              <p className="font-bold">+254 794 129 958</p>
            </div>
          </div>
          <div className="flex gap-6">
            <div className="p-4 glass rounded-2xl h-fit">
              <MapPin className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h4 className="font-black uppercase tracking-widest text-xs mb-2">Visit Us</h4>
              <p className="font-bold">Nairobi, Kenya</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
