import { motion } from 'framer-motion';
import { Trash2, Plus, Minus, ArrowRight, ShoppingBag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';

export default function Cart() {
  const { cartItems, updateQuantity, removeFromCart, cartTotal } = useCart();
  const { formatPrice } = useCurrency();

  const shipping = cartTotal > 5000 ? 0 : 500; // Example: free shipping over 5000 KES
  const tax = cartTotal * 0.16; // 16% VAT for Kenya
  const total = cartTotal + shipping + tax;

  if (cartItems.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <div className="glass w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8">
          <ShoppingBag className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-bold mb-4">Your cart is empty</h1>
        <p className="text-muted-foreground mb-8 text-lg">Looks like you haven't added anything to your cart yet.</p>
        <Link 
          to="/shop" 
          className="bg-primary text-white px-8 py-4 rounded-full font-bold hover:opacity-90 transition-all inline-flex items-center gap-2"
        >
          Start Shopping
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-12">Shopping Cart</h1>

      <div className="grid lg:grid-cols-[1fr_380px] gap-12 items-start">
        {/* Cart Items List */}
        <div className="space-y-6">
          {cartItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass p-6 rounded-3xl flex flex-col sm:flex-row gap-6 items-center"
            >
              <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              </div>
              
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-xl font-bold mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-sm mb-4">{item.author}</p>
                <div className="flex items-center justify-center sm:justify-start gap-4">
                  <div className="flex items-center gap-3 glass px-3 py-1 rounded-full">
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="p-1 hover:text-primary transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="p-1 hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-destructive hover:text-destructive/80 transition-colors p-2"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="text-2xl font-bold text-primary mb-1">
                  {formatPrice(item.price * item.quantity)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatPrice(item.price)} each
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Order Summary */}
        <aside>
          <div className="glass p-8 rounded-3xl space-y-6 sticky top-24">
            <h2 className="text-2xl font-bold mb-6">Order Summary</h2>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-semibold">{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Tax (16%)</span>
                <span className="font-semibold">{formatPrice(tax)}</span>
              </div>
              <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                <span className="text-lg font-bold">Total</span>
                <span className="text-3xl font-bold text-primary">{formatPrice(total)}</span>
              </div>
            </div>

            <Link 
              to="/checkout" 
              className="w-full bg-primary text-white h-14 rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-xl shadow-primary/20"
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5" />
            </Link>

            <div className="pt-4">
              <p className="text-xs text-center text-muted-foreground">
                Taxes and shipping calculated at checkout. Free shipping on orders over $50.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
