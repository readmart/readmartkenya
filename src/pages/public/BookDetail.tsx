import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Heart, Share2, Star, ChevronLeft, Check, Truck, ShieldCheck, RotateCcw, ThumbsUp, Loader2, Zap } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';
import { getProductById } from '@/api/products';

const mockReviews = [
  { id: 1, user: 'Sarah M.', rating: 5, date: '2 days ago', comment: 'Absolutely loved this book! The characters are so well-developed and the plot kept me guessing until the very end.', likes: 12 },
  { id: 2, user: 'John D.', rating: 4, date: '1 week ago', comment: 'Great read, though it started a bit slow. Once it picked up, I couldn\'t put it down.', likes: 5 },
  { id: 3, user: 'Emily R.', rating: 5, date: '2 weeks ago', comment: 'A masterpiece. Matt Haig has a way with words that is simply magical.', likes: 8 },
];

export default function BookDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [book, setBook] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart, buyNow } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { formatPrice, currency } = useCurrency();

  useEffect(() => {
    async function loadBook() {
      if (!id) return;
      setIsLoading(true);
      try {
        const data = await getProductById(id);
        setBook(data);
      } catch (error) {
        console.error('Failed to load book:', error);
        toast.error('Book not found');
      } finally {
        setIsLoading(false);
      }
    }
    loadBook();
  }, [id]);

  const jsonLd = useMemo(() => {
    if (!book) return null;
    return {
      "@context": "https://schema.org/",
      "@type": "Book",
      "name": book.title,
      "author": {
        "@type": "Person",
        "name": book.metadata?.author || 'ReadMart Author'
      },
      "description": book.description,
      "image": book.image_url || book.metadata?.image_url,
      "isbn": book.id,
      "offers": {
        "@type": "Offer",
        "price": book.price,
        "priceCurrency": currency,
        "availability": (book.stock_quantity || 0) > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
      },
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": book.metadata?.rating || 5,
        "reviewCount": 0
      }
    };
  }, [book, currency]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
        <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Loading Book Details...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-3xl font-black mb-4">Book Not Found</h2>
        <Link to="/shop" className="text-primary font-bold hover:underline">Back to Shop</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addToCart({
      id: book.id,
      title: book.title,
      author: book.metadata?.author || 'ReadMart Original',
      price: book.price,
      image: book.image_url || book.metadata?.image_url,
      category: book.category?.name || 'General'
    });
    toast.success(`${book.title} added to cart!`);
  };

  const handleBuyNow = () => {
    buyNow({
      id: book.id,
      title: book.title,
      author: book.metadata?.author || 'ReadMart Original',
      price: book.price,
      image: book.image_url || book.metadata?.image_url,
      category: book.category?.name || 'General'
    });
    navigate('/checkout');
  };

  const toggleWishlist = () => {
    if (isInWishlist(book.id)) {
      removeFromWishlist(book.id);
      toast.info(`${book.title} removed from wishlist`);
    } else {
      addToWishlist({
        id: book.id,
        title: book.title,
        author: book.metadata?.author || 'ReadMart Original',
        price: book.price,
        image: book.image_url || book.metadata?.image_url,
        category: book.category?.name || 'General',
        rating: book.metadata?.rating || 5
      });
      toast.success(`${book.title} added to wishlist!`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
      <Link to="/shop" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary mb-8 transition-colors font-bold">
        <ChevronLeft className="w-4 h-4" />
        Back to Shop
      </Link>

      <div className="grid lg:grid-cols-2 gap-12 items-start">
        {/* Left: Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden glass shadow-2xl group"
        >
          <img 
            src={book.image_url || book.metadata?.image_url} 
            alt={book.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={toggleWishlist}
            className={`absolute top-6 right-6 p-4 glass rounded-full transition-all ${isInWishlist(book.id) ? 'bg-secondary text-white' : 'hover:bg-secondary hover:text-white'}`}
          >
            <Heart className={`w-6 h-6 ${isInWishlist(book.id) ? 'fill-current' : ''}`} />
          </button>
        </motion.div>

        {/* Right: Details */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="glass px-4 py-1.5 rounded-full text-xs font-black text-primary uppercase tracking-widest border-primary/20">
                {book.category?.name || 'General'}
              </span>
              <div className="flex items-center gap-1.5 text-secondary">
                <Star className="w-5 h-5 fill-secondary" />
                <span className="font-black text-lg">{book.metadata?.rating || 5.0}</span>
                <span className="text-muted-foreground text-sm font-medium">(New Arrival)</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">{book.title}</h1>
            <p className="text-2xl text-muted-foreground">by <span className="text-foreground font-black underline decoration-primary/30 underline-offset-4">{book.metadata?.author || 'ReadMart Original'}</span></p>
          </div>

          <div className="flex items-end gap-4">
            <span className="text-5xl font-black text-primary">{formatPrice(book.price)}</span>
            {book.sale_price && (
              <span className="text-muted-foreground line-through text-xl mb-1.5">{formatPrice(book.sale_price)}</span>
            )}
            <span className="bg-green-500/10 text-green-500 px-4 py-1.5 rounded-xl text-sm font-black mb-1.5 border border-green-500/20">
              NEW COLLECTION
            </span>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed font-medium">
            {book.description || 'A premium selection from the ReadMart collection. This book offers profound insights and a captivating reading experience.'}
          </p>

          <div className="grid grid-cols-2 gap-6 py-8 border-y border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-2.5 glass rounded-xl text-green-500">
                <Check className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">In Stock ({book.stock_quantity || 0} copies)</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2.5 glass rounded-xl text-primary">
                <Truck className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Free Express Delivery</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2.5 glass rounded-xl text-primary">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">Secure Checkout</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="p-2.5 glass rounded-xl text-primary">
                <RotateCcw className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">30-Day Returns</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <button 
              onClick={handleAddToCart}
              disabled={(book.stock_quantity || 0) <= 0}
              className={`flex-1 ${ (book.stock_quantity || 0) <= 0 ? 'bg-muted cursor-not-allowed' : 'bg-white/5 hover:bg-white/10' } text-foreground h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 border border-white/10`}
            >
              <ShoppingCart className="w-6 h-6" />
              {(book.stock_quantity || 0) <= 0 ? 'OUT OF STOCK' : 'ADD TO CART'}
            </button>
            <button 
              onClick={handleBuyNow}
              disabled={(book.stock_quantity || 0) <= 0}
              className={`flex-[1.5] ${ (book.stock_quantity || 0) <= 0 ? 'bg-muted cursor-not-allowed' : 'bg-primary hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1' } text-white h-16 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3`}
            >
              <Zap className="w-6 h-6 fill-white" />
              {(book.stock_quantity || 0) <= 0 ? 'OUT OF STOCK' : 'BUY IT NOW'}
            </button>
            <button className="w-16 h-16 glass rounded-2xl flex items-center justify-center hover:bg-white/10 transition-all">
              <Share2 className="w-6 h-6" />
            </button>
          </div>

          {/* Additional Info Tabs */}
          <div className="pt-8">
            <div className="flex gap-8 border-b border-white/10 mb-8 overflow-x-auto no-scrollbar">
              {['details', 'reviews', 'author'].map((tab) => (
                <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-4 text-sm font-black uppercase tracking-widest transition-all relative ${
                    activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === 'details' && (
                <motion.div 
                  key="details"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <div className="grid grid-cols-2 gap-y-4 text-sm">
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Format</span>
                    <span className="font-black text-right">{book.metadata?.format || 'Physical'}</span>
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">Condition</span>
                    <span className="font-black text-right">{book.metadata?.condition || 'New'}</span>
                    <span className="text-muted-foreground font-bold uppercase tracking-wider">SKU</span>
                    <span className="font-black text-right">{book.sku || book.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                </motion.div>
              )}

              {activeTab === 'reviews' && (
                <motion.div 
                  key="reviews"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {mockReviews.map((review) => (
                    <div key={review.id} className="glass p-6 rounded-2xl space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-primary">{review.user}</span>
                        <span className="text-xs text-muted-foreground font-bold">{review.date}</span>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-secondary fill-secondary' : 'text-muted-foreground'}`} />
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.comment}</p>
                      <button className="flex items-center gap-2 text-xs font-black text-primary hover:opacity-70 transition-all uppercase tracking-widest">
                        <ThumbsUp className="w-3 h-3" />
                        Helpful ({review.likes})
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'author' && (
                <motion.div 
                  key="author"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
                >
                  <h3 className="text-xl font-black uppercase tracking-tight">{book.metadata?.author || 'ReadMart Original'}</h3>
                  <p className="text-muted-foreground leading-relaxed font-medium">
                    A featured contributor to the ReadMart collection, specializing in curated works that inspire and educate our community.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
