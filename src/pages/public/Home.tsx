import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  BookOpen, Star, ArrowRight, ShoppingBag, 
  Users, Sparkles, Zap, ShieldCheck, Globe, Truck,
  Loader2 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import BookCard from '@/components/shop/BookCard';
import { getCMSContent } from '@/api/dashboards';
import { supabase } from '@/lib/supabase/client';

const featuredCategories = [
  { name: 'Books', icon: <BookOpen className="w-6 h-6" />, count: '2,000+ Titles', color: 'from-blue-500/20 to-cyan-500/20' },
  { name: 'Art', icon: <Sparkles className="w-6 h-6" />, count: '450+ Items', color: 'from-purple-500/20 to-pink-500/20' },
  { name: 'Accessories', icon: <ShoppingBag className="w-6 h-6" />, count: '120+ Items', color: 'from-orange-500/20 to-yellow-500/20' },
  { name: 'Community', icon: <Users className="w-6 h-6" />, count: '15+ Clubs', color: 'from-green-500/20 to-emerald-500/20' },
];

const mockBooks = [
  { id: '1', title: 'The Midnight Library', author: 'Matt Haig', price: 24.99, rating: 4.8, category: 'Books', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', weight: 0.5, volume: 0.001 },
  { id: '2', title: 'Abstract Geometric Art', author: 'Elena Rossi', price: 120.00, rating: 4.9, category: 'Art', image: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?q=80&w=800', weight: 1.2, volume: 0.005 },
  { id: '3', title: 'Premium Leather Bookmark', author: 'Handcrafted', price: 15.99, rating: 4.7, category: 'Accessories', image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?q=80&w=800', weight: 0.1, volume: 0.0001 },
  { id: '4', title: 'The Psychology of Money', author: 'Morgan Housel', price: 21.00, rating: 4.8, category: 'Books', image: 'https://images.unsplash.com/photo-1592492159418-39f319320569?q=80&w=800', weight: 0.4, volume: 0.0008 },
];

export default function Home() {
  const [heroData, setHeroData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authorOfDay, setAuthorOfDay] = useState<any>(null);

  useEffect(() => {
    async function fetchHero() {
      try {
        const cms = await getCMSContent();
        const hero = cms.find((item: any) => item.type === 'hero' && item.is_active);
        if (hero) {
          setHeroData(hero);
        }

        // Get site settings for Author of the Day with resilience
        let settings = null;
        try {
          const { data, error } = await supabase
            .from('site_settings')
            .select('*, author_of_the_day:profiles!author_of_the_day_id(id, full_name, avatar_url, bio)')
            .maybeSingle();
          
          if (error) {
            // Handle specific column issues
            if (error.message?.includes('bio')) {
              const { data: noBioData, error: noBioError } = await supabase
                .from('site_settings')
                .select('*, author_of_the_day:profiles!author_of_the_day_id(id, full_name, avatar_url)')
                .maybeSingle();
              if (noBioError) throw noBioError;
              settings = noBioData;
            } else {
              throw error;
            }
          } else {
            settings = data;
          }
        } catch (err: any) {
          console.warn('Author of the Day join failed, retrying without join:', err.message);
          const { data } = await supabase
            .from('site_settings')
            .select('*')
            .maybeSingle();
          settings = data;
        }

        if (settings?.author_of_the_day_enabled) {
          // Fetch featured books
          if (settings.author_of_the_day_books?.length > 0) {
            const { data: books } = await supabase
              .from('products')
              .select('id, title, image_url, price')
              .in('id', settings.author_of_the_day_books);
            settings.featured_books = books || [];
          }
          setAuthorOfDay(settings);
        }
      } catch (error) {
        console.error('Failed to fetch home data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchHero();
  }, []);

  const defaultHero = {
    title: "EVERY PAGE\nTELLS A STORY",
    content: "Discover a curated sanctuary for bibliophiles and art enthusiasts. Bridging the gap between creators and readers.",
    image_url: "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=1200"
  };

  const displayHero = heroData || defaultHero;

  return (
    <div className="space-y-24 pb-24">
      {/* SEO Organization Schema (Hidden) */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "ReadMart",
          "url": "https://readmart.co.ke",
          "logo": "https://readmart.co.ke/assets/logo.jpg",
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+254-794-129-958",
            "contactType": "customer service"
          }
        })}
      </script>

      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto px-4 pt-8 md:pt-12"
      >
        <div className="glass-card relative overflow-hidden rounded-[3rem] p-8 md:p-12 lg:p-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-primary/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2" />
          
          <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column: Text Content */}
            <div className="text-left order-2 lg:order-1">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-primary font-bold text-sm mb-8 border-primary/20"
              >
                <Zap className="w-4 h-4 fill-primary" />
                WELCOME TO READMART
              </motion.div>
              
              <h1 className="text-6xl md:text-7xl xl:text-8xl font-black mb-8 tracking-tighter leading-[0.9]">
                {displayHero.title.split('\n').map((line: string, i: number) => (
                  <span key={i} className="block">
                    {i === 1 ? (
                      <span className="bg-gradient-to-r from-primary via-primary to-secondary bg-clip-text text-transparent">
                        {line}
                      </span>
                    ) : line}
                  </span>
                ))}
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground mb-12 leading-relaxed max-w-xl font-medium">
                {displayHero.content}
              </p>
              
              <div className="flex flex-wrap items-center gap-8">
                <Link 
                  to="/shop" 
                  className="bg-primary text-white px-10 py-5 rounded-2xl font-black text-lg hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all flex items-center gap-3"
                >
                  <ShoppingBag className="w-6 h-6" />
                  EXPLORE SHOP
                </Link>
                <Link 
                  to="/book-club" 
                  className="text-muted-foreground hover:text-primary font-bold text-lg transition-all flex items-center gap-2 group"
                >
                  JOIN THE CLUB
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>

              {/* Author of the Day Subtle Integration */}
              <AnimatePresence>
                {authorOfDay && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-16 pt-8 border-t border-primary/10"
                  >
                    <div className="flex items-start gap-6">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-lg group-hover:blur-xl transition-all" />
                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white shadow-xl">
                          <img 
                            src={authorOfDay.author_of_the_day_image || authorOfDay.author_of_the_day.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=200'} 
                            alt={authorOfDay.author_of_the_day.full_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary bg-primary/5 px-2 py-0.5 rounded">Spotlight</span>
                          <h4 className="text-sm font-black uppercase tracking-tight">{authorOfDay.author_of_the_day.full_name}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-4 font-medium max-w-xs italic">
                          "{authorOfDay.author_of_the_day.bio || 'A featured creator in our community.'}"
                        </p>
                        
                        {/* Books Carousel */}
                        <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                          {authorOfDay.featured_books?.map((book: any, idx: number) => (
                            <motion.div
                              key={book.id}
                              initial={{ opacity: 0, x: 10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 1 + (idx * 0.1) }}
                              className="flex-shrink-0 group/book"
                            >
                              <Link to={`/product/${book.id}`} className="block">
                                <div className="relative w-12 h-16 rounded-lg overflow-hidden shadow-md group-hover/book:shadow-lg transition-all group-hover/book:-translate-y-1">
                                  <img 
                                    src={book.image_url} 
                                    alt={book.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/book:opacity-100 transition-opacity" />
                                </div>
                              </Link>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right Column: Hero Image */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="relative order-1 lg:order-2"
            >
              <div className="relative aspect-[4/5] md:aspect-square lg:aspect-[4/5] rounded-[2.5rem] overflow-hidden group shadow-2xl bg-white/5">
                {isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                  </div>
                ) : (
                  <img 
                    src={displayHero.image_url} 
                    alt="Hero Visual"
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60" />
                
                {/* Decorative Elements */}
                <div className="absolute bottom-6 left-6 right-6 glass p-4 rounded-2xl border-white/10">
                  <p className="text-white font-bold text-sm">Empowering Creators, Inspiring Readers</p>
                  <p className="text-white/70 text-xs">Curated Sanctuary for Bibliophiles</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Trust Badges */}
      <section className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-8 border-y border-white/5">
          {[
            { icon: <ShieldCheck className="text-primary" />, label: 'Secure Payments', desc: 'M-Pesa Integrated' },
            { icon: <Truck className="text-secondary" />, label: 'Fast Delivery', desc: 'Across Kenya' },
            { icon: <Star className="text-yellow-500" />, label: 'Curated Quality', desc: 'Handpicked Titles' },
            { icon: <Globe className="text-blue-500" />, label: 'Global Reach', desc: 'International Shipping' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="p-3 glass rounded-2xl">{item.icon}</div>
              <div>
                <p className="font-bold text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Books */}
      <section className="container mx-auto px-4">
        <div className="flex items-end justify-between mb-12">
          <div>
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tighter uppercase">Weekly Picks</h2>
            <p className="text-muted-foreground font-medium">Hand-selected stories we know you'll love</p>
          </div>
          <Link to="/shop" className="text-primary font-bold flex items-center gap-2 hover:gap-3 transition-all mb-2">
            View All <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {mockBooks.map((book) => (
            <BookCard key={book.id} {...book} />
          ))}
        </div>
      </section>

      {/* Collections Scroller */}
      <section className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredCategories.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`glass p-8 rounded-3xl hover:translate-y-[-10px] transition-all cursor-pointer group bg-gradient-to-br ${category.color} border-white/10`}
            >
              <div className="bg-white/20 p-4 rounded-2xl w-fit mb-6 group-hover:rotate-12 transition-transform">
                {category.icon}
              </div>
              <h3 className="text-2xl font-black mb-2 tracking-tight uppercase">{category.name}</h3>
              <p className="text-muted-foreground font-bold">{category.count}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4">
        <div className="bg-primary rounded-[3rem] p-12 md:p-24 text-center text-white relative overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
          <div className="relative z-10">
            <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter leading-none">
              READY TO START YOUR <br /> NEXT CHAPTER?
            </h2>
            <p className="text-xl mb-12 text-white/80 max-w-2xl mx-auto font-medium">
              Join 10,000+ readers who trust us for their literary adventures.
            </p>
            <Link 
              to="/signup" 
              className="bg-white text-primary px-12 py-5 rounded-2xl font-black text-xl hover:bg-opacity-90 transition-all inline-block shadow-2xl"
            >
              GET STARTED FREE
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
