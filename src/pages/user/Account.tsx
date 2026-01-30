import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Package, Heart, Settings, LogOut, 
  ChevronRight, MapPin, Phone, Mail, CreditCard,
  Shield, Bell, Clock, Star, Trash2, ShoppingCart,
  Loader2, Briefcase, PenTool, ExternalLink, ShieldCheck
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useWishlist } from '@/contexts/WishlistContext';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase/client';

const getTabs = (isPartner: boolean, isAuthor: boolean) => [
  { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  { id: 'orders', label: 'Orders', icon: <Package className="w-5 h-5" /> },
  { id: 'ebooks', label: 'E-Books', icon: <BookOpen className="w-5 h-5" /> },
  { id: 'wishlist', label: 'Wishlist', icon: <Heart className="w-5 h-5" /> },
  ...(isPartner ? [{ id: 'partner', label: 'Partner Portal', icon: <Briefcase className="w-5 h-5" /> }] : []),
  ...(isAuthor ? [{ id: 'author', label: 'Author Portal', icon: <PenTool className="w-5 h-5" /> }] : []),
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
];

import { BookOpen, Download } from 'lucide-react';
import { getMyEbooks, getEbookAccessUrl } from '@/api/ebooks';

const mockOrders = [
  { id: 'ORD-1234', date: 'Jan 12, 2026', status: 'Delivered', total: 45.99, items: 2 },
  { id: 'ORD-5678', date: 'Jan 05, 2026', status: 'Processing', total: 29.99, items: 1 },
];

export default function Account() {
  const [activeTab, setActiveTab] = useState('profile');
  const [ebooks, setEbooks] = useState<any[]>([]);
  const [isLoadingEbooks, setIsLoadingEbooks] = useState(false);
  const { user, profile, logout, isPartner, isAuthor, updateProfile } = useAuth();

  const tabs = getTabs(isPartner, isAuthor);

  const [isUpdatingPreferences, setIsUpdatingPreferences] = useState(false);

  const toggleSMS = async () => {
    if (isUpdatingPreferences) return;
    setIsUpdatingPreferences(true);
    
    const newPrefs = {
      ...profile?.preferences,
      sms_notifications: !profile?.preferences?.sms_notifications
    };

    const { error } = await updateProfile({ preferences: newPrefs });
    
    if (error) {
      toast.error('Failed to update preferences');
    } else {
      toast.success(`SMS notifications ${newPrefs.sms_notifications ? 'enabled' : 'disabled'}`);
    }
    setIsUpdatingPreferences(false);
  };

  const toggleNewsletter = async () => {
    if (isUpdatingPreferences) return;
    setIsUpdatingPreferences(true);
    
    const newPrefs = {
      ...profile?.preferences,
      newsletter: !profile?.preferences?.newsletter
    };

    const { error } = await updateProfile({ preferences: newPrefs });
    
    if (error) {
      toast.error('Failed to update preferences');
    } else {
      toast.success(`Newsletter ${newPrefs.newsletter ? 'subscribed' : 'unsubscribed'}`);
    }
    setIsUpdatingPreferences(false);
  };

  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [isAddingPayment, setIsAddingPayment] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [newPaymentPhone, setNewPaymentPhone] = useState('');

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      toast.error('New passwords do not match');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ 
        password: passwordForm.new 
      });

      if (error) throw error;

      toast.success('Password updated successfully');
      setIsChangingPassword(false);
      setPasswordForm({ current: '', new: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const fetchPaymentMethods = async () => {
    if (!user) return;
    setIsLoadingPayments(true);
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching payment methods:', error);
        // If it's a 404, it might mean the table doesn't exist or isn't accessible
        if (error.code === 'PGRST204' || error.message.includes('not found')) {
          console.warn('Payment methods table might be missing or inaccessible');
        }
        return;
      }
      
      setPaymentMethods(data || []);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    } finally {
      setIsLoadingPayments(false);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPaymentPhone) return;
    
    setIsAddingPayment(true);
    try {
      const { error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: user.id,
          type: 'mpesa',
          provider: 'Safaricom',
          identifier: newPaymentPhone,
          is_default: paymentMethods.length === 0
        });

      if (error) throw error;

      toast.success('Payment method added successfully');
      setNewPaymentPhone('');
      setIsAddingPayment(false);
      fetchPaymentMethods();
    } catch (err) {
      toast.error('Failed to add payment method');
    } finally {
      setIsAddingPayment(false);
    }
  };

  const deletePaymentMethod = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Payment method removed');
      fetchPaymentMethods();
    } catch (err) {
      toast.error('Failed to remove payment method');
    }
  };

  useEffect(() => {
    if (activeTab === 'ebooks') {
      fetchEbooks();
    }
    if (activeTab === 'settings') {
      fetchPaymentMethods();
    }
  }, [activeTab]);

  const fetchEbooks = async () => {
    setIsLoadingEbooks(true);
    try {
      const data = await getMyEbooks();
      setEbooks(data);
    } catch (error) {
      toast.error('Failed to fetch your e-books');
    } finally {
      setIsLoadingEbooks(false);
    }
  };

  const handleDownload = async (ebookId: string) => {
    try {
      const { url } = await getEbookAccessUrl(ebookId);
      window.open(url, '_blank');
    } catch (error) {
      toast.error('Failed to get download link');
    }
  };
  const { wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { formatPrice } = useCurrency();

  const handleMoveToCart = (item: any) => {
    addToCart(item);
    removeFromWishlist(item.id);
    toast.success(`${item.title} moved to cart!`);
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col lg:flex-row gap-12">
        {/* Sidebar */}
        <aside className="lg:w-80 space-y-8">
          <div className="glass rounded-[2.5rem] p-8 text-center border-white/10">
            <div className="w-24 h-24 rounded-full bg-primary/10 mx-auto mb-6 flex items-center justify-center border-2 border-primary/20">
              <User className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-black mb-1">{profile?.full_name || 'Guest User'}</h2>
            <p className="text-muted-foreground text-sm font-medium mb-6">{user?.email}</p>
            <button 
              onClick={logout}
              className="flex items-center gap-2 text-red-500 font-black text-sm uppercase tracking-widest mx-auto hover:opacity-80 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>

          <nav className="glass rounded-[2.5rem] p-4 border-white/10 overflow-hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all group ${
                  activeTab === tab.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-white/5 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${activeTab === tab.id ? 'text-white' : 'text-primary'}`}>
                    {tab.icon}
                  </div>
                  <span className="font-black uppercase text-xs tracking-widest">{tab.label}</span>
                </div>
                <ChevronRight className={`w-4 h-4 transition-transform ${activeTab === tab.id ? 'rotate-90' : 'group-hover:translate-x-1'}`} />
              </button>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="glass rounded-[3rem] p-8 md:p-12 border-white/10 min-h-[600px]"
            >
              {activeTab === 'profile' && (
                <div className="space-y-12">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">My Profile</h1>
                    <p className="text-muted-foreground font-medium">Manage your personal information and security</p>
                  </header>

                  <div className="grid md:grid-cols-2 gap-8">
                    {profile?.is_member && (
                      <div className="md:col-span-2 glass p-8 rounded-[2rem] border-primary/20 bg-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                            <ShieldCheck className="w-8 h-8" />
                          </div>
                          <div>
                            <h3 className="text-xl font-black uppercase tracking-tight text-primary">Premium Member</h3>
                            <p className="text-sm font-bold text-muted-foreground mt-1">
                              {profile.membership_expires_at ? (
                                <>Valid until {new Date(profile.membership_expires_at).toLocaleDateString()}</>
                              ) : (
                                <>Lifetime Access</>
                              )}
                            </p>
                          </div>
                        </div>
                        <Link 
                          to="/book-club"
                          className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                        >
                          Explore Benefits <ExternalLink className="w-4 h-4" />
                        </Link>
                      </div>
                    )}
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Full Name</label>
                      <div className="glass p-4 rounded-2xl flex items-center gap-4 border-white/5">
                        <User className="w-5 h-5 text-primary" />
                        <span className="font-bold">{profile?.full_name || 'ReadMart User'}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                      <div className="glass p-4 rounded-2xl flex items-center gap-4 border-white/5">
                        <Mail className="w-5 h-5 text-primary" />
                        <span className="font-bold">{user?.email}</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Phone Number</label>
                      <div className="glass p-4 rounded-2xl flex items-center gap-4 border-white/5">
                        <Phone className="w-5 h-5 text-primary" />
                        <span className="font-bold">+254 794 129 958</span>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Location</label>
                      <div className="glass p-4 rounded-2xl flex items-center gap-4 border-white/5">
                        <MapPin className="w-5 h-5 text-primary" />
                        <span className="font-bold">Nairobi, Kenya</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-white/10">
                    <h3 className="text-xl font-black mb-6 uppercase tracking-tight">Account Security</h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="relative">
                        <button 
                          onClick={() => setIsChangingPassword(!isChangingPassword)}
                          className={`w-full glass p-6 rounded-3xl flex items-center gap-6 hover:bg-white/5 transition-all text-left group ${isChangingPassword ? 'border-primary/50' : ''}`}
                        >
                          <div className="p-4 rounded-2xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
                            <Shield className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase tracking-widest mb-1">Password</p>
                            <p className="text-xs text-muted-foreground">Change your account password</p>
                          </div>
                        </button>
                      </div>

                      <div className="relative">
                        <button 
                          onClick={() => {
                            setActiveTab('settings');
                            // Scroll to preferences section if needed
                          }}
                          className="w-full glass p-6 rounded-3xl flex items-center gap-6 hover:bg-white/5 transition-all text-left group"
                        >
                          <div className="p-4 rounded-2xl bg-purple-500/10 text-purple-500 group-hover:scale-110 transition-transform">
                            <Bell className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-black text-sm uppercase tracking-widest mb-1">Notifications</p>
                            <p className="text-xs text-muted-foreground">Manage your alerts & updates</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {isChangingPassword && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-6 overflow-hidden"
                        >
                          <form onSubmit={handlePasswordChange} className="glass p-8 rounded-3xl border-primary/30 space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label htmlFor="new_password" id="label-new_password" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">New Password</label>
                                <input 
                                  id="new_password"
                                  name="new_password"
                                  type="password" 
                                  value={passwordForm.new}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold focus:border-primary/50 outline-none transition-all"
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <label htmlFor="confirm_password" id="label-confirm_password" className="text-xs font-black uppercase tracking-widest text-muted-foreground ml-1">Confirm New Password</label>
                                <input 
                                  id="confirm_password"
                                  name="confirm_password"
                                  type="password" 
                                  value={passwordForm.confirm}
                                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 font-bold focus:border-primary/50 outline-none transition-all"
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-4">
                              <button 
                                type="button"
                                onClick={() => setIsChangingPassword(false)}
                                className="px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/5 transition-all"
                              >
                                Cancel
                              </button>
                              <button 
                                type="submit"
                                disabled={isUpdatingPassword}
                                className="bg-primary text-white px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
                              >
                                {isUpdatingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Update Password
                              </button>
                            </div>
                          </form>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-8">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Order History</h1>
                    <p className="text-muted-foreground font-medium">Track and manage your recent purchases</p>
                  </header>

                  <div className="space-y-4">
                    {mockOrders.map((order) => (
                      <div key={order.id} className="glass p-6 rounded-[2rem] border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/5 transition-all">
                        <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <Package className="w-8 h-8 text-primary" />
                          </div>
                          <div>
                            <p className="font-black text-lg">{order.id}</p>
                            <p className="text-sm text-muted-foreground font-medium">{order.date} • {order.items} items</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="font-black text-xl">{formatPrice(order.total)}</p>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                              order.status === 'Delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'
                            }`}>
                              {order.status}
                            </span>
                          </div>
                          <button className="p-4 glass rounded-2xl hover:bg-primary hover:text-white transition-all">
                            <ChevronRight className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {mockOrders.length === 0 && (
                    <div className="text-center py-20">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Package className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">No orders yet</h3>
                      <p className="text-muted-foreground mb-8">Start shopping to see your orders here.</p>
                      <button className="bg-primary text-white px-8 py-3 rounded-xl font-bold">
                        BROWSE SHOP
                      </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'ebooks' && (
                <div className="space-y-8">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">My Digital Library</h1>
                    <p className="text-muted-foreground font-medium">Access your purchased e-books anytime, anywhere</p>
                  </header>

                  <div className="grid gap-6">
                    {isLoadingEbooks ? (
                      <div className="flex justify-center py-20">
                        <Loader2 className="w-10 h-10 text-primary animate-spin" />
                      </div>
                    ) : ebooks.length > 0 ? (
                      ebooks.map((ebook) => (
                        <div key={ebook.id} className="glass p-6 rounded-[2.5rem] border-white/5 flex flex-col md:flex-row items-center gap-6 group">
                          <div className="w-24 aspect-[3/4] rounded-2xl overflow-hidden flex-shrink-0 bg-white/10">
                            {ebook.products?.image_url ? (
                              <img src={ebook.products.image_url} alt={ebook.products.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <BookOpen className="w-10 h-10 text-primary/20" />
                              </div>
                            )}
                          </div>
                          <div className="flex-grow text-center md:text-left">
                            <h3 className="text-xl font-black mb-1">{ebook.products?.title || 'Untitled E-Book'}</h3>
                            <p className="text-muted-foreground text-sm mb-4">{ebook.products?.author || ebook.products?.metadata?.author || 'Unknown Author'}</p>
                            <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                                PDF
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/5 text-muted-foreground border border-white/10">
                                {new Date(ebook.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => handleDownload(ebook.id)}
                              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                            >
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                            <button 
                              onClick={() => handleDownload(ebook.id)}
                              className="p-3 glass text-primary rounded-xl hover:bg-primary/10 transition-all"
                              title="Read Online"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="glass rounded-[2rem] p-12 text-center border-white/5">
                        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                          <BookOpen className="w-10 h-10 text-primary" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">No e-books yet</h3>
                        <p className="text-muted-foreground mb-8">Purchase e-books from the shop to see them here.</p>
                        <Link to="/shop?category=ebooks" className="bg-primary text-white px-8 py-3 rounded-xl font-bold inline-block">
                          BROWSE E-BOOKS
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'wishlist' && (
                <div className="space-y-8">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">My Wishlist</h1>
                    <p className="text-muted-foreground font-medium">Items you've saved for later</p>
                  </header>

                  <div className="grid gap-6">
                    {wishlistItems.map((item) => (
                      <div key={item.id} className="glass p-6 rounded-[2.5rem] border-white/5 flex flex-col md:flex-row items-center gap-6 group">
                        <Link to={`/book/${item.id}`} className="w-24 aspect-[3/4] rounded-2xl overflow-hidden flex-shrink-0">
                          <img src={item.image} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </Link>
                        <div className="flex-grow text-center md:text-left">
                          <h3 className="text-xl font-black mb-1 hover:text-primary transition-colors">{item.title}</h3>
                          <p className="text-muted-foreground text-sm mb-2">{item.author}</p>
                          <p className="text-primary font-black">{formatPrice(item.price)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => handleMoveToCart(item)}
                            className="p-3 bg-primary text-white rounded-xl hover:scale-105 transition-transform"
                            title="Move to Cart"
                          >
                            <ShoppingCart className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => removeFromWishlist(item.id)}
                            className="p-3 glass text-red-500 rounded-xl hover:bg-red-500/10 transition-all"
                            title="Remove"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {wishlistItems.length === 0 && (
                      <div className="glass rounded-[2rem] p-12 text-center col-span-full border-white/5">
                        <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Heart className="w-10 h-10 text-secondary" />
                        </div>
                        <h3 className="text-2xl font-bold mb-2">Your wishlist is empty</h3>
                        <p className="text-muted-foreground mb-8">Save items you love to keep track of them.</p>
                        <Link to="/shop" className="bg-secondary text-white px-8 py-3 rounded-xl font-bold inline-block">
                          EXPLORE BOOKS
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'partner' && (
                <div className="space-y-8">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Partner Portal</h1>
                    <p className="text-muted-foreground font-medium">Access your partnership dashboard and resources</p>
                  </header>

                  <div className="bg-primary/5 border border-primary/10 rounded-[2.5rem] p-8 md:p-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
                      <Briefcase className="w-10 h-10 text-primary" />
                    </div>
                    <div className="max-w-md mx-auto space-y-4">
                      <h3 className="text-2xl font-black">Welcome to the Partner Portal</h3>
                      <p className="text-muted-foreground">
                        You have been authorized as a ReadMart partner. Click the button below to access your management dashboard.
                      </p>
                    </div>
                    <Link 
                      to="/admin-login" 
                      state={{ targetRole: 'partner' }}
                      className="inline-flex items-center gap-3 bg-primary text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-primary/20"
                    >
                      GO TO DASHBOARD
                      <ExternalLink className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'author' && (
                <div className="space-y-8">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Author Portal</h1>
                    <p className="text-muted-foreground font-medium">Manage your publications and track your performance</p>
                  </header>

                  <div className="bg-purple-500/5 border border-purple-500/10 rounded-[2.5rem] p-8 md:p-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-purple-500/10 rounded-3xl flex items-center justify-center mx-auto">
                      <PenTool className="w-10 h-10 text-purple-500" />
                    </div>
                    <div className="max-w-md mx-auto space-y-4">
                      <h3 className="text-2xl font-black">Welcome to the Author Portal</h3>
                      <p className="text-muted-foreground">
                        You have been authorized as a ReadMart author. Click the button below to access your manuscript and sales dashboard.
                      </p>
                    </div>
                    <Link 
                      to="/admin-login" 
                      state={{ targetRole: 'author' }}
                      className="inline-flex items-center gap-3 bg-purple-600 text-white px-10 py-5 rounded-2xl font-black hover:scale-105 transition-all shadow-xl shadow-purple-600/20"
                    >
                      GO TO DASHBOARD
                      <ExternalLink className="w-5 h-5" />
                    </Link>
                  </div>
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="space-y-12">
                  <header>
                    <h1 className="text-4xl font-black uppercase tracking-tight mb-2">Account Settings</h1>
                    <p className="text-muted-foreground font-medium">Customize your ReadMart experience</p>
                  </header>

                  <div className="space-y-6">
                    <section className="space-y-6">
                      <h3 className="text-xl font-black uppercase tracking-tight">Preferences</h3>
                      <div className="space-y-4">
                        <div className="glass p-6 rounded-3xl flex items-center justify-between border-white/5">
                          <div className="flex items-center gap-4">
                            <div className="p-3 glass rounded-xl text-primary"><Clock className="w-5 h-5" /></div>
                            <div>
                              <p id="sms-updates-label" className="font-black text-sm uppercase tracking-widest">Order Updates</p>
                              <p className="text-xs text-muted-foreground">Receive SMS for delivery status</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            role="switch"
                            aria-checked={profile?.preferences?.sms_notifications}
                            aria-labelledby="sms-updates-label"
                            onClick={toggleSMS}
                            className={`w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors ${
                              profile?.preferences?.sms_notifications ? 'bg-primary' : 'bg-white/10'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${
                              profile?.preferences?.sms_notifications ? 'right-1' : 'left-1'
                            }`} />
                          </button>
                        </div>
                        <div className="glass p-6 rounded-3xl flex items-center justify-between border-white/5">
                          <div className="flex items-center gap-4">
                            <div className="p-3 glass rounded-xl text-secondary"><Star className="w-5 h-5" /></div>
                            <div>
                              <p id="newsletter-label" className="font-black text-sm uppercase tracking-widest">Newsletter</p>
                              <p className="text-xs text-muted-foreground">Weekly book recommendations</p>
                            </div>
                          </div>
                          <button 
                            type="button"
                            role="switch"
                            aria-checked={profile?.preferences?.newsletter}
                            aria-labelledby="newsletter-label"
                            onClick={toggleNewsletter}
                            className={`w-12 h-6 rounded-full relative p-1 cursor-pointer transition-colors ${
                              profile?.preferences?.newsletter ? 'bg-secondary' : 'bg-white/10'
                            }`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${
                              profile?.preferences?.newsletter ? 'right-1' : 'left-1'
                            }`} />
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-6">
                      <h3 className="text-xl font-black uppercase tracking-tight">Payment Methods</h3>
                      
                      <div className="space-y-4">
                        {isLoadingPayments ? (
                          <div className="flex justify-center py-12">
                            <Loader2 className="w-8 h-8 text-primary animate-spin" />
                          </div>
                        ) : paymentMethods.length > 0 ? (
                          paymentMethods.map((method) => (
                            <div key={method.id} className="glass p-6 rounded-3xl flex items-center justify-between border-white/5 group">
                              <div className="flex items-center gap-4">
                                <div className="p-3 glass rounded-xl text-primary">
                                  <Phone className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-black text-sm uppercase tracking-widest">{method.provider}</p>
                                  <p className="text-xs text-muted-foreground">{method.identifier}</p>
                                </div>
                                {method.is_default && (
                                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">Default</span>
                                )}
                              </div>
                              <button 
                                onClick={() => deletePaymentMethod(method.id)}
                                className="p-2 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        ) : null}

                        {!isAddingPayment && !isLoadingPayments ? (
                          <button 
                            onClick={() => setIsAddingPayment(true)}
                            className="w-full glass p-6 rounded-3xl border-dashed border-white/20 flex items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:border-primary/50 transition-all"
                          >
                            <CreditCard className="w-5 h-5" />
                            <span className="font-black text-sm uppercase tracking-widest">Add New Payment Method</span>
                          </button>
                        ) : isAddingPayment ? (
                          <form onSubmit={handleAddPayment} className="glass p-8 rounded-3xl border-primary/30 space-y-6">
                            <div className="flex items-center justify-between mb-2">
                              <label htmlFor="mpesa_number" className="font-black uppercase text-sm tracking-widest cursor-pointer">Add M-Pesa Number</label>
                              <button 
                                type="button" 
                                onClick={() => setIsAddingPayment(false)}
                                className="text-muted-foreground hover:text-white"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="space-y-4">
                              <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                                <input 
                                  id="mpesa_number"
                                  name="mpesa_number"
                                  type="tel" 
                                  placeholder="e.g. 254794129958"
                                  value={newPaymentPhone}
                                  onChange={(e) => setNewPaymentPhone(e.target.value)}
                                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 font-bold focus:border-primary/50 outline-none transition-all"
                                  required
                                />
                              </div>
                              <button 
                                type="submit"
                                className="w-full bg-primary text-white py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-[1.02] transition-all shadow-xl shadow-primary/20"
                              >
                                Save Payment Method
                              </button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
