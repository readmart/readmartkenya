import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, DollarSign, TrendingUp,
  Award, MessageSquare, Plus, Loader2, Shield,
  FileCheck, Star, XCircle, Image as ImageIcon, FileUp,
  Edit, Users, Rss, CreditCard, AlertCircle
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { 
  getAuthorSalesReport, 
  getInventory, 
  getSiteSettings,
  getAuthorPayouts,
  getAuthorReviews,
  getCategories,
  getPaymentMethods,
  addPaymentMethod,
  deletePaymentMethod,
  setDefaultPaymentMethod,
  createProduct,
  updateProduct,
  getAuthorEarnings,
  getAuthorDrops,
  createAuthorDrop,
  requestAuthorPayout,
  getAuthorSubscriptions
} from '@/api/dashboards';
import { uploadProductImage, uploadEbookFile, uploadProfileImage } from '@/api/storage';
import { toast } from 'sonner';
import AgreementsSection from '@/components/dashboard/AgreementsSection';

export default function AuthorDashboard() {
  const { formatPrice } = useCurrency();
  const { user, profile, updateProfile } = useAuth();
  const [salesReport, setSalesReport] = useState<any[]>([]);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [drops, setDrops] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldRenderChart, setShouldRenderChart] = useState(false);
  const [isUploadingProfile, setIsUploadingProfile] = useState(false);
  const [isAddingMpesa, setIsAddingMpesa] = useState(false);
  const [newMpesaNumber, setNewMpesaNumber] = useState('');
  const [isSubmittingMpesa, setIsSubmittingMpesa] = useState(false);

  // Drops & Payouts State
  const [isDropModalOpen, setIsDropModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [isSubmittingDrop, setIsSubmittingDrop] = useState(false);
  const [isSubmittingPayout, setIsSubmittingPayout] = useState(false);
  const [dropFormData, setDropFormData] = useState({
    title: '',
    description: '',
    type: 'content', // 'content', 'perk', 'exclusive'
    content_url: '',
    is_public: true,
    price: 0
  });
  const [payoutAmount, setPayoutAmount] = useState('');

  useEffect(() => {
    // Component mount logic
    const timer = setTimeout(() => setShouldRenderChart(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingProfile(true);
    const loadingToast = toast.loading('Uploading profile picture...');
    try {
      const url = await uploadProfileImage(file, {
        path: `authors/${user.id}`
      });
      
      const { error } = await updateProfile({ avatar_url: url });
      if (error) throw error;
      
      toast.success('Profile picture updated!', { id: loadingToast });
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload profile picture', { id: loadingToast });
    } finally {
      setIsUploadingProfile(false);
    }
  };

  // Modal & Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    author_id: '',
    price: '',
    sale_price: '',
    stock_quantity: '0',
    category_id: '',
    image_url: '',
    description: '',
    type: 'ebook', // Default to ebook for authors
    is_active: true,
    ebook_url: '',
    metadata: {} as any
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [sales, books, siteSettings, payoutData, reviewsData, cats, methods, subsData, earningsData, dropsData] = await Promise.all([
        getAuthorSalesReport(user.id),
        getInventory(user.id),
        getSiteSettings(),
        getAuthorPayouts(user.id),
        getAuthorReviews(user.id),
        getCategories(),
        getPaymentMethods(user.id),
        getAuthorSubscriptions(user.id),
        getAuthorEarnings(user.id),
        getAuthorDrops(user.id)
      ]);
      setSalesReport(sales);
      setMyBooks(books); 
      setSettings(siteSettings);
      setPayouts(payoutData);
      setReviews(reviewsData);
      setCategories(cats || []);
      setPaymentMethods(methods || []);
      setSubscriptions(subsData || []);
      setEarnings(earningsData);
      setDrops(dropsData || []);
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
        is_default: paymentMethods.length === 0 // Make default if it's the first one
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

  const handleCreateDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmittingDrop(true);
    const loadingToast = toast.loading('Releasing drop...');
    try {
      await createAuthorDrop(dropFormData);
      toast.success('Drop released successfully!', { id: loadingToast });
      setIsDropModalOpen(false);
      setDropFormData({
        title: '',
        description: '',
        type: 'content',
        content_url: '',
        is_public: true,
        price: 0
      });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to release drop', { id: loadingToast });
    } finally {
      setIsSubmittingDrop(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !payoutAmount) return;

    const amount = parseFloat(payoutAmount);
    const balance = earnings?.current_balance || 0;

    if (amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (amount > balance) {
      toast.error('Insufficient balance');
      return;
    }

    const defaultMethod = paymentMethods.find(m => m.is_default);
    if (!defaultMethod) {
      toast.error('Please set a default payment method first');
      return;
    }

    setIsSubmittingPayout(true);
    const loadingToast = toast.loading('Submitting payout request...');
    try {
      await requestAuthorPayout(user.id, amount, {
        payment_method_id: defaultMethod.id,
        method_type: defaultMethod.type,
        identifier: defaultMethod.identifier || defaultMethod.details?.phone
      });
      toast.success('Payout request submitted!', { id: loadingToast });
      setIsPayoutModalOpen(false);
      setPayoutAmount('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to request payout', { id: loadingToast });
    } finally {
      setIsSubmittingPayout(false);
    }
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      author: user?.user_metadata?.full_name || '',
      author_id: user?.id || '',
      price: '',
      sale_price: '',
      stock_quantity: '0',
      category_id: categories[0]?.id || '',
      image_url: '',
      description: '',
      type: 'ebook',
      is_active: true,
      ebook_url: '',
      metadata: {}
    });
    setIsModalOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    const ebookUrl = item.ebook_metadata?.[0]?.file_path || item.ebook_url || '';
    
    setFormData({
      title: item.title || '',
      author: item.author || '',
      author_id: item.author_id || '',
      price: item.price || '',
      sale_price: item.sale_price || '',
      stock_quantity: item.stock_quantity || '0',
      category_id: item.category_id || '',
      image_url: item.image_url || '',
      description: item.description || '',
      type: item.type || 'ebook',
      is_active: item.is_active ?? true,
      ebook_url: ebookUrl,
      metadata: item.metadata || {}
    });
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const loadingToast = toast.loading('Uploading cover imagery...');
    try {
      const url = await uploadProductImage(file, {
        path: `authors/${user?.id}`,
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, cover: percent }));
        }
      });
      setFormData({ ...formData, image_url: url });
      toast.success('Cover imagery synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, cover: 0 })), 2000);
    } catch (error) {
      toast.error('Upload failed', { id: loadingToast });
    }
  };

  const handleEbookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/epub+zip'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a PDF or EPUB file');
      return;
    }

    const loadingToast = toast.loading('Uploading secure digital asset...');
    try {
      const identifier = editingItem?.id || `temp_${Date.now()}`;
      const path = await uploadEbookFile(file, identifier, {
        path: `authors/${user?.id}`,
        onProgress: (progress) => {
          const percent = Math.round((progress.loaded / progress.total) * 100);
          setUploadProgress(prev => ({ ...prev, ebook: percent }));
        }
      });
      setFormData({ ...formData, ebook_url: path });
      toast.success('Digital asset synchronized', { id: loadingToast });
      setTimeout(() => setUploadProgress(prev => ({ ...prev, ebook: 0 })), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Upload failed', { id: loadingToast });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const loadingToast = toast.loading(editingItem ? 'Updating Manuscript...' : 'Submitting Manuscript...');
    try {
      const { ...rawFormData } = formData;

      const productPayload = {
        ...rawFormData,
        price: parseFloat(formData.price) || 0,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        category_id: formData.category_id || null,
        author_id: user.id, // Ensure it's the current user
        author: user.user_metadata?.full_name || 'Unknown Author',
        type: formData.type,
        ebook_url: formData.ebook_url, 
        ebook_metadata: formData.type === 'ebook' ? {
          file_path: formData.ebook_url,
          format: formData.ebook_url.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf',
        } : null
      };

      if (editingItem) {
        await updateProduct(editingItem.id, productPayload);
        toast.success('Manuscript updated', { id: loadingToast });
      } else {
        await createProduct(productPayload);
        toast.success('Manuscript submitted for review', { id: loadingToast });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Operation failed', { id: loadingToast });
    }
  };

  const stats = useMemo(() => {
    const totalRoyalties = earnings?.total_earned || 0;
    const currentBalance = earnings?.current_balance || 0;
    const uniqueBooks = new Set(myBooks.map(b => b.id)).size;
    const activeSubs = subscriptions.filter(s => s.status === 'active').length;
    
    return [
      { label: 'Published Books', value: uniqueBooks.toString(), icon: <BookOpen />, color: 'text-blue-500' },
      { label: 'Total Earnings', value: formatPrice(totalRoyalties), icon: <DollarSign />, color: 'text-green-500' },
      { label: 'Current Balance', value: formatPrice(currentBalance), icon: <TrendingUp />, color: 'text-orange-500' },
      { label: 'Active Fans', value: activeSubs.toString(), icon: <Users />, color: 'text-purple-500' },
    ];
  }, [earnings, myBooks, formatPrice, subscriptions]);

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

  const hasDefaultMpesa = useMemo(() => {
    return paymentMethods.some(m => m.type === 'mpesa' && m.is_default);
  }, [paymentMethods]);

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
                  <p className="text-sm text-muted-foreground">You haven't set a default M-Pesa number for royalties. Payouts will be held until configured.</p>
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
        <div className="flex items-center gap-6">
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/20 bg-primary/5">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name || 'Author'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-primary font-bold text-2xl">
                  {profile?.full_name?.charAt(0) || 'A'}
                </div>
              )}
              {isUploadingProfile && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <label className="absolute -bottom-2 -right-2 p-1.5 bg-primary text-white rounded-lg cursor-pointer hover:scale-110 transition-transform shadow-lg">
              <ImageIcon className="w-4 h-4" />
              <input type="file" className="hidden" accept="image/*" onChange={handleProfileImageUpload} disabled={isUploadingProfile} />
            </label>
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Author Hub
            </h1>
            <p className="text-muted-foreground">Manage your publications and track royalties</p>
          </div>
        </div>
        <button 
          onClick={handleAddNew}
          className="bg-primary text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
        >
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
            <div className="h-[400px] w-full relative">
              {shouldRenderChart && (
                <ResponsiveContainer width="100%" height="100%">
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
              )}
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
                const totalEarned = bookSales.reduce((acc, curr) => {
                  const price = Number(curr.price_at_purchase || curr.unit_price || 0);
                  const qty = Number(curr.quantity || 0);
                  return acc + (price * qty * authorRate);
                }, 0);
                
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
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-bold">{bookSales.length} Sales</p>
                        <p className="text-sm text-primary font-bold">{formatPrice(totalEarned)} Earned</p>
                      </div>
                      <button 
                        onClick={() => handleEdit(book)}
                        className="p-2 hover:bg-primary hover:text-white rounded-lg transition-all text-muted-foreground"
                        aria-label={`Edit ${book.title}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
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

          {/* Drops & Exclusives Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-8 rounded-3xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold">Drops & Exclusives</h3>
                <p className="text-sm text-muted-foreground">Release exclusive content to your fans</p>
              </div>
              <button 
                onClick={() => setIsDropModalOpen(true)}
                className="p-2 bg-primary text-white rounded-xl hover:scale-105 transition-all shadow-lg shadow-primary/20"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {drops.map((drop) => (
                <div key={drop.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        drop.type === 'exclusive' ? 'bg-purple-500/20 text-purple-500' :
                        drop.type === 'perk' ? 'bg-orange-500/20 text-orange-500' :
                        'bg-blue-500/20 text-blue-500'
                      }`}>
                        {drop.type}
                      </span>
                      {drop.price > 0 && <span className="text-xs font-bold text-green-500">{formatPrice(drop.price)}</span>}
                    </div>
                    <h4 className="font-bold mb-1">{drop.title}</h4>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-4">{drop.description}</p>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{new Date(drop.created_at).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {drop.unlock_count || 0} Unlocks
                    </span>
                  </div>
                </div>
              ))}
              {drops.length === 0 && (
                <div className="col-span-full py-12 text-center text-muted-foreground bg-white/5 rounded-2xl border border-dashed border-white/10">
                  <Rss className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No drops yet. Engage your fans with exclusive content!</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Active Fans Section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass p-8 rounded-3xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h3 className="text-xl font-bold">Active Fans</h3>
                <p className="text-sm text-muted-foreground">Your most dedicated readers</p>
              </div>
              <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                {subscriptions.length} Total
              </span>
            </div>

            <div className="space-y-4">
              {subscriptions.slice(0, 5).map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-secondary font-bold">
                      {sub.subscriber?.avatar_url ? (
                        <img src={sub.subscriber.avatar_url} alt={sub.subscriber.full_name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        sub.subscriber?.full_name?.charAt(0) || 'F'
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{sub.subscriber?.full_name || 'Fan'}</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${
                          sub.tier === 'patron' ? 'bg-purple-500/20 text-purple-500' :
                          sub.tier === 'superfan' ? 'bg-orange-500/20 text-orange-500' :
                          'bg-blue-500/20 text-blue-500'
                        }`}>
                          {sub.tier}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Subscribed {new Date(sub.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-green-500">{formatPrice(sub.amount)}/mo</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest">Active</p>
                  </div>
                </div>
              ))}
              {subscriptions.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>No active fans yet. Promote your profile to grow your community!</p>
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
              
              <button 
                onClick={() => setIsPayoutModalOpen(true)}
                disabled={!earnings?.current_balance || earnings.current_balance <= 0}
                className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:grayscale"
              >
                <CreditCard className="w-4 h-4" />
                Request Payout
              </button>
              
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
              <p className="text-muted-foreground text-sm">Manage where you receive your royalty payouts</p>
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
            <h2 className="text-2xl font-bold">Publishing Agreements</h2>
            <p className="text-muted-foreground text-sm">Review and sign your digital contracts and publishing terms</p>
          </div>
        </div>
        <AgreementsSection userId={user?.id || ''} type="author" />
      </motion.div>

      {/* Upload/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
                    {editingItem ? 'Update Manuscript' : 'Submit Manuscript'}
                  </h2>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ReadMart Author Protocol</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-red-500"
                  aria-label="Close modal"
                >
                  <XCircle className="w-8 h-8" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                <div className="grid md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    <div>
                      <label htmlFor="manuscript_title" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Manuscript Title</label>
                      <input 
                        id="manuscript_title"
                        name="title"
                        required
                        type="text" 
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                        placeholder="e.g. The Great Adventure"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="listing_price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Listing Price (KES)</label>
                        <input 
                          id="listing_price"
                          name="price"
                          required
                          type="number" 
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                          placeholder="950"
                        />
                      </div>
                      <div>
                        <label htmlFor="impact_price" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Impact Price (Optional)</label>
                        <input 
                          id="impact_price"
                          name="sale_price"
                          type="number" 
                          value={formData.sale_price}
                          onChange={(e) => setFormData({...formData, sale_price: e.target.value})}
                          className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                          placeholder="750"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="genre_category" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Genre/Category</label>
                      <select 
                        id="genre_category"
                        name="category_id"
                        required
                        value={formData.category_id}
                        onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900"
                      >
                        <option value="">Select Category</option>
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="manuscript_description" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Abstract/Description</label>
                      <textarea 
                        id="manuscript_description"
                        name="description"
                        required
                        rows={4}
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900 resize-none" 
                        placeholder="Brief summary of your work..."
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label htmlFor="cover_imagery" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Cover Imagery</label>
                      <div className="relative group cursor-pointer">
                        <input 
                          id="cover_imagery"
                          name="image_url"
                          type="file" 
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 z-10 cursor-pointer" 
                          aria-label="Upload book cover imagery"
                        />
                        <div className="w-full aspect-[3/4] bg-slate-50 rounded-[32px] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center p-8 transition-all group-hover:border-primary/20 group-hover:bg-slate-100/50 overflow-hidden relative">
                          {formData.image_url ? (
                            <>
                              <img src={formData.image_url} alt="Cover Preview" className="absolute inset-0 w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center backdrop-blur-sm">
                                <p className="text-white font-black uppercase tracking-tighter text-sm">Replace Cover</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <ImageIcon className="w-8 h-8 text-primary" />
                              </div>
                              <p className="text-sm font-black text-slate-900 uppercase tracking-tighter mb-1">Upload Cover</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">JPG, PNG up to 5MB</p>
                            </>
                          )}
                          
                          {uploadProgress.cover > 0 && uploadProgress.cover < 100 && (
                            <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-8" role="progressbar" aria-valuenow={uploadProgress.cover} aria-valuemin={0} aria-valuemax={100}>
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                                <div 
                                  className="h-full bg-primary transition-all duration-300" 
                                  style={{ width: `${uploadProgress.cover}%` }}
                                />
                              </div>
                              <p className="text-xs font-black text-primary uppercase tracking-tighter">Syncing Imagery {uploadProgress.cover}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="digital_asset" className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Digital Asset (PDF/EPUB)</label>
                      <div className="relative group cursor-pointer">
                        <input 
                          id="digital_asset"
                          name="ebook_url"
                          type="file" 
                          accept=".pdf,.epub"
                          onChange={handleEbookUpload}
                          className="absolute inset-0 opacity-0 z-10 cursor-pointer" 
                          aria-label="Upload manuscript digital asset"
                        />
                        <div className={`w-full p-6 rounded-2xl border-2 border-dashed transition-all flex items-center gap-4 ${
                          formData.ebook_url 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-slate-50 border-slate-100 group-hover:border-primary/20 group-hover:bg-slate-100/50'
                        }`}>
                          <div className={`p-3 rounded-xl ${formData.ebook_url ? 'bg-green-500 text-white' : 'bg-white text-primary shadow-sm'}`}>
                            {formData.ebook_url ? <FileCheck className="w-6 h-6" /> : <FileUp className="w-6 h-6" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-black uppercase tracking-tighter ${formData.ebook_url ? 'text-green-700' : 'text-slate-900'}`}>
                              {formData.ebook_url ? 'Asset Synchronized' : 'Upload Manuscript'}
                            </p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                              {formData.ebook_url ? formData.ebook_url.split('/').pop() : 'PDF or EPUB up to 100MB'}
                            </p>
                          </div>
                        </div>

                        {uploadProgress.ebook > 0 && uploadProgress.ebook < 100 && (
                          <div className="mt-4" role="progressbar" aria-valuenow={uploadProgress.ebook} aria-valuemin={0} aria-valuemax={100}>
                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-300" 
                                style={{ width: `${uploadProgress.ebook}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter mt-2">Uploading Digital Asset: {uploadProgress.ebook}%</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-12 flex gap-4">
                  <button 
                    type="submit"
                    className="flex-1 bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-primary/20"
                  >
                    {editingItem ? 'Update Manuscript' : 'Confirm Submission'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-10 bg-slate-100 text-slate-600 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Release Drop Modal */}
      <AnimatePresence>
        {isDropModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDropModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <div className="mb-8">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Release New Drop</h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Exclusive Creator Protocol</p>
              </div>

              <form onSubmit={handleCreateDrop} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Drop Title</label>
                  <input 
                    required
                    type="text" 
                    value={dropFormData.title}
                    onChange={(e) => setDropFormData({...dropFormData, title: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                    placeholder="e.g. Deleted Scenes: Chapter 5"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Description</label>
                  <textarea 
                    required
                    rows={3}
                    value={dropFormData.description}
                    onChange={(e) => setDropFormData({...dropFormData, description: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900 resize-none" 
                    placeholder="What's inside this drop?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Drop Type</label>
                    <select 
                      value={dropFormData.type}
                      onChange={(e) => setDropFormData({...dropFormData, type: e.target.value})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900"
                    >
                      <option value="content">Content</option>
                      <option value="perk">Perk</option>
                      <option value="exclusive">Exclusive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Price (Optional)</label>
                    <input 
                      type="number" 
                      value={dropFormData.price}
                      onChange={(e) => setDropFormData({...dropFormData, price: parseFloat(e.target.value) || 0})}
                      className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Content URL/Asset</label>
                  <input 
                    type="text" 
                    value={dropFormData.content_url}
                    onChange={(e) => setDropFormData({...dropFormData, content_url: e.target.value})}
                    className="w-full px-6 py-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-bold text-slate-900" 
                    placeholder="Link to file or secret content"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="submit"
                    disabled={isSubmittingDrop}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmittingDrop ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Release Drop'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsDropModalOpen(false)}
                    className="px-8 bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Request Payout Modal */}
      <AnimatePresence>
        {isPayoutModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPayoutModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <div className="mb-8 text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Request Payout</h2>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Available Balance: {formatPrice(earnings?.current_balance || 0)}</p>
              </div>

              <form onSubmit={handleRequestPayout} className="space-y-6">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Payout Amount (KES)</label>
                  <input 
                    required
                    type="number" 
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(e.target.value)}
                    max={earnings?.current_balance || 0}
                    className="w-full px-6 py-6 bg-slate-50 rounded-3xl border-none outline-none focus:ring-2 focus:ring-primary/20 font-black text-3xl text-center text-slate-900" 
                    placeholder="0.00"
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destination</p>
                  {paymentMethods.find(m => m.is_default) ? (
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-secondary/10 text-secondary rounded-lg">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm">M-Pesa: {paymentMethods.find(m => m.is_default)?.details?.phone}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Verified Default Method</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-red-500">
                      <AlertCircle className="w-5 h-5" />
                      <p className="text-xs font-bold">No default payment method set!</p>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex flex-col gap-3">
                  <button 
                    type="submit"
                    disabled={isSubmittingPayout || !paymentMethods.find(m => m.is_default)}
                    className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmittingPayout ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Payout Request'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsPayoutModalOpen(false)}
                    className="w-full bg-slate-100 text-slate-600 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
