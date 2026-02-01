import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Package, ChevronRight, Calendar, CreditCard, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function OrderHistory() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount,
          status,
          created_at,
          order_items (
            product_snapshot
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Order History</h1>

        {orders.length === 0 ? (
          <div className="glass p-12 rounded-[3rem] text-center">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-20" />
            <h3 className="text-xl font-bold mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-8">You haven't placed any orders yet.</p>
            <Link to="/shop" className="bg-primary text-white px-8 py-4 rounded-2xl font-bold">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass p-8 rounded-3xl"
              >
                <div className="flex flex-col md:flex-row justify-between gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <Package className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">#ORD-{order.id.slice(0, 8).toUpperCase()}</h3>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(order.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-4 h-4" />
                            {formatPrice(order.total_amount)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {order.order_items?.map((item: any, i: number) => (
                        <span key={i} className="glass px-3 py-1 rounded-full text-xs font-medium">
                          {item.product_snapshot?.title || 'Product'}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center gap-4">
                    <span className={`px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest ${
                      order.status === 'completed' || order.status === 'delivered' || order.status === 'paid'
                        ? 'bg-green-500/20 text-green-500' 
                        : order.status === 'cancelled' || order.status === 'failed'
                        ? 'bg-red-500/20 text-red-500'
                        : 'bg-orange-500/20 text-orange-500'
                    }`}>
                      {order.status}
                    </span>
                    <Link 
                      to={`/track-order?id=${order.id}`}
                      className="flex items-center gap-1 text-primary font-bold hover:underline group"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
