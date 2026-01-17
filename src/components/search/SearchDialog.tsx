import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Book, 
  Calendar, 
  User, 
  ShoppingBag, 
  Tag, 
  MessageSquare, 
  ArrowRight,
  History,
  TrendingUp,
  Shield,
  Layout,
  FileText,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface SearchResult {
  id: string;
  type: 'product' | 'event' | 'category' | 'page' | 'order' | 'user' | 'promo' | 'message';
  title: string;
  subtitle?: string;
  image?: string;
  link: string;
  badge?: string;
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATIC_PAGES = [
  { title: 'Shop', link: '/shop', category: 'Navigation' },
  { title: 'Events', link: '/events', category: 'Navigation' },
  { title: 'Book Club', link: '/book-club', category: 'Navigation' },
  { title: 'Partnership', link: '/apply', category: 'Navigation' },
  { title: 'Become an Author', link: '/author-apply', category: 'Navigation' },
  { title: 'Contact Support', link: '/contact', category: 'Help' },
  { title: 'Terms of Service', link: '/terms', category: 'Legal' },
  { title: 'Privacy Policy', link: '/privacy', category: 'Legal' },
  { title: 'Returns & Refunds', link: '/returns', category: 'Legal' },
  { title: 'Shipping Policy', link: '/shipping', category: 'Legal' },
];

const TRENDING_CATEGORIES = ['Fiction', 'Business', 'Technology', 'Art', 'Science'];

export default function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const { isFounder, isAdmin } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem('rm_recent_searches');
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  // Keyboard shortcut for closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Search logic with debouncing
  useEffect(() => {
    const search = async () => {
      if (query.length < 2) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults: SearchResult[] = [];

        // 1. Search Products
        const { data: products } = await supabase
          .from('products')
          .select('id, title, author, cover_image, price')
          .ilike('title', `%${query}%`)
          .limit(5);

        products?.forEach(p => {
          searchResults.push({
            id: p.id,
            type: 'product',
            title: p.title,
            subtitle: `by ${p.author}`,
            image: p.cover_image,
            link: `/book/${p.id}`
          });
        });

        // 2. Search Events
        const { data: events } = await supabase
          .from('events')
          .select('id, title, date')
          .ilike('title', `%${query}%`)
          .limit(3);

        events?.forEach(e => {
          searchResults.push({
            id: e.id,
            type: 'event',
            title: e.title,
            subtitle: new Date(e.date).toLocaleDateString(),
            link: `/events`
          });
        });

        // 3. Search Static Pages
        const filteredPages = STATIC_PAGES.filter(p => 
          p.title.toLowerCase().includes(query.toLowerCase()) || 
          p.category.toLowerCase().includes(query.toLowerCase())
        );

        filteredPages.forEach(p => {
          searchResults.push({
            id: `page-${p.link}`,
            type: 'page',
            title: p.title,
            subtitle: p.category,
            link: p.link
          });
        });

        // 4. Role-based Administrative Search
        if (isFounder || isAdmin) {
          // Search Orders
          const { data: orders } = await supabase
            .from('orders')
            .select('id, profiles(full_name)')
            .or(`id.ilike.%${query}%, profiles.full_name.ilike.%${query}%`)
            .limit(3);

          orders?.forEach(o => {
            searchResults.push({
              id: o.id,
              type: 'order',
              title: `Order #${o.id.slice(0, 8)}`,
              subtitle: `Customer: ${o.profiles?.full_name || 'Unknown'}`,
              link: `/founder-dashboard?tab=orders`,
              badge: 'Founder'
            });
          });

          // Search Users
          const { data: users } = await supabase
            .from('profiles')
            .select('id, full_name, email, role')
            .or(`full_name.ilike.%${query}%, email.ilike.%${query}%`)
            .limit(3);

          users?.forEach(u => {
            searchResults.push({
              id: u.id,
              type: 'user',
              title: u.full_name || 'Anonymous',
              subtitle: `${u.email} (${u.role})`,
              link: `/founder-dashboard?tab=users`,
              badge: 'Founder'
            });
          });
        }

        setResults(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query, isFounder, isAdmin]);

  const handleResultClick = (link: string, title: string) => {
    // Save to recent searches
    const newRecent = [title, ...recentSearches.filter(s => s !== title)].slice(0, 5);
    setRecentSearches(newRecent);
    localStorage.setItem('rm_recent_searches', JSON.stringify(newRecent));
    
    navigate(link);
    onClose();
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'product': return <Book className="w-4 h-4" />;
      case 'event': return <Calendar className="w-4 h-4" />;
      case 'page': return <FileText className="w-4 h-4" />;
      case 'order': return <ShoppingBag className="w-4 h-4" />;
      case 'user': return <User className="w-4 h-4" />;
      case 'promo': return <Tag className="w-4 h-4" />;
      case 'message': return <MessageSquare className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] sm:pt-[15vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="relative w-full max-w-2xl glass overflow-hidden rounded-[2.5rem] shadow-2xl border border-white/10"
          >
            {/* Search Input */}
            <div className="relative p-6 border-b border-white/10">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products, events, orders..."
                className="w-full pl-14 pr-14 py-4 bg-white/5 rounded-2xl border-none focus:ring-2 focus:ring-primary/50 text-xl font-medium placeholder:text-muted-foreground outline-none"
              />
              <button 
                onClick={onClose}
                className="absolute right-10 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto no-scrollbar p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-muted-foreground font-medium">Scanning the library...</p>
                </div>
              ) : query.length > 0 ? (
                results.length > 0 ? (
                  <div className="space-y-2">
                    {results.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => handleResultClick(result.link, result.title)}
                        className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all group text-left"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors overflow-hidden">
                          {result.image ? (
                            <img src={result.image} alt="" className="w-full h-full object-cover" />
                          ) : (
                            getTypeIcon(result.type)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold truncate">{result.title}</span>
                            {result.badge && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-black uppercase tracking-wider">
                                <Shield className="w-3 h-3" />
                                {result.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                        </div>
                        <ArrowRight className="w-5 h-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-primary" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="p-6 bg-white/5 rounded-full mb-6">
                      <Search className="w-12 h-12 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No results found</h3>
                    <p className="text-muted-foreground max-w-xs">We couldn't find anything matching "{query}". Try adjusting your search.</p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-4">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
                        <History className="w-4 h-4" />
                        Recent Searches
                      </h4>
                      <div className="space-y-1">
                        {recentSearches.map((s) => (
                          <button
                            key={s}
                            onClick={() => setQuery(s)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-white/5 rounded-xl transition-all text-left group"
                          >
                            <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                            <span className="text-sm font-medium">{s}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trending Categories */}
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
                      <TrendingUp className="w-4 h-4" />
                      Trending Categories
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {TRENDING_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => handleResultClick(`/shop?category=${cat}`, cat)}
                          className="px-4 py-2 bg-white/5 hover:bg-primary/10 hover:text-primary rounded-xl text-sm font-bold transition-all"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quick Links */}
                  <div className="space-y-4">
                    <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground">
                      <Layout className="w-4 h-4" />
                      Quick Access
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Link to="/shop" onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-center transition-all">Shop</Link>
                      <Link to="/events" onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-center transition-all">Events</Link>
                      <Link to="/book-club" onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-center transition-all">Book Club</Link>
                      <Link to="/account" onClick={onClose} className="p-3 bg-white/5 hover:bg-white/10 rounded-xl text-sm font-bold text-center transition-all">Account</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">ESC</kbd> to close</span>
                <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-white/10 border border-white/10">↵</kbd> to select</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-3 h-3" />
                <span>ReadMart Secure Search</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
