import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Truck, CreditCard, CheckCircle, ChevronRight, 
  MapPin, ShieldCheck, ArrowLeft, Loader2, ShoppingBag,
  Lock, Zap, Info, Smartphone, ArrowRight
} from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { createOrder } from '@/api/orders';
import { initiateSTKPush, checkPaymentStatus } from '@/api/payments';
import { supabase } from '@/lib/supabase/client';

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

export default function Checkout() {
  const [step, setStep] = useState<CheckoutStep>('shipping');
  const { formatPrice } = useCurrency();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { user, loading } = useAuth();
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    phone: '',
  });

  const kenyanPhoneRegex = /^(?:254|\+254|0)?(7|1)\d{8}$/;

  useEffect(() => {
    if (!loading && !user) {
      toast.error('Please login to continue to checkout');
      navigate('/login?redirect=/checkout');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  
  const taxRate = settings?.tax_rate || 16;
  const shipping = cartTotal > 5000 ? 0 : 500;
  const tax = cartTotal * (taxRate / 100);
  const total = cartTotal + shipping + tax;

  const handleNext = () => {
    if (step === 'shipping') {
      if (!formData.fullName || !formData.address || !formData.city) {
        toast.error('Please fill in all shipping details');
        return;
      }
      if (!kenyanPhoneRegex.test(formData.phone)) {
        toast.error('Please enter a valid Kenyan phone number');
        return;
      }
      setStep('payment');
    }
  };

  const handlePayment = async () => {
    setIsProcessing(true);
    try {
      // 1. Create the order in Supabase
      const order = await createOrder({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        total_amount: total,
        payment_method: 'm-pesa',
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          product_snapshot: item
        }))
      });

      setOrderNumber(order.id.slice(0, 8).toUpperCase());

      // 2. Initiate M-Pesa STK Push
      const result = await initiateSTKPush(order.id, formData.phone, total);
      
      if (result.error) {
        toast.error(result.error);
        setIsProcessing(false);
        return;
      }

      if (result.demo) {
        toast.info('Demo Mode: Payment simulated');
        setTimeout(() => {
          setIsProcessing(false);
          setStep('confirmation');
          clearCart();
          toast.success('Order placed successfully!');
        }, 2000);
      } else {
        toast.success('M-Pesa request sent! Please enter your PIN.');
        
        // Use Realtime for instant updates
        const channel = supabase
          .channel(`order-status-${order.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'orders',
              filter: `id=eq.${order.id}`
            },
            (payload) => {
              const newStatus = payload.new.status;
              if (newStatus === 'paid' || newStatus === 'processing') {
                cleanup();
                setIsProcessing(false);
                setStep('confirmation');
                clearCart();
                toast.success('Payment received! Order placed successfully.');
              } else if (newStatus === 'failed') {
                cleanup();
                setIsProcessing(false);
                toast.error('Payment failed. Please try again.');
              }
            }
          )
          .subscribe();

        // Fallback polling (in case Realtime fails or is not enabled)
        let attempts = 0;
        const maxAttempts = 20;
        const pollInterval = setInterval(async () => {
          attempts++;
          const orderStatus = await checkPaymentStatus(order.id);
          if (orderStatus?.status === 'paid' || orderStatus?.status === 'processing') {
            cleanup();
            setIsProcessing(false);
            setStep('confirmation');
            clearCart();
            toast.success('Payment received! Order placed successfully.');
          } else if (orderStatus?.status === 'failed') {
            cleanup();
            setIsProcessing(false);
            toast.error('Payment failed. Please try again.');
          } else if (attempts >= maxAttempts) {
            cleanup();
            setIsProcessing(false);
            toast.error('Payment timeout. If you paid, please check your order history.');
          }
        }, 3000);

        const cleanup = () => {
          clearInterval(pollInterval);
          supabase.removeChannel(channel);
        };
      }

    } catch (error: any) {
      toast.error(error.message || 'Checkout failed');
      setIsProcessing(false);
    }
  };

  if (cartItems.length === 0 && step !== 'confirmation') {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <div className="glass p-12 rounded-[3rem] inline-block">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-3xl font-black mb-4">Your cart is empty</h2>
          <p className="text-muted-foreground mb-8">Add some books to your cart before checking out.</p>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <motion.a 
              href="/shop"
              className="bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 block"
            >
              Go Shopping
            </motion.a>
          </motion.div>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 'shipping', label: 'Shipping', icon: <Truck className="w-5 h-5" /> },
    { id: 'payment', label: 'Payment', icon: <CreditCard className="w-5 h-5" /> },
    { id: 'confirmation', label: 'Done', icon: <CheckCircle className="w-5 h-5" /> },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Progress Stepper */}
      <div className="flex justify-between items-center mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 -z-10" />
        {steps.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center gap-2">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              step === s.id ? 'bg-primary text-white scale-110 shadow-lg shadow-primary/20' : 
              steps.findIndex(x => x.id === step) > i ? 'bg-green-500 text-white' : 'glass text-muted-foreground'
            }`}>
              {steps.findIndex(x => x.id === step) > i ? <CheckCircle className="w-6 h-6" /> : s.icon}
            </div>
            <span className={`text-sm font-bold ${step === s.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {step === 'shipping' && (
              <motion.div
                key="shipping"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass p-8 rounded-3xl space-y-6"
              >
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <MapPin className="text-primary" />
                  Shipping Information
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Full Name</label>
                    <input 
                      type="text" 
                      value={formData.fullName}
                      onChange={e => setFormData({...formData, fullName: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number (M-Pesa)</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="0712345678"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Delivery Address</label>
                    <textarea 
                      value={formData.address}
                      onChange={e => setFormData({...formData, address: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary min-h-[100px]" 
                      placeholder="Street, Apartment, Suite, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">City</label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="Nairobi"
                    />
                  </div>
                </div>
                <button 
                  onClick={handleNext}
                  className="w-full bg-primary text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                >
                  Continue to Payment
                  <ChevronRight className="w-5 h-5" />
                </button>
              </motion.div>
            )}

            {step === 'payment' && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="glass p-8 rounded-3xl space-y-6 relative overflow-hidden"
              >
                {/* Fast & Secure Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                    <Lock className="w-3 h-3" />
                    Secure SSL Encrypted
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20">
                    <Zap className="w-3 h-3" />
                    Fast Processing
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CreditCard className="text-primary" />
                    Payment Method
                  </h2>
                  <button onClick={() => setStep('shipping')} className="text-sm text-primary font-bold flex items-center gap-1 hover:underline">
                    <ArrowLeft className="w-4 h-4" /> Edit Shipping
                  </button>
                </div>

                <div className="grid gap-4">
                  <div className="p-6 glass border-2 border-primary rounded-2xl flex items-center justify-between bg-primary/5 transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white font-black text-xl italic shadow-lg shadow-green-500/20">
                        M
                      </div>
                      <div>
                        <p className="font-bold text-lg">M-Pesa Express</p>
                        <p className="text-sm text-muted-foreground font-medium">Instant STK Push to your phone</p>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full border-4 border-primary bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                  </div>

                  {/* Trust Badges */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass p-3 rounded-xl flex items-center gap-2 border-white/5">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fraud Protected</span>
                    </div>
                    <div className="glass p-3 rounded-xl flex items-center gap-2 border-white/5">
                      <Smartphone className="w-4 h-4 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone Verified</span>
                    </div>
                  </div>
                </div>

                <div className="glass p-6 rounded-2xl bg-white/5 border border-white/10 relative group">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Info className="w-5 h-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold">How it works:</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        1. Click "Authorize Payment" below.<br/>
                        2. Check your phone <strong>{formData.phone}</strong> for a prompt.<br/>
                        3. Enter your M-Pesa PIN to confirm.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={handlePayment}
                  disabled={isProcessing}
                  className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-2xl shadow-primary/30 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Waiting for PIN...
                    </>
                  ) : (
                    <>
                      Authorize {formatPrice(total)}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                
                <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest flex items-center justify-center gap-2">
                  <Lock className="w-3 h-3" /> 256-bit Secure Connection
                </p>
              </motion.div>
            )}

            {step === 'confirmation' && (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass p-12 rounded-3xl text-center space-y-6"
              >
                <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="w-12 h-12" />
                </div>
                <h2 className="text-4xl font-bold">Order Confirmed!</h2>
                <p className="text-muted-foreground text-lg max-w-md mx-auto">
                  Thank you for your purchase, {formData.fullName.split(' ')[0] || 'valued customer'}! 
                  Your order <strong>#RM-{orderNumber || 'PENDING'}</strong> is being processed.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                  <Link to="/account?tab=orders" className="glass px-8 py-3 rounded-2xl font-bold hover:bg-white/10 transition-all">
                    Track Order
                  </Link>
                  <Link to="/shop" className="bg-primary text-white px-8 py-3 rounded-2xl font-bold hover:opacity-90 transition-all">
                    Back to Shop
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Order Summary Sidebar */}
        <aside className="space-y-6">
          <div className="glass p-8 rounded-3xl sticky top-24">
            <h3 className="text-xl font-bold mb-6">Order Summary</h3>
            <div className="space-y-4 mb-6">
              {cartItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{item.title} x {item.quantity}</span>
                  <span className="font-bold">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 pt-6 border-t border-white/10 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">{formatPrice(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span className="font-bold">{formatPrice(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">VAT ({taxRate}%)</span>
                <span className="font-bold">{formatPrice(tax)}</span>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-white/10">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-black text-primary">{formatPrice(total)}</span>
              </div>
            </div>
          </div>

          <div className="glass p-6 rounded-3xl">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span>Secure encrypted checkout powered by ReadMart</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
