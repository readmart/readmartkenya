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
import { getShippingZones } from '@/api/dashboards';
import { supabase } from '@/lib/supabase/client';

type CheckoutStep = 'shipping' | 'payment' | 'confirmation';

export default function Checkout() {
  const [step, setStep] = useState<CheckoutStep>('shipping');
  const { formatPrice } = useCurrency();
  const { cartItems, cartTotal, clearCart } = useCart();
  const { user, profile, loading } = useAuth();
  const { settings } = useSettings();
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [shippingZones, setShippingZones] = useState<any[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    address: '',
    city: '',
    postalCode: '',
    phone: '',
  });

  // Track checkout session
  useEffect(() => {
    if (!user || cartItems.length === 0) return;

    const trackSession = async () => {
      try {
        if (!sessionId) {
          const { data } = await supabase
            .from('checkout_sessions')
            .insert([{
              user_id: user.id,
              email: formData.email || user.email,
              phone: formData.phone,
              cart_data: cartItems,
              status: 'initiated',
              last_step: step
            }])
            .select()
            .single();
          
          if (data) setSessionId(data.id);
        } else {
          await supabase
            .from('checkout_sessions')
            .update({
              email: formData.email,
              phone: formData.phone,
              last_step: step,
              status: step === 'confirmation' ? 'completed' : 
                      step === 'payment' ? 'payment_initiated' : 'initiated'
            })
            .eq('id', sessionId);
        }
      } catch (error) {
        console.error('Error tracking checkout session:', error);
      }
    };

    const timer = setTimeout(trackSession, 2000); // Debounce
    return () => clearTimeout(timer);
  }, [formData, step, user, cartItems]);

  const kenyanPhoneRegex = /^(?:254|\+254|0)?(7|1)\d{8}$/;

  useEffect(() => {
    async function loadShippingZones() {
      try {
        console.log('Loading shipping zones...');
        const zones = await getShippingZones();
        console.log('Loaded zones:', zones.length);
        setShippingZones(zones);
        
        // Default to first active zone if nothing selected
        if (zones && zones.length > 0 && !selectedZoneId) {
          const activeZone = zones.find((z: any) => z.is_active) || zones[0];
          if (activeZone) {
            console.log('Setting default zone:', activeZone.name);
            setSelectedZoneId(activeZone.id);
          }
        }
      } catch (error) {
        console.error('Error loading shipping zones:', error);
      }
    }
    loadShippingZones();
  }, []); // Reverted dependencies to avoid potential loops

  // Auto-match shipping zone based on city or postal code
  useEffect(() => {
    if (shippingZones.length === 0) return;

    const city = formData.city.toLowerCase().trim();
    const pCode = formData.postalCode.toLowerCase().trim();

    if (!city && !pCode) return;

    // Try to find a zone that matches the city name or postal code
    const matchedZone = shippingZones.find((zone: any) => {
      if (!zone.is_active) return false;
      
      const zoneName = zone.name.toLowerCase();
      const zonePostalCodes = (zone.postal_codes || '').toLowerCase();
      
      // Match by city name
      if (city && (zoneName.includes(city) || city.includes(zoneName))) return true;
      
      // Match by postal code
      if (pCode && zonePostalCodes.includes(pCode)) return true;
      
      return false;
    });

    if (matchedZone && matchedZone.id !== selectedZoneId) {
      setSelectedZoneId(matchedZone.id);
      toast.info(`Shipping zone updated to: ${matchedZone.name}`, { duration: 2000 });
    }
  }, [formData.city, formData.postalCode, shippingZones]);

  useEffect(() => {
    if (!loading && !user) {
      toast.error('Please login to continue to checkout');
      navigate('/login?redirect=/checkout');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user || profile) {
      setFormData(prev => ({
        ...prev,
        fullName: profile?.full_name || '',
        email: user?.email || '',
        phone: user?.phone || ''
      }));
    }
  }, [user, profile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  if (cartItems.length === 0 && step !== 'confirmation') {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-12 rounded-[3rem] inline-block"
        >
          <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-8">
            <ShoppingBag className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-4xl font-black mb-4">Your cart is empty</h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-md mx-auto">
            Add some books to your cart before checking out.
          </p>
          <Link 
            to="/shop"
            className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-black text-lg shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
          >
            Go to Shop <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    );
  }
  
  const totalWeight = cartItems.reduce((sum, item) => sum + (item.weight || 0.5) * item.quantity, 0);
  const totalVolume = cartItems.reduce((sum, item) => sum + (item.volume || 0.001) * item.quantity, 0);

  const selectedZone = shippingZones.find(z => z.id === selectedZoneId);
  const baseShipping = selectedZone?.base_rate ?? selectedZone?.price ?? selectedZone?.rate ?? 0;
  const weightSurcharge = (selectedZone?.weight_surcharge || 0) * totalWeight;
  const volumeSurcharge = (selectedZone?.volume_surcharge || 0) * totalVolume;
  
  const shippingAmount = baseShipping + weightSurcharge + volumeSurcharge;
  const taxRate = settings?.tax_rate ?? 16;
  const estimatedTax = cartTotal * (taxRate / 100);
  
  // Tax-inclusive subtotal for display
  const displaySubtotal = cartTotal + estimatedTax;
  const estimatedTotal = displaySubtotal + shippingAmount;

  const handleNext = () => {
    if (step === 'shipping') {
      if (!formData.fullName || !formData.address || !formData.city) {
        toast.error('Please fill in all shipping details');
        return;
      }
      if (!selectedZoneId) {
        toast.error('Please select a shipping zone');
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
      // The backend trigger handles tax_amount and total_amount calculation
      const order = await createOrder({
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        subtotal_amount: cartTotal,
        shipping_amount: shippingAmount,
        shipping_zone_id: selectedZoneId,
        payment_method: 'm-pesa',
        items: cartItems.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          product_snapshot: item
        }))
      });

      setOrderNumber(order.id.slice(0, 8).toUpperCase());

      // 2. Initiate M-Pesa STK Push using the backend-calculated total
      const result = await initiateSTKPush(order.id, formData.phone, order.total_amount);
      
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
                    <label className="text-sm font-medium">City / Town</label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={e => setFormData({...formData, city: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="e.g. Nairobi, Mombasa"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Postal Code (Optional)</label>
                    <input 
                      type="text" 
                      value={formData.postalCode}
                      onChange={e => setFormData({...formData, postalCode: e.target.value})}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary" 
                      placeholder="e.g. 00100"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-sm font-medium">Shipping Method & Region</label>
                    <select
                      value={selectedZoneId}
                      onChange={e => setSelectedZoneId(e.target.value)}
                      className="glass w-full px-4 py-3 rounded-xl outline-none focus:ring-2 focus:ring-primary bg-transparent font-bold"
                    >
                      <option value="" disabled className="bg-background">Select delivery option</option>
                      {shippingZones.filter(z => z.is_active).map(zone => (
                        <option key={zone.id} value={zone.id} className="bg-background">
                          {zone.name} ({zone.shipping_method || 'Standard'}) - {formatPrice(zone.base_rate || zone.price || zone.rate || 0)}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedZone && (
                        <>
                          {selectedZone.region && (
                            <span className="px-2 py-1 bg-slate-500/10 text-slate-500 rounded-md text-[10px] font-bold uppercase tracking-widest">
                              {selectedZone.region}
                            </span>
                          )}
                          <span className="px-2 py-1 bg-primary/10 text-primary rounded-md text-[10px] font-bold uppercase tracking-widest">
                            {selectedZone.estimated_days || 3} Days Delivery
                          </span>
                          {selectedZone.shipping_method && (
                            <span className="px-2 py-1 bg-blue-500/10 text-blue-500 rounded-md text-[10px] font-bold uppercase tracking-widest">
                              {selectedZone.shipping_method}
                            </span>
                          )}
                        </>
                      )}
                    </div>
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
                      Authorize {formatPrice(estimatedTotal)}
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
              {cartItems.map(item => {
                const itemTax = (item.price * (taxRate / 100));
                const taxInclusivePrice = item.price + itemTax;
                return (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{item.title} x {item.quantity}</span>
                    <span className="font-bold">{formatPrice(taxInclusivePrice * item.quantity)}</span>
                  </div>
                );
              })}
            </div>
            <div className="space-y-4 pt-6 border-t border-white/10 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-bold">{formatPrice(displaySubtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <div className="text-right">
                  <span className="font-bold">{formatPrice(shippingAmount)}</span>
                  {(weightSurcharge > 0 || volumeSurcharge > 0) && (
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-1">
                      {weightSurcharge > 0 && <div>Weight Surcharge: {formatPrice(weightSurcharge)}</div>}
                      {volumeSurcharge > 0 && <div>Volume Surcharge: {formatPrice(volumeSurcharge)}</div>}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-white/10">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-black text-primary">{formatPrice(estimatedTotal)}</span>
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
