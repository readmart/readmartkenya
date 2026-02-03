import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  Package, Truck, CheckCircle, 
  MapPin, DollarSign,
  AlertCircle, ChevronRight, Search, Loader2,
  FileCheck, MessageSquare, BookOpen, ExternalLink,
  Zap, XCircle, Plus, Award, Shield
} from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getPartnerPayouts, 
  getOrders,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod
} from '@/api/dashboards';
import { toast } from 'sonner';
import AgreementsSection from '@/components/dashboard/AgreementsSection';

export default function PartnerDashboard() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingMpesa, setIsAddingMpesa] = useState(false);
  const [newMpesaNumber, setNewMpesaNumber] = useState('');
  const [isSubmittingMpesa, setIsSubmittingMpesa] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [payoutData, orders, methods] = await Promise.all([
        getPartnerPayouts(user.id),
        getOrders(user.id),
        getPaymentMethods(user.id)
      ]);
      setPayouts(payoutData);
      setAssignments(orders);
      setPaymentMethods(methods || []);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMpesa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMpesaNumber || !user) return;

    // Basic validation
    let cleanNumber = newMpesaNumber.replace(/\D/g, '');
    if (cleanNumber.startsWith('0')) {
      cleanNumber = '254' + cleanNumber.substring(1);
    }
    
    if (!/^254\d{9}$/.test(cleanNumber)) {
      toast.error('Please enter a valid M-Pesa number (e.g., 254712345678)');
      return;
    }

    setIsSubmittingMpesa(true);
    try {
      await addPaymentMethod({
        type: 'mpesa',
        details: { phone: cleanNumber },
        is_default: paymentMethods.length === 0
      });
      toast.success('M-Pesa number added successfully');
      setNewMpesaNumber('');
      setIsAddingMpesa(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add M-Pesa number');
    } finally {
      setIsSubmittingMpesa(false);
    }
  };

  const handleDeleteMpesa = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment method?')) return;
    try {
      await deletePaymentMethod(id);
      toast.success('Payment method removed');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove payment method');
    }
  };

  const handleSetDefaultMpesa = async (id: string) => {
    try {
      await setDefaultPaymentMethod(id);
      toast.success('Default payment method updated');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update default method');
    }
  };

  const hasDefaultMpesa = useMemo(() => {
    return paymentMethods.some(m => m.type === 'mpesa' && m.is_default);
  }, [paymentMethods]);

  const stats = useMemo(() => {
    const totalPayouts = payouts.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const deliveredCount = assignments.filter(o => o.status === 'completed').length;
    
    return [
      { label: 'Active Shipments', value: assignments.filter(o => o.status === 'processing').length.toString(), icon: <Truck />, color: 'text-blue-500' },
      { label: 'Delivered (Total)', value: deliveredCount.toString(), icon: <CheckCircle />, color: 'text-green-500' },
      { label: 'Total Earnings', value: formatPrice(totalPayouts), icon: <DollarSign />, color: 'text-orange-500' },
      { label: 'Performance Score', value: '98%', icon: <Zap />, color: 'text-purple-500' },
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
      <AnimatePresence>
        {!hasDefaultMpesa && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 overflow-hidden"
          >
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-xl text-orange-500">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-orange-500">Action Required: Payment Method Missing</h4>
                  <p className="text-sm text-muted-foreground">You haven't set a default M-Pesa number for commissions. Payouts will be held until configured.</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  const el = document.getElementById('payment-methods-section');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-bold hover:bg-orange-600 transition-colors whitespace-nowrap"
              >
                Setup Now
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Partner Portal
          </h1>
          <p className="text-muted-foreground">Logistics management, performance metrics, and resources</p>
        </div>
        <div className="flex gap-3">
          <a 
            href="mailto:founder@readmart.com"
            className="glass px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <MessageSquare className="w-5 h-5" />
            Contact Founder
          </a>
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

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-8 rounded-3xl"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold">Partner Resource Library</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold">Shipping Guidelines</h4>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Standard operating procedures for order fulfillment and packaging.</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all cursor-pointer group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-bold">Partner Brand Assets</h4>
                  <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Official logos, fonts, and marketing materials for your local hub.</p>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-8 rounded-3xl"
          >
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <DollarSign className="text-primary w-5 h-5" />
              Commission Ledger
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Payout</span>
                <span className="font-bold text-orange-500">
                  {formatPrice(payouts.filter(p => p.payout_status === 'pending').reduce((acc, p) => acc + Number(p.amount), 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Processing</span>
                <span className="font-bold text-blue-500">
                  {formatPrice(payouts.filter(p => p.payout_status === 'processing').reduce((acc, p) => acc + Number(p.amount), 0))}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Paid to Date</span>
                <span className="font-bold text-green-500">
                  {formatPrice(payouts.filter(p => p.payout_status === 'paid').reduce((acc, p) => acc + Number(p.amount), 0))}
                </span>
              </div>
              
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">Recent Payouts</p>
                <div className="space-y-3">
                  {payouts.slice(0, 3).map(p => (
                    <div key={p.id} className="flex justify-between items-center text-xs">
                      <div className="flex flex-col">
                        <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                        <span className={`text-[9px] uppercase font-bold ${
                          p.payout_status === 'paid' ? 'text-green-500' : 
                          p.payout_status === 'processing' ? 'text-blue-500' : 
                          p.payout_status === 'failed' ? 'text-red-500' :
                          'text-orange-500'
                        }`}>
                          {p.payout_status}
                        </span>
                      </div>
                      <span className={`font-bold ${
                        p.payout_status === 'paid' ? 'text-green-500' : 
                        p.payout_status === 'processing' ? 'text-blue-500' : 
                        p.payout_status === 'failed' ? 'text-red-500' :
                        'text-orange-500'
                      }`}>
                        {formatPrice(p.amount)}
                      </span>
                    </div>
                  ))}
                  {payouts.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No payout history yet</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

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

      {/* Payment Methods Section */}
      <motion.div 
        id="payment-methods-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 glass p-8 rounded-3xl"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-secondary/10 text-secondary">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Payment Methods</h2>
              <p className="text-muted-foreground text-sm">Manage where you receive your partnership commissions</p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsAddingMpesa(!isAddingMpesa)}
            className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-2xl font-bold hover:opacity-90 transition-all shadow-lg shadow-secondary/20"
          >
            {isAddingMpesa ? <XCircle className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            {isAddingMpesa ? 'Cancel' : 'Add M-Pesa Number'}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* List of existing methods */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Configured Methods</h3>
            {paymentMethods.length > 0 ? (
              paymentMethods.map((method) => (
                <div 
                  key={method.id}
                  className={`p-6 rounded-2xl border transition-all ${
                    method.is_default 
                      ? 'bg-secondary/5 border-secondary/20 ring-1 ring-secondary/20' 
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${method.is_default ? 'bg-secondary text-white' : 'bg-white/10 text-muted-foreground'}`}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold flex items-center gap-2">
                          M-Pesa: {method.details?.phone}
                          {method.is_default && (
                            <span className="text-[10px] bg-secondary text-white px-2 py-0.5 rounded-full uppercase tracking-tighter">Default</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">Added {new Date(method.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!method.is_default && (
                        <button 
                          onClick={() => handleSetDefaultMpesa(method.id)}
                          className="p-2 hover:bg-secondary/20 rounded-lg text-secondary transition-colors"
                          title="Set as Default"
                        >
                          <Award className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDeleteMpesa(method.id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-500 transition-colors"
                        title="Remove"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
                <p className="text-sm text-muted-foreground italic">No payment methods configured yet.</p>
              </div>
            )}
          </div>

          {/* Add New Method Form */}
          <AnimatePresence>
            {isAddingMpesa && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="p-8 rounded-3xl bg-secondary/5 border border-secondary/10"
              >
                <h3 className="font-bold mb-6 flex items-center gap-2">
                  <Plus className="text-secondary w-5 h-5" />
                  Register M-Pesa Number
                </h3>
                <form onSubmit={handleAddMpesa} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">M-Pesa Phone Number</label>
                    <input 
                      type="tel" 
                      value={newMpesaNumber}
                      onChange={(e) => setNewMpesaNumber(e.target.value)}
                      placeholder="e.g. 254712345678"
                      className="w-full px-6 py-4 bg-white/5 rounded-2xl border border-white/10 outline-none focus:ring-2 focus:ring-secondary/20 font-bold"
                      required
                    />
                    <p className="text-[10px] text-muted-foreground mt-2 px-2">Format: 254XXXXXXXXX or 07XXXXXXXX</p>
                  </div>
                  
                  <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20 mb-6">
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-1">Important Note</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Ensure this number is registered for M-Pesa. ReadMart is not responsible for funds sent to incorrect or unregistered numbers.
                    </p>
                  </div>

                  <button 
                    type="submit"
                    disabled={isSubmittingMpesa}
                    className="w-full bg-secondary text-white py-4 rounded-2xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingMpesa ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Save Payment Method'
                    )}
                  </button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Agreements System */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-12 glass p-8 rounded-3xl"
      >
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 rounded-2xl bg-primary/10 text-primary">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Partnership Agreements</h2>
            <p className="text-muted-foreground text-sm">Review and sign your digital contracts and partnership terms</p>
          </div>
        </div>
        <AgreementsSection userId={user?.id || ''} type="partner" />
      </motion.div>
    </div>
  );
}
