import { motion } from 'framer-motion';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { toast } from 'sonner';

interface BookCardProps {
  id: string;
  title: string;
  author: string;
  price: number;
  image: string;
  rating: number;
  category: string;
}

export default function BookCard({ id, title, author, price, image, rating, category }: BookCardProps) {
  const { addToCart } = useCart();
  const { addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();
  const { formatPrice } = useCurrency();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({ id, title, author, price, image, category });
    toast.success(`${title} added to cart!`);
  };

  const toggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWishlist(id)) {
      removeFromWishlist(id);
      toast.info(`${title} removed from wishlist`);
    } else {
      addToWishlist({ id, title, author, price, image, category, rating });
      toast.success(`${title} added to wishlist!`);
    }
  };

  return (
    <motion.div
      whileHover={{ y: -10 }}
      className="glass rounded-3xl overflow-hidden group"
    >
      <Link to={`/book/${id}`} className="block relative aspect-[3/4] overflow-hidden">
        <img 
          src={image} 
          alt={title} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          referrerPolicy="no-referrer"
        />
        <div className="absolute top-4 left-4">
          <span className="glass px-3 py-1 rounded-full text-xs font-bold text-primary">
            {category}
          </span>
        </div>
        <button 
          onClick={toggleWishlist}
          className={`absolute top-4 right-4 p-2 glass rounded-full opacity-0 group-hover:opacity-100 transition-all ${isInWishlist(id) ? 'bg-secondary text-white opacity-100' : 'hover:bg-secondary hover:text-white'}`}
        >
          <Heart className={`w-4 h-4 ${isInWishlist(id) ? 'fill-current' : ''}`} />
        </button>
      </Link>

      <div className="p-6">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star 
              key={i} 
              className={`w-3 h-3 ${i < Math.floor(rating) ? 'text-secondary fill-secondary' : 'text-muted-foreground'}`} 
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1">({rating})</span>
        </div>
        
        <Link to={`/book/${id}`} className="block">
          <h3 className="font-bold text-lg mb-1 truncate hover:text-primary transition-colors">{title}</h3>
        </Link>
        <p className="text-sm text-muted-foreground mb-4">{author}</p>
        
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-primary">{formatPrice(price)}</span>
          <button 
            onClick={handleAddToCart}
            className="p-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
