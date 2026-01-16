import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { ShoppingCart, Heart, Share2, Star, ChevronLeft, Check, Truck, ShieldCheck, RotateCcw, ThumbsUp } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

const mockReviews = [
  { id: 1, user: 'Sarah M.', rating: 5, date: '2 days ago', comment: 'Absolutely loved this book! The characters are so well-developed and the plot kept me guessing until the very end.', likes: 12 },
  { id: 2, user: 'John D.', rating: 4, date: '1 week ago', comment: 'Great read, though it started a bit slow. Once it picked up, I couldn\'t put it down.', likes: 5 },
  { id: 3, user: 'Emily R.', rating: 5, date: '2 weeks ago', comment: 'A masterpiece. Matt Haig has a way with words that is simply magical.', likes: 8 },
];

export default function BookDetail() {
  const { id } = useParams();
  const [activeTab, setActiveTab] = useState('details');
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { formatPrice, currency } = useCurrency();

  // Mock book data
  const book = {
    id: id || '1',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    price: 24.99,
    rating: 4.8,
    reviews: 1250,
    category: 'Fiction',
    description: 'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived. To see how things would be if you had made other choices... Would you have done anything differently, if you had the chance to undo your regrets?',
    image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&q=80&w=800',
    stock: 12,
    pages: 304,
    publisher: 'Canongate Books',
    format: 'Hardcover',
    authorBio: 'Matt Haig is the number one bestselling author of Reasons to Stay Alive, Notes on a Nervous Planet and six highly acclaimed novels for adults, including How to Stop Time and The Humans.',
  };

  const jsonLd = useMemo(() => ({
    "@context": "https://schema.org/",
    "@type": "Book",
    "name": book.title,
    "author": {
      "@type": "Person",
      "name": book.author
    },
    "description": book.description,
    "image": book.image,
    "isbn": book.id,
    "offers": {
      "@type": "Offer",
      "price": book.price,
      "priceCurrency": currency,
      "availability": book.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": book.rating,
      "reviewCount": book.reviews
    }
  }), [book, currency]);

  const handleAddToCart = () => {
    addToCart(book);
    toast.success(`${book.title} added to cart!`);
  };

  const toggleWishlist = () => {
    if (isInWishlist(book.id)) {
      removeFromWishlist(book.id);
      toast.info(`${book.title} removed from wishlist`);
    } else {
      addToWishlist(book);
      toast.success(`${book.title} added to wishlist!`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <script type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </script>
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
            src={book.image} 
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
                {book.category}
              </span>
              <div className="flex items-center gap-1.5 text-secondary">
                <Star className="w-5 h-5 fill-secondary" />
                <span className="font-black text-lg">{book.rating}</span>
                <span className="text-muted-foreground text-sm font-medium">({book.reviews} reviews)</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight">{book.title}</h1>
            <p className="text-2xl text-muted-foreground">by <span className="text-foreground font-black underline decoration-primary/30 underline-offset-4">{book.author}</span></p>
          </div>

          <div className="flex items-end gap-4">
            <span className="text-5xl font-black text-primary">{formatPrice(book.price)}</span>
            <span className="text-muted-foreground line-through text-xl mb-1.5">{formatPrice(29.99)}</span>
            <span className="bg-green-500/10 text-green-500 px-4 py-1.5 rounded-xl text-sm font-black mb-1.5 border border-green-500/20">
              SAVE 20%
            </span>
          </div>

          <p className="text-lg text-muted-foreground leading-relaxed font-medium">
            {book.description}
          </p>

          <div className="grid grid-cols-2 gap-6 py-8 border-y border-white/10">
            <div className="flex items-center gap-4">
              <div className="p-2.5 glass rounded-xl text-green-500">
                <Check className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold">In Stock ({book.stock} copies)</span>
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

          <div className="flex gap-4 pt-4">
            <button 
              onClick={handleAddToCart}
              className="flex-1 bg-primary text-white h-16 rounded-2xl font-black text-lg hover:shadow-2xl hover:shadow-primary/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
            >
              <ShoppingCart className="w-6 h-6" />
              ADD TO CART
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
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'details' && (
                  <div className="grid grid-cols-2 gap-y-6 text-sm">
                    <div className="text-muted-foreground font-bold uppercase tracking-wider">Pages</div>
                    <div className="font-black text-base">{book.pages} pages</div>
                    <div className="text-muted-foreground font-bold uppercase tracking-wider">Publisher</div>
                    <div className="font-black text-base">{book.publisher}</div>
                    <div className="text-muted-foreground font-bold uppercase tracking-wider">Format</div>
                    <div className="font-black text-base">{book.format}</div>
                  </div>
                )}

                {activeTab === 'reviews' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-8">
                      <div>
                        <h3 className="text-2xl font-black mb-1">Customer Reviews</h3>
                        <p className="text-sm text-muted-foreground font-medium">Based on {book.reviews} ratings</p>
                      </div>
                      <button className="glass px-6 py-3 rounded-xl text-sm font-black hover:bg-primary hover:text-white transition-all">
                        WRITE A REVIEW
                      </button>
                    </div>
                    
                    <div className="space-y-6">
                      {mockReviews.map((review) => (
                        <div key={review.id} className="glass p-6 rounded-3xl border-white/5">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-black text-primary">
                                {review.user[0]}
                              </div>
                              <div>
                                <p className="font-black text-sm">{review.user}</p>
                                <div className="flex items-center gap-1">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-yellow-500 text-yellow-500' : 'text-white/20'}`} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs text-muted-foreground font-bold">{review.date}</span>
                          </div>
                          <p className="text-muted-foreground font-medium mb-4 italic">"{review.comment}"</p>
                          <button className="flex items-center gap-2 text-xs font-black text-muted-foreground hover:text-primary transition-colors">
                            <ThumbsUp className="w-3.5 h-3.5" />
                            HELPFUL ({review.likes})
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'author' && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-6 mb-6">
                      <div className="w-24 h-24 rounded-3xl overflow-hidden glass p-1">
                        <img 
                          src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?q=80&w=400" 
                          alt={book.author}
                          className="w-full h-full object-cover rounded-2xl"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black mb-1">{book.author}</h3>
                        <p className="text-primary font-black text-sm uppercase tracking-widest">Bestselling Author</p>
                      </div>
                    </div>
                    <p className="text-muted-foreground leading-relaxed font-medium">
                      {book.authorBio}
                    </p>
                    <button className="text-primary font-black flex items-center gap-2 hover:translate-x-1 transition-all">
                      VIEW ALL BOOKS BY {book.author.toUpperCase()} <ChevronLeft className="w-4 h-4 rotate-180" />
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
