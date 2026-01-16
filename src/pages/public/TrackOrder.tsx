import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Package, Truck, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { toast } from 'sonner';

export default function TrackOrder() {
  const [orderId, setOrderId] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId.trim()) return;

    setIsLoading(true);
    try {
      // Find order by ID or order number (if we have a short one)
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (*)
          )
        `)
        .or(`id.eq.${orderId},id.ilike.%${orderId}%`)
        .single();

      if (error || !data) {
        toast.error('Order not found. Please check the ID and try again.');
        setOrder(null);
      } else {
        setOrder(data);
      }
    } catch (err) {
      toast.error('Failed to track order');
    } finally {
      setIsLoading(false);
    }
  };

  const steps = [
    { status: 'pending', label: 'Order Placed', icon: <Clock />, description: 'We have received your order' },
    { status: 'processing', label: 'Processing', icon: <Package />, description: 'Your order is being prepared' },
    { status: 'shipped', label: 'In Transit', icon: <Truck />, description: 'Your order is on the way' },
    { status: 'completed', label: 'Delivered', icon: <CheckCircle />, description: 'Order has been delivered' },
  ];

  const currentStepIndex = steps.findIndex(s => s.status === order?.status);

  return (
    <div className="min-h-[80vh] pt-24 pb-12 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent">
            Track Your Order
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Enter your order ID to get real-time updates on your shipment status.
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-8 mb-8"
        >
          <form onSubmit={handleTrack} className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input 
                type="text" 
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="Enter Order ID (e.g., #ORD-12345)"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <button 
              type="submit"
              disabled={isLoading}
              className="bg-primary text-white px-8 py-4 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Track Status'}
            </button>
          </form>
        </motion.div>

        <AnimatePresence mode="wait">
          {order && (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              {/* Status Stepper */}
              <div className="glass-card p-8">
                <div className="flex flex-col md:flex-row justify-between gap-8">
                  {steps.map((step, index) => {
                    const isCompleted = index <= currentStepIndex;
                    const isCurrent = index === currentStepIndex;
                    
                    return (
                      <div key={step.status} className="flex-1 relative">
                        <div className="flex flex-col items-center text-center gap-3">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
                            isCompleted ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-muted-foreground'
                          } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}>
                            {step.icon}
                          </div>
                          <div>
                            <p className={`font-bold text-sm ${isCompleted ? 'text-white' : 'text-muted-foreground'}`}>
                              {step.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {step.description}
                            </p>
                          </div>
                        </div>
                        {index < steps.length - 1 && (
                          <div className="hidden md:block absolute top-6 left-[60%] w-[80%] h-[2px] bg-white/5">
                            <div 
                              className="h-full bg-primary transition-all duration-500" 
                              style={{ width: index < currentStepIndex ? '100%' : '0%' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Order Info */}
                <div className="md:col-span-2 glass-card p-8">
                  <h3 className="text-xl font-bold mb-6">Order Details</h3>
                  <div className="space-y-4">
                    {order.order_items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-4 py-4 border-b border-white/5 last:border-0">
                        <img 
                          src={item.products?.image_url} 
                          alt={item.products?.title} 
                          className="w-16 h-20 rounded-lg object-cover bg-white/5"
                        />
                        <div className="flex-1">
                          <p className="font-bold">{item.products?.title}</p>
                          <p className="text-sm text-muted-foreground">Qty: {item.quantity}</p>
                        </div>
                        <p className="font-bold text-primary">KES {item.price * item.quantity}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-white/5 flex justify-between items-center">
                    <p className="text-muted-foreground font-bold text-lg">Total Amount</p>
                    <p className="text-2xl font-bold text-primary">KES {order.total_amount}</p>
                  </div>
                </div>

                {/* Delivery Info */}
                <div className="glass-card p-8 h-fit">
                  <h3 className="text-xl font-bold mb-6">Shipping Info</h3>
                  <div className="space-y-6">
                    <div className="flex gap-3">
                      <Package className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Order ID</p>
                        <p className="font-medium">#ORD-{order.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <MapPin className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Delivery Address</p>
                        <p className="font-medium">{order.full_name}</p>
                        <p className="text-sm text-muted-foreground">{order.address}</p>
                        <p className="text-sm text-muted-foreground">{order.city}</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Clock className="w-5 h-5 text-primary shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Estimated Delivery</p>
                        <p className="font-medium">2-3 Business Days</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {!order && !isLoading && orderId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20 glass-card"
            >
              <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-20" />
              <h3 className="text-xl font-bold mb-2">No results found</h3>
              <p className="text-muted-foreground">Please double check your order ID and try again.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const MapPin = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
);
