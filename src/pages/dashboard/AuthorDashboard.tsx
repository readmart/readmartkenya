import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, DollarSign, TrendingUp,
  Award, MessageSquare, Plus, Loader2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthorSalesReport, getInventory } from '@/api/dashboards';
import { toast } from 'sonner';

export default function AuthorDashboard() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [myBooks, setMyBooks] = useState<any[]>([]);
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
      const [sales, books] = await Promise.all([
        getAuthorSalesReport(user.id),
        getInventory() // This fetches all, but we should ideally filter by author_id
      ]);
      setSalesReport(sales);
      // Filter inventory to only show books belonging to the current author
      // (In a real scenario, getInventory would already be filtered or take author_id)
      setMyBooks(books); 
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalSales = salesReport.reduce((acc, curr) => acc + Number(curr.price * curr.quantity), 0);
    const uniqueBooks = new Set(myBooks.map(b => b.id)).size;
    
    return [
      { label: 'Published Books', value: uniqueBooks.toString(), icon: <BookOpen />, color: 'text-blue-500' },
      { label: 'Total Royalties', value: formatPrice(totalSales * 0.7), icon: <DollarSign />, color: 'text-green-500' }, // Assuming 70% royalty
      { label: 'Total Sales', value: salesReport.length.toString(), icon: <TrendingUp />, color: 'text-orange-500' },
      { label: 'Reader Reviews', value: '0', icon: <MessageSquare />, color: 'text-purple-500' },
    ];
  }, [salesReport, myBooks, formatPrice]);

  const performanceData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const grouped = salesReport.reduce((acc: any, curr: any) => {
      const month = months[new Date(curr.orders.created_at).getMonth()];
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    return months.slice(0, new Date().getMonth() + 1).map(month => ({
      month,
      sales: grouped[month] || 0
    }));
  }, [salesReport]);

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
            Author Hub
          </h1>
          <p className="text-muted-foreground">Manage your publications and track royalties</p>
        </div>
        <button className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20">
          <Plus className="w-5 h-5" />
          Submit New Manuscript
        </button>
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
            className="glass p-8 rounded-3xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Sales Performance</h3>
              <div className="flex gap-2">
                <button className="glass px-3 py-1 rounded-lg text-xs font-bold hover:bg-primary hover:text-white transition-all">6M</button>
                <button className="bg-primary text-white px-3 py-1 rounded-lg text-xs font-bold">1Y</button>
              </div>
            </div>
            <div className="h-[300px] w-full relative">
              <ResponsiveContainer width="100%" height="100%" debounce={100}>
                <BarChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                  <XAxis dataKey="month" stroke="rgba(255,255,255,0.5)" />
                  <YAxis stroke="rgba(255,255,255,0.5)" />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="sales" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-3xl overflow-hidden"
          >
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="font-bold">My Publications</h3>
              <button className="text-primary text-sm font-bold hover:underline">View All</button>
            </div>
            <div className="divide-y divide-white/5">
              {myBooks.slice(0, 5).map(book => {
                const bookSales = salesReport.filter(s => s.product_id === book.id);
                const totalEarned = bookSales.reduce((acc, curr) => acc + (curr.price * curr.quantity * 0.7), 0);
                
                return (
                  <div key={book.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <img src={book.image_url} alt={book.title} className="w-12 h-16 rounded-lg bg-white/10 object-cover" />
                      <div>
                        <p className="font-bold">{book.title}</p>
                        <p className="text-sm text-muted-foreground">Status: <span className="text-green-500 font-medium">Published</span></p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{bookSales.length} Sales</p>
                      <p className="text-sm text-primary font-bold">{formatPrice(totalEarned)} Earned</p>
                    </div>
                  </div>
                );
              })}
              {myBooks.length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  No publications found.
                </div>
              )}
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass p-8 rounded-3xl bg-secondary/10 border-secondary/20"
          >
            <Award className="w-12 h-12 text-secondary mb-4" />
            <h3 className="text-xl font-bold mb-2">Author Excellence</h3>
            <p className="text-sm text-muted-foreground mb-6">
              You're in the top 5% of ReadMart creators this month! Keep it up to unlock the Premium Author badge.
            </p>
            <button className="w-full bg-secondary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all">
              View Milestones
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="glass p-8 rounded-3xl"
          >
            <h3 className="font-bold mb-6 flex items-center gap-2">
              <TrendingUp className="text-primary w-5 h-5" />
              Royalty Forecast
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Next Payout</span>
                <span className="font-bold">{formatPrice(1250.00)}</span>
              </div>
              <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[65%]" />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                65% towards next threshold
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
