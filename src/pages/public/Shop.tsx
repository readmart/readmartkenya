import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, ChevronDown, X, Loader2 } from 'lucide-react';
import BookCard from '@/components/shop/BookCard';
import { useCurrency } from '@/contexts/CurrencyContext';
import { getProducts } from '@/api/products';
import { getCategories } from '@/api/dashboards';

export default function Shop() {
  const { formatPrice } = useCurrency();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>(['All']);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [productsData, categoriesData] = await Promise.all([
          getProducts(),
          getCategories()
        ]);
        setProducts(productsData);
        
        // Ensure specific categories requested by user are present
        const dbCategories = categoriesData.map((c: any) => c.name);
        const requiredCategories = ['All', 'Art Books', 'Accessories', 'Stationery'];
        const finalCategories = [...new Set([...requiredCategories, ...dbCategories])];
        setCategories(finalCategories);
      } catch (error) {
        console.error('Failed to load shop data:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    const category = searchParams.get('category');
    if (category) {
      setSelectedCategory(category);
    }
  }, [searchParams]);

  const [priceRange, setPriceRange] = useState(1500000);
  const [minRating, setMinRating] = useState(0);
  const [sortBy, setSortBy] = useState('Newest First');
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const filteredBooks = useMemo(() => {
    return products
      .filter((book) => {
        const name = book.name || '';
        const author = book.metadata?.author || 'Unknown';
        const condition = book.metadata?.condition || 'New';
        const format = book.metadata?.format || 'Physical';
        
        const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              author.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = selectedCategory === 'All' 
          ? true 
          : book.category?.name === selectedCategory;
        
        const matchesPrice = priceRange >= 1500000 || book.price <= priceRange;
        
        const rating = book.metadata?.rating || 0;
        const matchesRating = rating >= minRating;

        const matchesCondition = selectedConditions.length === 0 || selectedConditions.includes(condition);
        const matchesFormat = selectedFormats.length === 0 || selectedFormats.includes(format);

        return matchesSearch && matchesCategory && matchesPrice && matchesRating && matchesCondition && matchesFormat;
      })
      .sort((a, b) => {
        if (sortBy === 'Price: Low to High') return a.price - b.price;
        if (sortBy === 'Price: High to Low') return b.price - a.price;
        if (sortBy === 'Most Popular') return (b.metadata?.rating || 0) - (a.metadata?.rating || 0);
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [products, searchQuery, selectedCategory, priceRange, minRating, sortBy]);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black mb-2 uppercase tracking-tight">Shop</h1>
          <p className="text-muted-foreground font-medium">Browse our collection of books, art, and accessories</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search products..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass pl-12 pr-6 py-3 rounded-2xl w-full md:w-80 focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>
          <button 
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            className="lg:hidden glass p-3 rounded-2xl hover:bg-primary/10 transition-colors"
          >
            <Filter className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[250px_1fr] gap-10">
        {/* Filters Sidebar */}
        <aside className="hidden lg:block space-y-8">
          <div>
            <h3 className="font-black mb-4 flex items-center justify-between uppercase text-sm tracking-widest">
              Categories <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="space-y-2">
              {categories.map(cat => (
                <label key={cat} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="category"
                    checked={selectedCategory === cat}
                    onChange={() => setSelectedCategory(cat)}
                    className="w-4 h-4 rounded-full border-white/20 bg-white/10 text-primary focus:ring-primary" 
                  />
                  <span className={`text-sm transition-colors ${selectedCategory === cat ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {cat}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-black mb-4 flex items-center justify-between uppercase text-sm tracking-widest">
              Price Range <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="px-2">
              <div className="flex justify-between mb-4 text-sm font-black text-primary">
                <span>{formatPrice(0)}</span>
                <span>{formatPrice(priceRange)}</span>
              </div>
              <input 
                type="range" 
                min="0"
                max="1500000"
                step="1000"
                value={priceRange}
                onChange={(e) => setPriceRange(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
              />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground font-bold">
                <span>Min</span>
                <span>{formatPrice(1500000)}+</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-black mb-4 flex items-center justify-between uppercase text-sm tracking-widest">
              Condition <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="space-y-2">
              {['New', 'Pre-loved'].map(condition => (
                <label key={condition} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedConditions.includes(condition)}
                    onChange={() => {
                      setSelectedConditions(prev => 
                        prev.includes(condition) 
                          ? prev.filter(c => c !== condition) 
                          : [...prev, condition]
                      );
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary" 
                  />
                  <span className={`text-sm transition-colors ${selectedConditions.includes(condition) ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {condition}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-black mb-4 flex items-center justify-between uppercase text-sm tracking-widest">
              Format <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="space-y-2">
              {['Physical', 'E-book'].map(format => (
                <label key={format} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="checkbox" 
                    checked={selectedFormats.includes(format)}
                    onChange={() => {
                      setSelectedFormats(prev => 
                        prev.includes(format) 
                          ? prev.filter(f => f !== format) 
                          : [...prev, format]
                      );
                    }}
                    className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary focus:ring-primary" 
                  />
                  <span className={`text-sm transition-colors ${selectedFormats.includes(format) ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {format}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-black mb-4 flex items-center justify-between uppercase text-sm tracking-widest">
              Min Rating <ChevronDown className="h-4 w-4" />
            </h3>
            <div className="space-y-2">
              {[4, 3, 2, 0].map(star => (
                <label key={star} className="flex items-center gap-3 cursor-pointer group">
                  <input 
                    type="radio" 
                    name="rating"
                    checked={minRating === star}
                    onChange={() => setMinRating(star)}
                    className="w-4 h-4 rounded-full border-white/20 bg-white/10 text-primary focus:ring-primary" 
                  />
                  <span className={`text-sm transition-colors ${minRating === star ? 'text-primary font-bold' : 'text-muted-foreground group-hover:text-foreground'}`}>
                    {star === 0 ? 'All Ratings' : `${star}+ Stars`}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <button 
            onClick={() => {
              setSelectedCategory('All');
              setPriceRange(1500000);
              setMinRating(0);
              setSelectedConditions([]);
              setSelectedFormats([]);
              setSearchQuery('');
            }}
            className="w-full py-3 glass rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-500/10 hover:text-red-500 transition-all"
          >
            Clear All Filters
          </button>
        </aside>

        {/* Product Grid */}
        <main>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
              <Loader2 className="w-12 h-12 text-primary animate-spin" />
              <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Synchronizing Inventory...</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <p className="text-sm text-muted-foreground font-medium">
                  Showing <span className="text-foreground font-black">{filteredBooks.length}</span> results
                </p>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <span className="text-sm text-muted-foreground font-bold whitespace-nowrap">Sort by:</span>
                  <div className="relative w-full sm:w-auto">
                    <select 
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="glass px-4 py-2 pr-10 rounded-xl text-sm font-bold outline-none w-full sm:w-auto focus:ring-2 focus:ring-primary transition-all appearance-none"
                    >
                      <option>Newest First</option>
                      <option>Price: Low to High</option>
                      <option>Price: High to Low</option>
                      <option>Most Popular</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {filteredBooks.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-8">
                  <AnimatePresence mode="popLayout">
                    {filteredBooks.map((book) => (
                      <motion.div
                        key={book.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                      >
                        <BookCard 
                          id={book.id}
                          title={book.name}
                          author={book.metadata?.author || 'ReadMart Original'}
                          price={book.price}
                          rating={book.metadata?.rating || 5.0}
                          category={book.category?.name || 'General'}
                          image={book.metadata?.image_url || 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800'}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center glass rounded-[3rem] p-12">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    <Search className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h2 className="text-2xl font-black mb-2 uppercase">No Products Found</h2>
                  <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
                    We couldn't find any items matching your current filters. Try adjusting your search or clearing filters.
                  </p>
                  <button 
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('All');
                      setPriceRange(1500000);
                      setMinRating(0);
                      setSelectedConditions([]);
                      setSelectedFormats([]);
                    }}
                    className="glass px-8 py-4 rounded-2xl font-black uppercase text-sm hover:bg-primary hover:text-white transition-all"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </>
          )}

          {/* Pagination */}
          {filteredBooks.length > 0 && (
            <div className="mt-16 flex justify-center gap-3">
              {[1, 2, 3].map((page) => (
                <button 
                  key={page}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold transition-all ${
                    page === 1 ? 'bg-primary text-white shadow-xl shadow-primary/30' : 'glass hover:bg-white/10'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Mobile Filters Overlay */}
      <AnimatePresence>
        {showMobileFilters && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 lg:hidden"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-[300px] glass border-l border-white/10 z-[51] p-8 lg:hidden overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black uppercase">Filters</h2>
                <button onClick={() => setShowMobileFilters(false)} className="p-2 glass rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="space-y-8">
                {/* Same filter sections as desktop */}
                <div>
                  <h3 className="font-black mb-4 uppercase text-xs tracking-widest">Categories</h3>
                  <div className="space-y-2">
                    {categories.map(cat => (
                      <label key={cat} className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="category-mobile"
                          checked={selectedCategory === cat}
                          onChange={() => setSelectedCategory(cat)}
                          className="w-4 h-4 rounded-full border-white/20 bg-white/10 text-primary" 
                        />
                        <span className={`text-sm ${selectedCategory === cat ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{cat}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-black mb-4 uppercase text-xs tracking-widest">Price Range</h3>
                  <div className="px-2">
                    <div className="flex justify-between mb-4 text-sm font-black text-primary">
                      <span>{formatPrice(0)}</span>
                      <span>{formatPrice(priceRange)}</span>
                    </div>
                    <input 
                      type="range" 
                      min="0"
                      max="1500000"
                      step="1000"
                      value={priceRange}
                      onChange={(e) => setPriceRange(parseInt(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary" 
                    />
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground font-bold">
                      <span>Min</span>
                      <span>{formatPrice(1500000)}+</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-black mb-4 uppercase text-xs tracking-widest">Condition</h3>
                  <div className="space-y-2">
                    {['New', 'Pre-loved'].map(condition => (
                      <label key={condition} className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedConditions.includes(condition)}
                          onChange={() => {
                            setSelectedConditions(prev => 
                              prev.includes(condition) 
                                ? prev.filter(c => c !== condition) 
                                : [...prev, condition]
                            );
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary" 
                        />
                        <span className={`text-sm ${selectedConditions.includes(condition) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{condition}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-black mb-4 uppercase text-xs tracking-widest">Format</h3>
                  <div className="space-y-2">
                    {['Physical', 'E-book'].map(format => (
                      <label key={format} className="flex items-center gap-3">
                        <input 
                          type="checkbox" 
                          checked={selectedFormats.includes(format)}
                          onChange={() => {
                            setSelectedFormats(prev => 
                              prev.includes(format) 
                                ? prev.filter(f => f !== format) 
                                : [...prev, format]
                            );
                          }}
                          className="w-4 h-4 rounded border-white/20 bg-white/10 text-primary" 
                        />
                        <span className={`text-sm ${selectedFormats.includes(format) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{format}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-black mb-4 uppercase text-xs tracking-widest">Min Rating</h3>
                  <div className="space-y-2">
                    {[4, 3, 2, 0].map(star => (
                      <label key={star} className="flex items-center gap-3">
                        <input 
                          type="radio" 
                          name="rating-mobile"
                          checked={minRating === star}
                          onChange={() => setMinRating(star)}
                          className="w-4 h-4 rounded-full border-white/20 bg-white/10 text-primary" 
                        />
                        <span className={`text-sm ${minRating === star ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                          {star === 0 ? 'All Ratings' : `${star}+ Stars`}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setShowMobileFilters(false)}
                  className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest"
                >
                  Show Results
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
