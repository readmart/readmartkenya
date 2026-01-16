import { motion, AnimatePresence } from 'framer-motion';
import { useWishlist } from '@/contexts/WishlistContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Trash2, ShoppingCart, Heart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

export default function Wishlist() {
  const { wishlistItems, removeFromWishlist, clearWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  const handleMoveToCart = (item: any) => {
    addToCart(item);
    removeFromWishlist(item.id);
    toast.success(`${item.title} moved to cart!`);
  };

  if (wishlistItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-12 rounded-[3rem] inline-block"
        >
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <Heart className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-4xl font-black mb-4">Your wishlist is empty</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto">
            Save your favorite books to keep track of what you want to read next.
          </p>
          <Link 
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
          >
            Explore Books <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
        <div>
          <h1 className="text-5xl font-black mb-2 tracking-tight uppercase">My Wishlist</h1>
          <p className="text-muted-foreground font-medium">
            You have <span className="text-primary font-bold">{wishlistItems.length}</span> items in your wishlist
          </p>
        </div>
        <button 
          onClick={clearWishlist}
          className="text-red-500 hover:text-red-600 font-bold flex items-center gap-2 px-6 py-3 glass rounded-2xl hover:bg-red-500/10 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          Clear Wishlist
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {wishlistItems.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="glass p-6 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 group"
            >
              <Link to={`/book/${item.id}`} className="w-32 aspect-[3/4] rounded-2xl overflow-hidden flex-shrink-0">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </Link>

              <div className="flex-grow text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-2">
                  <span className="glass px-3 py-1 rounded-full text-[10px] font-black text-primary uppercase tracking-widest self-center md:self-start">
                    {item.category}
                  </span>
                </div>
                <Link to={`/book/${item.id}`}>
                  <h3 className="text-2xl font-black mb-1 hover:text-primary transition-colors">{item.title}</h3>
                </Link>
                <p className="text-muted-foreground font-medium mb-4">{item.author}</p>
                <div className="text-2xl font-black text-primary">
                  {formatPrice(item.price)}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                <button 
                  onClick={() => handleMoveToCart(item)}
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-primary text-white px-8 py-4 rounded-2xl font-black shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Move to Cart
                </button>
                <button 
                  onClick={() => removeFromWishlist(item.id)}
                  className="p-4 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-2xl transition-all"
                  title="Remove from wishlist"
                >
                  <Trash2 className="w-6 h-6" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
