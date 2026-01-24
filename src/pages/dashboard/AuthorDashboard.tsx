import { motion } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, DollarSign, TrendingUp,
  Award, MessageSquare, Plus, Loader2, Shield,
  FileCheck, Star
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAuthorSalesReport, 
  getInventory, 
  getSiteSettings,
  getAuthorPayouts,
  getAuthorReviews
} from '@/api/dashboards';
import { toast } from 'sonner';
import AgreementsSection from '@/components/dashboard/AgreementsSection';

export default function AuthorDashboard() {
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
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
      const [sales, books, siteSettings, payoutData, reviewsData] = await Promise.all([
        getAuthorSalesReport(user.id),
        getInventory(user.id),
        getSiteSettings(),
        getAuthorPayouts(user.id),
        getAuthorReviews(user.id)
      ]);
      setSalesReport(sales);
      setMyBooks(books); 
      setSettings(siteSettings);
      setPayouts(payoutData);
      setReviews(reviewsData);
    } catch (error) {
      toast.error('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalRoyalties = payouts.reduce((acc, curr) => acc + Number(curr.amount), 0);
    const uniqueBooks = new Set(myBooks.map(b => b.id)).size;
    
    return [
      { label: 'Published Books', value: uniqueBooks.toString(), icon: <BookOpen />, color: 'text-blue-500' },
      { label: 'Total Royalties', value: formatPrice(totalRoyalties), icon: <DollarSign />, color: 'text-green-500' },
      { label: 'Total Sales', value: salesReport.length.toString(), icon: <TrendingUp />, color: 'text-orange-500' },
      { label: 'Reader Reviews', value: reviews.length.toString(), icon: <MessageSquare />, color: 'text-purple-500' },
    ];
  }, [payouts, myBooks, formatPrice, salesReport, reviews]);

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
            <div className="h-[400px] w-full min-h-[400px] relative">
              <ResponsiveContainer width="100%" height="100%" minHeight={400} debounce={100}>
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
                const authorRate = (settings?.author_commission_rate || 70) / 100;
                const totalEarned = bookSales.reduce((acc, curr) => acc + (curr.price * curr.quantity * authorRate), 0);
                
                return (
                  <div key={book.id} className="p-6 flex items-center justify-between hover:bg-white/5 transition-all">
                    <div className="flex items-center gap-4">
                      <img src={book.image_url} alt={book.title} className="w-12 h-16 rounded-lg bg-white/10 object-cover" />
                      <div>
                        <p className="font-bold">{book.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-sm text-muted-foreground">Status: <span className="text-green-500 font-medium">Published</span></p>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold uppercase tracking-wider flex items-center gap-1">
                             {book.type === 'ebook' ? (
                               <>
                                 <BookOpen className="w-3 h-3" />
                                 E-Book
                                 {book.metadata?.ebook_password && (
                                   <Shield className="w-2.5 h-2.5 text-primary/60" title={`Password Protected: ${book.metadata.ebook_password}`} />
                                 )}
                               </>
                             ) : 'Physical'}
                           </span>
                        </div>
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

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-8 rounded-3xl"
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold">Reader Feedback</h3>
              <button className="text-primary text-sm font-bold hover:underline">View All Reviews</button>
            </div>
            <div className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                        {review.profile?.full_name?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{review.profile?.full_name || 'Anonymous Reader'}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'text-secondary fill-secondary' : 'text-white/10'}`} />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs font-bold text-primary mb-1 italic">on {review.product?.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                </div>
              ))}
              {reviews.length === 0 && (
                <div className="py-8 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No reader feedback yet. Keep writing!</p>
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
              Royalty Ledger
            </h3>
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Payout</span>
                <span className="font-bold text-orange-500">
                  {formatPrice(payouts.filter(p => p.payout_status === 'pending').reduce((acc, p) => acc + Number(p.amount), 0))}
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
                      <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                      <span className={`font-bold ${p.payout_status === 'paid' ? 'text-green-500' : 'text-orange-500'}`}>
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
        </div>
      </div>

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
            <h2 className="text-2xl font-bold">Publishing Agreements</h2>
            <p className="text-muted-foreground text-sm">Review and sign your digital contracts and publishing terms</p>
          </div>
        </div>
        <AgreementsSection userId={user?.id || ''} type="author" />
      </motion.div>
    </div>
  );
}
