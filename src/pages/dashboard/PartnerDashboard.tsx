import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  Package, Truck, CheckCircle, Clock, 
  MapPin, DollarSign,
  AlertCircle, ChevronRight, Search, Loader2
} from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { getPartnerPayouts, getOrders } from '@/api/dashboards';
import { toast } from 'sonner';

export default function PartnerDashboard() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [payoutData, orders] = await Promise.all([
        getPartnerPayouts(user.id),
        getOrders() // Ideally filtered by partner zone/id
      ]);
      setPayouts(payoutData);
      setAssignments(orders);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const pendingPayout = payouts.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const deliveredCount = assignments.filter(o => o.status === 'completed').length;
    
    return [
      { label: 'Active Shipments', value: assignments.filter(o => o.status === 'processing').length.toString(), icon: <Truck />, color: 'text-blue-500' },
      { label: 'Delivered (MTD)', value: deliveredCount.toString(), icon: <CheckCircle />, color: 'text-green-500' },
      { label: 'Pending Payout', value: formatPrice(pendingPayout), icon: <DollarSign />, color: 'text-orange-500' },
      { label: 'Avg. Delivery Time', value: '1.2 Days', icon: <Clock />, color: 'text-purple-500' },
    ];
  }, [payouts, assignments, formatPrice]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Partner Logistics
          </h1>
          <p className="text-muted-foreground">Manage fulfillment and track service performance</p>
        </div>
        <div className="flex gap-3">
          <button className="glass px-6 py-3 rounded-2xl font-bold hover:bg-white/10 transition-all">
            Service Settings
          </button>
          <button className="bg-primary text-white px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-primary/20">
            Request Payout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass p-6 rounded-3xl"
          >
            <div className={`p-3 rounded-2xl bg-white/5 w-fit mb-4 ${stat.color}`}>
              {stat.icon}
            </div>
            <p className="text-muted-foreground text-sm mb-1">{stat.label}</p>
            <h3 className="text-2xl font-bold">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-3xl overflow-hidden"
          >
            <div className="p-8 border-b border-white/10 bg-white/5 flex flex-col md:flex-row justify-between gap-4">
              <h3 className="font-bold text-xl">Active Assignments</h3>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Order ID..." 
                  className="glass pl-10 pr-4 py-2 rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {assignments.slice(0, 5).map(order => (
                <div key={order.id} className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-white/5 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 glass rounded-xl text-primary">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold">#ORD-{order.id.slice(0, 8).toUpperCase()}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {order.city}, {order.address}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
                    <div className="text-right">
                      <p className={`text-xs font-bold uppercase ${
                        order.status === 'completed' ? 'text-green-500' :
                        order.status === 'processing' ? 'text-blue-500' :
                        'text-orange-500'
                      }`}>{order.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <button className="glass p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-primary">
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {assignments.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  No assignments found.
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-8 rounded-3xl"
          >
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <AlertCircle className="text-orange-500 w-5 h-5" />
              Service Alerts
            </h3>
            <div className="space-y-4">
              <div className="p-4 glass rounded-2xl bg-orange-500/5 border border-orange-500/10">
                <p className="text-sm font-bold mb-1">Heavy Rain Alert</p>
                <p className="text-xs text-muted-foreground">Expect delays in Nairobi CBD area due to weather conditions.</p>
              </div>
              <div className="p-4 glass rounded-2xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-bold mb-1">System Update</p>
                <p className="text-xs text-muted-foreground">App update scheduled for 2:00 AM. Fulfillment will be offline for 30 mins.</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-8 rounded-3xl"
          >
            <h3 className="font-bold mb-6">Service Level (SLA)</h3>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>ON-TIME DELIVERY</span>
                  <span className="text-green-500">98%</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full w-[98%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span>CUSTOMER RATING</span>
                  <span className="text-primary">4.9/5.0</span>
                </div>
                <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[92%]" />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
